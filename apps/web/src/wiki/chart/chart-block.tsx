/**
 * Un bloque «Gráfico» en una página (módulo 10, decisión 16): su YAML (```chart) pintado con Chart.js, que se carga
 * aparte con el primer gráfico, con los colores del tema y su título encima; debajo, una tabla oculta con los datos
 * para el lector de pantalla. Si el YAML no se lee, un aviso con lo que falla y el texto. En el editor, al elegirlo, su
 * editor visual sale en el sitio del panel (chart-editing.ts); también en lo que se lee (la jugadora)
 */
import { type ChartSpec, resolveChart } from '@crisol/editor'
import type { JSONContent, Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Pencil, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './chart.module.css'
import { type ChartTheme, chartConfig, shownSeries } from './chart-config.ts'
import { clearChartEditing, setChartEditing } from './chart-editing.ts'

/** Los colores del tema donde se pinta el gráfico */
export function readTheme(element: Element): ChartTheme {
  const style = getComputedStyle(element)
  const value = (name: string) => style.getPropertyValue(name).trim()
  const colors: string[] = []
  for (let i = 1; value(`--color-series-${i}`); i++) colors.push(value(`--color-series-${i}`))
  return {
    colors: colors.length > 0 ? colors : ['#e9b872', '#f07167', '#6fc3b2', '#8ab4f8'],
    text: value('--color-muted') || '#a1a1aa',
    strongText: value('--color-text') || '#e7e7ea',
    grid: value('--color-border') || '#2c2d33',
    background: value('--color-bg') || '#17181b',
    tooltip: value('--color-raised') || '#25262b',
    font: 'Barlow, system-ui, sans-serif'
  }
}

/** Un gráfico listo para pintar, o lo que falla */
export function ChartFigure({ yaml, doc }: { yaml: string; doc: JSONContent }) {
  const { t } = useTranslation()
  const reading = useMemo(() => resolveChart(yaml, doc, t('charts.bestFit')), [yaml, doc, t])
  if (reading.error) {
    const { code } = reading.error
    const detail = 'detail' in reading.error ? reading.error.detail : ''
    return <ChartProblem message={t(`charts.errors.${code}`, { detail })} yaml={yaml} />
  }
  return <ChartCanvas chart={reading.chart} />
}

function ChartCanvas({ chart }: { chart: ChartSpec }) {
  const { t } = useTranslation()
  const box = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading')
  useEffect(() => {
    let alive = true
    let drawn: { destroy(): void } | null = null
    void import('./chart-engine.ts').then(
      ({ Chart }) => {
        if (!alive || !canvas.current || !box.current) return
        try {
          drawn = new Chart(canvas.current, chartConfig(chart, readTheme(box.current)))
          setState('ready')
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) })
        }
      },
      (error: unknown) => {
        if (alive) setState({ error: error instanceof Error ? error.message : String(error) })
      }
    )
    return () => {
      alive = false
      drawn?.destroy()
    }
  }, [chart])
  const title =
    typeof chart.options.title === 'string' || typeof chart.options.title === 'number'
      ? String(chart.options.title)
      : ''
  const series = shownSeries(chart)
  const names = series.map((each) => each.title).filter(Boolean)
  return (
    <figure
      ref={box}
      className={styles.figure}
      data-type={chart.type}
      data-state={typeof state === 'object' ? 'error' : state}
      style={chart.width ? { inlineSize: chart.width } : undefined}
    >
      {title && <figcaption className={styles.title}>{title}</figcaption>}
      {typeof state === 'object' ? (
        <p className={styles.problemText}>{t('charts.failed')}</p>
      ) : (
        <div className={styles.canvas}>
          <canvas
            ref={canvas}
            role="img"
            aria-label={t('charts.aria', {
              type: t(`charts.types.${chart.type}`),
              series: names.join(', ') || chart.labels.join(', ')
            })}
          />
          {state === 'loading' && <span className={styles.loading}>{t('charts.loading')}</span>}
        </div>
      )}
      {/* Los datos, en una tabla para el lector de pantalla */}
      <table className={styles.data}>
        <caption>{title || t('charts.dataTable')}</caption>
        <thead>
          <tr>
            <td />
            {series.map((each, i) => (
              <th key={`${each.title}-${String(i)}`} scope="col">
                {each.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((label, row) => (
            <tr key={`${label}-${String(row)}`}>
              <th scope="row">{label}</th>
              {series.map((each, i) => (
                <td key={`${each.title}-${String(i)}`}>{each.data[row] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** El aviso de un gráfico que no se puede pintar: lo que falla y su YAML */
function ChartProblem({ message, yaml }: { message: string; yaml: string }) {
  const { t } = useTranslation()
  return (
    <div className={styles.problem} role="note" aria-label={t('charts.failed')}>
      <p className={styles.problemTitle}>
        <TriangleAlert size={16} aria-hidden="true" />
        {message}
      </p>
      {yaml && (
        <pre>
          <code>{yaml}</code>
        </pre>
      )}
    </div>
  )
}

export function withChartView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ChartView)
    }
  })
}

/** El bloque en el editor: elegido (con el ratón, las flechas o su lápiz), su editor visual ocupa el panel */
function ChartView({ node, editor, selected, updateAttributes, getPos }: NodeViewProps) {
  const { t } = useTranslation()
  const yaml = String(node.attrs.yaml ?? '')
  const key = String(node.attrs.id ?? 'chart')
  const editable = editor.isEditable
  // El documento, para las tablas de la página (cambia poco: se lee al pintar el bloque)
  const doc = useMemo(() => editor.getJSON(), [editor, yaml])
  const update = useRef(updateAttributes)
  update.current = updateAttributes
  useEffect(() => {
    if (!selected || !editable) return
    setChartEditing({
      key,
      yaml,
      doc,
      update: (next) => update.current({ yaml: next }),
      close: () => {
        const at = typeof getPos === 'function' ? getPos() : undefined
        if (typeof at === 'number')
          editor
            .chain()
            .focus()
            .setTextSelection(at + node.nodeSize)
            .run()
      }
    })
  }, [selected, editable, key, yaml, doc, editor, getPos, node.nodeSize])
  useEffect(() => {
    if (!selected) clearChartEditing(key)
  }, [selected, key])
  useEffect(() => () => clearChartEditing(key), [key])
  return (
    <NodeViewWrapper className={styles.block} data-selected={selected || undefined} contentEditable={false}>
      <ChartFigure yaml={yaml} doc={doc} />
      {editable && !selected && (
        <button
          type="button"
          className={styles.edit}
          aria-label={t('charts.edit')}
          title={t('charts.edit')}
          onClick={() => {
            const at = typeof getPos === 'function' ? getPos() : undefined
            if (typeof at === 'number') editor.chain().setNodeSelection(at).run()
          }}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      )}
    </NodeViewWrapper>
  )
}
