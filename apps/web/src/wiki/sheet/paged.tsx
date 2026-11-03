/**
 * La hoja al escribir: el texto se ve ya maquetado, en sus páginas y a dos columnas, como saldrá al imprimir (mismo
 * paginador del dominio y mismas medidas que sheet.tsx), pero con los colores y la letra de la app, sin el papel del
 * tema. Cada bloque de primer nivel se coloca en su sitio con una decoración (position absolute); se mide al cambiar
 * el texto y se vuelve a colocar. Las páginas se dibujan detrás
 */
import type { SheetSettings } from '@crisol/contracts'
import { paginate, type SheetBlock } from '@crisol/domain'
import { type Editor, Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useState } from 'react'
import { GHOST_LINE } from '../ghost-line.ts'
import styles from './paged.module.css'
import { PAPER } from './sheet.tsx'

const MARGIN = { top: 56, side: 56, bottom: 72 }
const GAP = 28
/** Entre una página y la siguiente, en la vista al escribir */
const PAGE_GAP = 24

const contentWidth = (settings: SheetSettings) => PAPER[settings.paper].width - 2 * MARGIN.side

/**
 * Las medidas de la hoja a una escala k (sin zoom de CSS, que agrandaría también lo que flota dentro): el texto llena
 * la columna y todo crece o mengua a la par, así que cae igual que al imprimir
 */
function geometry(settings: SheetSettings, k: number) {
  const paper = PAPER[settings.paper]
  const width = paper.width * k
  const side = MARGIN.side * k
  const content = width - 2 * side
  const gap = GAP * k
  return {
    width,
    height: paper.height * k,
    side,
    top: MARGIN.top * k,
    content,
    contentHeight: (paper.height - MARGIN.top - MARGIN.bottom) * k,
    gap,
    column: (content - gap) / 2
  }
}

/** Cómo cuenta un bloque para paginar; a una columna, todo va «a lo ancho» (como en sheet.tsx) */
function kindOf(node: PMNode, columns: 1 | 2): SheetBlock['kind'] {
  if (node.type.name === 'pageBreak') return 'pageBreak'
  if (node.type.name === 'columnBreak') return columns === 1 ? 'pageBreak' : 'columnBreak'
  if (node.type.name === 'columnsChange') return 'wide'
  if (columns === 1) return 'wide'
  if (node.type.name === 'heading') return 'heading'
  if (node.type.name === 'wideBlock' || node.attrs.wide === true) return 'wide'
  return 'block'
}

const layoutKey = new PluginKey<{ styles: readonly string[] | null }>('hojaAlEscribir')

/** El sitio de cada bloque de primer nivel (por su orden), como estilo; null, sin hoja */
export const SheetLayout = Extension.create({
  name: 'sheetLayout',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: layoutKey,
        state: {
          init: (): { styles: readonly string[] | null } => ({ styles: null }),
          apply: (tr, value) => {
            const next = tr.getMeta(layoutKey) as { styles: readonly string[] | null } | undefined
            return next ?? value
          }
        },
        props: {
          decorations: (state) => {
            const placed = layoutKey.getState(state)?.styles
            if (!placed) return null
            const decorations: Decoration[] = []
            state.doc.forEach((node, offset, index) => {
              const style = placed[index]
              if (style) decorations.push(Decoration.node(offset, offset + node.nodeSize, { style }))
            })
            return DecorationSet.create(state.doc, decorations)
          }
        }
      })
    ]
  }
})

/** Lo que ocupa un bloque con sus márgenes (en px de la maqueta, sin el zoom) */
function heightOf(dom: HTMLElement) {
  const style = getComputedStyle(dom)
  return dom.offsetHeight + Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom)
}

/** Coloca los bloques y devuelve cuántas páginas hay */
function layOut(editor: Editor, settings: SheetSettings, k: number) {
  const g = geometry(settings, k)
  const { view, state } = editor
  const blocks: SheetBlock[] = []
  const heights: number[] = []
  // Las columnas de cada tramo: las de la página y, desde cada cambio, las suyas
  let columns: 1 | 2 = settings.columns
  state.doc.forEach((node, offset, index) => {
    if (node.type.name === 'columnsChange') columns = node.attrs.count === 1 ? 1 : 2
    const dom = view.nodeDOM(offset)
    // El cambio no ocupa sitio (su raya va encima de lo que sigue)
    const height = dom instanceof HTMLElement && node.type.name !== 'columnsChange' ? heightOf(dom) : 0
    heights.push(height)
    blocks.push({ id: String(index), kind: kindOf(node, columns), height })
  })
  const pages = paginate(blocks, g.contentHeight)
  const placed: string[] = blocks.map(
    (block) =>
      // Hasta que se coloque: a su ancho, para medirlo bien
      `position:absolute;left:0;top:0;width:${block.kind === 'wide' ? g.content : g.column}px;margin-inline:0;box-sizing:border-box`
  )
  let last: { x: number; y: number; width: number } | null = null
  const place = (id: string, x: number, y: number, width: number) => {
    const index = Number(id)
    placed[index] = `position:absolute;left:${x}px;top:${y}px;width:${width}px;margin-inline:0;box-sizing:border-box`
    last = { x, y: y + (heights[index] ?? 0), width }
  }
  pages.forEach((page, p) => {
    let y = p * (g.height + PAGE_GAP)
    for (const row of page.rows) {
      if (row.kind === 'wide') {
        place(row.id, 0, y, g.content)
        y += heights[Number(row.id)] ?? 0
        continue
      }
      let left = y
      let right = y
      for (const id of row.columns[0]) {
        place(id, 0, left, g.column)
        left += heights[Number(id)] ?? 0
      }
      for (const id of row.columns[1]) {
        place(id, g.column + g.gap, right, g.column)
        right += heights[Number(id)] ?? 0
      }
      y = Math.max(left, right)
    }
  })
  const current = layoutKey.getState(state)?.styles
  const changed = !current || current.length !== placed.length || current.some((style, i) => style !== placed[i])
  if (changed) view.dispatch(state.tr.setMeta(layoutKey, { styles: placed }).setMeta('addToHistory', false))
  // La línea de más, debajo del último bloque (es de otra extensión: se coloca aquí, sin pasar por el documento)
  const ghost = view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)
  const end = last as { x: number; y: number; width: number } | null
  if (ghost && end) {
    Object.assign(ghost.style, { position: 'absolute', left: `${end.x}px`, top: `${end.y}px`, width: `${end.width}px` })
  }
  return { pages: Math.max(1, pages.length), changed }
}

/** Quita la maqueta (sin hoja, o en lo estrecho) */
function clear(editor: Editor) {
  if (layoutKey.getState(editor.state)?.styles) {
    editor.view.dispatch(editor.state.tr.setMeta(layoutKey, { styles: null }).setMeta('addToHistory', false))
  }
  editor.view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)?.removeAttribute('style')
}

/** Cuánto escalar las páginas para que quepan a lo ancho de su sitio, sin pasar del tamaño de letra de siempre */
function useFit(container: HTMLElement | null, width: number) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      // Como mucho, la letra del tamaño de siempre (12 pt de la hoja = 16 px; el texto de la app, 17 px)
      setScale(Math.min(MAX_SCALE, Math.max(0.4, (entry?.contentRect.width ?? width) / width)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, width])
  return scale
}

/** La escala más grande: la letra de la hoja, del tamaño del texto de siempre */
const MAX_SCALE = 17 / 16

/** Para medir antes de tener ajustes */
const DEFAULT_GEOMETRY: SheetSettings = {
  paper: 'a4',
  theme: 'neutro',
  numbers: true,
  firstNumber: 1,
  footer: true,
  columns: 1
}

/** En lo estrecho (el móvil), una columna seguida, sin páginas */
const NARROW = '(max-width: 48rem)'

export function PagedSheet({
  editor,
  settings,
  ready,
  children
}: {
  editor: Editor | null
  settings: SheetSettings | null
  /** El texto ya llegó del servidor: antes no se coloca nada (una transacción antes de tiempo metería una línea) */
  ready: boolean
  children: ReactNode
}) {
  const [pages, setPages] = useState(1)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(NARROW).matches)
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  // El texto llena la columna (alineado con el título); el margen del papel queda fuera, sin verse
  const scale = useFit(frame, contentWidth(settings ?? DEFAULT_GEOMETRY))
  const paged = Boolean(settings) && !narrow

  useEffect(() => {
    const query = window.matchMedia?.(NARROW)
    if (!query) return
    const change = () => setNarrow(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (!paged || !settings) {
      clear(editor)
      return
    }
    if (!ready) return
    let frameId = 0
    let passes = 0
    const run = () => {
      frameId = 0
      if (editor.isDestroyed) return
      const result = layOut(editor, settings, scale)
      setPages(result.pages)
      // Colocar cambia el ancho de los nuevos: se mide otra vez hasta que no cambie nada
      if (result.changed && passes++ < 4) schedule()
      else passes = 0
    }
    const schedule = () => {
      if (!frameId) frameId = requestAnimationFrame(run)
    }
    const onUpdate = () => {
      passes = 0
      schedule()
    }
    schedule()
    editor.on('update', onUpdate)
    // Cuando un bloque cambia de alto sin cambiar el texto (una imagen que llega, la letra que carga)
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onUpdate)
    const observeAll = () => {
      resized?.disconnect()
      for (const child of editor.view.dom.children) resized?.observe(child)
    }
    observeAll()
    editor.on('update', observeAll)
    void document.fonts?.ready.then(onUpdate)
    return () => {
      cancelAnimationFrame(frameId)
      editor.off('update', onUpdate)
      editor.off('update', observeAll)
      resized?.disconnect()
      if (!editor.isDestroyed) clear(editor)
    }
  }, [editor, paged, settings, ready, scale])

  if (!paged || !settings) return <>{children}</>
  const g = geometry(settings, scale)
  const height = pages * (g.height + PAGE_GAP) - PAGE_GAP
  return (
    <div ref={setFrame} className={styles.fit}>
      <div
        className={styles.paged}
        style={
          {
            inlineSize: g.width,
            blockSize: height,
            marginInlineStart: -g.side,
            marginBlockStart: -g.top + 8,
            '--sheet-k': scale
          } as CSSProperties
        }
        data-sheet-paged=""
      >
        {/* Las páginas, detrás del texto */}
        {Array.from({ length: pages }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: las páginas son su número
            key={index}
            className={styles.page}
            aria-hidden="true"
            style={{ insetBlockStart: index * (g.height + PAGE_GAP), blockSize: g.height }}
          >
            {/* Al escribir, sin pie (es para imprimir): en la raya entre páginas, su número, pequeño */}
            {index > 0 && <span className={styles.number}>{settings.firstNumber + index}</span>}
          </div>
        ))}
        <div
          className={styles.text}
          style={{ insetBlockStart: g.top, insetInlineStart: g.side, inlineSize: g.content, blockSize: height - g.top }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
