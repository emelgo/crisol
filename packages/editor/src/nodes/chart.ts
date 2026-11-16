/**
 * Un gráfico en una página (módulo 10): un bloque que guarda su YAML tal cual (el formato ```chart del plugin «Charts»
 * de Obsidian, que lee chart-spec.ts) y en Markdown es ese bloque de código. Lo escribe la IA en Markdown o el editor
 * visual de la web; la web lo pinta con Chart.js. Volver a Markdown da el mismo texto
 */
import { mergeAttributes, Node } from '@tiptap/core'

/** `chart` en una valla de tres o más acentos graves, hasta una igual en su línea (o vacío) */
const CHART = /^(`{3,})chart[ \t]*\n(?:([\s\S]*?)\n)?\1[ \t]*(?:\n|$)/

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null }

/** El bloque en Markdown: con una valla más larga que cualquiera que empiece una línea de su YAML (así no se corta) */
export function chartMarkdown(yaml: string) {
  const longest = Math.max(0, ...[...yaml.matchAll(/^[ \t]*(`{3,})/gm)].map((match) => match[1]?.length ?? 0))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return yaml === '' ? `${fence}chart\n${fence}` : `${fence}chart\n${yaml}\n${fence}`
}

export const Chart = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    yaml: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-yaml') ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-yaml': String(attributes.yaml ?? '') })
    }
  }),
  parseHTML: () => [{ tag: 'div[data-chart]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-chart': '' }, HTMLAttributes)],
  // Antes que el bloque de código de siempre
  markdownTokenizer: {
    name: 'chart',
    level: 'block',
    start: (src) => src.search(/^`{3,}chart/m),
    tokenize: (src) => {
      const match = CHART.exec(src)
      if (!match) return undefined
      return { type: 'chart', raw: match[0], yaml: match[2] ?? '' }
    }
  },
  parseMarkdown: (token, helpers) => helpers.createNode('chart', { yaml: String(token.yaml ?? '') }),
  renderMarkdown: (node) => chartMarkdown(String(node.attrs?.yaml ?? ''))
})
