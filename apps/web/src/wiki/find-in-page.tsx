/**
 * Buscar en la página abierta: una barra con el campo, «n de m», anterior y siguiente. Lo encontrado se resalta en el
 * texto con decoraciones (no cambia el documento) sin mirar tildes ni mayúsculas, y lo actual se elige y se lleva a la
 * vista. Lo de dentro de los secretos (otros editores) no entra
 */
import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './find-in-page.module.css'

interface Match {
  from: number
  to: number
}

interface FindState {
  query: string
  current: number
  matches: Match[]
  decorations: DecorationSet
}

export const findKey = new PluginKey<FindState>('findInPage')

const foldChar = (char: string) => char.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

/** Dónde sale lo buscado en el documento: en cada bloque de texto, sin tildes ni mayúsculas */
export function findMatches(doc: PMNode, query: string): Match[] {
  const wanted = [...query].map(foldChar).join('').trim()
  if (!wanted) return []
  const found: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // El texto del bloque, sin tildes, con la posición en el documento de cada letra
    let text = ''
    const at: number[] = []
    node.forEach((child, offset) => {
      if (!child.isText) {
        text += '￼'
        at.push(pos + 1 + offset)
        return
      }
      const value = child.text ?? ''
      for (let i = 0; i < value.length; i++) {
        const folded = foldChar(value[i] ?? '')
        for (let j = 0; j < folded.length; j++) at.push(pos + 1 + offset + i)
        text += folded
      }
    })
    for (let index = text.indexOf(wanted); index !== -1; index = text.indexOf(wanted, index + wanted.length)) {
      const from = at[index]
      const last = at[index + wanted.length - 1]
      if (from !== undefined && last !== undefined) found.push({ from, to: last + 1 })
    }
    return false
  })
  return found
}

const build = (doc: PMNode, query: string, current: number, classes: { match: string; current: string }) => {
  const matches = findMatches(doc, query)
  const index = matches.length === 0 ? 0 : Math.min(Math.max(current, 0), matches.length - 1)
  const decorations = DecorationSet.create(
    doc,
    matches.map((match, i) =>
      Decoration.inline(match.from, match.to, {
        class: i === index ? `${classes.match} ${classes.current}` : classes.match
      })
    )
  )
  return { query, current: index, matches, decorations }
}

export const FindInPage = Extension.create<{ match: string; current: string }>({
  name: 'findInPage',
  addOptions: () => ({ match: '', current: '' }),
  addProseMirrorPlugins() {
    const classes = this.options
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({ query: '', current: 0, matches: [], decorations: DecorationSet.empty }),
          apply: (tr, previous) => {
            const meta = tr.getMeta(findKey) as { query?: string; current?: number } | undefined
            if (meta) return build(tr.doc, meta.query ?? previous.query, meta.current ?? previous.current, classes)
            if (tr.docChanged && previous.query) return build(tr.doc, previous.query, previous.current, classes)
            return previous
          }
        },
        props: { decorations: (state) => findKey.getState(state)?.decorations }
      })
    ]
  }
})

/** Lleva a la coincidencia que toca: la elige y la pone a la vista */
function show(editor: Editor, query: string, current: number) {
  editor.view.dispatch(editor.state.tr.setMeta(findKey, { query, current }))
  const state = findKey.getState(editor.state)
  const match = state?.matches[state.current]
  if (!match) return
  const { tr } = editor.state
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView())
}

/** La barra de buscar en la página. Se abre con su botón o con Ctrl+Alt+F (Ctrl+F sigue siendo el del navegador) */
export function FindBar({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [count, setCount] = useState({ current: 0, total: 0 })
  const input = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === 'KeyF') {
        event.preventDefault()
        setOpen(true)
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [])
  // Al abrirla, el foco al campo; al cerrarla, de vuelta al botón (cuando ya está pintado)
  const back = useRef(false)
  useEffect(() => {
    if (open) input.current?.focus()
    else if (back.current) button.current?.focus()
    back.current = false
  }, [open])
  // Lo que cuenta la barra, al día con el documento (si se escribe mientras, cambia)
  useEffect(() => {
    const update = () => {
      const state = findKey.getState(editor.state)
      setCount({
        current: state && state.matches.length > 0 ? state.current + 1 : 0,
        total: state?.matches.length ?? 0
      })
    }
    editor.on('transaction', update)
    return () => {
      editor.off('transaction', update)
    }
  }, [editor])

  const search = (next: string) => {
    setQuery(next)
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: next, current: 0 }))
  }
  const move = (step: number) => {
    const state = findKey.getState(editor.state)
    if (!state || state.matches.length === 0) return
    show(editor, query, (state.current + step + state.matches.length) % state.matches.length)
  }
  const close = () => {
    search('')
    back.current = true
    setOpen(false)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      move(event.shiftKey ? -1 : 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  if (!open) {
    return (
      <button ref={button} type="button" className={styles.open} onClick={() => setOpen(true)}>
        {t('find.button')}
      </button>
    )
  }
  return (
    <search className={styles.bar}>
      <input
        ref={input}
        type="search"
        className={styles.input}
        aria-label={t('find.label')}
        value={query}
        onChange={(event) => search(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      <span role="status" className={styles.count}>
        {query.trim() ? t('find.count', { current: count.current, total: count.total }) : ''}
      </span>
      <button type="button" className={styles.button} disabled={count.total === 0} onClick={() => move(-1)}>
        {t('find.previous')}
      </button>
      <button type="button" className={styles.button} disabled={count.total === 0} onClick={() => move(1)}>
        {t('find.next')}
      </button>
      <button type="button" className={styles.button} onClick={close}>
        {t('find.close')}
      </button>
    </search>
  )
}
