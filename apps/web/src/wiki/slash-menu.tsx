/**
 * El menú «/»: al escribir «/» en el texto sale la lista de bloques, se filtra con lo que se escribe detrás y se elige
 * con las flechas e Intro (Escape lo cierra). El texto sigue con el foco: la lista es su lista de sugerencias
 * (aria-controls y aria-activedescendant), como en un cuadro combinado
 */
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import { ChevronRight } from 'lucide-react'
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type BlockChoice, type BlockContext, findBlocks, SECTIONS, type SectionKey } from './blocks.ts'
import styles from './slash-menu.module.css'

export interface SlashMenuOptions {
  /** El editor de un secreto: sin «Del máster» */
  nested: boolean
  /** El nombre traducido de cada bloque, para filtrar */
  name: (block: BlockChoice) => string
  /** Lo que hace falta para crear secretos (solo en el cuerpo) */
  context: BlockContext | null
  /** Dice a los lectores de pantalla qué bloque se puso */
  announce: (block: BlockChoice) => void
  /** Si la página es una hoja: solo entonces salen sus bloques (saltos, columnas, statblock…) */
  sheet: () => boolean
}

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',
  // Antes que las teclas de las tablas y las listas: con el menú abierto, Intro y Tab son suyos
  priority: 200,
  addOptions: () => ({
    nested: false,
    name: (block) => block.label,
    context: null,
    announce: () => {},
    sheet: () => false
  }),
  addProseMirrorPlugins() {
    const { nested, name, context, announce, sheet } = this.options
    return [
      Suggestion<BlockChoice, BlockChoice>({
        editor: this.editor,
        pluginKey: new PluginKey('slashMenu'),
        char: '/',
        // Ni dentro del código ni en un título de tabla raro: solo en texto normal
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => findBlocks(query, name, nested).filter((block) => block.group !== 'sheet' || sheet()),
        command: ({ editor, range, props: block }) => {
          editor.chain().focus().deleteRange(range).run()
          void Promise.resolve(block.run(editor, context ?? { makeSeparate: async () => undefined })).then(() =>
            announce(block)
          )
        },
        render: () => {
          let renderer: ReactRenderer<SlashListHandle, SlashListProps> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor })
              // Va al final de la página: por encima de ella, que monta sobre su portada
              renderer.element.style.zIndex = '30'
              unmount = props.mount(renderer.element)
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              unmount?.()
              renderer?.destroy()
              renderer = null
            }
          }
        }
      })
    ]
  }
})

type SlashListProps = SuggestionProps<BlockChoice, BlockChoice>

interface SlashListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

type Entry = { type: 'group'; key: SectionKey; count: number } | { type: 'block'; block: BlockChoice; nested: boolean }

const entryId = (entry: Entry) => (entry.type === 'group' ? `grupo-${entry.key}` : entry.block.id)

const SlashList = forwardRef<SlashListHandle, SlashListProps>(function SlashList(
  { items, command, editor, query },
  ref
) {
  const { t } = useTranslation()
  const id = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  // Sin escribir nada, los grupos en desplegables (uno abierto a la vez); al escribir, lo que encaja, sin grupos
  const [open, setOpen] = useState<SectionKey | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const searching = query.trim().length > 0
  const entries: Entry[] = searching
    ? items.map((block) => ({ type: 'block', block, nested: false }))
    : SECTIONS.flatMap(({ key, match }): Entry[] => {
        const blocks = items.filter(match)
        if (blocks.length === 0) return []
        return [
          { type: 'group', key, count: blocks.length },
          ...(open === key ? blocks.map((block): Entry => ({ type: 'block', block, nested: true })) : [])
        ]
      })
  // La activa; si lo escrito la deja fuera, la primera
  const current = entries.find((entry) => entryId(entry) === activeId) ?? entries[0]
  const toggle = (key: SectionKey, opening: boolean) => {
    setOpen(opening ? key : null)
    const first = items.find((block) => SECTIONS.find((s) => s.key === key)?.match(block))
    setActiveId(opening && first ? first.id : `grupo-${key}`)
  }
  const choose = (entry: Entry) => {
    if (entry.type === 'group') toggle(entry.key, open !== entry.key)
    else command(entry.block)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (entries.length === 0) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        const index = current ? entries.indexOf(current) : 0
        const next = entries[(index + step + entries.length) % entries.length]
        setActiveId(next ? entryId(next) : null)
        return true
      }
      if (event.key === 'ArrowRight' && current?.type === 'group' && open !== current.key) {
        toggle(current.key, true)
        return true
      }
      if (event.key === 'ArrowLeft' && !searching && open) {
        toggle(open, false)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (current) choose(current)
        return true
      }
      return false
    }
  }))

  // El texto lleva el foco y anuncia la opción activa de la lista
  const optionId = (entry: Entry) => `${id}-${entryId(entry)}`
  useEffect(() => {
    const dom = editor.view.dom
    dom.setAttribute('aria-controls', `${id}-list`)
    dom.setAttribute('aria-autocomplete', 'list')
    if (current) dom.setAttribute('aria-activedescendant', optionId(current))
    else dom.removeAttribute('aria-activedescendant')
    // La activa, a la vista dentro de la lista (scrollIntoView movería también la página: el menú aún no está colocado)
    const box = list.current
    const option = box?.querySelector('[aria-selected="true"]')
    if (box && option) {
      const outer = box.getBoundingClientRect()
      const inner = option.getBoundingClientRect()
      if (inner.top < outer.top) box.scrollTop -= outer.top - inner.top
      else if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom
    }
  })
  useEffect(() => {
    const dom = editor.view.dom
    return () => {
      for (const name of ['aria-controls', 'aria-autocomplete', 'aria-activedescendant']) dom.removeAttribute(name)
    }
  }, [editor])

  return (
    <div className={styles.menu}>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label={t('blocks.menu')} className={styles.list}>
        {entries.map((entry) => (
          <div
            key={entryId(entry)}
            id={optionId(entry)}
            role="option"
            aria-selected={entry === current}
            className={styles.option}
            data-group={entry.type === 'group' || undefined}
            data-open={(entry.type === 'group' && open === entry.key) || undefined}
            data-nested={(entry.type === 'block' && entry.nested) || undefined}
            // El foco se queda en el texto: se elige al pulsar, sin quitárselo
            tabIndex={-1}
            // Al pasar el ratón, esa es la elegida (como con las flechas)
            onMouseEnter={() => setActiveId(entryId(entry))}
            onMouseDown={(event) => {
              event.preventDefault()
              choose(entry)
            }}
          >
            {entry.type === 'group' ? (
              <>
                <span>{t(`blocks.groups.${entry.key}`)}</span>
                <ChevronRight aria-hidden="true" size={14} className={styles.chevron} />
              </>
            ) : (
              <>
                <span>{t(`blocks.${entry.block.label}`)}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && <p className={styles.empty}>{t('blocks.none')}</p>}
      <p className={styles.help} aria-hidden="true">
        {t('blocks.help')}
      </p>
    </div>
  )
})
