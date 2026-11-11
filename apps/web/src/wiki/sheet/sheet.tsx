/**
 * La vista de hoja (spec § `hojas`): la página en páginas de papel, a dos columnas, con el tema elegido. Pinta lo que
 * da la API (con los secretos y los incrustados ya proyectados), mide cada bloque con el ancho de su columna en un
 * medidor oculto y lo reparte con el paginador del dominio, sin partir ningún bloque
 */
import '@fontsource/alegreya/400.css'
import '@fontsource/alegreya/400-italic.css'
import '@fontsource/alegreya/700.css'
import type { Page, SheetSettings } from '@crisol/contracts'
import { paginate, type SheetBlock, type SheetPage } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Block } from '../content.tsx'
import { ImageLoading } from '../file-embed.tsx'
import { usePageContent } from '../preview.tsx'
import styles from './sheet.module.css'

/** El papel, en px a 96 ppp, y sus márgenes */
export const PAPER = {
  a4: { width: 794, height: 1123 },
  letter: { width: 816, height: 1056 }
} as const
const MARGIN = { top: 56, side: 56, bottom: 72 }
const GAP = 28

const contentWidth = (settings: SheetSettings) => PAPER[settings.paper].width - 2 * MARGIN.side
const contentHeight = (settings: SheetSettings) => PAPER[settings.paper].height - MARGIN.top - MARGIN.bottom
const columnWidth = (settings: SheetSettings) => (contentWidth(settings) - GAP) / 2

const idOf = (block: JSONContent, index: number) => String(block.attrs?.id ?? `b${index}`)

/** Cómo cuenta cada bloque para paginar */
function kindOf(block: JSONContent, columns: 1 | 2): SheetBlock['kind'] {
  if (block.type === 'pageBreak') return 'pageBreak'
  if (block.type === 'columnBreak') return columns === 1 ? 'pageBreak' : 'columnBreak'
  // A una columna (lo de la página o tras un cambio de columnas), todo «a lo ancho»
  if (block.type === 'columnsChange' || columns === 1) return 'wide'
  if (block.type === 'heading') return 'heading'
  if (block.type === 'wideBlock' || block.attrs?.wide === true) return 'wide'
  return 'block'
}

/**
 * Lo que se mide y se pagina junto. Una nota lateral va en la misma caja que el bloque que la sigue: así flota a su
 * lado y su texto la rodea (cada caja es un flow-root, para medirla con sus márgenes)
 */
interface Unit {
  id: string
  kind: SheetBlock['kind']
  blocks: { id: string; block: JSONContent }[]
}

function unitsOf(blocks: readonly JSONContent[], start: 1 | 2): Unit[] {
  const units: Unit[] = []
  let columns = start
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as JSONContent
    const id = idOf(block, i)
    // Un cambio de columnas no se pinta ni ocupa: solo cambia lo que sigue
    if (block.type === 'columnsChange') {
      columns = block.attrs?.count === 1 ? 1 : 2
      continue
    }
    const next = blocks[i + 1]
    const nextKind = next ? kindOf(next, columns) : null
    // A dos columnas, con un bloque de su columna; a una, con el que sea (todo va a lo ancho), salvo un salto
    const pairs =
      nextKind === 'block' ||
      nextKind === 'heading' ||
      (columns === 1 && nextKind === 'wide' && next?.type !== 'columnsChange')
    if (block.type === 'sidenote' && next && pairs) {
      units.push({
        id,
        kind: nextKind,
        blocks: [
          { id, block },
          { id: idOf(next, i + 1), block: next }
        ]
      })
      i++
      continue
    }
    units.push({ id, kind: kindOf(block, columns), blocks: [{ id, block }] })
  }
  return units
}

/** En qué página sale cada título (para el índice) */
const PageNumbers = createContext<ReadonlyMap<string, number>>(new Map())

/** Un bloque en la hoja: los títulos como títulos de verdad, el índice con sus números, lo demás como en la sencilla */
function SheetBlockView({ block, worldId, headings }: { block: JSONContent; worldId: string; headings: Heading[] }) {
  const { t } = useTranslation()
  const pages = useContext(PageNumbers)
  if (block.type === 'heading') {
    const level = Math.min(Number(block.attrs?.level ?? 1), 3)
    const text = (block.content ?? []).map((n) => n.text ?? '').join('')
    const Tag = (['h2', 'h3', 'h4'] as const)[level - 1] ?? 'h2'
    return <Tag className={styles[`h${level}`]}>{text}</Tag>
  }
  if (block.type === 'tableOfContents') {
    return (
      <nav aria-label={t('sheet.toc')} className={styles.toc}>
        <p className={styles.tocTitle}>{t('sheet.toc')}</p>
        <ol>
          {headings.map((heading) => (
            <li key={heading.id} className={styles.tocEntry} style={{ paddingInlineStart: `${heading.level - 1}em` }}>
              <span className={styles.tocText}>{heading.text}</span>
              <span className={styles.tocDots} aria-hidden="true" />
              <span>{pages.get(heading.id) ?? ''}</span>
            </li>
          ))}
        </ol>
      </nav>
    )
  }
  if (block.type === 'pageBreak' || block.type === 'columnBreak') return null
  return <Block node={block} worldId={worldId} />
}

interface Heading {
  id: string
  text: string
  level: number
}

const headingsOf = (blocks: readonly JSONContent[]): Heading[] =>
  blocks.flatMap((block, i) =>
    block.type === 'heading'
      ? [
          {
            id: idOf(block, i),
            text: (block.content ?? []).map((n) => n.text ?? '').join(''),
            level: Number(block.attrs?.level ?? 1)
          }
        ]
      : []
  )

/** Cuánto encoger el papel para que quepa a lo ancho de su sitio (nunca agrandarlo; al imprimir, tal cual) */
function useFitScale(container: HTMLElement | null, paperWidth: number, printing: boolean) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    if (!container || printing || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? paperWidth
      setScale(Math.min(1, Math.max(0.3, width / paperWidth)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, paperWidth, printing])
  return scale
}

/** Lo que mide cada bloque (con sus márgenes) a su ancho: el de la columna o el de la página */
function useMeasured(units: readonly Unit[], settings: SheetSettings, measurer: HTMLDivElement | null) {
  const [heights, setHeights] = useState<Map<string, number> | null>(null)
  // Las imágenes que aún no han llegado (mientras, miden poco: se vuelve a medir con cada una)
  const [loading, setLoading] = useState(0)
  useLayoutEffect(() => {
    if (!measurer) return
    const measure = () => {
      const next = new Map<string, number>()
      for (const element of measurer.querySelectorAll<HTMLElement>('[data-measure]')) {
        next.set(element.dataset.measure ?? '', element.getBoundingClientRect().height)
      }
      // Solo si algo cambió: si no, cada medida pintaría otra vez y volvería a medir
      setHeights((current) =>
        current && current.size === next.size && [...next].every(([id, h]) => current.get(id) === h) ? current : next
      )
    }
    measure()
    // Cuando llegan las letras del tema, todo mide otra cosa
    void document.fonts?.ready.then(measure)
    const pending = [...measurer.querySelectorAll('img')].filter((img) => !img.complete)
    setLoading(pending.length)
    const loaded = () => {
      setLoading((count) => Math.max(0, count - 1))
      measure()
    }
    for (const img of pending) {
      img.addEventListener('load', loaded, { once: true })
      img.addEventListener('error', loaded, { once: true })
    }
    return () => {
      for (const img of pending) {
        img.removeEventListener('load', loaded)
        img.removeEventListener('error', loaded)
      }
    }
  }, [measurer, units, settings])
  return { heights, loading: loading > 0 }
}

export function SheetView({
  page,
  settings,
  onBlockClick,
  print,
  onReady
}: {
  page: Page
  settings: SheetSettings
  /** Pulsar un bloque de la hoja (para llevar el editor a él) */
  onBlockClick?: (blockId: string) => void
  /** Para imprimir: las notas ocultas nunca salen, y los secretos solo si se piden */
  print?: { secrets: boolean }
  /** Ya está paginada (para imprimir) */
  onReady?: () => void
}) {
  const { t } = useTranslation()
  const content = usePageContent(page.worldId, page.id, null, false)
  const printing = print !== undefined
  const secrets = print?.secrets ?? true
  const blocks = useMemo(() => {
    const all = (content.data?.blocks ?? []) as JSONContent[]
    if (!printing) return all
    return all.filter((block) => block.type !== 'note' && (secrets || block.type !== 'secret'))
  }, [content.data, printing, secrets])
  const [measurer, setMeasurer] = useState<HTMLDivElement | null>(null)
  const [sheetSection, setSheetSection] = useState<HTMLElement | null>(null)
  const units = useMemo(() => unitsOf(blocks, settings.columns), [blocks, settings.columns])
  const { heights, loading: imagesLoading } = useMeasured(units, settings, measurer)
  const headings = headingsOf(blocks)
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const pages: SheetPage[] = heights
    ? paginate(
        units.map((unit) => ({ id: unit.id, kind: unit.kind, height: heights.get(unit.id) ?? 0 })),
        contentHeight(settings)
      )
    : []
  // A lo ancho que haya (al lado del editor, más pequeña); se mide siempre a tamaño real
  const scale = useFitScale(sheetSection, PAPER[settings.paper].width, printing)
  // Lista cuando está paginada con todo medido, imágenes incluidas (el PDF del servidor espera a esto)
  const ready = content.data !== undefined && heights !== null && !imagesLoading
  useEffect(() => {
    if (ready) onReady?.()
  }, [ready, onReady])
  const numbers = new Map<string, number>()
  pages.forEach((sheetPage, index) => {
    for (const row of sheetPage.rows) {
      for (const id of row.kind === 'wide' ? [row.id] : row.columns.flat()) {
        for (const inner of byId.get(id)?.blocks ?? []) numbers.set(inner.id, settings.firstNumber + index)
      }
    }
  })
  const paper = PAPER[settings.paper]
  const render = (id: string): ReactNode => {
    const unit = byId.get(id)
    if (!unit) return null
    return (
      <div key={id} className={styles.block}>
        {unit.blocks.map(({ id: blockId, block }) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: pulsar un bloque lleva el editor a él; es un atajo del ratón
          // biome-ignore lint/a11y/useKeyWithClickEvents: con el teclado se va al editor y se mueve el cursor por el texto
          <div key={blockId} data-sheet-block={blockId} onClick={() => onBlockClick?.(blockId)}>
            <SheetBlockView block={block} worldId={page.worldId} headings={headings} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <ImageLoading.Provider value="eager">
      <PageNumbers.Provider value={numbers}>
        <section
          ref={setSheetSection}
          className={styles.sheet}
          data-theme={settings.theme}
          lang="es"
          aria-label={t('sheet.view')}
        >
          {/* El medidor: cada bloque a su ancho, fuera de la vista */}
          <div ref={setMeasurer} className={`${styles.measurer} ${styles.page}`} aria-hidden="true">
            {units.map((unit) => (
              <div
                key={unit.id}
                data-measure={unit.id}
                className={styles.block}
                style={{ inlineSize: unit.kind === 'wide' ? contentWidth(settings) : columnWidth(settings) }}
              >
                {unit.blocks.map(({ id, block }) => (
                  <div key={id}>
                    <SheetBlockView block={block} worldId={page.worldId} headings={headings} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {pages.map((sheetPage, index) => (
            <section
              key={index}
              className={styles.page}
              aria-label={t('sheet.pageLabel', { number: settings.firstNumber + index })}
              style={{ inlineSize: paper.width, blockSize: paper.height, zoom: scale }}
            >
              <div className={styles.content} style={{ blockSize: contentHeight(settings) }}>
                {sheetPage.rows.map((row, r) =>
                  row.kind === 'wide' ? (
                    render(row.id)
                  ) : (
                    <div key={r} className={styles.columns} style={{ columnGap: GAP }}>
                      <div className={styles.column}>{row.columns[0].map(render)}</div>
                      <div className={styles.column}>{row.columns[1].map(render)}</div>
                    </div>
                  )
                )}
              </div>
              {sheetPage.overflow.length > 0 && (
                <p role="note" className={styles.overflow}>
                  {t('sheet.overflow')}
                </p>
              )}
              {(settings.footer || settings.numbers) && (
                <footer className={styles.footer}>
                  <span>{settings.footer ? page.title : ''}</span>
                  <span>{settings.numbers ? settings.firstNumber + index : ''}</span>
                </footer>
              )}
            </section>
          ))}
        </section>
      </PageNumbers.Provider>
    </ImageLoading.Provider>
  )
}

/** Lleva la hoja (su contenedor con barra propia) al bloque del cursor del editor */
export function useFollowBlock(container: HTMLElement | null, blockId: string | null) {
  useEffect(() => {
    if (!container || !blockId) return
    const target = container.querySelector<HTMLElement>(`[data-sheet-block="${CSS.escape(blockId)}"]`)
    if (!target) return
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' })
  }, [container, blockId])
}
