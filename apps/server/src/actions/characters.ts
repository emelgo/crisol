/**
 * Los personajes de una campaña (docs/specs/personajes.md § personaje, ADR-0013): cada uno ve y cambia los suyos; el
 * máster de la campaña, todos (y su dueño). Lo de otro, para quien no puede verlo, no existe
 */

import { randomUUID } from 'node:crypto'
import {
  type Character,
  type CharacterCard,
  chooseForCharacter,
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  listCharacterVersions,
  restoreCharacterVersion,
  updateCharacter
} from '@crisol/contracts'
import { campaignsRepo, charactersRepo, membersRepo, systemsRepo } from '@crisol/db'
import { authorize, can, NotFoundError } from '@crisol/domain'
import {
  applyChoices,
  type Build,
  type Choices,
  ChooseError,
  type ContentItem,
  catalogSystem,
  characterView,
  checkBuild,
  normalizeChoices,
  type System
} from '@crisol/systems'
import { catalogContent } from '@crisol/systems/catalog/content'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { contentOf } from './systems.ts'

/** Sin nombre al crearlo */
export const UNNAMED = 'Sin nombre'

const changed = () =>
  new InvalidRequestError('CHARACTER_CHANGED', 'lo ha cambiado otro mientras tanto: vuelve a leerlo')

type Row = Omit<charactersRepo.CharacterRow, 'worldId' | 'organizationId'>

const cardOf = (row: Row): CharacterCard => ({
  id: row.id,
  campaignId: row.campaignId,
  owner: row.ownerId ? { id: row.ownerId, name: row.ownerName ?? '' } : null,
  name: row.name,
  system: row.system,
  status: row.status,
  summary: row.summary,
  version: row.version,
  updatedAt: row.updatedAt.toISOString()
})

const characterOf = (row: Row): Character => ({ ...cardOf(row), build: row.build, play: row.play })

/** Si quien pide es máster de la campaña (o de su mundo): ve y cambia todos sus personajes */
const isMaster = (ctx: ActionContext, campaignId: string, worldId: string) =>
  can(ctx.actor, 'characters.manage', { campaignId, worldId })

/** Un personaje que quien pide puede ver: el suyo o, si es máster de su campaña, cualquiera */
async function readable(ctx: ActionContext, characterId: string) {
  const row = await charactersRepo.findCharacter(ctx.db, characterId)
  if (!row) throw new NotFoundError('character')
  authorize(ctx.actor, 'campaign.read', { campaignId: row.campaignId, worldId: row.worldId })
  const master = isMaster(ctx, row.campaignId, row.worldId)
  if (!master && row.ownerId !== ctx.actor.userId) throw new NotFoundError('character')
  return { row, master }
}

/** Que quien va a jugarlo esté en la campaña */
async function assertMember(ctx: ActionContext, campaignId: string, userId: string) {
  if (!(await membersRepo.findCampaignMember(ctx.db, campaignId, userId)))
    throw new InvalidRequestError('NOT_A_MEMBER', 'quien lo juega tiene que estar en la campaña')
}

async function updated<T>(write: () => Promise<T>) {
  try {
    return await write()
  } catch (error) {
    if (error instanceof charactersRepo.CharacterChangedError) throw changed()
    throw error
  }
}

/** El sistema de un personaje (de serie o de la cuenta) y todo su contenido */
async function systemOf(
  ctx: ActionContext,
  systemId: string
): Promise<{ document: System; content: readonly ContentItem[] }> {
  const catalog = catalogSystem(systemId)
  // El de serie, tal cual (siempre el mismo): así el motor lo tiene ya preparado
  if (catalog) return { document: catalog, content: catalogContent(catalog.id) }
  const row = await systemsRepo.findSystem(ctx.db, systemId)
  if (!row) throw new NotFoundError('system')
  return {
    document: row.document as unknown as System,
    content: (await systemsRepo.listContent(ctx.db, row.id)).map(contentOf)
  }
}

/** Monta un personaje de sus elecciones, con lo que eligió su campaña de su sistema */
async function contextOf(ctx: ActionContext, campaignId: string, systemId: string) {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  if (!campaign) throw new NotFoundError('campaign')
  const { document, content } = await systemOf(ctx, systemId)
  const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
  return { document, content, choices }
}

async function stateOf(ctx: ActionContext, campaignId: string, systemId: string, build: Record<string, unknown>) {
  const { document, content, choices } = await contextOf(ctx, campaignId, systemId)
  return characterView(document, content, choices, build as Build)
}

/** Unas elecciones nuevas que valen: su forma, su tamaño y las reglas de lo que cambia (si no, dice qué falla) */
async function checked(ctx: ActionContext, row: charactersRepo.CharacterRow, given: unknown) {
  const { document, content, choices } = await contextOf(ctx, row.campaignId, row.system)
  const previous = characterView(document, content, choices, row.build as Build)
  const { build, problems } = checkBuild(document, content, choices, given, row.build as Build, previous.view.sheet)
  if (!build || problems.length > 0) throw new InvalidRequestError('BAD_CHOICE', problems.join('. '))
  return build
}

/**
 * Guarda un cambio de un personaje con la versión que se leyó: lo monta con lo nuevo (su resumen se guarda), y
 * terminarlo pide lo que su sistema pide. Al terminarlo o confirmar un nivel, deja una versión suya
 */
async function save(
  ctx: ActionContext,
  row: charactersRepo.CharacterRow,
  version: number,
  given: { name?: string; build?: Record<string, unknown>; play?: Record<string, unknown>; ownerId?: string | null },
  confirm: 'created' | 'level' | undefined
) {
  const { ownerId, ...rest } = given
  const patch: charactersRepo.CharacterPatch = { ...rest }
  if (given.build) patch.build = (await checked(ctx, row, given.build)) as Record<string, unknown>
  if (ownerId !== undefined && ownerId !== row.ownerId) {
    authorize(ctx.actor, 'characters.manage', { campaignId: row.campaignId, worldId: row.worldId })
    if (ownerId) await assertMember(ctx, row.campaignId, ownerId)
    patch.ownerId = ownerId
  }
  // Montado con lo nuevo: su resumen se guarda; terminarlo pide lo que su sistema pide
  const { view } = await stateOf(ctx, row.campaignId, row.system, given.build ?? row.build)
  if (given.build) patch.summary = view.summary
  if (confirm === 'created') {
    if (!view.complete) throw new InvalidRequestError('INCOMPLETE', 'aún le falta algo de lo que pide su sistema')
    patch.status = 'ready'
  }
  const details: Record<string, unknown> = { name: given.name ?? row.name }
  if (given.name && given.name !== row.name) details.from = row.name
  if (patch.ownerId !== undefined) details.owner = true
  if (confirm) details.confirm = confirm
  const saved = await updated(() =>
    charactersRepo.updateCharacter(
      ctx.db,
      historyContext(ctx, 'updateCharacter', details, row),
      row.id,
      version,
      patch,
      confirm ? { kind: confirm, level: view.level } : undefined
    )
  )
  const fresh = await charactersRepo.findCharacter(ctx.db, saved.id)
  if (!fresh) throw new NotFoundError('character')
  return { character: characterOf(fresh), state: view }
}

export const characterActions = [
  implement(listCharacters, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const master = isMaster(ctx, campaignId, campaign.worldId)
    const rows = await charactersRepo.listCharacters(ctx.db, campaignId, master ? undefined : ctx.actor.userId)
    return { characters: rows.map(cardOf) }
  }),

  implement(getCharacter, async (ctx, { characterId }) => {
    const { row } = await readable(ctx, characterId)
    const { view } = await stateOf(ctx, row.campaignId, row.system, row.build)
    return { character: characterOf(row), state: view }
  }),

  implement(createCharacter, async (ctx, { campaignId, name, ownerId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    if (!campaign.system) throw new InvalidRequestError('NO_SYSTEM', 'la campaña aún no tiene sistema')
    const owner = ownerId ?? ctx.actor.userId
    if (owner !== ctx.actor.userId) {
      authorize(ctx.actor, 'characters.manage', { campaignId, worldId: campaign.worldId })
      await assertMember(ctx, campaignId, owner)
    }
    const created = await charactersRepo.createCharacter(
      ctx.db,
      historyContext(
        ctx,
        'createCharacter',
        { name: name ?? UNNAMED, campaign: campaign.name },
        { organizationId: campaign.organizationId, worldId: campaign.worldId }
      ),
      { campaignId, ownerId: owner, name: name ?? UNNAMED, system: campaign.system }
    )
    const row = await charactersRepo.findCharacter(ctx.db, created.id)
    if (!row) throw new NotFoundError('character')
    const { view } = await stateOf(ctx, row.campaignId, row.system, row.build)
    return { character: characterOf(row), state: view }
  }),

  implement(updateCharacter, async (ctx, { characterId, version, ownerId, confirm, ...given }) => {
    const { row } = await readable(ctx, characterId)
    return save(ctx, row, version, { ...given, ...(ownerId !== undefined ? { ownerId } : {}) }, confirm)
  }),

  implement(chooseForCharacter, async (ctx, { characterId, version, confirm, ...choose }) => {
    const { row } = await readable(ctx, characterId)
    const { document } = await systemOf(ctx, row.system)
    let build: Build
    try {
      build = applyChoices(document, row.build as Build, choose, () => randomUUID().slice(0, 8))
    } catch (error) {
      if (error instanceof ChooseError) throw new InvalidRequestError('BAD_CHOICE', error.message)
      throw error
    }
    return save(ctx, row, version, { build: build as Record<string, unknown> }, confirm)
  }),

  implement(deleteCharacter, async (ctx, { characterId }) => {
    const { row } = await readable(ctx, characterId)
    await charactersRepo.deleteCharacter(
      ctx.db,
      historyContext(ctx, 'deleteCharacter', { name: row.name }, row),
      characterId
    )
    return { ok: true as const }
  }),

  implement(listCharacterVersions, async (ctx, { characterId }) => {
    await readable(ctx, characterId)
    const versions = await charactersRepo.listCharacterVersions(ctx.db, characterId)
    return {
      versions: versions.map((v) => ({
        id: v.id,
        kind: v.kind,
        level: v.level,
        name: v.snapshot.name,
        summary: v.snapshot.summary,
        createdAt: v.createdAt.toISOString()
      }))
    }
  }),

  implement(restoreCharacterVersion, async (ctx, { characterId, versionId, version }) => {
    const { row } = await readable(ctx, characterId)
    const versions = await charactersRepo.listCharacterVersions(ctx.db, characterId)
    const chosen = versions.find((v) => v.id === versionId)
    if (!chosen) throw new NotFoundError('character')
    const { name, status, build, play, summary } = chosen.snapshot
    await updated(() =>
      charactersRepo.updateCharacter(
        ctx.db,
        historyContext(ctx, 'restoreCharacterVersion', { name: row.name, kind: chosen.kind, level: chosen.level }, row),
        characterId,
        version,
        { name, status, build, play, summary }
      )
    )
    const fresh = await charactersRepo.findCharacter(ctx.db, characterId)
    if (!fresh) throw new NotFoundError('character')
    const { view } = await stateOf(ctx, fresh.campaignId, fresh.system, fresh.build)
    return { character: characterOf(fresh), state: view }
  })
]
