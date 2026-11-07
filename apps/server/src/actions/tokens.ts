/**
 * Las fichas de la mesa y los encuentros (docs/specs/fichas.md). Las fichas son de la mesa de la campaña: las lleva su
 * máster. Los encuentros son del mundo: los prepara quien lleva la wiki. Lo que cambia se avisa a la sala abierta
 */
import {
  type CreatureInPlay,
  deleteEncounter,
  type EncounterView,
  listEncounters,
  moveTokens,
  placeEncounter,
  placeTokens,
  removeTokens,
  saveEncounter,
  updateToken
} from '@crisol/contracts'
import { charactersRepo, creaturesRepo, filesRepo, scenesRepo, tokensRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { cellCenter } from '@crisol/tabletop'
import { tokenViews } from '../table/projection.ts'
import { authorizedCampaign, authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { sceneOfCampaign } from './scenes.ts'

type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>
type Placed = {
  characterId?: string
  creatureId?: string
  x: number
  y: number
  label: string
  faction: 'group' | 'hostile'
}

/** La inicial de un nombre (sin artículos sueltos ni signos), en mayúscula */
const initial = (name: string) => (name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase()

/** El rótulo corto de una ficha: una copia, su inicial y su número («G3»); lo demás, su primera palabra */
export function shortLabel(name: string, number?: number | null) {
  if (number) return `${initial(name)}${number}`
  return (name.trim().split(/\s+/)[0] ?? name).slice(0, 12)
}

const encounterView = (row: tokensRepo.EncounterRow): EncounterView => ({
  id: row.id,
  worldId: row.worldId,
  systemId: row.systemId,
  name: row.name,
  members: row.members
})

/** Pone en juego una criatura del compendio (copias o la única) con la acción de siempre; la única ya puesta, esa */
async function putInPlay(
  ctx: ActionContext,
  campaign: Campaign,
  key: string,
  count: number,
  unique: boolean,
  hidden?: boolean
) {
  const impl = ctx.actions.get('putInPlay')
  if (!impl) throw new Error('falta la acción putInPlay')
  try {
    const result = (await impl.handler(ctx, {
      campaignId: campaign.id,
      key,
      ...(unique ? { unique: true } : { count }),
      ...(hidden ? { hidden: true } : {})
    })) as { creatures: CreatureInPlay[] }
    return result.creatures
  } catch (error) {
    if (!(error instanceof InvalidRequestError) || error.code !== 'UNIQUE_TAKEN') throw error
    const rows = await creaturesRepo.listCreatures(ctx.db, campaign.id)
    const found = rows.find((r) => r.unique && r.key === key)
    if (!found) throw error
    return [{ id: found.id, name: found.name, number: found.number } as CreatureInPlay]
  }
}

/** Guarda las fichas: las nuevas y, las que ya tenían ficha en la escena, movidas */
async function store(ctx: ActionContext, campaign: Campaign, sceneId: string, placed: Placed[], hidden?: boolean) {
  const existing = await tokensRepo.listTokens(ctx.db, campaign.id, sceneId)
  const holder = (p: Placed) =>
    existing.find((t) => (p.characterId ? t.characterId === p.characterId : t.creatureId === p.creatureId))
  const moves = placed.flatMap((p) => {
    const found = holder(p)
    return found ? [{ id: found.id, patch: { x: p.x, y: p.y } }] : []
  })
  const fresh = placed.filter((p) => !holder(p))
  const context = historyContext(ctx, 'placeTokens', { campaign: campaign.name, count: placed.length }, campaign)
  const inserted = fresh.length
    ? await tokensRepo.insertTokens(
        ctx.db,
        context,
        fresh.map((p) => ({
          worldId: campaign.worldId,
          campaignId: campaign.id,
          sceneId,
          characterId: p.characterId ?? null,
          creatureId: p.creatureId ?? null,
          x: p.x,
          y: p.y,
          label: p.label,
          faction: p.faction,
          hidden: hidden ?? false
        }))
      )
    : []
  const moved = moves.length ? await tokensRepo.updateTokens(ctx.db, context, moves) : []
  ctx.table?.changed(campaign.id)
  // En el orden en que se pidieron
  const order = new Map(placed.map((p, i) => [p.characterId ?? p.creatureId, i]))
  const ids = new Set([...inserted, ...moved].map((t) => t.id))
  return (await tokenViews(ctx, campaign, sceneId))
    .filter((t) => ids.has(t.id))
    .sort((a, b) => (order.get(a.actor.id) ?? 0) - (order.get(b.actor.id) ?? 0))
}

/** La escena de la campaña (de su mundo), con su estado en ella, y el lado de su casilla */
async function sceneFor(ctx: ActionContext, campaign: Campaign, sceneId: string) {
  const scene = await sceneOfCampaign(ctx, campaign.worldId, sceneId)
  await scenesRepo.ensureSceneState(
    ctx.db,
    historyContext(ctx, 'openScene', { campaign: campaign.name, name: scene.name, title: scene.pageTitle }, campaign),
    { worldId: campaign.worldId, campaignId: campaign.id, sceneId }
  )
  return { scene, cell: scene.grid.type === 'none' ? 100 : scene.grid.size }
}

type Where = { x?: number | undefined; y?: number | undefined; column?: number | undefined; row?: number | undefined }

/** El punto, en píxeles: el dado o el centro de la casilla (sin rejilla, casillas de 100 px desde la esquina) */
function pointIn(grid: scenesRepo.SceneRow['grid'], where: Where) {
  if (where.column === undefined || where.row === undefined) return { x: where.x ?? 0, y: where.y ?? 0 }
  const type = grid.type === 'none' ? 'square' : grid.type
  const size = grid.type === 'none' ? 100 : grid.size
  const offset = grid.type === 'none' ? { offsetX: 0, offsetY: 0 } : { offsetX: grid.offsetX, offsetY: grid.offsetY }
  return cellCenter({ type, size, ...offset }, { q: where.column, r: where.row })
}

/** Unas fichas de la campaña por su id; si falta alguna, 404 */
async function ownTokens(ctx: ActionContext, campaignId: string, ids: readonly string[]) {
  const found = await tokensRepo.findTokens(ctx.db, campaignId, ids)
  if (found.length !== new Set(ids).size) throw new NotFoundError('token')
  return found
}

export const tokenActions = [
  implement(placeTokens, async (ctx, { campaignId, sceneId, tokens, hidden }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const { scene, cell } = await sceneFor(ctx, campaign, sceneId)
    const placed: Placed[] = []
    for (const raw of tokens) {
      const item = { ...raw, ...pointIn(scene.grid, raw) }
      if ('characterId' in item) {
        const character = await charactersRepo.findCharacter(ctx.db, item.characterId)
        if (!character || character.campaignId !== campaignId) throw new NotFoundError('character')
        placed.push({
          characterId: character.id,
          x: item.x,
          y: item.y,
          label: shortLabel(character.name),
          faction: 'group'
        })
      } else if ('creatureId' in item) {
        const creature = await creaturesRepo.findCreature(ctx.db, item.creatureId)
        if (!creature || creature.campaignId !== campaignId) throw new NotFoundError('creature')
        placed.push({
          creatureId: creature.id,
          x: item.x,
          y: item.y,
          label: shortLabel(creature.name, creature.number),
          faction: 'hostile'
        })
      } else {
        const { key, count, unique } = item.content
        const created = await putInPlay(ctx, campaign, key, count ?? 1, unique ?? false, hidden)
        // Varias copias, en fila desde donde se soltaron (de cuatro en cuatro)
        for (const [i, creature] of created.entries())
          placed.push({
            creatureId: creature.id,
            x: item.x + (i % 4) * cell,
            y: item.y + Math.floor(i / 4) * cell,
            label: shortLabel(creature.name, creature.number),
            faction: 'hostile'
          })
      }
    }
    return { tokens: await store(ctx, campaign, sceneId, placed, hidden) }
  }),

  implement(moveTokens, async (ctx, { campaignId, moves }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const found = await ownTokens(
      ctx,
      campaignId,
      moves.map((m) => m.tokenId)
    )
    const sceneIds = new Set(found.map((t) => t.sceneId))
    const grids = new Map<string, scenesRepo.SceneRow['grid']>()
    for (const sceneId of sceneIds) {
      const scene = await scenesRepo.findScene(ctx.db, sceneId)
      if (scene) grids.set(sceneId, scene.grid)
    }
    const sceneOf = new Map(found.map((t) => [t.id, t.sceneId]))
    await tokensRepo.updateTokens(
      ctx.db,
      historyContext(ctx, 'moveTokens', { campaign: campaign.name, count: moves.length }, campaign),
      moves.map((m) => {
        const grid = grids.get(sceneOf.get(m.tokenId) ?? '')
        return { id: m.tokenId, patch: grid ? pointIn(grid, m) : { x: m.x ?? 0, y: m.y ?? 0 } }
      })
    )
    ctx.table?.changed(campaignId)
    const ids = new Set(moves.map((m) => m.tokenId))
    const views = []
    for (const sceneId of sceneIds) views.push(...(await tokenViews(ctx, campaign, sceneId)))
    return { tokens: views.filter((t) => ids.has(t.id)) }
  }),

  implement(updateToken, async (ctx, { tokenId, label, faction, size, hidden, image }) => {
    const token = await tokensRepo.findToken(ctx.db, tokenId)
    const campaign = await authorizedCampaign(ctx, 'table.manage', token?.campaignId ?? '')
    if (!token) throw new NotFoundError('token')
    if (image?.fileId) {
      // Una imagen del mundo o común de su organización
      const file = await filesRepo.findFile(ctx.db, image.fileId)
      if (
        file?.kind !== 'image' ||
        (file.worldId !== campaign.worldId &&
          (file.worldId !== null || file.organizationId !== campaign.organizationId))
      )
        throw new InvalidRequestError('BAD_TOKEN_IMAGE')
    }
    await tokensRepo.updateTokens(
      ctx.db,
      historyContext(ctx, 'updateToken', { campaign: campaign.name, label: token.label }, campaign),
      [
        {
          id: tokenId,
          patch: {
            ...(label !== undefined ? { label } : {}),
            ...(faction !== undefined ? { faction } : {}),
            ...(size !== undefined ? { size } : {}),
            ...(hidden !== undefined ? { hidden } : {}),
            ...(image !== undefined ? { image } : {})
          }
        }
      ]
    )
    ctx.table?.changed(campaign.id)
    const view = (await tokenViews(ctx, campaign, token.sceneId)).find((t) => t.id === tokenId)
    if (!view) throw new NotFoundError('token')
    return view
  }),

  implement(removeTokens, async (ctx, { campaignId, tokenIds }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    await ownTokens(ctx, campaignId, tokenIds)
    await tokensRepo.removeTokens(
      ctx.db,
      historyContext(ctx, 'removeTokens', { campaign: campaign.name, count: tokenIds.length }, campaign),
      tokenIds
    )
    ctx.table?.changed(campaignId)
    return { removed: [...new Set(tokenIds)] }
  }),

  implement(listEncounters, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return { encounters: (await tokensRepo.listEncounters(ctx.db, worldId)).map(encounterView) }
  }),

  implement(saveEncounter, async (ctx, { worldId, encounterId, systemId, name, members }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    if (encounterId) {
      const found = await tokensRepo.findEncounter(ctx.db, encounterId)
      if (!found || found.worldId !== worldId) throw new NotFoundError('encounter')
    }
    const saved = await tokensRepo.saveEncounter(
      ctx.db,
      historyContext(ctx, 'saveEncounter', { name }, wiki),
      { worldId, systemId, name, members },
      encounterId
    )
    return encounterView(saved)
  }),

  implement(deleteEncounter, async (ctx, { encounterId }) => {
    const found = await tokensRepo.findEncounter(ctx.db, encounterId)
    const wiki = await authorizedWiki(ctx, 'page.write', found?.worldId ?? '')
    if (!found) throw new NotFoundError('encounter')
    await tokensRepo.deleteEncounter(
      ctx.db,
      historyContext(ctx, 'deleteEncounter', { name: found.name }, wiki),
      found.id
    )
    return { id: found.id }
  }),

  implement(placeEncounter, async (ctx, { campaignId, sceneId, encounterId, ...where }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const encounter = await tokensRepo.findEncounter(ctx.db, encounterId)
    if (!encounter || encounter.worldId !== campaign.worldId) throw new NotFoundError('encounter')
    const { scene, cell } = await sceneFor(ctx, campaign, sceneId)
    const { x, y } = pointIn(scene.grid, where)
    const placed: Placed[] = []
    const skipped: string[] = []
    for (const member of encounter.members) {
      let created: CreatureInPlay[]
      try {
        created = await putInPlay(ctx, campaign, member.key, member.at.length, member.unique)
      } catch (error) {
        // Lo que el compendio de la campaña no tiene (otro sistema, una entrada borrada) se salta y se dice
        if (error instanceof InvalidRequestError || error instanceof NotFoundError) {
          skipped.push(member.key)
          continue
        }
        throw error
      }
      created.forEach((creature, i) => {
        const offset = member.at[i] ?? member.at[0] ?? { dx: 0, dy: 0 }
        placed.push({
          creatureId: creature.id,
          x: x + offset.dx * cell,
          y: y + offset.dy * cell,
          label: shortLabel(creature.name, creature.number),
          faction: 'hostile'
        })
      })
    }
    return { tokens: placed.length ? await store(ctx, campaign, sceneId, placed) : [], skipped }
  })
]
