/**
 * El asa de los bloques: sale al pasar el ratón junto a uno, se arrastra para moverlo y al pulsarla abre su menú
 * (convertir, duplicar, subir, bajar y borrar). El mismo menú se abre desde la barra, para el bloque del cursor: así
 * vale con el teclado y en el móvil
 */
import { withoutBlockIds } from '@crisol/editor'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { Editor } from '@tiptap/core'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from '../components/announcer.tsx'
import { BLOCKS, type BlockChoice, type BlockContext } from './blocks.ts'
import styles from './drag-handle.module.css'
import { copiesOf } from './separate.tsx'

export interface BlockTarget {
  pos: number
  node: PMNode
}

/** Los bloques que se pueden convertir en otros: el texto y lo que lleva texto dentro */
const CONVERTIBLE = [
  'paragraph',
  'heading',
  'codeBlock',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
  'callout',
  'box'
]

/** El bloque de primer nivel en el que está el cursor (o el elegido entero) */
export function blockAtCursor(editor: Editor): BlockTarget | null {
  const { selection, doc } = editor.state
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    return { pos: selection.from, node: selection.node }
  }
  if (selection.$from.depth === 0) return null
  const pos = selection.$from.before(1)
  const node = doc.nodeAt(pos)
  return node ? { pos, node } : null
}

/** Convierte el bloque en otro: elige todo lo de dentro, le quita los envoltorios y aplica el nuevo */
async function convert(editor: Editor, { pos, node }: BlockTarget, block: BlockChoice, context: BlockContext) {
  const kind = block.id.startsWith('callout-') ? block.id.slice('callout-'.length) : null
  if (node.type.name === 'callout' && kind) {
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind })
        return true
      })
      .run()
    return
  }
  const { state } = editor
  const inside = TextSelection.between(state.doc.resolve(pos + 1), state.doc.resolve(pos + node.nodeSize - 1))
  editor.view.dispatch(state.tr.setSelection(inside))
  if (block.group !== 'master') editor.chain().focus().clearNodes().run()
  await block.run(editor, context)
}

/** Una copia justo debajo: sin sus ids, y los secretos de dentro pasan a ser copias */
function duplicate(editor: Editor, { pos, node }: BlockTarget) {
  const copy = copiesOf(withoutBlockIds(Fragment.from(node)))
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.insert(pos + node.nodeSize, copy)
      return true
    })
    .run()
}

/** Sube o baja el bloque un puesto entre los de su nivel */
function move(editor: Editor, { pos, node }: BlockTarget, step: -1 | 1) {
  const { doc } = editor.state
  const $pos = doc.resolve(pos)
  const index = $pos.index()
  const sibling = $pos.parent.maybeChild(index + step)
  if (!sibling) return
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(pos, pos + node.nodeSize)
      const to = step === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize
      tr.insert(to, node)
      tr.setSelection(NodeSelection.create(tr.doc, to))
      return true
    })
    .run()
}

function remove(editor: Editor, { pos, node }: BlockTarget) {
  editor
    .chain()
    .focus()
    .deleteRange({ from: pos, to: pos + node.nodeSize })
    .run()
}

/** El asa, junto al bloque bajo el ratón */
export function BlockHandle({ editor, context }: { editor: Editor; context: BlockContext }) {
  const { t } = useTranslation()
  const target = useRef<BlockTarget | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<BlockTarget | null>(null)
  return (
    <>
      <DragHandle
        editor={editor}
        className={styles.handle}
        // El último bloque junto al que salió: al ir del bloque al asa se deja de estar sobre él
        onNodeChange={({ node, pos }) => {
          if (node) target.current = { node, pos }
        }}
      >
        <button
          ref={button}
          type="button"
          className={styles.grip}
          aria-label={t('blockMenu.open')}
          aria-haspopup="menu"
          aria-expanded={Boolean(open)}
          title={t('blockMenu.open')}
          onClick={() => {
            // Si el texto cambió desde entonces, el bloque está donde esté ahora
            const last = target.current
            const node = last && editor.state.doc.nodeAt(last.pos)
            if (!last || !node || node.type !== last.node.type) return
            // Que el asa no se vaya mientras el menú está abierto (es la meta de su plugin)
            editor.commands.setMeta('lockDragHandle', true)
            setOpen({ pos: last.pos, node })
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 10 16">
            {[3, 8, 13].flatMap((y) => [
              <circle key={`a${y}`} cx="2.5" cy={y} r="1.5" />,
              <circle key={`b${y}`} cx="7.5" cy={y} r="1.5" />
            ])}
          </svg>
        </button>
      </DragHandle>
      {open && (
        <BlockMenu
          editor={editor}
          target={open}
          anchor={button.current}
          context={context}
          onClose={(returnFocus) => {
            setOpen(null)
            editor.commands.setMeta('lockDragHandle', false)
            if (returnFocus) editor.commands.focus()
          }}
        />
      )}
    </>
  )
}

/** El menú de un bloque: convertir en otro, duplicar, subir, bajar y borrar */
export function BlockMenu({
  editor,
  target,
  anchor,
  context,
  onClose
}: {
  editor: Editor
  target: BlockTarget
  anchor: HTMLElement | null
  context: BlockContext
  onClose: (returnFocus?: boolean) => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const convertible = CONVERTIBLE.includes(target.node.type.name)
  const $pos = editor.state.doc.resolve(target.pos)
  const first = $pos.index() === 0
  const last = $pos.index() === $pos.parent.childCount - 1

  // Junto a lo que lo abrió, y que no se salga de la pantalla
  useLayoutEffect(() => {
    const element = menu.current
    if (!element || !anchor) return
    return autoUpdate(anchor, element, () => {
      void computePosition(anchor, element, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [
          offset(4),
          flip(),
          shift({ padding: 8 }),
          // Si no cabe ni arriba ni abajo, se encoge al hueco que queda y se desplaza por dentro
          size({
            padding: 8,
            apply: ({ availableHeight, elements }) => {
              elements.floating.style.maxBlockSize = `${Math.max(160, availableHeight)}px`
            }
          })
        ]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [anchor])

  // Al abrirse, el foco va a la primera opción; un clic fuera lo cierra
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const act = (action: () => unknown, done: string) => () => {
    onClose()
    void Promise.resolve(action()).then(() => announce(done))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const go = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(index + 1)
    else if (event.key === 'ArrowUp') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
    else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose(true)
    }
  }

  const blocks = BLOCKS.filter((block) => block.convert)
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={t('blockMenu.title')}
      className={styles.menu}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {convertible && (
        // biome-ignore lint/a11y/useSemanticElements: un grupo de opciones del menú (ARIA), no un grupo de un formulario
        <div role="group" aria-labelledby={`${id}-convert`}>
          <div id={`${id}-convert`} className={styles.group}>
            {t('blockMenu.convert')}
          </div>
          <div className={styles.grid}>
            {blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                onClick={act(
                  () => convert(editor, target, block, context),
                  t('blockMenu.converted', { block: t(`blocks.${block.label}`).toLowerCase() })
                )}
              >
                {t(`blocks.${block.label}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: un grupo de opciones del menú (ARIA), no un grupo de un formulario */}
      <div role="group" aria-label={t('blockMenu.actions')} className={styles.actions}>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={styles.item}
          onClick={act(() => duplicate(editor, target), t('blockMenu.duplicated'))}
        >
          {t('blockMenu.duplicate')}
        </button>
        {!first && (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={styles.item}
            onClick={act(() => move(editor, target, -1), t('blockMenu.moved'))}
          >
            {t('blockMenu.up')}
          </button>
        )}
        {!last && (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={styles.item}
            onClick={act(() => move(editor, target, 1), t('blockMenu.moved'))}
          >
            {t('blockMenu.down')}
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={`${styles.item} ${styles.danger}`}
          onClick={act(() => remove(editor, target), t('blockMenu.deleted'))}
        >
          {t('blockMenu.delete')}
        </button>
      </div>
    </div>,
    document.body
  )
}
