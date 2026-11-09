/**
 * Qué dados van a caer en una tirada, antes de que conteste el servidor: con eso la física empieza en el clic (a la
 * vez que se pregunta) y al llegar el resultado solo se recolocan los números de las caras. Si no se puede saber de
 * antemano (dados que explotan o se repiten: cuántos salen depende de lo que salga), null y se espera como siempre
 */
import type { DieKind } from './3d/solids.ts'
import { MAX_FALLING } from './falling.ts'

const SOLID = new Set([4, 6, 8, 10, 12, 20])

export function predictFalling(formula: string): DieKind[] | null {
  const written = formula.split('#')[0] ?? ''
  // Explotan («!») o se repiten («r»): el número de dados no se sabe hasta tirarlos
  if (/!/.test(written) || /\dd(?:\d+|%|f)\s*r/i.test(written)) return null
  const kinds: DieKind[] = []
  for (const match of written.matchAll(/(\d*)d(\d+|%|f)/gi)) {
    const count = Math.min(MAX_FALLING, Number(match[1] || 1))
    const sides = (match[2] ?? '').toLowerCase()
    for (let i = 0; i < count; i++) {
      if (sides === '%' || sides === '100') kinds.push('T', 10)
      else if (sides === 'f') kinds.push('F')
      else if (SOLID.has(Number(sides))) kinds.push(Number(sides) as DieKind)
    }
  }
  return kinds.length > 0 ? kinds.slice(0, MAX_FALLING) : null
}
