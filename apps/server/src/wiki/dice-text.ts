/**
 * Los dados salen de la wiki (revisión, tanda 7): una tirada escrita en una página (el nodo `diceRoll`, que ya no
 * existe) pasa a ser su texto en código, `dice: 1d20+5 # Nombre`, como en Markdown. Se hace en Yjs, sin el esquema
 * (que ya no la conoce y la perdería): al abrir cada documento, al leer uno guardado o una versión, y en el barrido
 * (`crisol quitar-dados`). Lo que deba tirarse irá a una entrada del compendio
 */
import * as Y from 'yjs'

/** El texto de una tirada: el mismo que su Markdown, sin las comillas */
export function diceText(formula: string, label: string | null) {
  const clean = formula.replace(/[`#]/g, '').trim()
  const name = (label ?? '').replace(/`/g, '').trim()
  return `dice: ${clean}${name ? ` # ${name}` : ''}`
}

/** Las tiradas de un fragmento de Yjs, a texto en código; cuántas había. Dentro de una transacción, de una vez */
export function diceRollsToText(fragment: Y.XmlFragment): number {
  const found: Y.XmlElement[] = []
  const walker = fragment.createTreeWalker((node) => node instanceof Y.XmlElement && node.nodeName === 'diceRoll')
  for (const node of walker) found.push(node as Y.XmlElement)
  if (found.length === 0) return 0
  const replace = () => {
    for (const roll of found) {
      const parent = roll.parent
      if (!(parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment)) continue
      const index = parent.toArray().indexOf(roll)
      if (index < 0) continue
      const formula = String(roll.getAttribute('formula') ?? '')
      const label = (roll.getAttribute('label') as string | null | undefined) ?? null
      const text = new Y.XmlText()
      text.applyDelta([{ insert: diceText(formula, label), attributes: { code: {} } }])
      parent.delete(index, 1)
      parent.insert(index, [text])
    }
  }
  if (fragment.doc) fragment.doc.transact(replace)
  else replace()
  return found.length
}
