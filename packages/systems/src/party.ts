/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): sus contenedores, sus objetos (del compendio o escritos
 * a mano) y sus monedas; y moverlos con lo que lleva cada personaje sin duplicarlos. Todo puro: el servidor lo guarda
 * en una sola operación
 */
import { characterType } from './builder.ts'
import type { Field, System } from './format.ts'
import { own } from './own.ts'
import type { Play, PlayItem } from './play.ts'
import type { Text } from './text.ts'

/** El contenedor de serie, que no se borra */
export const PARTY_CONTAINER = 'grupo'
export const PARTY_LIMITS = { items: 500, containers: 20, quantity: 100_000, coins: 1_000_000_000 }

export interface PartyContainer {
  id: string
  name: string
}

export interface PartyItem {
  id: string
  /** Del compendio, su clave; escrito a mano, null */
  key: string | null
  /** Su nombre: el que tenía al ponerlo (lo del compendio) o el escrito */
  name: string
  note?: string
  quantity: number
  container: string
}

export interface Party {
  containers: PartyContainer[]
  items: PartyItem[]
  coins: Record<string, number>
}

export class PartyError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const emptyParty = (): Party => ({ containers: [], items: [], coins: {} })

/** Sus contenedores, con el de serie delante (aunque no esté guardado) */
export const partyContainers = (party: Party): PartyContainer[] =>
  party.containers.some((c) => c.id === PARTY_CONTAINER)
    ? party.containers
    : [{ id: PARTY_CONTAINER, name: '' }, ...party.containers]

/** Lo del grupo en un sistema: el campo de objetos del personaje (y sus tipos) y su grupo de monedas */
export interface PartyFields {
  items: { field: string; types: string[] } | null
  coins: { field: string; label: Text; coins: { key: string; label: Text }[] } | null
}

const isCoins = (f: Field) =>
  f.kind === 'group' &&
  Object.keys(f.fields).length > 0 &&
  // Enteros sin tope (las salvaciones de muerte, de 0 a 3, no son monedas)
  Object.values(f.fields).every((sub) => sub.kind === 'number' && sub.integer === true && sub.max === undefined)

/** Los dice `party`; si no, el primer campo de objetos y el primer grupo de números que se cambian jugando */
export function partyFields(system: System): PartyFields {
  const type = characterType(system)
  const fields = type ? (system.types[type]?.fields ?? {}) : {}
  const named = (key: string | undefined) => (key && own(fields, key) ? fields[key] : undefined)
  const itemsKey =
    (named(system.party?.items)?.kind === 'items' ? system.party?.items : undefined) ??
    Object.entries(fields).find(([, f]) => f.kind === 'items' && f.play)?.[0]
  const coinsKey =
    (named(system.party?.coins) && isCoins(named(system.party?.coins) as Field) ? system.party?.coins : undefined) ??
    Object.entries(fields).find(([, f]) => f.play && isCoins(f))?.[0]
  const itemsField = itemsKey ? fields[itemsKey] : undefined
  const coinsField = coinsKey ? fields[coinsKey] : undefined
  return {
    items: itemsKey && itemsField?.kind === 'items' ? { field: itemsKey, types: itemsField.of } : null,
    coins:
      coinsKey && coinsField?.kind === 'group'
        ? {
            field: coinsKey,
            label: coinsField.label,
            coins: Object.entries(coinsField.fields).map(([key, f]) => ({ key, label: f.label }))
          }
        : null
  }
}

const positive = (quantity: number, what: string) => {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PARTY_LIMITS.quantity)
    throw new PartyError('BAD_QUANTITY', `${what}: la cantidad tiene que ser un entero de 1 en adelante`)
}

/** Saca del grupo una cantidad de un objeto (si es toda, se va); da lo que sale */
export function takeFromParty(party: Party, itemId: string, quantity: number): { party: Party; taken: PartyItem } {
  const item = party.items.find((i) => i.id === itemId)
  if (!item) throw new PartyError('NOT_IN_PARTY', 'ese objeto no está en el grupo')
  positive(quantity, item.name)
  if (quantity > item.quantity)
    throw new PartyError('NOT_ENOUGH', `del grupo solo hay ${item.quantity} de «${item.name}»`)
  const items =
    quantity === item.quantity
      ? party.items.filter((i) => i.id !== itemId)
      : party.items.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i))
  return { party: { ...party, items }, taken: { ...item, quantity } }
}

/** Pone en un contenedor del grupo: lo del compendio se junta con lo igual (misma clave, sin nota) */
export function putInParty(
  party: Party,
  thing: { key: string | null; name: string; note?: string | undefined },
  quantity: number,
  container: string,
  newId: () => string
): Party {
  positive(quantity, thing.name)
  if (!partyContainers(party).some((c) => c.id === container))
    throw new PartyError('NO_CONTAINER', 'ese contenedor no está en el grupo')
  const same = thing.key
    ? party.items.find((i) => i.key === thing.key && i.container === container && !i.note && !thing.note)
    : undefined
  if (same) {
    const total = same.quantity + quantity
    if (total > PARTY_LIMITS.quantity) throw new PartyError('BAD_QUANTITY', `demasiados «${same.name}»`)
    return { ...party, items: party.items.map((i) => (i.id === same.id ? { ...i, quantity: total } : i)) }
  }
  if (party.items.length >= PARTY_LIMITS.items)
    throw new PartyError('PARTY_FULL', `el grupo lleva como mucho ${PARTY_LIMITS.items} objetos`)
  const item: PartyItem = {
    id: newId(),
    key: thing.key,
    name: thing.name.trim().slice(0, 200) || thing.key || '—',
    ...(thing.note?.trim() ? { note: thing.note.trim().slice(0, 500) } : {}),
    quantity,
    container
  }
  return { ...party, items: [...party.items, item] }
}

/** Saca de lo que lleva un personaje (si es todo, deja de llevarlo y se van sus usos); da lo que sale */
export function takeFromPlay(play: Play, itemId: string, quantity: number): { play: Play; taken: PlayItem } {
  const item = (play.items ?? []).find((i) => i.id === itemId)
  if (!item) throw new PartyError('NOT_CARRIED', 'no lleva ese objeto')
  positive(quantity, item.key)
  const has = item.quantity ?? 1
  if (quantity > has) throw new PartyError('NOT_ENOUGH', `solo lleva ${has}`)
  if (quantity < has)
    return {
      play: {
        ...play,
        items: (play.items ?? []).map((i) => (i.id === itemId ? { ...i, quantity: has - quantity } : i))
      },
      taken: { ...item, quantity }
    }
  const { [itemId]: _, ...uses } = play.uses ?? {}
  const rest: Play = { ...play, items: (play.items ?? []).filter((i) => i.id !== itemId) }
  if (play.uses) rest.uses = uses
  if (play.active) rest.active = play.active.filter((a) => a !== itemId && !a.startsWith(`${itemId}:`))
  return { play: rest, taken: { ...item, quantity } }
}

/** Pone en lo que lleva un personaje: se junta con lo igual que no lleve equipado ni tenga usos gastados */
export function putInPlay(play: Play, key: string, quantity: number, newId: () => string): Play {
  positive(quantity, key)
  const items = play.items ?? []
  const same = items.find((i) => i.key === key && !i.equipped && !i.attuned && !play.uses?.[i.id])
  if (same)
    return {
      ...play,
      items: items.map((i) => (i.id === same.id ? { ...i, quantity: (i.quantity ?? 1) + quantity } : i))
    }
  if (items.length >= 500) throw new PartyError('PLAY_FULL', 'ese personaje ya lleva demasiadas cosas')
  return { ...play, items: [...items, { id: newId(), key, quantity }] }
}

export type Coins = Record<string, number>

/** Las monedas de un personaje, de su grupo de monedas */
export const coinsOf = (play: Play, field: string): Coins => {
  const value = play.values?.[field]
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))
  ) as Coins
}

/** Lo que lleva un personaje con otras monedas */
export const withCoins = (play: Play, field: string, coins: Coins): Play => ({
  ...play,
  values: { ...(play.values ?? {}), [field]: { ...((play.values?.[field] as object | undefined) ?? {}), ...coins } }
})

/** Pasa monedas de un sitio a otro: sin quedar en negativo; solo de las que hay (`allowed`) */
export function moveCoins(
  from: Coins,
  to: Coins,
  amounts: Coins,
  allowed: readonly string[]
): { from: Coins; to: Coins } {
  const nextFrom = { ...from }
  const nextTo = { ...to }
  for (const [coin, amount] of Object.entries(amounts)) {
    if (amount === 0) continue
    if (!allowed.includes(coin)) throw new PartyError('NO_COIN', `no hay monedas «${coin}»`)
    if (!Number.isInteger(amount) || amount < 0 || amount > PARTY_LIMITS.coins)
      throw new PartyError('BAD_QUANTITY', 'las monedas, en enteros de 0 en adelante')
    const has = nextFrom[coin] ?? 0
    if (amount > has) throw new PartyError('NOT_ENOUGH', `solo hay ${has} ${coin}`)
    nextFrom[coin] = has - amount
    nextTo[coin] = (nextTo[coin] ?? 0) + amount
  }
  return { from: nextFrom, to: nextTo }
}

/** Repartir a partes iguales entre tantos: lo de cada uno y lo que sobra (se queda en el grupo) */
export function splitCoins(coins: Coins, among: number): { each: Coins; left: Coins } {
  if (!Number.isInteger(among) || among < 1) throw new PartyError('NO_ONE', 'no hay entre quién repartir')
  const each: Coins = {}
  const left: Coins = {}
  for (const [coin, amount] of Object.entries(coins)) {
    if (!amount) continue
    each[coin] = Math.floor(amount / among)
    left[coin] = amount - each[coin] * among
  }
  return { each, left }
}
