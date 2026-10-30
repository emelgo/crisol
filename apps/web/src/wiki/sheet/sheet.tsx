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
function kindOf(block: JSONContent): SheetBlock['kind'] {
  if (block.type === 'pageBreak') return 'pageBreak'
  if (block.type === 'columnBreak') return 'columnBreak'
  if (block.type === 'heading') return 'heading'
  if (block.type === 'wideBlock' || block.attrs?.wide === true) return 'wide'
  return 'block'
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

/** Lo que mide cada bloque (con sus márgenes) a su ancho: el de la columna o el de la página */
function useMeasured(blocks: readonly JSONContent[], settings: SheetSettings, measurer: HTMLDivElement | null) {
  const [heights, setHeights] = useState<Map<string, number> | null>(null)
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
  }, [measurer, blocks, settings])
  return heights
}

export function SheetView({
  page,
  settings,
  onBlockClick
}: {
  page: Page
  settings: SheetSettings
  /** Pulsar un bloque de la hoja (para llevar el editor a él) */
  onBlockClick?: (blockId: string) => void
}) {
  const { t } = useTranslation()
  const content = usePageContent(page.worldId, page.id, null, false)
  const blocks = useMemo(() => (content.data?.blocks ?? []) as JSONContent[], [content.data])
  const [measurer, setMeasurer] = useState<HTMLDivElement | null>(null)
  const heights = useMeasured(blocks, settings, measurer)
  const headings = headingsOf(blocks)
  const byId = new Map(blocks.map((block, i) => [idOf(block, i), block]))
  const pages: SheetPage[] = heights
    ? paginate(
        blocks.map((block, i) => ({
          id: idOf(block, i),
          kind: kindOf(block),
          height: heights.get(idOf(block, i)) ?? 0
        })),
        contentHeight(settings)
      )
    : []
  const numbers = new Map<string, number>()
  pages.forEach((sheetPage, index) => {
    for (const row of sheetPage.rows) {
      for (const id of row.kind === 'wide' ? [row.id] : row.columns.flat()) {
        numbers.set(id, settings.firstNumber + index)
      }
    }
  })
  const paper = PAPER[settings.paper]
  const render = (id: string): ReactNode => {
    const block = byId.get(id)
    if (!block) return null
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: pulsar un bloque lleva el editor a él; es un atajo del ratón
      // biome-ignore lint/a11y/useKeyWithClickEvents: con el teclado se va al editor y se mueve el cursor por el texto
      <div key={id} data-sheet-block={id} className={styles.block} onClick={() => onBlockClick?.(id)}>
        <SheetBlockView block={block} worldId={page.worldId} headings={headings} />
      </div>
    )
  }
  return (
    <PageNumbers.Provider value={numbers}>
      <section className={styles.sheet} data-theme={settings.theme} lang="es" aria-label={t('sheet.view')}>
        {/* El medidor: cada bloque a su ancho, fuera de la vista */}
        <div ref={setMeasurer} className={`${styles.measurer} ${styles.page}`} aria-hidden="true">
          {blocks.map((block, i) => (
            <div
              key={idOf(block, i)}
              data-measure={idOf(block, i)}
              className={styles.block}
              style={{ inlineSize: kindOf(block) === 'wide' ? contentWidth(settings) : columnWidth(settings) }}
            >
              <SheetBlockView block={block} worldId={page.worldId} headings={headings} />
            </div>
          ))}
        </div>
        {pages.map((sheetPage, index) => (
          <section
            key={index}
            className={styles.page}
            aria-label={t('sheet.pageLabel', { number: settings.firstNumber + index })}
            style={{ inlineSize: paper.width, blockSize: paper.height }}
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
