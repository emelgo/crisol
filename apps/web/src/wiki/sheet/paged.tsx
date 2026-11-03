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
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GHOST_LINE } from '../ghost-line.ts'
import styles from './paged.module.css'
import { PAPER } from './sheet.tsx'

const MARGIN = { top: 56, side: 56, bottom: 72 }
const GAP = 28
/** Entre una página y la siguiente, al escribir: el hueco de su marca (sin papel: se escribe seguido) */
const MARKER = 28

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

interface LayoutState {
  styles: readonly string[] | null
  /** Hay bloques nuevos (o de menos) que aún no se han vuelto a colocar */
  stale: boolean
}

const layoutKey = new PluginKey<LayoutState>('hojaAlEscribir')

/**
 * Las vistas que dejaron un desplazamiento al cursor para después de colocar: mientras la maqueta está desfasada, un
 * bloque nuevo aún va en el flujo (arriba del todo) y desplazarse a él subiría la vista al principio
 */
const pendingScroll = new WeakSet<EditorView>()

/** El sitio de cada bloque de primer nivel (por su orden), como estilo; null, sin hoja */
export const SheetLayout = Extension.create({
  name: 'sheetLayout',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: layoutKey,
        state: {
          init: (): LayoutState => ({ styles: null, stale: false }),
          apply: (tr, value): LayoutState => {
            const next = tr.getMeta(layoutKey) as { styles: readonly string[] | null } | undefined
            if (next) return { styles: next.styles, stale: false }
            // Desfasada solo si cambia cuántos bloques hay (uno nuevo aún no tiene sitio); al mover o escribir, no
            const missing = tr.docChanged && value.styles && tr.doc.childCount !== value.styles.length
            return missing && !value.stale ? { ...value, stale: true } : value
          }
        },
        props: {
          handleScrollToSelection: (view) => {
            if (!layoutKey.getState(view.state)?.stale) return false
            pendingScroll.add(view)
            return true
          },
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

/** Dónde empieza una página (salvo la primera), para su marca; manual: tras un salto de página */
export interface PageMark {
  y: number
  number: number
}

/**
 * Coloca los bloques: las páginas se calculan como al imprimir (qué cabe en cada una y cómo se reparten sus dos
 * columnas), pero van seguidas, sin el hueco de lo que no se llena: se escribe sin saltar. Devuelve el alto y las
 * marcas de cada página
 */
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
    const height = dom instanceof HTMLElement ? heightOf(dom) : 0
    heights.push(height)
    // El cambio de columnas tiene su sitio en pantalla, pero al imprimir no sale: no cuenta para repartir las páginas
    blocks.push({
      id: String(index),
      kind: kindOf(node, columns),
      height: node.type.name === 'columnsChange' ? 0 : height
    })
  })
  // Como al imprimir (sheet.tsx, unitsOf): una nota lateral va con el bloque que la sigue, en la misma columna y página
  const types: string[] = []
  state.doc.forEach((node) => {
    types.push(node.type.name)
  })
  const members = new Map<string, number[]>()
  const units: SheetBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as SheetBlock
    const next = blocks[i + 1]
    if (types[i] === 'sidenote' && next && (next.kind === 'block' || next.kind === 'heading')) {
      units.push({ id: block.id, kind: next.kind, height: block.height + next.height })
      members.set(block.id, [i, i + 1])
      i++
      continue
    }
    units.push(block)
    members.set(block.id, [i])
  }
  const pages = paginate(units, g.contentHeight)
  const placed: string[] = blocks.map(
    (block) =>
      // Hasta que se coloque: a su ancho, para medirlo bien
      `position:absolute;left:0;top:0;width:${block.kind === 'wide' ? g.content : g.column}px;margin-inline:0;box-sizing:border-box`
  )
  // Dónde acaba cada bloque colocado (por su orden)
  const ends: ({ x: number; y: number; width: number } | undefined)[] = []
  const place = (id: string, x: number, y: number, width: number) => {
    const index = Number(id)
    placed[index] = `position:absolute;left:${x}px;top:${y}px;width:${width}px;margin-inline:0;box-sizing:border-box`
    ends[index] = { x, y: y + (heights[index] ?? 0), width }
  }
  /** Coloca una unidad (un bloque, o la nota lateral y el suyo, uno debajo del otro) y devuelve lo que ocupa */
  const placeUnit = (id: string, x: number, y: number, width: number) => {
    let at = y
    for (const index of members.get(id) ?? [Number(id)]) {
      place(String(index), x, at, width)
      at += heights[index] ?? 0
    }
    return at - y
  }
  const marks: PageMark[] = []
  const idsOf = (page: (typeof pages)[number]) =>
    page.rows
      .flatMap((row) => (row.kind === 'wide' ? [row.id] : row.columns.flat()))
      .flatMap((id) => members.get(id) ?? [Number(id)])
  let top = 0
  // Saltos antes del primer bloque (paginate no abre página para ellos): arriba del todo, empujando lo demás
  const firstId = pages[0] ? Math.min(blocks.length, ...idsOf(pages[0])) : blocks.length
  for (const block of blocks.slice(0, firstId)) {
    if (block.kind !== 'pageBreak' && block.kind !== 'columnBreak') continue
    place(block.id, 0, top, g.content)
    top += heights[Number(block.id)] ?? 0
  }
  pages.forEach((page, p) => {
    if (p > 0) {
      // Entre esta y la de antes: sus saltos de página (su raya hace de marca) o, si no hay, la marca con el número
      const before = Math.max(-1, ...idsOf(pages[p - 1] as (typeof pages)[number]))
      const after = Math.min(blocks.length, ...idsOf(page))
      const breaks = blocks.slice(before + 1, after).filter((block) => block.kind === 'pageBreak')
      if (breaks.length > 0) {
        for (const block of breaks) {
          place(block.id, 0, top, g.content)
          top += heights[Number(block.id)] ?? 0
        }
      } else {
        marks.push({ y: top + MARKER * k * 0.5, number: settings.firstNumber + p })
        top += MARKER * k
      }
    }
    let y = top
    for (const row of page.rows) {
      if (row.kind === 'wide') {
        y += placeUnit(row.id, 0, y, g.content)
        continue
      }
      let left = y
      let right = y
      for (const id of row.columns[0]) left += placeUnit(id, 0, left, g.column)
      for (const id of row.columns[1]) right += placeUnit(id, g.column + g.gap, right, g.column)
      y = Math.max(left, right)
    }
    top = y
  })
  // Los demás saltos (de columna, o uno al final) no van en ninguna fila: su raya, justo debajo del bloque de antes
  blocks.forEach((block, index) => {
    if (ends[index]) return
    const before = ends[index - 1] ?? { x: 0, y: 0, width: g.content }
    place(block.id, before.x, before.y, before.width)
    if (before.y + (heights[index] ?? 0) > top) top = before.y + (heights[index] ?? 0)
  })
  const last = ends.at(-1) ?? null
  const current = layoutKey.getState(state)?.styles
  const changed = !current || current.length !== placed.length || current.some((style, i) => style !== placed[i])
  if (changed || layoutKey.getState(state)?.stale) {
    view.dispatch(state.tr.setMeta(layoutKey, { styles: placed }).setMeta('addToHistory', false))
  }
  // Ya en su sitio: el desplazamiento al cursor que quedó pendiente
  if (pendingScroll.has(view) && !changed) {
    pendingScroll.delete(view)
    view.dispatch(view.state.tr.scrollIntoView().setMeta('addToHistory', false))
  }
  // La línea de más, debajo del último bloque (es de otra extensión: se coloca aquí, sin pasar por el documento)
  const ghost = view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)
  if (ghost && last) {
    Object.assign(ghost.style, {
      position: 'absolute',
      left: `${last.x}px`,
      top: `${last.y}px`,
      width: `${last.width}px`
    })
  }
  return { height: top, marks, changed }
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
  const { t } = useTranslation()
  const [layout, setLayout] = useState<{ height: number; marks: readonly PageMark[] }>({ height: 0, marks: [] })
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
    // Tras limpiar (otra escala, lo estrecho), lo que quedó pendiente (las letras al cargar) ya no coloca nada
    let disposed = false
    const run = () => {
      frameId = 0
      if (disposed || editor.isDestroyed) return
      const result = layOut(editor, settings, scale)
      setLayout((current) =>
        current.height === result.height && JSON.stringify(current.marks) === JSON.stringify(result.marks)
          ? current
          : { height: result.height, marks: result.marks }
      )
      // Colocar cambia el ancho de los nuevos: se mide otra vez hasta que no cambie nada
      if (result.changed && passes++ < 4) schedule()
      else passes = 0
    }
    const schedule = () => {
      if (!disposed && !frameId) frameId = requestAnimationFrame(run)
    }
    const onUpdate = () => {
      passes = 0
      schedule()
    }
    schedule()
    editor.on('update', onUpdate)
    // Cuando un bloque cambia de alto sin cambiar el texto (una imagen que llega, la letra que carga)
    // (el primer aviso es el de empezar a observar: ya se va a colocar igualmente)
    let primed = false
    const resized =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (primed) onUpdate()
            primed = true
          })
    // Solo los bloques nuevos (observarlos todos en cada cambio haría medir todo otra vez)
    const observed = new Set<Element>()
    const observeAll = () => {
      for (const child of editor.view.dom.children) {
        if (observed.has(child)) continue
        observed.add(child)
        resized?.observe(child)
      }
      for (const element of observed) {
        if (element.isConnected) continue
        observed.delete(element)
        resized?.unobserve(element)
      }
    }
    observeAll()
    editor.on('update', observeAll)
    void document.fonts?.ready.then(onUpdate)
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      editor.off('update', onUpdate)
      editor.off('update', observeAll)
      resized?.disconnect()
      if (!editor.isDestroyed) clear(editor)
    }
  }, [editor, paged, settings, ready, scale])

  if (!paged || !settings) return <>{children}</>
  const g = geometry(settings, scale)
  // Debajo, sitio para la línea de más
  const height = layout.height + 32 * scale
  return (
    <div ref={setFrame} className={styles.fit}>
      <div
        className={styles.paged}
        // Sin el texto aún (sin conexión), sin colocar: a su alto, con el texto en el flujo
        style={{ inlineSize: g.content, blockSize: ready ? height : undefined, '--sheet-k': scale } as CSSProperties}
        data-sheet-paged=""
        data-placed={ready || undefined}
      >
        {/* Dónde empieza cada página (se calculan por detrás, como al imprimir): una raya fina con su número */}
        {layout.marks.map((mark) => (
          <div key={mark.number} className={styles.mark} style={{ insetBlockStart: mark.y }} aria-hidden="true">
            <span>{t('sheet.pageLabel', { number: mark.number })}</span>
          </div>
        ))}
        <div className={styles.text} style={ready ? { inset: 0 } : { position: 'static' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
