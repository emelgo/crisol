/**
 * Los ids de bloque: estables, para enlazar a un bloque, para el MCP y para exportar (`^id` en Markdown). Cortos, porque
 * se leen en el Markdown; únicos dentro de su documento (la extensión cambia los repetidos al pegar o duplicar)
 */

import type { JSONContent } from '@tiptap/core'
import { UniqueID } from '@tiptap/extension-unique-id'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'

/** Los bloques que llevan id (no las filas ni las celdas de las tablas, ni el texto) */
export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'table',
  'callout',
  'box',
  'secret',
  'note'
]

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Un id nuevo: 8 letras o cifras al azar (36^8: no se repite en una página) */
export function newBlockId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export const BlockIds = UniqueID.configure({ types: BLOCK_TYPES, generateID: newBlockId })

/** Los ids que faltan (o repetidos) en un documento ya abierto, o null si no falta ninguno. No va al historial */
export function fillMissingIds(state: EditorState): Transaction | null {
  const { tr } = state
  const seen = new Set<string>()
  state.doc.descendants((node: PMNode, pos: number) => {
    if (!BLOCK_TYPES.includes(node.type.name)) return
    const id = node.attrs.id as string | null
    if (id && !seen.has(id)) {
      seen.add(id)
      return
    }
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: newBlockId() })
  })
  if (!tr.docChanged) return null
  return tr.setMeta('addToHistory', false)
}

/** Una copia sin ids (para duplicar un bloque): el editor les pone otros nuevos al meterla */
export function withoutBlockIds(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    const content = withoutBlockIds(node.content)
    nodes.push(
      BLOCK_TYPES.includes(node.type.name)
        ? node.type.create({ ...node.attrs, id: null }, content, node.marks)
        : node.copy(content)
    )
  })
  return Fragment.from(nodes)
}

/**
 * Lo mismo en JSON, para lo que se escribe fuera del editor (Claude, al crear o cambiar una página): pone id a los
 * bloques que no lo tienen y cambia los repetidos (se queda el primero)
 */
export function fillJsonIds(node: JSONContent, seen: Set<string> = new Set()): JSONContent {
  let attrs = node.attrs
  if (node.type && BLOCK_TYPES.includes(node.type)) {
    const id = typeof attrs?.id === 'string' && attrs.id !== '' ? attrs.id : null
    const fresh = id && !seen.has(id) ? id : newBlockId()
    seen.add(fresh)
    attrs = { ...attrs, id: fresh }
  }
  const content = node.content?.map((child) => fillJsonIds(child, seen))
  return { ...node, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) }
}
