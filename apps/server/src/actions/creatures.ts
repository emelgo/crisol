/**
 * Las criaturas en juego de una campaña (docs/specs/criaturas.md): ponerlas en juego desde el compendio (copias
 * numeradas o una única), su hoja (la entrada calculada con lo de la partida encima), lo de la partida, tirar por ellas
 * y quitarlas. Hasta el módulo 5, solo el máster (`creatures.manage`)
 */
import {
  type CreatureInPlay,
  getInPlay,
  listInPlay,
  playCreature,
  putInPlay,
  removeFromPlay,
  rollForCreature
} from '@crisol/contracts'
import { creaturesRepo, systemsRepo } from '@crisol/db'
import { cryptoRoller, rollDice } from '@crisol/dice'
import { authorize, NotFoundError } from '@crisol/domain'
import {
  type Choices,
  type ContentItem,
  changeResource,
  creatureView,
  nextNumbers,
  normalizeChoices,
  type Play,
  playSchema,
  RollError,
  resourcePaths,
  rest,
  type System,
  spend,
  startingPlay,
  type Text,
  textOf,
  tryAction,
  tryRoll,
  visibleContent
} from '@crisol/systems'
import { creaturesChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { saveRoll, storedOf } from './dice.ts'
import * as layers from './layers.ts'
import { implement } from './registry.ts'

const changed = () => new InvalidRequestError('CREATURE_CHANGED', 'la ha cambiado otro mientras tanto: vuelve a leerla')

/** La campaña (si quien pide lleva sus criaturas), su sistema de la cuenta y lo que eligió de él */
async function campaignOf(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'creatures.manage', campaignId)
  const row = campaign.system ? await systemsRepo.findSystem(ctx.db, campaign.system) : null
  // Las criaturas son del compendio: solo con un sistema de la cuenta (Crisol viene vacío, ADR-0015)
  if (!row || row.deletedAt) throw new InvalidRequestError('NO_SYSTEM', 'la campaña no tiene un sistema con compendio')
  const document = row.document as unknown as System
  const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
  const world: layers.WorldLayer = { worldId: campaign.worldId, systemId: row.id }
  return { campaign, row, document, choices, world }
}

type Context = Awaited<ReturnType<typeof campaignOf>>

/** Su entrada y lo que lleva, del compendio de la campaña (las dos capas: quien la pide lleva el mundo) */
async function contentFor(ctx: ActionContext, at: Context, key: string, play: Play) {
  const keys = [key, ...(play.items ?? []).map((i) => i.key)]
  return layers.contentByKeys(ctx, at.row.id, at.world, [...new Set(keys)])
}

/** Su hoja y lo que se ve de ella en la lista */
function viewOf(at: Context, row: creaturesRepo.CreatureRow, content: readonly ContentItem[]) {
  const entry = content.find((c) => c.key === row.key)
  if (!entry) throw new InvalidRequestError('ENTRY_GONE', 'su entrada ya no está en el compendio de la campaña')
  const played = creatureView(at.document, content, at.choices, entry, row.play as Play, row.overrides)
  return { entry, played, card: cardOf(at.document, row, entry, played.view) }
}

/** Lo de la lista: su vida (su primer recurso), sus primeras cifras y cómo está */
function cardOf(
  system: System,
  row: creaturesRepo.CreatureRow,
  entry: ContentItem,
  view: ReturnType<typeof creatureView>['view']
): CreatureInPlay {
  const fields = system.types[entry.type]?.fields ?? {}
  const [first] = resourcePaths(fields)
  const at = first
    ? (first.path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], view.sheet) as
        | { value?: number; max?: number; temp?: number }
        | undefined)
    : undefined
  const life =
    first && typeof at?.max === 'number'
      ? { path: first.path, value: at.value ?? at.max, max: at.max, temp: at.temp ?? 0 }
      : null
  const statsBlock = view.layout.find((b) => b.kind === 'stats') as
    | { fields?: { key: string; label: string }[] }
    | undefined
  const stats = (statsBlock?.fields ?? []).slice(0, 2).flatMap((f) => {
    const value = view.sheet[f.key]
    return typeof value === 'number' || typeof value === 'string'
      ? [{ key: f.key, label: f.label, value: String(value) }]
      : []
  })
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    number: row.number,
    unique: row.unique,
    type: entry.type,
    version: row.version,
    life,
    stats,
    condition: !life ? 'ok' : life.value <= 0 ? 'down' : life.value <= life.max / 2 ? 'bloodied' : 'ok'
  }
}

/** Una criatura en juego, si quien pide lleva las de su campaña; si no, 404 */
async function readable(ctx: ActionContext, creatureId: string) {
  const row = await creaturesRepo.findCreature(ctx.db, creatureId)
  authorize(ctx.actor, 'creatures.manage', { campaignId: row?.campaignId ?? '', worldId: row?.worldId ?? '' })
  if (!row) throw new NotFoundError('creature')
  return { row, at: await campaignOf(ctx, row.campaignId) }
}

/** Lo de la partida sin lo guardado de unos recursos (por su ruta): así vuelven a estar llenos */
function setValues(play: Play, paths: readonly string[]): Play {
  let values = structuredClone(play.values ?? {})
  for (const path of paths) {
    const parts = path.split('.')
    const last = parts.pop()
    const parent = parts.reduce<Record<string, unknown> | undefined>(
      (v, k) => (v?.[k] && typeof v[k] === 'object' ? (v[k] as Record<string, unknown>) : undefined),
      values
    )
    if (parent && last) delete parent[last]
  }
  values = Object.fromEntries(Object.entries(values))
  return { ...play, values }
}

const nameOf = (entry: ContentItem, language: 'es' | 'en') =>
  textOf(entry.data.name as Text | undefined, language) || entry.key

export const creatureActions = [
  implement(listInPlay, async (ctx, { campaignId }) => {
    const at = await campaignOf(ctx, campaignId)
    const rows = await creaturesRepo.listCreatures(ctx.db, campaignId)
    const keys = [...new Set(rows.flatMap((r) => [r.key, ...((r.play as Play).items ?? []).map((i) => i.key)]))]
    const content = await layers.contentByKeys(ctx, at.row.id, at.world, keys)
    // Las que ya no tienen entrada (se borró del compendio) se quedan fuera de la lista
    return {
      creatures: rows.flatMap((row) => {
        try {
          return [viewOf(at, row, content).card]
        } catch {
          return []
        }
      })
    }
  }),

  implement(getInPlay, async (ctx, { creatureId }) => {
    const { row, at } = await readable(ctx, creatureId)
    const { card, played } = viewOf(at, row, await contentFor(ctx, at, row.key, row.play as Play))
    return { creature: card, state: played.view }
  }),

  implement(putInPlay, async (ctx, { campaignId, key, count, formula, unique, hp, name }) => {
    const at = await campaignOf(ctx, campaignId)
    const [entry] = await layers.contentByKeys(ctx, at.row.id, at.world, [key])
    // Que la vea la campaña (sus fuentes; lo del mundo, siempre) y sea una criatura (un actor)
    const visible = entry && visibleContent(at.document, [entry], at.choices).length > 0
    if (!entry || !visible) throw new NotFoundError('content')
    if (at.document.types[entry.type]?.document !== 'actor')
      throw new InvalidRequestError('NOT_A_CREATURE', 'solo se ponen en juego criaturas y personajes (actores)')
    let many = unique ? 1 : (count ?? 1)
    if (!unique && formula) {
      try {
        many = Math.max(1, Math.min(50, rollDice(formula, cryptoRoller).total))
      } catch {
        throw new InvalidRequestError('BAD_FORMULA', `«${formula}» no es una tirada`)
      }
    }
    const base = name ?? nameOf(entry, at.choices.language)
    const existing = await creaturesRepo.listCreatures(ctx.db, campaignId)
    const numbers = unique
      ? [null]
      : nextNumbers(
          existing.filter((r) => r.key === key && r.number !== null).map((r) => r.number as number),
          many
        )
    const values = numbers.map((number) => {
      const start = startingPlay(at.document, entry, {
        hp: hp ?? 'average',
        roller: cryptoRoller,
        language: at.choices.language,
        settings: at.choices.settings
      })
      return {
        campaignId,
        systemId: at.row.id,
        key,
        name: number === null ? base : `${base} ${number}`,
        number,
        unique: Boolean(unique),
        play: start.play as Record<string, unknown>,
        overrides: start.overrides
      }
    })
    let created: Awaited<ReturnType<typeof creaturesRepo.createCreatures>>
    try {
      created = await creaturesRepo.createCreatures(
        ctx.db,
        historyContext(ctx, 'putInPlay', { name: base, count: values.length, unique: Boolean(unique) }, at.campaign),
        values
      )
    } catch (error) {
      if (error instanceof creaturesRepo.UniqueTakenError)
        throw new InvalidRequestError('UNIQUE_TAKEN', `«${base}» ya está en juego`)
      throw error
    }
    ctx.realtime.publish(creaturesChanged({ campaignId, worldId: at.campaign.worldId }))
    const rows = created.map((r) => ({ ...r, worldId: at.campaign.worldId }))
    return { creatures: rows.map((row) => viewOf(at, row, [entry]).card) }
  }),

  implement(
    playCreature,
    async (ctx, { creatureId, version, resource, damage, heal, temp, spend: used, rest: kind, max, rollHp, name }) => {
      const { row, at } = await readable(ctx, creatureId)
      const content = await contentFor(ctx, at, row.key, row.play as Play)
      const { entry, played } = viewOf(at, row, content)
      const fields = at.document.types[entry.type]?.fields ?? {}
      const paths = resourcePaths(fields)
      const pathOf = (given: string | undefined) => {
        const path = given ?? paths[0]?.path
        if (!path || !paths.some((p) => p.path === path))
          throw new InvalidRequestError('BAD_PLAY', `no hay un recurso «${given ?? ''}»`)
        return path
      }
      let play = structuredClone(row.play) as Play
      let overrides = { ...row.overrides }
      if (max) {
        const path = pathOf(max.resource)
        if (max.value === null) delete overrides[path]
        else overrides[path] = max.value
      }
      if (rollHp) {
        const start = startingPlay(at.document, entry, {
          hp: 'rolled',
          roller: cryptoRoller,
          language: at.choices.language,
          settings: at.choices.settings
        })
        if (Object.keys(start.overrides).length === 0)
          throw new InvalidRequestError('NO_HP_ROLL', 'su sistema no dice cómo se tiran sus PG')
        overrides = { ...overrides, ...start.overrides }
        // Tirados otra vez: llenos (sin lo guardado de esos recursos, se ven enteros)
        play = setValues(play, Object.keys(start.overrides))
      }
      if (damage !== undefined || heal !== undefined || temp !== undefined) {
        const path = pathOf(resource)
        // El máximo de ahora (con otro máximo, si se acaba de poner)
        const view =
          max || rollHp ? creatureView(at.document, content, at.choices, entry, play, overrides).view : played.view
        const at2 = path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], view.sheet) as
          | { max?: number }
          | undefined
        if (typeof at2?.max !== 'number') throw new InvalidRequestError('BAD_PLAY', `no hay un recurso «${path}»`)
        play = changeResource(play, path, at2.max, {
          ...(damage !== undefined ? { damage } : {}),
          ...(heal !== undefined ? { heal } : {}),
          ...(temp !== undefined ? { temp } : {})
        })
      }
      if (used) {
        const found = played.view.resources.find((r) => r.item === used.item && r.key === used.key)
        if (!found) throw new InvalidRequestError('BAD_PLAY', `no hay un uso «${used.key}»`)
        play = spend(play, found, used.by)
      }
      // Lo que vuelve con dados (una recarga) lo tira el servidor; si no se puede tirar, vuelve todo
      const roll = (formula: string) => {
        try {
          return rollDice(formula, cryptoRoller).total
        } catch {
          return Number.POSITIVE_INFINITY
        }
      }
      if (kind) play = rest(play, played.view.resources, kind, paths, roll)
      const parsed = playSchema.safeParse(play)
      if (!parsed.success) throw new InvalidRequestError('BAD_PLAY', 'lo de la partida no vale')
      let saved: Awaited<ReturnType<typeof creaturesRepo.updateCreature>>
      try {
        saved = await creaturesRepo.updateCreature(
          ctx.db,
          historyContext(ctx, 'playCreature', { name: row.name }, at.campaign),
          row.id,
          version,
          { play: parsed.data as Record<string, unknown>, overrides, ...(name ? { name } : {}) }
        )
      } catch (error) {
        if (error instanceof creaturesRepo.CreatureChangedError) throw changed()
        throw error
      }
      ctx.realtime.publish(creaturesChanged({ campaignId: row.campaignId, worldId: row.worldId }))
      const fresh = { ...saved, worldId: row.worldId }
      const after = viewOf(at, fresh, await contentFor(ctx, at, fresh.key, fresh.play as Play))
      return { creature: after.card, state: after.played.view }
    }
  ),

  implement(rollForCreature, async (ctx, { creatureId, roll, action, visibility }) => {
    const { row, at } = await readable(ctx, creatureId)
    if (Boolean(roll) === Boolean(action)) throw new InvalidRequestError('BAD_ROLL', 'una tirada o una acción')
    const { entry, played } = viewOf(at, row, await contentFor(ctx, at, row.key, row.play as Play))
    const doc = played.document
    const options = { roller: cryptoRoller, settings: at.choices.settings, language: at.choices.language }
    try {
      if (roll) {
        const result = tryRoll(at.document, entry.type, doc, roll.key, {
          ...options,
          ...(roll.element ? { element: roll.element } : {}),
          ...(roll.mode !== undefined ? { mode: roll.mode } : {})
        })
        const view = await saveRoll(ctx, at.campaign, {
          formula: result.formula,
          label: `${row.name} · ${result.label}`,
          visibility,
          result: storedOf(result)
        })
        return { roll: view }
      }
      if (!action) throw new InvalidRequestError('BAD_ROLL', 'una tirada o una acción')
      const rolled = tryAction(at.document, entry.type, doc, action.item, action.key, {
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
      const view = await saveRoll(ctx, at.campaign, {
        formula: parts.map((p) => p.result.formula).join(' + '),
        label: `${row.name} · ${rolled.label}${action.part === 'attack' ? '' : action.part === 'heal' ? ' · curación' : ' · daño'}`,
        visibility,
        result: {
          total: stored.reduce((n, p) => n + p.total, 0),
          detail: stored.map((p) => p.detail).join(' + '),
          critical: action.part === 'attack' ? (stored[0]?.critical ?? null) : null,
          dice: stored.flatMap((p) => p.dice)
        }
      })
      return { roll: view }
    } catch (error) {
      if (error instanceof RollError) throw new InvalidRequestError('BAD_ROLL', error.message)
      throw error
    }
  }),

  implement(removeFromPlay, async (ctx, { campaignId, creatureIds, copiesOf }) => {
    const campaign = await authorizedCampaign(ctx, 'creatures.manage', campaignId)
    if (!creatureIds && !copiesOf) throw new InvalidRequestError('NOTHING_TO_REMOVE', 'di cuáles (ids o copiesOf)')
    const rows = await creaturesRepo.listCreatures(ctx.db, campaignId)
    const wanted = rows
      .filter((r) => creatureIds?.includes(r.id) || (copiesOf !== undefined && r.key === copiesOf && !r.unique))
      .map((r) => r.id)
    const removed =
      wanted.length > 0
        ? await creaturesRepo.deleteCreatures(
            ctx.db,
            historyContext(ctx, 'removeFromPlay', { count: wanted.length }, campaign),
            campaignId,
            wanted
          )
        : []
    if (removed.length > 0) ctx.realtime.publish(creaturesChanged({ campaignId, worldId: campaign.worldId }))
    return { removed }
  })
]
