/**
 * El menú «/»: al escribir «/» en el texto sale la lista de bloques, se filtra con lo que se escribe detrás y se elige
 * con las flechas e Intro (Escape lo cierra). El texto sigue con el foco: la lista es su lista de sugerencias
 * (aria-controls y aria-activedescendant), como en un cuadro combinado
 */
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type BlockChoice, type BlockContext, type BlockGroup, findBlocks } from './blocks.ts'
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
}

const GROUPS: readonly BlockGroup[] = ['text', 'wiki', 'boxes', 'sheet', 'master']

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',
  // Antes que las teclas de las tablas y las listas: con el menú abierto, Intro y Tab son suyos
  priority: 200,
  addOptions: () => ({ nested: false, name: (block) => block.label, context: null, announce: () => {} }),
  addProseMirrorPlugins() {
    const { nested, name, context, announce } = this.options
    return [
      Suggestion<BlockChoice, BlockChoice>({
        editor: this.editor,
        pluginKey: new PluginKey('slashMenu'),
        char: '/',
        // Ni dentro del código ni en un título de tabla raro: solo en texto normal
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => findBlocks(query, name, nested),
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

const SlashList = forwardRef<SlashListHandle, SlashListProps>(function SlashList({ items, command, editor }, ref) {
  const { t } = useTranslation()
  const id = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
  // La opción activa; si lo escrito la deja fuera, la primera
  const current = items.find((block) => block.id === activeId) ?? items[0]

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        const index = current ? items.indexOf(current) : 0
        setActiveId(items[(index + step + items.length) % items.length]?.id ?? null)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (current) command(current)
        return true
      }
      return false
    }
  }))

  // El texto lleva el foco y anuncia la opción activa de la lista
  const optionId = (block: BlockChoice) => `${id}-${block.id}`
  useEffect(() => {
    const dom = editor.view.dom
    dom.setAttribute('aria-controls', `${id}-list`)
    dom.setAttribute('aria-autocomplete', 'list')
    if (current) dom.setAttribute('aria-activedescendant', optionId(current))
    else dom.removeAttribute('aria-activedescendant')
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
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
        {GROUPS.map((group) => {
          const blocks = items.filter((block) => block.group === group)
          if (blocks.length === 0) return null
          return (
            // biome-ignore lint/a11y/useSemanticElements: un grupo de opciones de la lista (ARIA), no un grupo de un formulario
            <div key={group} role="group" aria-labelledby={`${id}-${group}`}>
              <div id={`${id}-${group}`} className={styles.group}>
                {t(`blocks.groups.${group}`)}
              </div>
              {blocks.map((block) => (
                <div
                  key={block.id}
                  id={optionId(block)}
                  role="option"
                  aria-selected={block === current}
                  className={styles.option}
                  // El foco se queda en el texto: se elige al pulsar, sin quitárselo
                  tabIndex={-1}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    command(block)
                  }}
                >
                  <span>{t(`blocks.${block.label}`)}</span>
                  {block.hint && <span className={styles.hint}>{t(`blocks.${block.hint}`)}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {items.length === 0 && <p className={styles.empty}>{t('blocks.none')}</p>}
      <p className={styles.help} aria-hidden="true">
        {t('blocks.help')}
      </p>
    </div>
  )
})
