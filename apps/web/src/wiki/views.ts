/** Las vistas de React de los bloques que la tienen, para el esquema del editor */
import type { Node } from '@tiptap/core'
import { withCalloutView } from './callout.tsx'
import { withSeparateView } from './separate.tsx'

export function withNodeView(node: Node) {
  if (node.name === 'callout') return withCalloutView(node)
  if (node.name === 'secret' || node.name === 'note') return withSeparateView(node)
  return node
}
