import { BODY_FIELD, editorSchema } from '@crisol/editor'
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { diceRollsToText, diceText } from './dice-text.ts'

/** Un documento de Yjs con una tirada escrita a mano, como los de antes (el nodo `diceRoll`) */
function withRolls() {
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment(BODY_FIELD)
  const paragraph = new Y.XmlElement('paragraph')
  const before = new Y.XmlText()
  before.insert(0, 'Tira ')
  const roll = new Y.XmlElement('diceRoll')
  roll.setAttribute('formula', '1d20+5')
  roll.setAttribute('label', 'Ataque')
  const after = new Y.XmlText()
  after.insert(0, ' ahora.')
  paragraph.insert(0, [before, roll, after])
  const second = new Y.XmlElement('paragraph')
  const only = new Y.XmlElement('diceRoll')
  only.setAttribute('formula', '2d6')
  second.insert(0, [only])
  fragment.insert(0, [paragraph, second])
  return doc
}

describe('los dados salen de la wiki: las tiradas, a texto en código', () => {
  it('el texto es el de su Markdown, sin comillas ni almohadillas en la fórmula', () => {
    expect(diceText('1d20+5', 'Ataque')).toBe('dice: 1d20+5 # Ataque')
    expect(diceText(' 2d6 ', null)).toBe('dice: 2d6')
    expect(diceText('1d4#`', '`x`')).toBe('dice: 1d4 # x')
  })

  it('en Yjs, sin el esquema: cada tirada pasa a su texto en código, en su sitio', () => {
    const doc = withRolls()
    expect(diceRollsToText(doc.getXmlFragment(BODY_FIELD))).toBe(2)
    const json = yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(BODY_FIELD), editorSchema()).toJSON()
    expect(json.content[0].content).toEqual([
      { type: 'text', text: 'Tira ' },
      { type: 'text', text: 'dice: 1d20+5 # Ataque', marks: [{ type: 'code' }] },
      { type: 'text', text: ' ahora.' }
    ])
    expect(json.content[1].content).toEqual([{ type: 'text', text: 'dice: 2d6', marks: [{ type: 'code' }] }])
    // Otra vez, nada
    expect(diceRollsToText(doc.getXmlFragment(BODY_FIELD))).toBe(0)
  })

  it('un documento sin tiradas no cambia', () => {
    const doc = prosemirrorJSONToYDoc(
      editorSchema(),
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] },
      BODY_FIELD
    )
    const before = Y.encodeStateVector(doc)
    expect(diceRollsToText(doc.getXmlFragment(BODY_FIELD))).toBe(0)
    expect(Y.encodeStateVector(doc)).toEqual(before)
  })
})
