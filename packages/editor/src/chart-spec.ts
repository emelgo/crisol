/**
 * Origen: Crisol antiguo (de Enrique), `apps/desktop/src/renderer/src/graficos/bloque.ts`, commit 601f0c9
 * (2026-10-12), sin licencia pública (UNLICENSED, suyo). Portado con nombres en inglés: la lectura del YAML de un
 * bloque ```chart (el formato del plugin «Charts» de Obsidian), sus errores, la recta de ajuste y los datos de una
 * tabla, ahora de una tabla de la misma página por su id de bloque (no de otra nota ni del Markdown). La configuración
 * de Chart.js va en la web (módulo 10, porción 2). Entrada en docs/terceros.md.
 *
 * Un gráfico: YAML con `type`, `labels` y `series` (`title` y `data`) y los modificadores del plugin (`beginAtZero`,
 * `width`, `fill`, `tension`, `stacked`, `indexAxis`, `legend`, `rMax`…), que se guardan tal cual en options. O, con
 * `id`, los datos de una tabla de la página (`layout: rows` para leerla por filas; `select`, solo esas series). Puro: lo
 * usan el editor, la web y las pruebas
 */
import type { JSONContent } from '@tiptap/core'
import { parse } from 'yaml'

export const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'] as const
export type ChartType = (typeof CHART_TYPES)[number]

export interface ChartSeries {
  title: string
  data: (number | null)[]
  /** Las demás claves de la serie (pasan tal cual a Chart.js, como en el plugin) */
  extra: Record<string, unknown>
}

export interface ChartSpec {
  type: ChartType
  labels: string[]
  series: ChartSeries[]
  /** El ancho (`width`: «50%», «400px»…); null, todo el ancho */
  width: string | null
  /** El YAML entero: los modificadores del plugin */
  options: Record<string, unknown>
}

/** Los datos de una tabla de la página: su id de bloque, si se lee por filas y qué series */
export interface ChartTableSource {
  id: string
  byRows: boolean
  select: string[] | null
}

/** Lo que está mal: el YAML no se lee, falta type o labels y series, un tipo que no es, series sin data, sin tabla */
export type ChartError =
  | { code: 'yaml'; detail: string }
  | { code: 'missing' }
  | { code: 'type'; detail: string }
  | { code: 'series' }
  | { code: 'table'; detail: string }

export type ChartReading =
  | { chart: ChartSpec; table: ChartTableSource | null; error?: undefined }
  | { error: ChartError; chart?: undefined; table?: undefined }

const isType = (value: unknown): value is ChartType =>
  typeof value === 'string' && (CHART_TYPES as readonly string[]).includes(value)
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** «12», 12 → 12; «1,5» → 1.5; vacío o lo que no es un número → null (un hueco en la serie) */
export function chartNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const clean = value.trim().replace(/\s/g, '').replace(',', '.')
  if (clean === '') return null
  const number = Number(clean)
  return Number.isFinite(number) ? number : null
}

function seriesOf(value: unknown): ChartSeries[] | null {
  if (!Array.isArray(value)) return null
  const list: ChartSeries[] = []
  for (const each of value) {
    if (!isObject(each) || !Array.isArray(each.data)) return null
    const { title, data, ...extra } = each
    list.push({ title: title === undefined || title === null ? '' : String(title), data: data.map(chartNumber), extra })
  }
  return list
}

/** Lee el YAML de un gráfico (bestFitTitle: el nombre de la recta de `bestFit` si no trae `bestFitTitle`) */
export function readChart(source: string, bestFitTitle = ''): ChartReading {
  let read: unknown
  try {
    // Como el plugin: un tabulador cuenta como cuatro espacios
    read = parse(source.replace(/\t/g, '    '))
  } catch (error) {
    return {
      error: { code: 'yaml', detail: (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '' }
    }
  }
  if (!isObject(read)) return { error: { code: 'missing' } }
  const { type, id } = read
  if (type === undefined || type === null) return { error: { code: 'missing' } }
  if (!isType(type)) return { error: { code: 'type', detail: String(type) } }
  const width = read.width === undefined || read.width === null ? null : String(read.width)
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    const select = read.select
    return {
      chart: { type, labels: [], series: [], width, options: read },
      table: {
        id: String(id).trim().replace(/^\^/, ''),
        byRows: read.layout === 'rows',
        select: Array.isArray(select) ? select.map(String) : typeof select === 'string' ? [select] : null
      }
    }
  }
  if (!Array.isArray(read.labels) || read.series === undefined) return { error: { code: 'missing' } }
  const series = seriesOf(read.series)
  if (!series) return { error: { code: 'series' } }
  const chart: ChartSpec = {
    type,
    labels: read.labels.map((label) => (label === null || label === undefined ? '' : String(label))),
    series,
    width,
    options: read
  }
  return { chart: withBestFit(chart, bestFitTitle), table: null }
}

/** `bestFit` (líneas): añade la recta de regresión, como el plugin */
function withBestFit(chart: ChartSpec, defaultTitle: string): ChartSpec {
  const o = chart.options
  if (o.bestFit !== true || chart.type !== 'line') return chart
  const index = o.bestFitNumber === undefined ? 0 : Number(o.bestFitNumber)
  const y = chart.series[index]?.data
  const x = chart.labels.map(chartNumber)
  if (!y || y.length === 0 || x.some((v) => v === null)) return chart
  let sy = 0
  let sx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < y.length; i++) {
    const yi = y[i] ?? 0
    const xi = x[i] ?? 0
    sy += yi
    sx += xi
    syy += yi * yi
    sxy += yi * xi
  }
  const n = y.length
  const slope = (n * sxy - sx * sy) / (n * syy - sy * sy)
  const intercept = (sx - slope * sy) / n
  const title = o.bestFitTitle !== undefined && o.bestFitTitle !== 'undefined' ? String(o.bestFitTitle) : defaultTitle
  return {
    ...chart,
    series: [...chart.series, { title, data: x.map((xi) => ((xi ?? 0) - intercept) / slope), extra: {} }]
  }
}

/**
 * Las etiquetas y las series de las filas de una tabla (la primera, su cabecera). Por columnas (lo normal): la primera
 * columna da las etiquetas y cada otra columna es una serie; por filas, al revés. null si no hay datos
 */
export function chartFromRows(
  rows: readonly (readonly string[])[],
  source: ChartTableSource
): { labels: string[]; series: ChartSeries[] } | null {
  const first = rows[0]
  if (rows.length < 2 || !first || first.length < 2) return null
  // Por columnas se trasponen: cada columna pasa a ser una fila
  const table = source.byRows ? rows : first.map((_, c) => rows.map((row) => row[c] ?? ''))
  const [header = [], ...rest] = table
  let series = rest.map((row) => ({ title: row[0] ?? '', data: row.slice(1).map(chartNumber), extra: {} }))
  if (source.select) {
    const wanted = source.select
    series = series.filter((each) => wanted.includes(each.title))
  }
  return { labels: header.slice(1), series }
}

/** El texto de un nodo, todo seguido */
const textOf = (node: JSONContent): string =>
  node.type === 'text' ? (node.text ?? '') : (node.content ?? []).map(textOf).join(' ').trim()

/** Las filas de la tabla de un documento con ese id de bloque, como texto de cada celda; null si no está */
export function tableRows(doc: JSONContent, id: string): string[][] | null {
  if (doc.type === 'table' && doc.attrs?.id === id)
    return (doc.content ?? []).map((row) => (row.content ?? []).map((cell) => textOf(cell)))
  for (const child of doc.content ?? []) {
    const found = tableRows(child, id)
    if (found) return found
  }
  return null
}

/** El gráfico listo para pintar: su YAML y, si lo pide (id), los datos de esa tabla del documento */
export function resolveChart(source: string, doc: JSONContent, bestFitTitle = ''): ChartReading {
  const reading = readChart(source, bestFitTitle)
  if (!reading.chart || !reading.table) return reading
  const rows = tableRows(doc, reading.table.id)
  const data = rows && chartFromRows(rows, reading.table)
  if (!data) return { error: { code: 'table', detail: reading.table.id } }
  return { chart: withBestFit({ ...reading.chart, ...data }, bestFitTitle), table: reading.table }
}
