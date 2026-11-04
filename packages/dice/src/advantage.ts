/**
 * Con ventaja o desventaja: cada d20 suelto («1d20») pasa a «2d20kh1» o «2d20kl1», y el que ya la tenía cambia a la
 * otra; sin ninguna, vuelve a un d20. Sin d20 no hay a qué dársela (null)
 */
import { type DiceNode, formatDice, parseDice, splitComment } from './notation.ts'

export type Advantage = 'advantage' | 'disadvantage' | 'none'

function change(node: DiceNode, mode: Advantage): { node: DiceNode; changed: boolean } {
  switch (node.kind) {
    case 'number':
      return { node, changed: false }
    case 'negate': {
      const inner = change(node.value, mode)
      return { node: { ...node, value: inner.node }, changed: inner.changed }
    }
    case 'binary': {
      const left = change(node.left, mode)
      const right = change(node.right, mode)
      return { node: { ...node, left: left.node, right: right.node }, changed: left.changed || right.changed }
    }
    case 'dice': {
      if (node.sides !== 20) return { node, changed: false }
      const single = node.count === 1 && !node.keep
      const withOne = node.count === 2 && node.keep?.n === 1
      if (!single && !withOne) return { node, changed: false }
      if (mode === 'none')
        return withOne ? { node: { ...node, count: 1, keep: null }, changed: true } : { node, changed: false }
      return { node: { ...node, count: 2, keep: { mode: mode === 'advantage' ? 'kh' : 'kl', n: 1 } }, changed: true }
    }
  }
}

/** La misma fórmula (con su comentario) con ventaja, con desventaja o sin ellas; null si no tiene un d20 */
export function withAdvantage(formula: string, mode: Advantage): string | null {
  const { comment } = splitComment(formula)
  let tree: DiceNode
  try {
    tree = parseDice(formula)
  } catch {
    return null
  }
  const { node, changed } = change(tree, mode)
  if (!changed) return null
  return `${formatDice(node).replace(/×/g, '*')}${comment ? ` # ${comment}` : ''}`
}
