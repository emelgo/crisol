/**
 * Los dados que se van juntando antes de tirar (lienzo «Tirar dados», a lo D&D Beyond): cuántos de cada, en el orden
 * en que se añadieron, el modificador y la ventaja. De aquí sale la fórmula que se tira
 */

/** Los dados del lanzador, de arriba abajo: el d4 arriba y el d100 junto al botón */
export const SIDES = [4, 6, 8, 10, 12, 20, 100] as const
export type Sides = (typeof SIDES)[number]

export type Advantage = 'none' | 'advantage' | 'disadvantage'

export interface Pool {
  /** Cada dado con cuántos lleva, en el orden en que se añadió el primero */
  dice: { sides: Sides; count: number }[]
  modifier: number
  advantage: Advantage
}

export const EMPTY: Pool = { dice: [], modifier: 0, advantage: 'none' }

/** Como mucho, de un mismo dado (lo que deja tirar el servidor de sobra) */
const MAX_COUNT = 99
const MAX_MODIFIER = 99

export type PoolAction =
  | { type: 'add'; sides: Sides }
  | { type: 'remove'; sides: Sides }
  | { type: 'drop'; sides: Sides }
  | { type: 'modifier'; by: number }
  | { type: 'advantage'; mode: 'advantage' | 'disadvantage' }
  | { type: 'clear' }

export function poolReducer(pool: Pool, action: PoolAction): Pool {
  switch (action.type) {
    case 'add': {
      const found = pool.dice.find((d) => d.sides === action.sides)
      const dice = found
        ? pool.dice.map((d) => (d.sides === action.sides ? { ...d, count: Math.min(MAX_COUNT, d.count + 1) } : d))
        : [...pool.dice, { sides: action.sides, count: 1 }]
      return { ...pool, dice }
    }
    case 'remove': {
      const dice = pool.dice
        .map((d) => (d.sides === action.sides ? { ...d, count: d.count - 1 } : d))
        .filter((d) => d.count > 0)
      return settle({ ...pool, dice })
    }
    case 'drop':
      return settle({ ...pool, dice: pool.dice.filter((d) => d.sides !== action.sides) })
    case 'modifier':
      return { ...pool, modifier: Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, pool.modifier + action.by)) }
    case 'advantage': {
      // Otra vez la misma, se quita; si no hay d20, se pone uno (la ventaja es del d20)
      if (pool.advantage === action.mode) return { ...pool, advantage: 'none' }
      const withD20 = pool.dice.some((d) => d.sides === 20) ? pool : poolReducer(pool, { type: 'add', sides: 20 })
      return { ...withD20, advantage: action.mode }
    }
    case 'clear':
      return EMPTY
  }
}

/** Sin d20 ya no hay ventaja que valga */
const settle = (pool: Pool): Pool =>
  pool.advantage !== 'none' && !pool.dice.some((d) => d.sides === 20) ? { ...pool, advantage: 'none' } : pool

export const isEmpty = (pool: Pool) => pool.dice.length === 0

export const dieName = (sides: number) => `d${sides}`

/** Cada grupo, como se escribe: «2d8», «1d20» */
export const chipOf = (d: { sides: Sides; count: number }) => `${d.count}${dieName(d.sides)}`

/** La fórmula de lo juntado: la ventaja va en un d20 (2d20kh1) y los demás d20, aparte; luego el modificador */
export function poolFormula(pool: Pool): string {
  const parts = pool.dice.flatMap((d) => {
    if (d.sides !== 20 || pool.advantage === 'none') return [chipOf(d)]
    const kept = pool.advantage === 'advantage' ? '2d20kh1' : '2d20kl1'
    return d.count > 1 ? [kept, `${d.count - 1}d20`] : [kept]
  })
  const base = parts.join('+')
  if (!pool.modifier) return base
  return `${base}${pool.modifier > 0 ? '+' : '-'}${Math.abs(pool.modifier)}`
}

/** El modificador, siempre con su signo: «+3», «−2», «+0» */
export const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`)
