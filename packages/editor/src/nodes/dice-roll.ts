/**
 * Una tirada escrita en el texto de una página (docs/specs/dados.md): su fórmula y su nombre. En la web se pulsa y tira
 * en la campaña elegida en la ficha de dados. En Markdown, `` `dice: 1d20+5 # Nombre` ``, como el plugin Dice Roller de
 * Obsidian (lo usa Eana): así la escribe la IA y así se pasa
 */
import { mergeAttributes, Node } from '@tiptap/core'

/** `` `dice: fórmula` `` o `` `dice: fórmula # nombre` ``: lo de dentro, de una vez (y se parte por la #), sin atascarse */
const ROLL = /^`dice:([^`]*)`/

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null; textContent: string | null }

/** Sin comillas invertidas (cerrarían la tirada) ni, en la fórmula, almohadillas (empezarían el nombre) */
export function diceRollMarkdown({ formula, label }: { formula: string; label: string | null }) {
  const clean = formula.replace(/[`#]/g, '').trim()
  const name = (label ?? '').replace(/`/g, '').trim()
  return `\`dice: ${clean}${name ? ` # ${name}` : ''}\``
}

export const DiceRoll = Node.create({
  name: 'diceRoll',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    formula: {
      default: '1d20',
      parseHTML: (element: Element) => element.getAttribute('data-formula') ?? element.textContent ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-formula': String(attributes.formula ?? '') })
    },
    label: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-label') || null,
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.label ? { 'data-label': String(attributes.label) } : {}
    }
  }),
  parseHTML: () => [{ tag: 'span[data-dice-roll]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes({ 'data-dice-roll': '' }, HTMLAttributes),
    String(node.attrs.formula)
  ],
  renderText: ({ node }) => [node.attrs.label, node.attrs.formula].filter(Boolean).join(' '),
  // Antes que el código en línea: `dice: …` es una tirada, y lo demás entre comillas, código
  markdownTokenizer: {
    name: 'diceRoll',
    level: 'inline',
    start: (src) => src.search(/`dice:/),
    tokenize: (src) => {
      const match = ROLL.exec(src)
      if (!match) return undefined
      const inside = match[1] ?? ''
      const hash = inside.indexOf('#')
      const formula = (hash < 0 ? inside : inside.slice(0, hash)).trim()
      if (!formula) return undefined
      return {
        type: 'diceRoll',
        raw: match[0],
        formula,
        label: hash < 0 ? null : inside.slice(hash + 1).trim() || null
      }
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('diceRoll', { formula: token.formula ?? '', label: token.label ?? null }),
  renderMarkdown: (node) =>
    diceRollMarkdown({
      formula: String(node.attrs?.formula ?? ''),
      label: (node.attrs?.label as string | null) ?? null
    })
})
