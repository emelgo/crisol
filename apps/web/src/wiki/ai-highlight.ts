/**
 * Lo que escribe Claude se resalta un instante: el servidor avisa por el documento (un mensaje sin estado) con los ids
 * de los bloques que cambió, y aquí se marcan con una decoración (una clase puesta a mano en el DOM la quitaría
 * ProseMirror al repintar). El aviso puede llegar antes que el cambio (Hocuspocus junta los cambios y los manda al final
 * de la vuelta): los ids esperan a que sus bloques estén. A los lectores de pantalla, un aviso
 */
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { type Editor, Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect } from 'react'

const FLASH_MS = 2500
/** Las decoraciones puestas, y los ids avisados que aún no han llegado al documento */
interface HighlightState {
  set: DecorationSet
  pending: readonly string[]
}
const key = new PluginKey<HighlightState>('aiHighlight')

type Meta = { ids: readonly string[] } | { clear: true }

/** Marca los bloques avisados que ya están; los demás siguen esperando (el aviso puede llegar antes que el cambio) */
function resolve(doc: PMNode, state: HighlightState, className: string): HighlightState {
  if (state.pending.length === 0) return state
  const pending = new Set(state.pending)
  const decorations: Decoration[] = []
  doc.forEach((node, offset) => {
    const id = String(node.attrs.id ?? '')
    if (!pending.has(id)) return
    pending.delete(id)
    decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: className }))
  })
  return { set: state.set.add(doc, decorations), pending: [...pending] }
}

export const AiHighlight = Extension.create<{ className: string }>({
  name: 'aiHighlight',
  addOptions: () => ({ className: '' }),
  addProseMirrorPlugins() {
    const { className } = this.options
    return [
      new Plugin<HighlightState>({
        key,
        state: {
          init: () => ({ set: DecorationSet.empty, pending: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(key) as Meta | undefined
            if (meta && 'clear' in meta) return { set: DecorationSet.empty, pending: [] }
            const mapped = { set: value.set.map(tr.mapping, tr.doc), pending: value.pending }
            if (meta && 'ids' in meta) return resolve(tr.doc, { ...mapped, pending: meta.ids }, className)
            return tr.docChanged ? resolve(tr.doc, mapped, className) : mapped
          }
        },
        props: { decorations: (state) => key.getState(state)?.set }
      })
    ]
  }
})

export function useAiHighlight(editor: Editor | null, provider: HocuspocusProvider, announce: () => void) {
  useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const mark = (meta: Meta) => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(key, meta))
    }
    const onStateless = ({ payload }: { payload: string }) => {
      let message: { type?: unknown; blocks?: unknown }
      try {
        message = JSON.parse(payload)
      } catch {
        return
      }
      if (message.type !== 'ai' || !Array.isArray(message.blocks)) return
      announce()
      mark({ ids: message.blocks.map(String) })
      clearTimeout(timer)
      timer = setTimeout(() => mark({ clear: true }), FLASH_MS)
    }
    provider.on('stateless', onStateless)
    return () => {
      provider.off('stateless', onStateless)
      clearTimeout(timer)
    }
  }, [editor, provider, announce])
}
