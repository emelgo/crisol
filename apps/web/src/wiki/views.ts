/** Las vistas de React de los bloques que la tienen, para el esquema del editor */
import type { Node } from '@tiptap/core'
import { withCalloutView } from './callout.tsx'
import { withChartView } from './chart/chart-block.tsx'
import { withContentEmbedView } from './content-embed.tsx'
import { withContentLinkView } from './content-link.tsx'
import { withPageEmbedView } from './embed.tsx'
import { withFileEmbedView } from './file-embed.tsx'
import { withPageLinkView } from './page-links.tsx'
import { withSeparateView } from './separate.tsx'
import { withSheetView } from './sheet-blocks.tsx'

export function withNodeView(node: Node) {
  if (node.name === 'callout') return withCalloutView(node)
  if (node.name === 'chart') return withChartView(node)
  if (node.name === 'pageLink') return withPageLinkView(node)
  if (node.name === 'contentLink') return withContentLinkView(node)
  if (node.name === 'contentEmbed') return withContentEmbedView(node)
  if (node.name === 'pageEmbed') return withPageEmbedView(node)
  if (node.name === 'fileEmbed') return withFileEmbedView(node)
  if (node.name === 'secret' || node.name === 'note') return withSeparateView(node)
  return withSheetView(node)
}
