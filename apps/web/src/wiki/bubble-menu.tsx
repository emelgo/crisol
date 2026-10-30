/**
 * Las barras flotantes del texto: la de formato, al elegir texto, y la de la tabla, con el cursor en una. Con el teclado
 * se llega con Alt+F10, se recorren con las flechas y Escape vuelve al texto
 */
import { resolveName } from '@crisol/domain'
import { isExternalUrl } from '@crisol/editor'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import styles from './bubble-menu.module.css'
import { PageLinksContext } from './page-links.tsx'

/** Alt+F10 desde el texto lleva a la barra, si se ve */
function useReachWithKeyboard(editor: Editor, toolbar: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const dom = editor.view.dom
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.altKey && event.key === 'F10') || !toolbar.current?.isConnected) return
      event.preventDefault()
      toolbar.current.querySelector<HTMLElement>('button, input')?.focus()
    }
    dom.addEventListener('keydown', onKeyDown)
    return () => dom.removeEventListener('keydown', onKeyDown)
  }, [editor, toolbar])
}

/** Las flechas recorren los botones de la barra; Escape vuelve al texto */
function toolbarKeys(editor: Editor) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    const go = (next: number) => {
      event.preventDefault()
      buttons[(next + buttons.length) % buttons.length]?.focus()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      editor.commands.focus()
    } else if (index === -1) return
    else if (event.key === 'ArrowRight') go(index + 1)
    else if (event.key === 'ArrowLeft') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(buttons.length - 1)
  }
}

function ToolButton({
  label,
  pressed,
  onClick,
  children
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={children ? label : undefined}
      aria-pressed={pressed}
      title={label}
      // Sin quitar la selección del texto al pulsar con el ratón
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  )
}

const MARKS = [
  { name: 'bold', label: 'format.bold', glyph: 'N', toggle: (editor: Editor) => editor.chain().focus().toggleBold() },
  {
    name: 'italic',
    label: 'format.italic',
    glyph: 'K',
    toggle: (editor: Editor) => editor.chain().focus().toggleItalic()
  },
  {
    name: 'underline',
    label: 'format.underline',
    glyph: 'S',
    toggle: (editor: Editor) => editor.chain().focus().toggleUnderline()
  },
  {
    name: 'strike',
    label: 'format.strike',
    glyph: 'T',
    toggle: (editor: Editor) => editor.chain().focus().toggleStrike()
  },
  { name: 'code', label: 'format.code', glyph: '‹›', toggle: (editor: Editor) => editor.chain().focus().toggleCode() }
] as const

/** La barra de formato: sale al elegir texto (no dentro del código) */
export function FormatMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const toolbar = useRef<HTMLDivElement>(null)
  const [linking, setLinking] = useState(false)
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
      href: String(current.getAttributes('link').href ?? ''),
      text: current.state.doc.textBetween(current.state.selection.from, current.state.selection.to, ' ')
    })
  })
  // Si lo elegido es el nombre de una página (título o alias, y una sola), se propone enlazarlo
  const links = useContext(PageLinksContext)
  const named = active.text.trim() ? resolveName(active.text, links?.names ?? []) : []
  const page = named.length === 1 ? named[0] : undefined
  useReachWithKeyboard(editor, toolbar)
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatMenu"
      className={styles.bubble}
      // Que la barra en sí no sea una parada más del tabulador (se llega a sus botones con Alt+F10)
      tabIndex={-1}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: current, state }) =>
        current.isEditable &&
        state.selection instanceof TextSelection &&
        !state.selection.empty &&
        !current.isActive('codeBlock')
      }
    >
      <div ref={toolbar}>
        {linking ? (
          <LinkForm
            editor={editor}
            href={active.href}
            onDone={() => {
              setLinking(false)
              editor.commands.focus()
            }}
          />
        ) : (
          <div
            role="toolbar"
            aria-label={t('format.toolbar')}
            className={styles.toolbar}
            onKeyDown={toolbarKeys(editor)}
          >
            {MARKS.map((mark) => (
              <ToolButton
                key={mark.name}
                label={t(mark.label)}
                pressed={active[mark.name]}
                onClick={() => mark.toggle(editor).run()}
              >
                <span aria-hidden="true" className={styles[mark.name]}>
                  {mark.glyph}
                </span>
              </ToolButton>
            ))}
            <ToolButton label={t('format.link')} pressed={active.link} onClick={() => setLinking(true)} />
            {page && (
              <ToolButton
                label={t('links.linkTo', { title: page.title })}
                onClick={() => {
                  const text = active.text.trim()
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: 'pageLink',
                      attrs: { pageId: page.id, title: page.title, label: text === page.title ? null : text }
                    })
                    .run()
                }}
              />
            )}
          </div>
        )}
      </div>
    </BubbleMenu>
  )
}

/** Poner o quitar un enlace externo: solo http, https o mailto */
function LinkForm({ editor, href, onDone }: { editor: Editor; href: string; onDone: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [value, setValue] = useState(href)
  const [invalid, setInvalid] = useState(false)
  // Se abre al pulsar «Enlace»: a escribir la dirección
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  return (
    <form
      className={styles.link}
      onSubmit={(event) => {
        event.preventDefault()
        if (!isExternalUrl(value)) {
          setInvalid(true)
          return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: value.trim() }).run()
        onDone()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        onDone()
      }}
    >
      <label htmlFor={id} className={styles.linkLabel}>
        {t('format.linkUrl')}
      </label>
      <input
        ref={input}
        id={id}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          setValue(event.target.value)
          setInvalid(false)
        }}
      />
      <button type="submit" className={styles.button}>
        {t('format.linkApply')}
      </button>
      {href && (
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            onDone()
          }}
        >
          {t('format.linkRemove')}
        </button>
      )}
      {invalid && (
        <p id={`${id}-error`} role="alert" className={styles.error}>
          {t('format.linkInvalid')}
        </p>
      )}
    </form>
  )
}

/** La tabla en la que está el cursor, para colocar su barra encima */
function tableElement(editor: Editor) {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== 'table') continue
    const dom = editor.view.nodeDOM($from.before(depth))
    return dom instanceof HTMLElement ? dom : null
  }
  return null
}

/** La barra de la tabla: filas y columnas, la fila de cabecera y quitarla */
export function TableMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const toolbar = useRef<HTMLDivElement>(null)
  const headerRow = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const table = tableElement(current)
      return Boolean(table?.querySelector('tr:first-child > th'))
    }
  })
  useReachWithKeyboard(editor, toolbar)
  const run = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
    command(editor.chain().focus()).run()
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      className={styles.bubble}
      tabIndex={-1}
      options={{ placement: 'top-start', offset: 6 }}
      getReferencedVirtualElement={() => {
        const table = tableElement(editor)
        return table ? { getBoundingClientRect: () => table.getBoundingClientRect() } : null
      }}
      shouldShow={({ editor: current, state }) =>
        current.isEditable &&
        current.isActive('table') &&
        !(state.selection instanceof TextSelection && !state.selection.empty)
      }
    >
      <div
        ref={toolbar}
        role="toolbar"
        aria-label={t('table.toolbar')}
        className={styles.toolbar}
        onKeyDown={toolbarKeys(editor)}
      >
        <ToolButton label={t('table.addRow')} onClick={run((chain) => chain.addRowAfter())} />
        <ToolButton label={t('table.addColumn')} onClick={run((chain) => chain.addColumnAfter())} />
        <ToolButton label={t('table.deleteRow')} onClick={run((chain) => chain.deleteRow())} />
        <ToolButton label={t('table.deleteColumn')} onClick={run((chain) => chain.deleteColumn())} />
        <ToolButton
          label={t('table.headerRow')}
          pressed={headerRow}
          onClick={run((chain) => chain.toggleHeaderRow())}
        />
        <ToolButton label={t('table.delete')} onClick={run((chain) => chain.deleteTable())} />
      </div>
    </BubbleMenu>
  )
}
