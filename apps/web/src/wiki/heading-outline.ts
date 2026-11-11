/**
 * Los niveles de los títulos para el lector de pantalla, sin saltos. El título de la página es el h1 y el texto pinta
 * «#» como h2 y «##» como h3 (así se ven): quien escribe sus apartados con «##» dejaría un salto de h1 a h3. Cada
 * título lleva el nivel que le toca en el esquema (aria-level): uno más que el que lo abarca; a la vista, igual
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey<DecorationSet>('headingOutline')

/** El nivel que se pinta: el de Markdown más uno (h1 es el título de la página), hasta h6 */
const shown = (node: PMNode) => Math.min(Number(node.attrs.level ?? 1) + 1, 6)

function outlineOf(doc: PMNode) {
  const marks: Decoration[] = []
  // Los títulos abiertos por encima: [el que se pinta, el del esquema]. Uno nuevo cierra los de su nivel o más
  const open: [number, number][] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true
    const level = shown(node)
    while ((open.at(-1)?.[0] ?? 0) >= level) open.pop()
    const outline = (open.at(-1)?.[1] ?? 1) + 1
    open.push([level, outline])
    if (outline !== level) marks.push(Decoration.node(pos, pos + node.nodeSize, { 'aria-level': String(outline) }))
    return false
  })
  return DecorationSet.create(doc, marks)
}

export const HeadingOutline = Extension.create({
  name: 'headingOutline',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => outlineOf(state.doc),
          apply: (tr, value) => (tr.docChanged ? outlineOf(tr.doc) : value)
        },
        props: { decorations: (state) => key.getState(state) }
      })
    ]
  }
})
