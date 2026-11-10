/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): lo ven y lo cambian todos los de la campaña; mover con
 * un personaje, su dueño o el máster; repartir las monedas, el máster. Mover es una sola operación con el grupo y los
 * personajes (historial y deshacer)
 */
import { getParty, moveCoins, moveItem, type Party, splitCoins, updateParty } from '@crisol/contracts'
import { charactersRepo, historyRepo, partyRepo } from '@crisol/db'
import { can, ForbiddenError, NotFoundError } from '@crisol/domain'
import {
  coinsOf,
  emptyParty,
  moveCoins as movedCoins,
  PARTY_CONTAINER,
  PARTY_LIMITS,
  PartyError,
  type Party as PartyValues,
  type Play,
  partyContainers,
  partyFields,
  putInParty,
  putInPlay,
  splitCoins as splitEvenly,
  type Text,
  takeFromParty,
  takeFromPlay,
  textOf,
  visibleContent,
  withCoins
} from '@crisol/systems'
import { partyChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { charactersContext, parsedPlay, summaryIn } from './characters.ts'
import { campaignSystem } from './compendium.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

const newId = () => crypto.randomUUID().slice(0, 8)

const view = (row: partyRepo.PartyRow | null): Party => {
  const values: PartyValues = row
    ? { containers: row.containers, items: row.items, coins: row.coins }
    : { containers: [], items: [], coins: {} }
  return {
    version: row?.version ?? 0,
    containers: partyContainers(values),
    items: values.items.map((i) => ({ ...i, note: i.note ?? null })),
    coins: values.coins
  }
}

/** La campaña, si quien pide es su máster, su sistema y lo del grupo en él */
async function partyContext(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
  const master = can(ctx.actor, 'characters.manage', { campaignId, worldId: campaign.worldId })
  const found = await campaignSystem(ctx, campaignId)
  const fields = found ? partyFields(found.document) : { items: null, coins: null }
  return { campaign, master, found, fields }
}

type Context = Awaited<ReturnType<typeof partyContext>>

/**
 * Lo de los personajes del sistema de la campaña, cargado antes de bloquear nada (dentro del bloqueo no se consulta
 * fuera de la transacción): su contenido entero, para el nombre y el tipo de lo que se mueve y el resumen de cada uno
 */
async function loadedFor(ctx: ActionContext, c: Context) {
  const system = c.campaign.system
  if (!system || !c.found) return null
  const context = await charactersContext(ctx, c.campaign.id, system)
  return { system, context, byKey: new Map(context.content.map((item) => [item.key, item])) }
}

type Loaded = Awaited<ReturnType<typeof loadedFor>>

/** El nombre de una entrada del compendio, de lo ya cargado */
const nameIn = (loaded: Loaded, c: Context, key: string) => {
  const item = loaded?.byKey.get(key)
  return (item && textOf(item.data.name as Text | undefined, c.found?.choices.language ?? 'es')) || key
}

/** Cambia el grupo en una operación; los fallos del motor, como errores de la petición */
async function change(
  ctx: ActionContext,
  c: Context,
  action: string,
  details: Record<string, unknown>,
  version: number | undefined,
  fn: Parameters<typeof partyRepo.changeParty>[4]
) {
  try {
    const done = await partyRepo.changeParty(
      ctx.db,
      historyContext(ctx, action, details, { organizationId: c.campaign.organizationId, worldId: c.campaign.worldId }),
      c.campaign.id,
      version,
      async (party, lock) => {
        try {
          return await fn(party, lock)
        } catch (error) {
          if (error instanceof PartyError) throw new InvalidRequestError(error.code, error.message)
          throw error
        }
      }
    )
    ctx.realtime.publish(
      partyChanged(
        { campaignId: c.campaign.id, worldId: c.campaign.worldId },
        done.characters.map((ch) => ch.id)
      )
    )
    return done
  } catch (error) {
    if (error instanceof partyRepo.PartyChangedError)
      throw new InvalidRequestError('PARTY_CHANGED', 'otro ha cambiado el grupo mientras tanto: vuelve a leerlo')
    throw error
  }
}

/** Un personaje de la campaña con el que quien pide puede mover cosas: el suyo o, el máster, cualquiera */
async function lockedFor(
  c: Context,
  ctx: ActionContext,
  lock: (id: string) => Promise<partyRepo.LockedCharacter | null>,
  id: string
) {
  const character = await lock(id)
  if (!character || (!c.master && character.ownerId !== ctx.actor.userId)) throw new NotFoundError('character')
  return character
}

/** Lo que lleva un personaje, cambiado: con su forma y su tamaño (como al guardar la hoja) y su resumen al día */
function played(loaded: Loaded, character: partyRepo.LockedCharacter, play: Play) {
  const checked = parsedPlay(play) as Record<string, unknown>
  let summary: ReturnType<typeof summaryIn> | null = null
  if (loaded && character.system === loaded.system) {
    try {
      summary = summaryIn(loaded.context, character.build, checked)
    } catch {
      summary = null
    }
  }
  return { id: character.id, play: checked, summary }
}

export const partyActions = [
  implement(getParty, async (ctx, { campaignId }) => {
    const c = await partyContext(ctx, campaignId)
    const row = await partyRepo.findParty(ctx.db, campaignId)
    const characters = await charactersRepo.listCharacters(ctx.db, campaignId, c.master ? undefined : ctx.actor.userId)
    const language = c.found?.choices.language ?? 'es'
    const coinField = c.fields.coins?.field
    const allowed = (c.fields.coins?.coins ?? []).map((coin) => coin.key)
    return {
      party: view(row),
      coins: (c.fields.coins?.coins ?? []).map((coin) => ({ key: coin.key, label: textOf(coin.label, language) })),
      types: c.fields.items?.types ?? [],
      characters: characters.map((ch) => ({
        id: ch.id,
        name: ch.name,
        mine: ch.ownerId === ctx.actor.userId,
        coins: coinField ? coinsOf(ch.play as Play, coinField, allowed) : {}
      })),
      master: c.master,
      moves: row
        ? (await historyRepo.operationsOfRow(ctx.db, 'campaign_party', row.id, 10)).map((op) => ({
            id: op.id,
            action: op.action,
            details: op.details,
            by: op.actorName ?? null,
            ai: op.via === 'ai',
            at: op.createdAt.toISOString()
          }))
        : []
    }
  }),

  implement(updateParty, async (ctx, input) => {
    const { campaignId, version } = input
    const c = await partyContext(ctx, campaignId)
    const given = ['add', 'remove', 'edit', 'addContainer', 'renameContainer', 'removeContainer', 'coins'].filter(
      (k) => input[k as keyof typeof input] !== undefined
    )
    if (given.length !== 1) throw new InvalidRequestError('ONE_CHANGE', 'una cosa por vez')
    // Solo poner las monedas (un valor absoluto) pide la versión; lo demás cambia sobre lo que haya
    if (input.coins !== undefined && version === undefined)
      throw new InvalidRequestError('VERSION_REQUIRED', 'para poner las monedas, la versión que se leyó')
    // Lo que se añade del compendio: algo que se ve en la campaña y cabe en el inventario
    let added: { key: string | null; name: string; note?: string; addedBy?: string } | null = null
    if (input.add) {
      if (input.add.key) {
        const { found } = c
        const seen = found ? visibleContent(found.document, found.entries, found.choices) : []
        const entry = seen.find((s) => s.item.key === input.add?.key)
        if (!entry) throw new NotFoundError('content')
        const types = c.fields.items?.types
        if (types ? !types.includes(entry.item.type) : found?.document.types[entry.item.type]?.document !== 'item')
          throw new InvalidRequestError('NOT_CARRIED_TYPE', 'eso no se lleva en el inventario')
        const language = found?.choices.language ?? 'es'
        added = {
          key: input.add.key,
          name: textOf(entry.item.name as Text | undefined, language) || input.add.key,
          note: input.add.note
        }
      } else if (input.add.name) added = { key: null, name: input.add.name, note: input.add.note }
      else throw new InvalidRequestError('NOTHING_TO_ADD', 'falta su clave o su nombre')
      // «Lo puso»: el personaje de quien lo añade (si tiene uno en la campaña)
      const mine = await charactersRepo.listCharacters(ctx.db, campaignId, ctx.actor.userId)
      if (mine[0]) added.addedBy = mine[0].name
    }
    const details: Record<string, unknown> = { change: given[0] }
    const { row } = await change(
      ctx,
      c,
      'updateParty',
      details,
      input.coins !== undefined ? version : undefined,
      async (party) => {
        // Lo que se dice en el historial: de qué y cuánto (se rellena aquí, antes de guardar la operación)
        const itemName = (id: string) => party.items.find((i) => i.id === id)?.name ?? ''
        const containerName = (id: string) => partyContainers(party).find((x) => x.id === id)?.name ?? ''
        if (input.add) Object.assign(details, { name: added?.name, quantity: input.add.quantity })
        if (input.remove) Object.assign(details, { name: itemName(input.remove.item), quantity: input.remove.quantity })
        if (input.edit) details.name = itemName(input.edit.item)
        if (input.addContainer) details.name = input.addContainer.name
        if (input.renameContainer)
          Object.assign(details, { from: containerName(input.renameContainer.id), name: input.renameContainer.name })
        if (input.removeContainer) details.name = containerName(input.removeContainer.id)
        if (input.add && added)
          return {
            party: putInParty(party, added, input.add.quantity ?? 1, input.add.container ?? PARTY_CONTAINER, newId),
            result: null
          }
        if (input.remove) {
          const item = party.items.find((i) => i.id === input.remove?.item)
          if (!item) throw new PartyError('NOT_IN_PARTY', 'ese objeto no está en el grupo')
          return { party: takeFromParty(party, item.id, input.remove.quantity ?? item.quantity).party, result: null }
        }
        if (input.edit) {
          const { item: id, name, note, container } = input.edit
          const item = party.items.find((i) => i.id === id)
          if (!item) throw new PartyError('NOT_IN_PARTY', 'ese objeto no está en el grupo')
          if (name !== undefined && item.key) throw new PartyError('NAMED_BY_CONTENT', 'su nombre es el del compendio')
          if (container !== undefined && !partyContainers(party).some((x) => x.id === container))
            throw new PartyError('NO_CONTAINER', 'ese contenedor no está en el grupo')
          const edited = {
            ...item,
            ...(name !== undefined ? { name } : {}),
            ...(container !== undefined ? { container } : {})
          }
          if (note !== undefined) {
            if (note.trim()) edited.note = note.trim()
            else delete edited.note
          }
          return { party: { ...party, items: party.items.map((i) => (i.id === id ? edited : i)) }, result: null }
        }
        if (input.addContainer) {
          if (party.containers.filter((x) => x.id !== PARTY_CONTAINER).length >= PARTY_LIMITS.containers)
            throw new PartyError('TOO_MANY_CONTAINERS', `como mucho, ${PARTY_LIMITS.containers} contenedores`)
          return {
            party: { ...party, containers: [...party.containers, { id: newId(), name: input.addContainer.name }] },
            result: null
          }
        }
        if (input.renameContainer) {
          const { id, name } = input.renameContainer
          const containers = partyContainers(party)
          if (!containers.some((x) => x.id === id)) throw new PartyError('NO_CONTAINER', 'ese contenedor no está')
          return {
            party: { ...party, containers: containers.map((x) => (x.id === id ? { id, name } : x)) },
            result: null
          }
        }
        if (input.removeContainer) {
          const { id } = input.removeContainer
          if (id === PARTY_CONTAINER) throw new PartyError('DEFAULT_CONTAINER', 'el del grupo no se quita')
          if (!party.containers.some((x) => x.id === id)) throw new PartyError('NO_CONTAINER', 'ese contenedor no está')
          // Lo de dentro, al de serie (juntando lo igual)
          let next: PartyValues = { ...party, containers: party.containers.filter((x) => x.id !== id) }
          next = { ...next, items: next.items.filter((i) => i.container !== id) }
          for (const item of party.items.filter((i) => i.container === id))
            next = putInParty(next, item, item.quantity, PARTY_CONTAINER, () => item.id)
          return { party: next, result: null }
        }
        // Las monedas, como quedan: solo las del sistema
        const allowed = (c.fields.coins?.coins ?? []).map((coin) => coin.key)
        const coins = input.coins ?? {}
        for (const coin of Object.keys(coins))
          if (!allowed.includes(coin)) throw new PartyError('NO_COIN', `no hay monedas «${coin}»`)
        return { party: { ...party, coins: { ...party.coins, ...coins } }, result: null }
      }
    )
    return { party: view(row) }
  }),

  implement(moveItem, async (ctx, { campaignId, from, to, quantity }) => {
    const c = await partyContext(ctx, campaignId)
    const loaded = await loadedFor(ctx, c)
    const types = c.fields.items?.types
    const details: Record<string, unknown> = {}
    const done = await change(ctx, c, 'moveItem', details, undefined, async (party, lock) => {
      if ('character' in from && 'character' in to && from.character === to.character)
        throw new PartyError('SAME_PLACE', 'ya está ahí')
      // De dónde sale (con lo gastado de sus recursos, que viaja con él)
      let next = party
      let thing: {
        key: string | null
        name: string
        note?: string
        quantity: number
        uses?: Record<string, number>
        addedBy?: string
      }
      let source: partyRepo.LockedCharacter | null = null
      let sourcePlay: Play | null = null
      if ('party' in from) {
        const item = party.items.find((i) => i.id === from.party)
        if (!item) throw new PartyError('NOT_IN_PARTY', 'ese objeto no está en el grupo')
        if ('container' in to && to.container === item.container) throw new PartyError('SAME_PLACE', 'ya está ahí')
        const taken = takeFromParty(party, item.id, quantity ?? item.quantity)
        next = taken.party
        thing = taken.taken
      } else {
        source = await lockedFor(c, ctx, lock, from.character)
        const has = ((source.play as Play).items ?? []).find((i) => i.id === from.item)
        if (!has) throw new PartyError('NOT_CARRIED', 'no lleva ese objeto')
        const taken = takeFromPlay(source.play as Play, has.id, quantity ?? has.quantity ?? 1)
        sourcePlay = taken.play
        thing = {
          key: taken.taken.key,
          name: nameIn(loaded, c, taken.taken.key),
          quantity: taken.taken.quantity ?? 1,
          ...(taken.taken.uses ? { uses: taken.taken.uses } : {}),
          // «Lo puso»: el personaje de quien sale
          addedBy: source.name
        }
      }
      // A dónde va
      const plays: ReturnType<typeof played>[] = []
      let target: partyRepo.LockedCharacter | null = null
      if ('container' in to) next = putInParty(next, thing, thing.quantity, to.container, newId)
      else {
        if (!thing.key) throw new PartyError('HANDWRITTEN_STAYS', 'lo escrito a mano se queda en el grupo')
        // Solo lo que se lleva en su inventario
        const type = loaded?.byKey.get(thing.key)?.type
        if (types && (!type || !types.includes(type)))
          throw new PartyError('NOT_CARRIED_TYPE', 'eso no se lleva en el inventario')
        target = await lockedFor(c, ctx, lock, to.character)
        plays.push(played(loaded, target, putInPlay(target.play as Play, thing.key, thing.quantity, newId, thing.uses)))
      }
      if (source && sourcePlay) plays.push(played(loaded, source, sourcePlay))
      // En el historial: qué, cuánto, de dónde y a dónde (el grupo, o el nombre del personaje)
      Object.assign(details, {
        name: thing.name,
        quantity: thing.quantity,
        from: source?.name ?? null,
        to: target?.name ?? null,
        container: 'container' in to ? (partyContainers(next).find((x) => x.id === to.container)?.name ?? '') : null
      })
      return { party: next, plays, result: null }
    })
    return { party: view(done.row), characters: done.characters }
  }),

  implement(moveCoins, async (ctx, { campaignId, character, toParty, coins }) => {
    const c = await partyContext(ctx, campaignId)
    const field = c.fields.coins?.field
    if (!field) throw new InvalidRequestError('NO_COINS', 'su sistema no tiene monedas')
    if (!Object.values(coins).some((n) => n > 0)) throw new InvalidRequestError('NOTHING_TO_MOVE', 'ninguna moneda')
    const allowed = (c.fields.coins?.coins ?? []).map((coin) => coin.key)
    const loaded = await loadedFor(ctx, c)
    const details: Record<string, unknown> = { toParty, coins }
    const done = await change(ctx, c, 'moveCoins', details, undefined, async (party, lock) => {
      const target = await lockedFor(c, ctx, lock, character)
      details.character = target.name
      const own = coinsOf(target.play as Play, field, allowed)
      const moved = toParty
        ? movedCoins(own, party.coins, coins, allowed)
        : movedCoins(party.coins, own, coins, allowed)
      const mine = toParty ? moved.from : moved.to
      const ours = toParty ? moved.to : moved.from
      return {
        party: { ...party, coins: ours },
        plays: [played(loaded, target, withCoins(target.play as Play, field, mine))],
        result: null
      }
    })
    return { party: view(done.row), characters: done.characters }
  }),

  implement(splitCoins, async (ctx, { campaignId, characters, coins, amounts }) => {
    const c = await partyContext(ctx, campaignId)
    if (!c.master) throw new ForbiddenError('splitCoins')
    const field = c.fields.coins?.field
    if (!field) throw new InvalidRequestError('NO_COINS', 'su sistema no tiene monedas')
    const allowed = (c.fields.coins?.coins ?? []).map((coin) => coin.key)
    const loaded = await loadedFor(ctx, c)
    const ids = [...new Set(characters)]
    let each: Record<string, number> = {}
    const details: Record<string, unknown> = { count: ids.length }
    const done = await change(ctx, c, 'splitCoins', details, undefined, async (party, lock) => {
      // Lo que se reparte: las cantidades dichas (de las que hay) o las clases dichas; solo monedas del sistema
      const wanted: Record<string, number> = {}
      for (const coin of allowed) {
        const has = party.coins[coin] ?? 0
        if (amounts) {
          const amount = amounts[coin] ?? 0
          if (amount > has) throw new PartyError('NOT_ENOUGH', `solo hay ${has} ${coin}`)
          if (amount > 0) wanted[coin] = amount
        } else if (!coins || coins.includes(coin)) {
          if (has > 0) wanted[coin] = has
        }
      }
      for (const coin of Object.keys(amounts ?? {}))
        if (!allowed.includes(coin)) throw new PartyError('NO_COIN', `no hay monedas «${coin}»`)
      const split = splitEvenly(wanted, ids.length)
      each = Object.fromEntries(Object.entries(split.each).filter(([, n]) => n > 0))
      if (Object.keys(each).length === 0) throw new PartyError('NOTHING_TO_SPLIT', 'no llega ni a una para cada uno')
      details.each = each
      const plays = []
      for (const id of ids) {
        const target = await lockedFor(c, ctx, lock, id)
        const own = coinsOf(target.play as Play, field, allowed)
        const sum: Record<string, number> = {}
        for (const [coin, n] of Object.entries(each)) {
          sum[coin] = (own[coin] ?? 0) + n
          if (sum[coin] > PARTY_LIMITS.coins)
            throw new PartyError('TOO_MANY_COINS', `${target.name} tendría más de ${PARTY_LIMITS.coins} ${coin}`)
        }
        plays.push(played(loaded, target, withCoins(target.play as Play, field, sum)))
      }
      // Lo que se queda: lo que no se repartió más lo que sobra
      const left = { ...party.coins }
      for (const [coin, n] of Object.entries(each)) left[coin] = (left[coin] ?? 0) - n * ids.length
      return { party: { ...party, coins: left }, plays, result: null }
    })
    return { party: view(done.row), each, characters: done.characters }
  })
]

/**
 * Lo que pide la IA sobre el grupo, dicho como en el historial (para la cola de aprobación): qué, cuánto y los nombres
 * de los personajes y contenedores, en vez de sus ids
 */
export async function partyRequest(
  ctx: ActionContext,
  action: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!['updateParty', 'moveItem', 'moveCoins', 'splitCoins'].includes(action)) return {}
  if (typeof input.campaignId !== 'string') return {}
  const c = await partyContext(ctx, input.campaignId)
  const row = await partyRepo.findParty(ctx.db, c.campaign.id)
  const party: PartyValues = row ? { containers: row.containers, items: row.items, coins: row.coins } : emptyParty()
  const itemName = (id: unknown) => party.items.find((i) => i.id === id)?.name ?? ''
  const containerName = (id: unknown) => partyContainers(party).find((x) => x.id === id)?.name ?? ''
  const characterName = async (id: unknown) => {
    if (typeof id !== 'string') return null
    const found = await charactersRepo.findCharacter(ctx.db, id)
    return found && found.campaignId === c.campaign.id ? found.name : null
  }
  const language = c.found?.choices.language ?? 'es'
  const contentName = (key: unknown) => {
    const entry = c.found?.entries.find((e) => e.key === key)
    return (entry && textOf(entry.name as Text | undefined, language)) || String(key ?? '')
  }
  const of = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})
  if (action === 'updateParty') {
    const add = of(input.add)
    if (input.add)
      return { change: 'add', name: add.key ? contentName(add.key) : add.name, quantity: add.quantity ?? 1 }
    if (input.remove) return { change: 'remove', name: itemName(of(input.remove).item) }
    if (input.edit) return { change: 'edit', name: itemName(of(input.edit).item) }
    if (input.addContainer) return { change: 'addContainer', name: of(input.addContainer).name }
    if (input.renameContainer)
      return {
        change: 'renameContainer',
        from: containerName(of(input.renameContainer).id),
        name: of(input.renameContainer).name
      }
    if (input.removeContainer) return { change: 'removeContainer', name: containerName(of(input.removeContainer).id) }
    return { change: 'coins' }
  }
  if (action === 'moveItem') {
    const from = of(input.from)
    const to = of(input.to)
    const source = from.character ? await characterName(from.character) : null
    const sourceItem = source ? null : party.items.find((i) => i.id === from.party)
    let name = sourceItem?.name ?? ''
    if (from.character) {
      const found = await charactersRepo.findCharacter(ctx.db, String(from.character))
      const key = ((found?.play as Play | undefined)?.items ?? []).find((i) => i.id === from.item)?.key
      name = key ? contentName(key) : ''
    }
    return {
      name,
      quantity: input.quantity ?? sourceItem?.quantity ?? 1,
      from: source,
      to: to.character ? await characterName(to.character) : null,
      container: to.container !== undefined ? containerName(to.container) : null
    }
  }
  if (action === 'moveCoins') return { character: await characterName(input.character) }
  return { count: Array.isArray(input.characters) ? new Set(input.characters).size : 0 }
}
