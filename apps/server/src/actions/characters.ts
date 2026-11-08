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
  playCharacter,
  restoreCharacterVersion,
  rollForCharacter,
  updateCharacter,
  visibilitiesFor
} from '@crisol/contracts'
import { campaignsRepo, charactersRepo, membersRepo, systemsRepo } from '@crisol/db'
import { cryptoRoller, rollDice } from '@crisol/dice'
import { authorize, can, NotFoundError } from '@crisol/domain'
import {
  applyChoices,
  type Build,
  type Choices,
  ChooseError,
  type ContentItem,
  catalogSystem,
  changeResource,
  characterView,
  checkBuild,
  normalizeChoices,
  PLAY_BYTES,
  type Play,
  playedDocument,
  playSchema,
  RollError,
  resourcePaths,
  rest,
  type SenseRanges,
  type System,
  sensesOf,
  spend,
  tryAction,
  tryRoll
} from '@crisol/systems'
import { contentSeen } from '../wiki/reader.ts'
import { authorizedCampaign } from './access.ts'
import { withCondition } from './conditions.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { saveRoll, storedOf } from './dice.ts'
import * as layers from './layers.ts'
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

/** El sistema de un personaje (de serie o de la cuenta) y todo su contenido */
async function systemOf(
  ctx: ActionContext,
  systemId: string,
  worldId?: string,
  /** De lo del mundo, solo esto (lo que ya tiene el personaje de un jugador y lo que se le reveló); sin ello, todo */
  only?: (key: string) => boolean
): Promise<{ document: System; content: readonly ContentItem[] }> {
  const catalog = catalogSystem(systemId)
  // El de serie, tal cual (siempre el mismo): así el motor lo tiene ya preparado
  if (catalog) return { document: catalog, content: [] }
  const row = await systemsRepo.findSystem(ctx.db, systemId)
  if (!row) throw new NotFoundError('system')
  const content = await layers.allContent(ctx, row.id, worldId ? { worldId, systemId: row.id } : null)
  return {
    document: row.document as unknown as System,
    content: only ? content.filter((item) => !item.world || only(item.key)) : content
  }
}

/** Los textos que hay en unas elecciones y lo de la partida: entre ellos, las claves del contenido que nombran */
function namedIn(...values: unknown[]): Set<string> {
  const found = new Set<string>()
  const walk = (value: unknown) => {
    if (typeof value === 'string') found.add(value)
    else if (Array.isArray(value)) for (const each of value) walk(each)
    else if (value && typeof value === 'object') for (const each of Object.values(value)) walk(each)
  }
  for (const value of values) walk(value)
  return found
}

/** Lo guardado de un personaje: de lo del mundo, un jugador solo monta con lo que ya nombra */
interface Stored {
  build: unknown
  play?: unknown
}

/**
 * Monta un personaje de sus elecciones, con lo que eligió su campaña de su sistema y el compendio de su mundo. Quien
 * lleva el mundo, con todo lo suyo (lo da a un personaje y el creador lo ofrece); un jugador, con lo del mundo que su
 * personaje ya tiene guardado y lo que se le reveló (docs/specs/compendio-jugadores.md): lo demás ni lo ve en el
 * creador ni lo añade por su clave
 */
async function contextOf(ctx: ActionContext, campaignId: string, systemId: string, stored: Stored, everything = false) {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  if (!campaign) throw new NotFoundError('campaign')
  const wiki = { worldId: campaign.worldId, organizationId: campaign.organizationId }
  // Todo lo del mundo para quien lo ve (o para calcular en el servidor); si no, solo lo que ya tiene el personaje
  let only: ((key: string) => boolean) | undefined
  const player = !everything && !can(ctx.actor, 'worldContent.read', wiki)
  const named = player ? namedIn(stored.build, stored.play) : new Set<string>()
  if (player) {
    const seen = await contentSeen(ctx, wiki, campaignId)
    only = (key) => named.has(key) || (seen?.(key) ?? false)
  }
  const found = await systemOf(ctx, systemId, campaign.worldId, only)
  // Un jugador no ve los tipos que su campaña le oculta (docs/specs/compendio-jugadores.md), salvo lo que ya lleva
  const hidden = player ? (campaign.hiddenTypes ?? []) : []
  const content =
    hidden.length > 0
      ? found.content.filter((item) => !hidden.includes(item.type) || named.has(item.key))
      : found.content
  const document = found.document
  const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
  return { document, content, choices }
}

async function stateOf(
  ctx: ActionContext,
  campaignId: string,
  systemId: string,
  build: Record<string, unknown>,
  play: Record<string, unknown> = {},
  stored: Stored = { build, play }
) {
  const { document, content, choices } = await contextOf(ctx, campaignId, systemId, stored)
  return { ...characterView(document, content, choices, build as Build, play as Play), document }
}

/**
 * Lo que hace falta para montar los personajes de una campaña con su sistema (todo su contenido, con lo del mundo, y
 * lo que elige la campaña): se carga una vez, antes de bloquear nada (al mover algo con el grupo)
 */
export async function charactersContext(ctx: ActionContext, campaignId: string, systemId: string) {
  return contextOf(ctx, campaignId, systemId, { build: {} }, true)
}

/** El resumen de un personaje (su tarjeta) con otro «play», con lo ya cargado */
export const summaryIn = (
  context: Awaited<ReturnType<typeof charactersContext>>,
  build: Record<string, unknown>,
  play: Record<string, unknown>
) => characterView(context.document, context.content, context.choices, build as Build, play as Play).view.summary

/** Lo vital de un personaje para su ficha en la mesa: su vida (su primer recurso), sus primeras cifras y sus estados */
export interface CharacterVitals {
  name: string
  version: number
  life: { value: number; max: number; temp: number } | null
  stats: Array<{ key: string; label: string; value: string }>
  conditions: NonNullable<Play['conditions']>
  /** Sus sentidos para la niebla de la mesa, en la unidad de la rejilla (donde dice su sistema) */
  senses: SenseRanges
}

/**
 * Lo vital ya calculado de cada personaje, por lo que lo decide (ver abajo): montar su hoja con todo el contenido del
 * sistema cuesta, y la mesa lo pide con cada cambio (al soltar una ficha, también). Lo del mundo no cuenta en la
 * clave: un cambio en su compendio se ve, como mucho, al minuto
 */
const vitalsKept = new Map<string, { at: number; vitals: CharacterVitals }>()
const VITALS_TTL_MS = 60_000
const VITALS_KEEP = 2000

/** Lo de la campaña que decide lo vital de sus personajes (si quien llama ya la tiene leída) */
type VitalsCampaign = { id: string; version: number; system: string | null }

/**
 * Lo vital de unos personajes de una campaña, para la mesa (ADR-0018). No autoriza: lo hace quien llama. Se carga el
 * contexto de cada sistema una vez. Con la campaña ya leída no se vuelve a leer
 */
export async function characterVitalsOf(
  ctx: ActionContext,
  of: string | VitalsCampaign,
  ids: readonly string[] | Promise<readonly string[]>
): Promise<Map<string, CharacterVitals>> {
  const vitals = new Map<string, CharacterVitals>()
  if (Array.isArray(ids) && ids.length === 0) return vitals
  const given = typeof of === 'string' ? null : of
  const campaignId = given?.id ?? (of as string)
  // A la vez la lista, la versión del sistema de la campaña (el de casi todos sus personajes) y, si aún se están
  // leyendo, los que se piden (las fichas de una escena): menos vueltas a la base
  const [listed, campaign, guessed, asked] = await Promise.all([
    charactersRepo.listCharacters(ctx.db, campaignId),
    given ?? campaignsRepo.findCampaign(ctx.db, campaignId),
    systemsRepo.systemVersions(ctx.db, given?.system ? [given.system] : []),
    ids
  ])
  const wanted = new Set(asked)
  const rows = listed.filter((r) => wanted.has(r.id))
  const contexts = new Map<string, Awaited<ReturnType<typeof charactersContext>> | null>()
  // Lo que decide su hoja: él (su versión), su sistema (la suya) y lo que elige la campaña (la suya)
  const missing = [...new Set(rows.map((r) => r.system))].filter((id) => id !== given?.system)
  const versions = [...guessed, ...(await systemsRepo.systemVersions(ctx.db, missing))]
  const systems = new Map(versions.map((s) => [s.id, `${s.version}:${s.deletedAt ?? ''}`]))
  const now = Date.now()
  for (const row of rows) {
    const key = `${campaignId}:${row.id}:${row.version}:${row.system}:${systems.get(row.system) ?? 'catalog'}:${campaign?.version ?? 0}`
    const kept = vitalsKept.get(key)
    if (kept && now - kept.at < VITALS_TTL_MS) {
      vitals.set(row.id, kept.vitals)
      continue
    }
    const play = row.play as Play
    let context = contexts.get(row.system)
    if (context === undefined) {
      context = await charactersContext(ctx, campaignId, row.system).catch(() => null)
      contexts.set(row.system, context)
    }
    let life: CharacterVitals['life'] = null
    let stats: CharacterVitals['stats'] = []
    let senses: SenseRanges = {}
    if (context) {
      try {
        const { view, built } = characterView(
          context.document,
          context.content,
          context.choices,
          row.build as Build,
          play
        )
        const [first] = resourcePaths(context.document.types[built.type]?.fields ?? {})
        const at = first
          ? (first.path
              .split('.')
              .reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], view.sheet) as
              | { value?: number; max?: number; temp?: number }
              | undefined)
          : undefined
        if (typeof at?.max === 'number') life = { value: at.value ?? at.max, max: at.max, temp: at.temp ?? 0 }
        stats = view.summary.stats ?? []
        senses = sensesOf(context.document, view.sheet as Record<string, unknown>)
      } catch {
        // Un personaje a medio crear: sin vida que enseñar
      }
    }
    const made = { name: row.name, version: row.version, life, stats, conditions: play.conditions ?? [], senses }
    vitals.set(row.id, made)
    vitalsKept.set(key, { at: now, vitals: made })
    if (vitalsKept.size > VITALS_KEEP) vitalsKept.delete(vitalsKept.keys().next().value as string)
  }
  return vitals
}

/** Lo de la partida nuevo, con su forma y su tamaño (antes de montarlo) */
export function parsedPlay(given: unknown): Play {
  const parsed = playSchema.safeParse(given)
  if (!parsed.success)
    throw new InvalidRequestError(
      'BAD_PLAY',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('. ')
    )
  if (JSON.stringify(parsed.data).length > PLAY_BYTES) throw new InvalidRequestError('BAD_PLAY', 'demasiado grande')
  return parsed.data
}

/**
 * Lo de la partida nuevo, ya montado: lo que se añade a lo que lleva, que esté en el contenido y se lleve; y los
 * valores, que se cambien jugando y con su forma (lo que ya estaba guardado y no vale se deja fuera, sin más)
 */
function checkedPlay(
  play: Play,
  previous: Play,
  missing: readonly string[],
  played: { refused: readonly string[]; problems: readonly { key: string; message: string }[] }
): Play {
  const before = new Set((previous.items ?? []).map((it) => it.key))
  const added = (play.items ?? []).filter((it) => !before.has(it.key))
  const absent = added.filter((it) => missing.includes(it.key)).map((it) => it.key)
  if (absent.length > 0)
    throw new InvalidRequestError('BAD_PLAY', `no está en el contenido de la campaña: ${absent.join(', ')}`)
  const refused = added.filter((it) => played.refused.includes(it.key)).map((it) => it.key)
  if (refused.length > 0) throw new InvalidRequestError('BAD_PLAY', `no se lleva: ${refused.join(', ')}`)
  const same = (key: string) => JSON.stringify(play.values?.[key]) === JSON.stringify(previous.values?.[key])
  const wrong = played.problems.filter((p) => !same(p.key))
  if (wrong.length > 0) throw new InvalidRequestError('BAD_PLAY', wrong.map((p) => `${p.key}: ${p.message}`).join('. '))
  if (played.problems.length === 0) return play
  const values = { ...(play.values ?? {}) }
  for (const p of played.problems) delete values[p.key]
  return { ...play, values }
}

/** Unas elecciones nuevas que valen: su forma, su tamaño y las reglas de lo que cambia (si no, dice qué falla) */
async function checked(ctx: ActionContext, row: charactersRepo.CharacterRow, given: unknown) {
  const { document, content, choices } = await contextOf(ctx, row.campaignId, row.system, row)
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
  const play = given.play ? parsedPlay(given.play) : undefined
  // Montado con lo nuevo: su resumen se guarda; terminarlo pide lo que su sistema pide
  // Con lo del mundo que ya tenía (si es un jugador): lo nuevo no puede traer más
  const { view, played } = await stateOf(
    ctx,
    row.campaignId,
    row.system,
    patch.build ?? row.build,
    (play ?? row.play) as Record<string, unknown>,
    row
  )
  if (play) patch.play = checkedPlay(play, row.play as Play, view.playMissing, played) as Record<string, unknown>
  if (given.build || play) patch.summary = view.summary
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
  // Otro dueño: lo que el de antes escribía por él (una página de jugadores) se vuelve a mirar
  if (patch.ownerId !== undefined) ctx.collab?.closeWorldPlayers(row.worldId)
  // Su ficha en la mesa (sus PG, sus estados, su nombre)
  ctx.table?.changed(row.campaignId)
  return { character: characterOf(fresh), state: view }
}

export const characterActions = [
  implement(listCharacters, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const master = isMaster(ctx, campaignId, campaign.worldId)
    if (master) return { characters: (await charactersRepo.listCharacters(ctx.db, campaignId)).map(cardOf) }
    // Un jugador: los suyos enteros y, de los demás, los ya hechos en una línea (sus aliados, sin abrirlos)
    const rows = await charactersRepo.listCharacters(ctx.db, campaignId)
    const mine = rows.filter((row) => row.ownerId === ctx.actor.userId)
    const allies = rows
      .filter((row) => row.ownerId !== ctx.actor.userId && row.status === 'ready')
      .map((row) => ({
        id: row.id,
        name: row.name,
        owner: row.ownerId ? { id: row.ownerId, name: row.ownerName ?? '' } : null,
        ...(row.summary.line ? { line: row.summary.line } : {})
      }))
    return { characters: mine.map(cardOf), allies }
  }),

  implement(getCharacter, async (ctx, { characterId }) => {
    const { row } = await readable(ctx, characterId)
    const { view } = await stateOf(ctx, row.campaignId, row.system, row.build, row.play)
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

  implement(rollForCharacter, async (ctx, { characterId, roll, action, visibility }) => {
    const { row } = await readable(ctx, characterId)
    if (Boolean(roll) === Boolean(action)) throw new InvalidRequestError('BAD_ROLL', 'una tirada o una acción')
    const campaign = await authorizedCampaign(ctx, 'dice.roll', row.campaignId)
    const master = can(ctx.actor, 'dice.private', { campaignId: campaign.id, worldId: campaign.worldId })
    if (!master && !visibilitiesFor('player').includes(visibility))
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    const { document, content, choices } = await contextOf(ctx, row.campaignId, row.system, row)
    const { type, document: doc } = playedDocument(document, content, choices, row.build as Build, row.play as Play)
    const options = { roller: cryptoRoller, settings: choices.settings, language: choices.language }
    try {
      if (roll) {
        const result = tryRoll(document, type, doc, roll.key, {
          ...options,
          ...(roll.element ? { element: roll.element } : {}),
          ...(roll.mode !== undefined ? { mode: roll.mode } : {})
        })
        const view = await saveRoll(ctx, campaign, {
          formula: result.formula,
          label: `${row.name} · ${result.label}`,
          visibility,
          result: storedOf(result)
        })
        return { roll: view }
      }
      if (!action) throw new InvalidRequestError('BAD_ROLL', 'una tirada o una acción')
      const rolled = tryAction(document, type, doc, action.item, action.key, {
        ...options,
        ...(action.level !== undefined ? { level: action.level } : {}),
        ...(action.mode !== undefined ? { mode: action.mode } : {}),
        ...(action.critical ? { critical: true } : {})
      })
      const parts =
        action.part === 'attack'
          ? rolled.attack
            ? [{ result: rolled.attack }]
            : []
          : action.part === 'heal'
            ? rolled.heal
              ? [rolled.heal]
              : []
            : rolled.damage
      if (parts.length === 0) throw new InvalidRequestError('BAD_ROLL', 'esa acción no tiene eso')
      const stored = parts.map((p) => storedOf(p.result))
      const view = await saveRoll(ctx, campaign, {
        formula: parts.map((p) => p.result.formula).join(' + '),
        label: `${row.name} · ${rolled.label}${action.part === 'attack' ? '' : action.part === 'heal' ? ' · curación' : ' · daño'}`,
        visibility,
        result: {
          total: stored.reduce((n, p) => n + p.total, 0),
          detail: stored.map((p) => p.detail).join(' + '),
          critical: action.part === 'attack' ? (stored[0]?.critical ?? null) : null,
          dice: stored.flatMap((p) => p.dice),
          // Lo que se aplica después a quien lo recibe: cada parte con su tipo
          ...(action.part === 'attack'
            ? {}
            : {
                apply: {
                  kind: action.part === 'heal' ? ('heal' as const) : ('damage' as const),
                  parts: parts.map((p, i) => ({
                    amount: stored[i]?.total ?? 0,
                    type: (p as { type?: string }).type ?? null
                  }))
                }
              })
        }
      })
      return { roll: view }
    } catch (error) {
      if (error instanceof RollError) throw new InvalidRequestError('BAD_ROLL', error.message)
      throw error
    }
  }),

  implement(
    playCharacter,
    async (ctx, { characterId, version, resource, damage, heal, temp, spend: used, rest: kind, condition }) => {
      const { row } = await readable(ctx, characterId)
      const { view, built, document } = await stateOf(ctx, row.campaignId, row.system, row.build, row.play)
      let play = structuredClone(row.play) as Play
      const paths = resourcePaths(document.types[built.type]?.fields ?? {})
      if (damage !== undefined || heal !== undefined || temp !== undefined) {
        const path = resource ?? paths[0]?.path
        const at = path
          ? (path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], view.sheet) as
              | { max?: number }
              | undefined)
          : undefined
        if (!path || !paths.some((p) => p.path === path) || typeof at?.max !== 'number')
          throw new InvalidRequestError('BAD_PLAY', `no hay un recurso «${resource ?? ''}»`)
        play = changeResource(play, path, at.max, {
          ...(damage !== undefined ? { damage } : {}),
          ...(heal !== undefined ? { heal } : {}),
          ...(temp !== undefined ? { temp } : {})
        })
      }
      if (used) {
        const found = view.resources.find((r) => r.item === used.item && r.key === used.key)
        if (!found) throw new InvalidRequestError('BAD_PLAY', `no hay un uso «${used.key}»`)
        play = spend(play, found, used.by)
      }
      // Lo que vuelve con dados (las cargas de una varita) lo tira el servidor; si no se puede tirar, vuelve todo
      const roll = (formula: string) => {
        try {
          return rollDice(formula, cryptoRoller).total
        } catch {
          return Number.POSITIVE_INFINITY
        }
      }
      if (kind) play = rest(play, view.resources, kind, paths, roll)
      play = withCondition(play, condition)
      return save(ctx, row, version, { play: play as Record<string, unknown> }, undefined)
    }
  ),

  implement(deleteCharacter, async (ctx, { characterId }) => {
    const { row } = await readable(ctx, characterId)
    await charactersRepo.deleteCharacter(
      ctx.db,
      historyContext(ctx, 'deleteCharacter', { name: row.name }, row),
      characterId
    )
    // Con él se va lo que su dueño escribía por él (una página de jugadores para unos personajes)
    ctx.collab?.closeWorldPlayers(row.worldId)
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
    const { view } = await stateOf(ctx, fresh.campaignId, fresh.system, fresh.build, fresh.play)
    return { character: characterOf(fresh), state: view }
  })
]
