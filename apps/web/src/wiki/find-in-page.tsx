/**
 * Buscar en la página abierta: una barra con el campo, «n de m», anterior y siguiente. Lo encontrado se resalta en el
 * texto con decoraciones (no cambia el documento) sin mirar tildes ni mayúsculas, y lo actual se elige y se lleva a la
 * vista. Cuenta también el texto que enseñan los enlaces y lo de dentro de los secretos y las notas ocultas, que son
 * otros editores: cada uno resalta lo suyo y «n de m» los suma en el orden de la página
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
        // Un enlace a una página, con el texto que enseña; lo demás, un hueco
        const shown = child.type.name === 'pageLink' ? String(child.attrs.label || child.attrs.title || '') : ''
        const folded = shown ? [...shown].map(foldChar).join('') : '￼'
        for (let j = 0; j < folded.length; j++) at.push(pos + 1 + offset)
        text += folded
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

/**
 * El orden de lo encontrado en toda la página: lo del cuerpo (source -1) y lo de cada secreto (source, su número), que
 * va donde está su bloque en el cuerpo
 */
export function mergeMatches(
  main: readonly Match[],
  nested: readonly { at: number; count: number }[]
): { source: number; index: number }[] {
  const all = [
    ...main.map((match, index) => ({ source: -1, index, at: match.from, inner: 0 })),
    ...nested.flatMap((each, source) =>
      Array.from({ length: each.count }, (_, index) => ({ source, index, at: each.at, inner: index }))
    )
  ]
  all.sort((a, b) => a.at - b.at || a.inner - b.inner)
  return all.map(({ source, index }) => ({ source, index }))
}

/** Los editores de los secretos de una página, para buscar también en ellos */
interface NestedFind {
  editor: Editor
  at: () => number | undefined
}

class NestedFinds {
  readonly entries = new Set<NestedFind>()
  private readonly listeners = new Set<() => void>()
  add(entry: NestedFind) {
    this.entries.add(entry)
    this.changed()
    return () => {
      this.entries.delete(entry)
      this.changed()
    }
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private changed() {
    for (const listener of this.listeners) listener()
  }
}

const registries = new WeakMap<Editor, NestedFinds>()

/** Los editores de dentro (secretos, notas ocultas) de un editor del cuerpo */
export function nestedFinds(editor: Editor) {
  let found = registries.get(editor)
  if (!found) {
    found = new NestedFinds()
    registries.set(editor, found)
  }
  return found
}

const build = (doc: PMNode, query: string, current: number, classes: { match: string; current: string }) => {
  const matches = findMatches(doc, query)
  // -1: lo actual está en otro editor de la página
  const index = matches.length === 0 || current < 0 ? -1 : Math.min(current, matches.length - 1)
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

/** Lo encontrado en el cuerpo y en sus secretos, en el orden de la página */
function collect(editor: Editor) {
  const nested = [...nestedFinds(editor).entries]
    .map((entry) => ({ editor: entry.editor, at: entry.at() }))
    .filter((entry): entry is { editor: Editor; at: number } => entry.at !== undefined && !entry.editor.isDestroyed)
  const matchesOf = (each: Editor) => findKey.getState(each.state)?.matches ?? []
  const order = mergeMatches(
    matchesOf(editor),
    nested.map((entry) => ({ at: entry.at, count: matchesOf(entry.editor).length }))
  )
  const owner = (source: number) => (source === -1 ? editor : nested[source]?.editor)
  // Lo actual: el de la página que su editor tiene como actual
  const current = order.findIndex(
    (item) => findKey.getState(owner(item.source)?.state ?? editor.state)?.current === item.index
  )
  return { editors: [editor, ...nested.map((entry) => entry.editor)], order, owner, current }
}

/** Busca en todos los editores de la página y lleva a la coincidencia que toca (por su número en toda la página) */
function show(editor: Editor, query: string, wanted: number, scroll: boolean) {
  for (const each of collect(editor).editors) each.view.dispatch(each.state.tr.setMeta(findKey, { query, current: -1 }))
  const { order, owner } = collect(editor)
  const item = order[Math.min(Math.max(wanted, 0), order.length - 1)]
  const target = item ? owner(item.source) : undefined
  if (!item || !target) return
  target.view.dispatch(target.state.tr.setMeta(findKey, { query, current: item.index }))
  const match = findKey.getState(target.state)?.matches[item.index]
  if (!match || !scroll) return
  const { tr } = target.state
  target.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView())
}

/** La barra de buscar en la página. Se abre con su botón o con Ctrl+Alt+F (Ctrl+F sigue siendo el del navegador) */
export function FindBar({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [count, setCount] = useState({ current: 0, total: 0 })
  const input = useRef<HTMLInputElement>(null)

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
  // Al abrirla, el foco al campo; al cerrarla, de vuelta al texto
  const back = useRef(false)
  useEffect(() => {
    if (open) input.current?.focus()
    else if (back.current) editor.commands.focus()
    back.current = false
  }, [open])
  // Lo que cuenta la barra, al día con los documentos (si se escribe mientras, cambia), también los de los secretos
  const queryRef = useRef('')
  useEffect(() => {
    const registry = nestedFinds(editor)
    const update = () => {
      const { order, current } = collect(editor)
      setCount({ current: order.length > 0 ? Math.max(current, 0) + 1 : 0, total: order.length })
    }
    let bound: Editor[] = []
    const bind = () => {
      for (const each of bound) each.off('transaction', update)
      bound = collect(editor).editors
      for (const each of bound) each.on('transaction', update)
      update()
    }
    bind()
    // Un secreto que se abre mientras se busca: busca también en él
    const unsubscribe = registry.subscribe(() => {
      bind()
      if (queryRef.current) show(editor, queryRef.current, Math.max(collect(editor).current, 0), false)
    })
    return () => {
      unsubscribe()
      for (const each of bound) each.off('transaction', update)
    }
  }, [editor])

  const search = (next: string) => {
    setQuery(next)
    queryRef.current = next
    show(editor, next, 0, false)
  }
  const move = (step: number) => {
    const { order, current } = collect(editor)
    if (order.length === 0) return
    show(editor, query, (Math.max(current, 0) + step + order.length) % order.length, true)
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

  // Cerrada no ocupa sitio: se abre con Ctrl+Alt+F
  if (!open) return null
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
