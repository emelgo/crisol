/**
 * Las fichas de la mesa y los encuentros (docs/specs/fichas.md). Las fichas son de la mesa de la campaña: las lleva su
 * máster. Los encuentros son del mundo: los prepara quien lleva la wiki. Lo que cambia se avisa a la sala abierta
 */
import {
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
import { creaturesChanged } from '../realtime/events.ts'
import { tokenViews, viewsOfTokens, visionOf } from '../table/projection.ts'
import { authorizedCampaign, authorizedWiki, sceneOfCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { creaturesToPlay } from './creatures.ts'
import { implement } from './registry.ts'

type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>
type Placed = {
  characterId?: string
  creatureId?: string
  /** Una criatura que entra en juego con su ficha: su sitio en la tanda (`Newcomers`) */
  fresh?: number
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

/** Una criatura que va a tener ficha: ya en juego (su id) o entrando con ella (su sitio en la tanda) */
export type Joining = { creatureId?: string; fresh?: number; name: string; number: number | null }

/**
 * Las criaturas del compendio que entran en juego al poner unas fichas: se guardan con ellas, en la misma operación
 * (deshacerla lo quita todo). Las copias de una entrada se numeran seguidas aunque vengan en varias veces; la única que
 * ya está en juego (o que ya va en la tanda) es esa
 */
export class Newcomers {
  readonly values: creaturesRepo.CreatureValues[] = []
  private inPlay: Promise<creaturesRepo.CreatureRow[]> | null = null
  private readonly ctx: ActionContext
  private readonly campaignId: string
  constructor(ctx: ActionContext, campaignId: string) {
    this.ctx = ctx
    this.campaignId = campaignId
  }

  /** `reuse: false`: la única que ya está en juego (o en la tanda) no se pone otra vez (sin nada que poner) */
  async add(key: string, count: number, unique: boolean, hidden?: boolean, reuse = true): Promise<Joining[]> {
    if (unique) {
      const queued = this.values.findIndex((v) => v.unique && v.key === key)
      if (queued >= 0) return reuse ? [{ fresh: queued, name: this.values[queued]?.name ?? key, number: null }] : []
      this.inPlay ??= creaturesRepo.listCreatures(this.ctx.db, this.campaignId)
      const found = (await this.inPlay).find((r) => r.unique && r.key === key)
      if (found) return reuse ? [{ creatureId: found.id, name: found.name, number: found.number }] : []
    }
    const reserved = this.values.flatMap((v) => (v.key === key && v.number !== null ? [v.number] : []))
    const input = { campaignId: this.campaignId, key, ...(unique ? { unique: true } : { count }), hidden }
    const { values } = await creaturesToPlay(this.ctx, input, reserved)
    return values.map((value) => {
      this.values.push(value)
      return { fresh: this.values.length - 1, name: value.name, number: value.number }
    })
  }
}

/** Lo que no pudo guardarse porque la única ya entró en juego mientras tanto (dos a la vez) */
function uniqueTaken(error: unknown) {
  const code =
    (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code
  return error instanceof creaturesRepo.UniqueTakenError || code === '23505'
}

/**
 * Guarda las fichas en una operación: las criaturas que entran en juego con ellas, las nuevas y, las que ya tenían
 * ficha en la escena, movidas. Si dos piden la misma, la última
 */
async function store(
  ctx: ActionContext,
  campaign: Campaign,
  sceneId: string,
  asked: Placed[],
  hidden?: boolean,
  newcomers?: Newcomers
) {
  const actor = (p: Placed) => p.characterId ?? p.creatureId ?? `fresh:${p.fresh}`
  const placed = [...new Map(asked.map((p) => [actor(p), p])).values()]
  const existing = await tokensRepo.listTokens(ctx.db, campaign.id, sceneId)
  const holder = (p: Placed) =>
    p.fresh === undefined
      ? existing.find((t) => (p.characterId ? t.characterId === p.characterId : t.creatureId === p.creatureId))
      : undefined
  const moves = placed.flatMap((p) => {
    const found = holder(p)
    return found ? [{ id: found.id, patch: { x: p.x, y: p.y } }] : []
  })
  const fresh = placed.filter((p) => !holder(p))
  const context = historyContext(ctx, 'placeTokens', { campaign: campaign.name, count: placed.length }, campaign)
  let saved: Awaited<ReturnType<typeof tokensRepo.placeTokens>>
  try {
    saved = await tokensRepo.placeTokens(ctx.db, context, {
      creatures: newcomers?.values ?? [],
      tokens: (created) =>
        fresh.map((p) => ({
          worldId: campaign.worldId,
          campaignId: campaign.id,
          sceneId,
          characterId: p.characterId ?? null,
          creatureId: (p.fresh !== undefined ? created[p.fresh]?.id : p.creatureId) ?? null,
          x: p.x,
          y: p.y,
          label: p.label,
          faction: p.faction,
          hidden: hidden ?? false
        })),
      moves
    })
  } catch (error) {
    if (uniqueTaken(error)) throw new InvalidRequestError('UNIQUE_TAKEN', 'esa criatura única ya está en juego')
    throw error
  }
  if (saved.creatures.length > 0)
    ctx.realtime.publish(creaturesChanged({ campaignId: campaign.id, worldId: campaign.worldId }))
  ctx.table?.changed(campaign.id)
  // En el orden en que se pidieron
  const order = new Map(
    placed.map((p, i) => [p.fresh !== undefined ? saved.creatures[p.fresh]?.id : (p.characterId ?? p.creatureId), i])
  )
  const ids = new Set([...saved.inserted, ...saved.moved].map((t) => t.id))
  return (await tokenViews(ctx, campaign, sceneId))
    .filter((t) => ids.has(t.id))
    .sort((a, b) => (order.get(a.actor.id) ?? 0) - (order.get(b.actor.id) ?? 0))
}

/** La escena de la campaña (de su mundo), con su estado en ella, y el lado de su casilla */
async function sceneFor(ctx: ActionContext, campaign: Campaign, sceneId: string) {
  const scene = await sceneOfCampaign(ctx, campaign.worldId, sceneId)
  await scenesRepo.ensureSceneState(
    ctx.db,
    historyContext(
      ctx,
      'openScene',
      { campaign: campaign.name, name: scene.name, title: scene.pageTitle ?? scene.name },
      campaign
    ),
    { worldId: campaign.worldId, campaignId: campaign.id, sceneId }
  )
  return { scene, cell: scene.grid.type === 'none' ? 100 : scene.grid.size }
}

type Where = { x?: number | undefined; y?: number | undefined; column?: number | undefined; row?: number | undefined }

/** El punto, en píxeles: el dado o el centro de la casilla (sin rejilla, casillas de 100 px desde la esquina) */
export function pointIn(grid: scenesRepo.SceneRow['grid'], where: Where) {
  if (where.column === undefined || where.row === undefined) return { x: where.x ?? 0, y: where.y ?? 0 }
  const type = grid.type === 'none' ? 'square' : grid.type
  const size = grid.type === 'none' ? 100 : grid.size
  const offset = grid.type === 'none' ? { offsetX: 0, offsetY: 0 } : { offsetX: grid.offsetX, offsetY: grid.offsetY }
  return cellCenter({ type, size, ...offset }, { q: where.column, r: where.row })
}

/** El orden de las fichas en su escena (como `listTokens`): cuando se pusieron, su rótulo y su id */
function placedOrder(a: tokensRepo.TokenRow, b: tokensRepo.TokenRow) {
  const at = a.createdAt.getTime() - b.createdAt.getTime()
  if (at !== 0) return at
  if (a.label !== b.label) return a.label < b.label ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
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
    const newcomers = new Newcomers(ctx, campaignId)
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
        const joining = await newcomers.add(key, count ?? 1, unique ?? false, hidden)
        // Varias copias, en fila desde donde se soltaron (de cuatro en cuatro)
        for (const [i, creature] of joining.entries())
          placed.push({
            ...(creature.creatureId ? { creatureId: creature.creatureId } : { fresh: creature.fresh }),
            x: item.x + (i % 4) * cell,
            y: item.y + Math.floor(i / 4) * cell,
            label: shortLabel(creature.name, creature.number),
            faction: 'hostile'
          })
      }
    }
    return { tokens: await store(ctx, campaign, sceneId, placed, hidden, newcomers) }
  }),

  implement(moveTokens, async (ctx, { campaignId, moves }) => {
    // Las fichas se leen a la vez que la campaña, pero solo se miran después de autorizar
    const reading = ownTokens(
      ctx,
      campaignId,
      moves.map((m) => m.tokenId)
    )
    reading.catch(() => undefined)
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const found = await reading
    const sceneIds = new Set(found.map((t) => t.sceneId))
    const grids = new Map<string, scenesRepo.SceneRow['grid']>()
    for (const sceneId of sceneIds) {
      const scene = await scenesRepo.findScene(ctx.db, sceneId)
      if (scene) grids.set(sceneId, scene.grid)
    }
    const sceneOf = new Map(found.map((t) => [t.id, t.sceneId]))
    const updated = await tokensRepo.updateTokens(
      ctx.db,
      historyContext(ctx, 'moveTokens', { campaign: campaign.name, count: moves.length }, campaign),
      moves.map((m) => {
        const grid = grids.get(sceneOf.get(m.tokenId) ?? '')
        return { id: m.tokenId, patch: grid ? pointIn(grid, m) : { x: m.x ?? 0, y: m.y ?? 0 } }
      })
    )
    // La vista del grupo se recalcula al soltar, explorando también lo que se ve desde las casillas del camino: lo hace
    // la sala al refrescarse o, si nadie mira, aquí mismo sin esperar
    const destination = new Map(moves.map((m) => [m.tokenId, m]))
    for (const sceneId of sceneIds) {
      const grid = grids.get(sceneId)
      const walked = found
        .filter((t) => t.sceneId === sceneId)
        .map((t) => {
          const move = destination.get(t.id)
          return {
            tokenId: t.id,
            from: { x: t.x, y: t.y },
            to: grid && move ? pointIn(grid, move) : { x: t.x, y: t.y }
          }
        })
      ctx.vision?.walked(campaignId, sceneId, walked)
    }
    ctx.table?.changed(campaignId)
    if (ctx.vision && !ctx.table?.size(campaignId)) {
      const vision = ctx.vision
      for (const sceneId of sceneIds)
        void scenesRepo
          .findScene(ctx.db, sceneId)
          .then((scene) => (scene ? visionOf(ctx, campaign, scene) : null))
          .catch((error: unknown) => vision.report(error))
    }
    // Las movidas, como quedaron al guardarlas (sin volver a leer la escena), en el orden en que se pusieron
    const rows = [...new Map(updated.map((row) => [row.id, row])).values()].sort(placedOrder)
    const { views } = await viewsOfTokens(ctx, campaign, rows)
    return { tokens: views }
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
    const newcomers = new Newcomers(ctx, campaignId)
    for (const member of encounter.members) {
      let joining: Joining[]
      try {
        joining = await newcomers.add(member.key, member.at.length, member.unique)
      } catch (error) {
        // Lo que el compendio de la campaña no tiene (otro sistema, una entrada borrada) se salta y se dice
        if (error instanceof InvalidRequestError || error instanceof NotFoundError) {
          skipped.push(member.key)
          continue
        }
        throw error
      }
      joining.forEach((creature, i) => {
        const offset = member.at[i] ?? member.at[0] ?? { dx: 0, dy: 0 }
        placed.push({
          ...(creature.creatureId ? { creatureId: creature.creatureId } : { fresh: creature.fresh }),
          x: x + offset.dx * cell,
          y: y + offset.dy * cell,
          label: shortLabel(creature.name, creature.number),
          faction: 'hostile'
        })
      })
    }
    return { tokens: placed.length ? await store(ctx, campaign, sceneId, placed, undefined, newcomers) : [], skipped }
  })
]
