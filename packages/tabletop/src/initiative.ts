// Portado de packages/mesa/src/nucleo/iniciativa.ts (Crisol actual, commit 3f68f11)
/**
 * El orden de iniciativa y los turnos de un combate (docs/specs/combate.md): funciones puras. Las tiradas se hacen
 * fuera y entran como valores. Los de un mismo grupo (las copias de una criatura) tienen un solo turno; quien está
 * fuera de combate se puede saltar
 */

export interface Combatant {
  id: string
  /** null: aún sin tirar (van al final) */
  initiative: number | null
  /** Lo que suma a su tirada: deshace los empates */
  modifier: number | null
  /** Los de un mismo grupo actúan juntos, en un turno */
  group: string | null
  /** El orden a mano entre los empatados (lo arrastra el máster) */
  sort: number | null
  /** Fuera de combate (a 0) */
  defeated: boolean
}

/** Por dónde va el combate: ronda 0 es antes de empezar; turn, el combatiente cuyo turno es (el primero de su grupo) */
export interface TurnState {
  round: number
  turn: string | null
  skipDefeated: boolean
}

/** Un turno: un combatiente solo o un grupo entero */
export interface Slot<T extends Combatant> {
  key: string
  members: T[]
  /** Todos fuera de combate */
  defeated: boolean
}

export interface TurnChange<T extends Combatant> {
  round: number
  turn: string | null
  /** El turno que empieza (solo al pasar hacia delante): a quien le caducan los estados */
  started: Slot<T> | null
}

/** De mayor a menor; sin número, al final */
const high = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a)
/** De menor a mayor; sin número, al final */
const low = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b)

/**
 * En el orden en que actúan: de mayor a menor iniciativa, los empates por el modificador y luego a mano (a igualdad,
 * como estaban). Un grupo va junto, donde cae el primero de los suyos
 */
export function initiativeOrder<T extends Combatant>(list: readonly T[]): T[] {
  const sorted = list
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        high(a.c.initiative, b.c.initiative) || high(a.c.modifier, b.c.modifier) || low(a.c.sort, b.c.sort) || a.i - b.i
    )
    .map(({ c }) => c)
  const out: T[] = []
  const placed = new Set<string>()
  for (const c of sorted) {
    if (c.group === null) out.push(c)
    else if (!placed.has(c.group)) {
      placed.add(c.group)
      out.push(...sorted.filter((other) => other.group === c.group))
    }
  }
  return out
}

/** Los turnos de una ronda, en orden: cada grupo, uno */
export function turnSlots<T extends Combatant>(list: readonly T[]): Slot<T>[] {
  const slots: Slot<T>[] = []
  for (const c of initiativeOrder(list)) {
    const key = c.group === null ? c.id : `group:${c.group}`
    const last = slots[slots.length - 1]
    if (last?.key === key) last.members.push(c)
    else slots.push({ key, members: [c], defeated: false })
  }
  for (const slot of slots) slot.defeated = slot.members.every((m) => m.defeated)
  return slots
}

/** El turno en el que está un combatiente (-1 si no está) */
export const slotIndexOf = <T extends Combatant>(slots: readonly Slot<T>[], id: string | null) =>
  id === null ? -1 : slots.findIndex((slot) => slot.members.some((m) => m.id === id))

/**
 * El turno siguiente (+1) o el anterior (−1). Desde la ronda 0, el siguiente empieza la 1 con el primero. Al dar la
 * vuelta cambia la ronda; antes del primer turno de la ronda 1 no se vuelve. Salta los turnos fuera de combate si se
 * pide (si lo están todos, no salta)
 */
export function passTurn<T extends Combatant>(list: readonly T[], state: TurnState, step: 1 | -1): TurnChange<T> {
  const same: TurnChange<T> = { round: state.round, turn: state.turn, started: null }
  const slots = turnSlots(list)
  const n = slots.length
  if (n === 0 || (state.round <= 0 && step === -1)) return same
  let round = Math.max(1, state.round)
  let index = state.round <= 0 ? -1 : slotIndexOf(slots, state.turn)
  // Sin turno (se quitó a quien lo tenía): hacia atrás, desde el principio de la ronda
  if (index === -1 && step === -1) index = 0
  const skipping = state.skipDefeated && slots.some((s) => !s.defeated)
  for (let tries = 0; tries < n; tries++) {
    index += step
    if (index >= n) {
      index = 0
      round += 1
    } else if (index < 0) {
      if (round <= 1) return same
      index = n - 1
      round -= 1
    }
    if (!skipping || !slots[index]?.defeated) break
  }
  const slot = slots[index]
  if (!slot) return same
  return { round, turn: slot.members[0]?.id ?? null, started: step === 1 ? slot : null }
}

/**
 * De quién es el turno después de quitar a unos: si queda alguno de su turno (su grupo), el primero de ellos; si no, el
 * siguiente turno que quede (sin empezarlo: no caduca nada). Sin nadie, de nadie
 */
export function turnAfterRemoval<T extends Combatant>(
  list: readonly T[],
  state: TurnState,
  removed: readonly string[]
): string | null {
  const gone = new Set(removed)
  const slots = turnSlots(list)
  const at = slotIndexOf(slots, state.turn)
  if (at === -1) return null
  for (let i = 0; i < slots.length; i++) {
    const left = slots[(at + i) % slots.length]?.members.filter((m) => !gone.has(m.id)) ?? []
    const first = left[0]
    if (first) return first.id
  }
  return null
}
