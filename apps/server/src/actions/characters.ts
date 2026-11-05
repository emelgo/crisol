/**
 * Los personajes de una campaña (docs/specs/personajes.md § personaje, ADR-0013): cada uno ve y cambia los suyos; el
 * máster de la campaña, todos (y su dueño). Lo de otro, para quien no puede verlo, no existe
 */
import {
  type Character,
  type CharacterCard,
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  listCharacterVersions,
  restoreCharacterVersion,
  updateCharacter
} from '@crisol/contracts'
import { charactersRepo, membersRepo } from '@crisol/db'
import { authorize, can, NotFoundError } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

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

export const characterActions = [
  implement(listCharacters, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const master = isMaster(ctx, campaignId, campaign.worldId)
    const rows = await charactersRepo.listCharacters(ctx.db, campaignId, master ? undefined : ctx.actor.userId)
    return { characters: rows.map(cardOf) }
  }),

  implement(getCharacter, async (ctx, { characterId }) => {
    const { row } = await readable(ctx, characterId)
    return { character: characterOf(row) }
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
    return { character: characterOf(row) }
  }),

  implement(updateCharacter, async (ctx, { characterId, version, ownerId, confirm, ...given }) => {
    const { row } = await readable(ctx, characterId)
    const patch: charactersRepo.CharacterPatch = { ...given }
    if (ownerId !== undefined && ownerId !== row.ownerId) {
      authorize(ctx.actor, 'characters.manage', { campaignId: row.campaignId, worldId: row.worldId })
      if (ownerId) await assertMember(ctx, row.campaignId, ownerId)
      patch.ownerId = ownerId
    }
    if (confirm === 'created') patch.status = 'ready'
    const level = row.summary.level ?? 1
    const details: Record<string, unknown> = { name: given.name ?? row.name }
    if (given.name && given.name !== row.name) details.from = row.name
    if (patch.ownerId !== undefined) details.owner = true
    if (confirm) details.confirm = confirm
    const saved = await updated(() =>
      charactersRepo.updateCharacter(
        ctx.db,
        historyContext(ctx, 'updateCharacter', details, row),
        characterId,
        version,
        patch,
        confirm ? { kind: confirm, level } : undefined
      )
    )
    const fresh = await charactersRepo.findCharacter(ctx.db, saved.id)
    if (!fresh) throw new NotFoundError('character')
    return { character: characterOf(fresh) }
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
    return { character: characterOf(fresh) }
  })
]
