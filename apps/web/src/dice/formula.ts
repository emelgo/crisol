/** La fórmula que se escribe en la ficha de dados: los dados rápidos y su explicación mientras se escribe */
import { DiceSyntaxError, describeFormula, parseDice, splitComment } from '@crisol/dice'

/** Un dado más: otro igual que el último suma uno; uno distinto se suma aparte. El nombre (# …) se queda */
export function addDie(formula: string, sides: number): string {
  const { formula: written, comment } = splitComment(formula)
  const base = written.trim()
  const tag = sides === 100 ? '%' : String(sides)
  const last = /(\d*)d(\d+|%)$/i.exec(base)
  const next = !base
    ? `1d${tag}`
    : last && last[2]?.toLowerCase() === tag
      ? `${base.slice(0, base.length - last[0].length)}${Number(last[1] || 1) + 1}d${tag}`
      : `${base}+1d${tag}`
  return comment ? `${next} # ${comment}` : next
}

/** La tirada dicha en español (con su nombre), o por qué no vale */
export function explain(formula: string): { ok: boolean; text: string } {
  try {
    parseDice(formula)
  } catch (error) {
    if (error instanceof DiceSyntaxError) return { ok: false, text: error.message }
    throw error
  }
  const { comment } = splitComment(formula)
  return { ok: true, text: `${describeFormula(formula)}${comment ? ` · ${comment}` : ''}` }
}

/** Si la explicación no dice más que lo escrito («1d20» bajo «1d20»): entonces no se enseña */
export function echoes(formula: string, text: string): boolean {
  const bare = (value: string) => value.replace(/\s+/g, '').toLowerCase()
  return bare(formula) === bare(text)
}
