/**
 * Claves de orden fraccionarias: cadenas que se ordenan comparando sus caracteres uno a uno (en SQL, con la collation
 * "C"). Entre dos claves siempre cabe otra, así que mover una página solo cambia la suya. Cada clave es una parte
 * entera, cuya primera letra dice cuántos dígitos lleva, y una fracción que nunca acaba en cero: así añadir al final o
 * al principio alarga la clave muy despacio
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ZERO = DIGITS.charAt(0)
const LAST = DIGITS.charAt(DIGITS.length - 1)
/** La parte entera más pequeña: no se usa sola, para que siempre quepa otra delante */
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`

/** Cuántos caracteres ocupa la parte entera: a-z, 2 a 27 (positivas); Z-A, 2 a 27 (negativas) */
function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2
  throw new Error(`Clave de orden no válida: ${head}`)
}

function integerPart(key: string): string {
  const length = integerLength(key.charAt(0))
  if (length > key.length) throw new Error(`Clave de orden no válida: ${key}`)
  return key.slice(0, length)
}

function validate(key: string): void {
  if (key === SMALLEST_INTEGER) throw new Error(`Clave de orden no válida: ${key}`)
  const integer = integerPart(key)
  const rest = key.slice(1)
  if ([...rest].some((char) => !DIGITS.includes(char))) throw new Error(`Clave de orden no válida: ${key}`)
  if (key.length > integer.length && key.endsWith(ZERO)) throw new Error(`Clave de orden no válida: ${key}`)
}

/** Una fracción entre a y b (b null: sin tope), las dos sin ceros al final */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`${a} no va antes de ${b}`)
  if (b !== null) {
    // Lo que comparten se queda tal cual
    let n = 0
    while ((a.charAt(n) || ZERO) === b.charAt(n)) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const digitA = a ? DIGITS.indexOf(a.charAt(0)) : 0
  const digitB = b !== null ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length
  if (digitB - digitA > 1) return DIGITS.charAt(Math.round((digitA + digitB) / 2))
  // Dígitos seguidos: con b más largo basta su primer dígito; si no, uno más detrás de a
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return DIGITS.charAt(digitA) + midpoint(a.slice(1), null)
}

function incrementInteger(integer: string): string | null {
  const head = integer.charAt(0)
  const digits = [...integer.slice(1)]
  for (let i = digits.length - 1; i >= 0; i--) {
    const next = DIGITS.indexOf(digits[i] ?? ZERO) + 1
    if (next < DIGITS.length) {
      digits[i] = DIGITS.charAt(next)
      return head + digits.join('')
    }
    digits[i] = ZERO
  }
  // Se llevó una: la parte entera pasa a tener otra longitud
  if (head === 'Z') return `a${ZERO}`
  if (head === 'z') return null
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1)
  if (nextHead > 'a') digits.push(ZERO)
  else digits.pop()
  return nextHead + digits.join('')
}

function decrementInteger(integer: string): string | null {
  const head = integer.charAt(0)
  const digits = [...integer.slice(1)]
  for (let i = digits.length - 1; i >= 0; i--) {
    const previous = DIGITS.indexOf(digits[i] ?? ZERO) - 1
    if (previous >= 0) {
      digits[i] = DIGITS.charAt(previous)
      return head + digits.join('')
    }
    digits[i] = LAST
  }
  if (head === 'a') return `Z${LAST}`
  if (head === 'A') return null
  const previousHead = String.fromCharCode(head.charCodeAt(0) - 1)
  if (previousHead < 'Z') digits.push(LAST)
  else digits.pop()
  return previousHead + digits.join('')
}

/** Una clave entre a y b; null: sin vecina por ese lado (la primera de todas, al principio o al final) */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) validate(a)
  if (b !== null) validate(b)
  if (a !== null && b !== null && a >= b) throw new Error(`${a} no va antes de ${b}`)
  if (a === null) {
    if (b === null) return `a${ZERO}`
    const integerB = integerPart(b)
    if (integerB === SMALLEST_INTEGER) return integerB + midpoint('', b.slice(integerB.length))
    if (integerB < b) return integerB
    const previous = decrementInteger(integerB)
    if (previous === null) throw new Error('No caben más claves delante')
    return previous
  }
  const integerA = integerPart(a)
  const fractionA = a.slice(integerA.length)
  if (b === null) return incrementInteger(integerA) ?? integerA + midpoint(fractionA, null)
  const integerB = integerPart(b)
  if (integerA === integerB) return integerA + midpoint(fractionA, b.slice(integerB.length))
  const next = incrementInteger(integerA)
  if (next !== null && next < b) return next
  return integerA + midpoint(fractionA, null)
}

/** Compara dos claves como lo hace la collation "C": por sus caracteres, sin mirar mayúsculas ni idioma */
export const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Algo con puesto entre sus hermanas (null o sin él: aún no lo tiene) */
export interface Placed {
  position?: string | null
}

/**
 * El orden de unas hermanas: las que tienen puesto, por él (como la collation "C"); detrás, las que no, por nombre. Lo
 * usan las carpetas y los archivos, en el servidor y en la web, para que se vean igual
 */
export const bySiblingPlace = (a: Placed & { name: string }, b: Placed & { name: string }) => {
  const left = a.position ?? null
  const right = b.position ?? null
  if (left !== null && right !== null) return compareKeys(left, right)
  if (left !== null) return -1
  if (right !== null) return 1
  return a.name.localeCompare(b.name, 'es')
}

/**
 * Los puestos que hay que guardar al poner `moved` delante o detrás de una de sus hermanas (`siblings`: todas, ya en su
 * orden, con ella o sin ella; sin ancla o con una que no está, al final). Si todas las demás tenían puesto, solo cambia
 * el suyo; si no, se rellenan todas en el orden nuevo, para que las que iban por nombre se queden donde se veían
 */
export function placeAmong(
  siblings: readonly (Placed & { id: string })[],
  moved: string,
  to: { before?: string; after?: string }
): { id: string; position: string }[] {
  const others = siblings.filter((s) => s.id !== moved)
  const anchor = to.before ?? to.after
  const at = anchor === undefined ? -1 : others.findIndex((s) => s.id === anchor)
  const index = at < 0 ? others.length : to.before !== undefined ? at : at + 1
  if (others.every((s) => (s.position ?? null) !== null)) {
    const previous = others[index - 1]?.position ?? null
    const next = others[index]?.position ?? null
    return [{ id: moved, position: keyBetween(previous, next) }]
  }
  const order = [...others.slice(0, index).map((s) => s.id), moved, ...others.slice(index).map((s) => s.id)]
  const result: { id: string; position: string }[] = []
  let last: string | null = null
  for (const id of order) {
    last = keyBetween(last, null)
    result.push({ id, position: last })
  }
  return result
}
