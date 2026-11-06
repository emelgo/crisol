/**
 * El visor de PDF en una página: antes de nada enseña el nombre y el tamaño, y pdf.js (Apache-2.0) solo se carga al
 * pedirlo. Pide los bytes a trozos (Range), así que un libro de 200 MB se abre por la página que toque sin bajarlo
 * entero. Va a una página y abre por la que diga el bloque (`#page=12`)
 */
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loading } from '../components/brand.tsx'
import styles from './pdf-viewer.module.css'

export function PdfViewer({ url, name, size, page }: { url: string; name: string; size: number; page: number | null }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const megabytes = new Intl.NumberFormat(i18n.language, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1
  }).format(size / (1024 * 1024))
  const href = page ? `${url}#page=${page}` : url
  return (
    <div className={styles.viewer}>
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          {page ? t('pdf.metaFromPage', { size: megabytes, page }) : t('pdf.meta', { size: megabytes })}
        </span>
        {!open && (
          <button
            type="button"
            className={styles.button}
            aria-label={t('pdf.showLabel', { name })}
            onClick={() => setOpen(true)}
          >
            {t('pdf.show')}
          </button>
        )}
        <a href={href} target="_blank" rel="noopener" aria-label={t('pdf.openLabel', { name })}>
          {t('pdf.open')}
        </a>
      </div>
      {open && <PdfPages url={url} name={name} first={page ?? 1} />}
    </div>
  )
}

type Loaded = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; doc: PDFDocumentProxy }

/** Para comparar: sin tildes ni mayúsculas */
const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Las páginas de un PDF, una a una, con su capa de texto (se puede seleccionar) y, si se dice, lo buscado marcado: las
 * líneas que llevan alguna de esas palabras (sin tildes)
 */
export function PdfPages({
  url,
  name,
  first,
  highlight = []
}: {
  url: string
  name: string
  first: number
  highlight?: readonly string[]
}) {
  const { t } = useTranslation()
  const pageId = useId()
  const frame = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const textLayer = useRef<HTMLDivElement>(null)
  const words = highlight.map(folded).filter((word) => word.length >= 3)
  const marked = words.join(' ')
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [current, setCurrent] = useState(first)
  const [typed, setTyped] = useState(String(first))
  // Al abrirse, el foco pasa al visor (el botón que lo abrió ya no está)
  useEffect(() => {
    frame.current?.focus()
  }, [])

  // El documento: pdf.js y su worker se piden ahora, no antes
  useEffect(() => {
    let cancelled = false
    let destroy: (() => Promise<void>) | null = null
    const load = async () => {
      const pdfjs = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const task = pdfjs.getDocument({ url, disableAutoFetch: true })
      destroy = () => task.destroy()
      const doc = await task.promise
      if (cancelled) return
      setLoaded({ state: 'ready', doc })
      const start = Math.min(Math.max(1, first), doc.numPages)
      setCurrent(start)
      setTyped(String(start))
    }
    load().catch(() => {
      if (!cancelled) setLoaded({ state: 'failed' })
    })
    return () => {
      cancelled = true
      void destroy?.()
    }
  }, [url, first])

  // La página que toca, al ancho del visor, con su capa de texto encima
  useEffect(() => {
    if (loaded.state !== 'ready') return
    let task: RenderTask | null = null
    let layer: { cancel(): void } | null = null
    let cancelled = false
    const draw = async () => {
      const pdfPage = await loaded.doc.getPage(current)
      const target = canvas.current
      const text = textLayer.current
      if (cancelled || !target) return
      const base = pdfPage.getViewport({ scale: 1 })
      const width = Math.min(frame.current?.clientWidth || base.width, 1100)
      const ratio = window.devicePixelRatio || 1
      const scale = width / base.width
      const viewport = pdfPage.getViewport({ scale: scale * ratio })
      target.width = Math.floor(viewport.width)
      target.height = Math.floor(viewport.height)
      target.style.inlineSize = `${Math.floor(viewport.width / ratio)}px`
      task = pdfPage.render({ canvas: target, viewport })
      if (text) {
        const { TextLayer } = await import('pdfjs-dist')
        text.replaceChildren()
        const shown = pdfPage.getViewport({ scale })
        text.style.setProperty('--total-scale-factor', String(scale))
        text.style.setProperty('--scale-factor', String(scale))
        const textLayerTask = new TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container: text,
          viewport: shown
        })
        layer = textLayerTask
        await textLayerTask.render()
        // Lo buscado, marcado: las líneas que lo llevan
        const wanted = marked ? marked.split(' ') : []
        if (wanted.length > 0)
          for (const span of text.querySelectorAll('span')) {
            const line = folded(span.textContent ?? '')
            if (wanted.some((word) => line.includes(word))) span.classList.add(styles.hit ?? 'hit')
          }
      }
      await task.promise
    }
    draw().catch(() => {
      // Cancelada al pasar de página: no es un fallo
    })
    return () => {
      cancelled = true
      task?.cancel()
      layer?.cancel()
    }
  }, [loaded, current, marked])

  // El mismo contenedor mientras carga, si falla y con las páginas: el foco no se pierde al cambiar
  if (loaded.state !== 'ready')
    return (
      <section ref={frame} className={styles.pages} tabIndex={-1} aria-label={t('pdf.viewer', { name })}>
        {loaded.state === 'loading' ? (
          <Loading label={t('pdf.loading')} />
        ) : (
          <p role="alert" className={styles.note}>
            {t('pdf.failed')}
          </p>
        )}
      </section>
    )
  const total = loaded.doc.numPages
  const go = (page: number) => {
    const next = Math.min(Math.max(1, page), total)
    setCurrent(next)
    setTyped(String(next))
  }
  return (
    <section ref={frame} className={styles.pages} tabIndex={-1} aria-label={t('pdf.viewer', { name })}>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.button}
          aria-disabled={current <= 1 || undefined}
          onClick={() => current > 1 && go(current - 1)}
        >
          {t('pdf.previous')}
        </button>
        <form
          className={styles.goto}
          onSubmit={(event) => {
            event.preventDefault()
            go(Number(typed) || current)
          }}
        >
          <label htmlFor={pageId}>{t('pdf.page')}</label>
          <input
            id={pageId}
            inputMode="numeric"
            className={styles.number}
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value.replace(/\D/g, ''))}
            onBlur={() => go(Number(typed) || current)}
          />
          <span>{t('pdf.of', { total })}</span>
        </form>
        <button
          type="button"
          className={styles.button}
          aria-disabled={current >= total || undefined}
          onClick={() => current < total && go(current + 1)}
        >
          {t('pdf.next')}
        </button>
      </div>
      <div className={styles.stage}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          role="img"
          aria-label={t('pdf.canvas', { page: current, total, name })}
        />
        <div ref={textLayer} className={styles.textLayer} />
      </div>
    </section>
  )
}
