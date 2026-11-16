/**
 * Origen: Crisol antiguo (de Enrique), `apps/desktop/src/renderer/src/graficos/bloque.ts` (configuracionChartJs,
 * conAlfa) y `motor.ts`, commit 3f68f11 (2026-10-28), sin licencia pública (UNLICENSED, suyo). Portado con nombres en
 * inglés: la configuración de Chart.js de un bloque ```chart como la monta el plugin «Charts», con los colores del tema.
 * Nuevo: la clave colors (los colores elegidos en el editor visual, por serie o, en los circulares, por etiqueta) y
 * title. Entrada en docs/terceros.md.
 */
import type { ChartSpec, ChartType } from '@crisol/editor'
import type { ChartConfiguration } from 'chart.js'

/** Los colores del tema que usa un gráfico (leídos de las variables CSS donde se pinta) */
export interface ChartTheme {
  /** Los de las series, en orden fijo (--color-series-N) */
  colors: string[]
  text: string
  strongText: string
  grid: string
  /** El fondo: separa los sectores de los circulares */
  background: string
  /** El recuadro al pasar el ratón */
  tooltip: string
  font: string
}

const RADIAL = new Set<ChartType>(['pie', 'doughnut', 'polarArea'])

/** Si los colores van por etiqueta (tarta, donut y área polar, o labelColors), en vez de por serie */
export const colorsByLabel = (chart: Pick<ChartSpec, 'type' | 'options'>) =>
  typeof chart.options.labelColors === 'boolean' ? chart.options.labelColors : RADIAL.has(chart.type)

/** Un color con transparencia: admite #rgb, #rrggbb y rgb()/rgba() */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c)
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(c)
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c)
  const channels = short
    ? short.slice(1).map((h) => Number.parseInt(h + h, 16))
    : long
      ? long.slice(1).map((h) => Number.parseInt(h, 16))
      : rgb
        ? rgb.slice(1).map(Number)
        : null
  if (!channels) return c
  return `rgba(${channels.join(', ')}, ${Math.max(0, Math.min(1, alpha))})`
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Sin las claves sin valor (Chart.js tomaría undefined por un valor) */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T
  if (!isObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, each]) => (each === undefined ? [] : [[key, clean(each)]]))
  ) as T
}

const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined)
const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}
const text = (value: unknown): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : String(value)

/** Las series que se pintan: en tarta, donut y área polar, solo la primera */
export const shownSeries = (chart: Pick<ChartSpec, 'type' | 'series'>) =>
  RADIAL.has(chart.type) ? chart.series.slice(0, 1) : chart.series

/** Los colores del gráfico: los elegidos (colors) y, detrás, los del tema */
export function chartColors(chart: Pick<ChartSpec, 'options'>, theme: ChartTheme): string[] {
  const chosen = Array.isArray(chart.options.colors) ? chart.options.colors.map(String) : []
  return chosen.length > 0 ? [...chosen, ...theme.colors] : theme.colors
}

/**
 * La configuración de Chart.js, como la monta el plugin, con los colores del tema: rellenos semitransparentes en líneas
 * y radar, macizos en barras y sectores (transparency fuerza la del plugin), y los circulares con un color por etiqueta
 */
export function chartConfig(chart: ChartSpec, theme: ChartTheme): ChartConfiguration {
  const o = chart.options
  const { type } = chart
  const radial = RADIAL.has(type)
  const area = type === 'line' || type === 'radar'
  const byLabel = colorsByLabel(chart)
  const alpha = num(o.transparency) ?? (area ? 0.25 : 0.85)
  const palette = chartColors(chart, theme)
  const color = (i: number) => palette[i % palette.length] ?? '#e5484d'
  // La tarta, el donut y el área polar, con la primera serie (como el antiguo)
  const datasets = shownSeries(chart).map((series, m) => ({
    label: series.title,
    data: series.data,
    backgroundColor: byLabel ? chart.labels.map((_, i) => withAlpha(color(i), alpha)) : withAlpha(color(m), alpha),
    borderColor: radial ? theme.background : byLabel ? chart.labels.map((_, i) => color(i)) : color(m),
    borderWidth: type === 'bar' ? 0 : 2,
    ...(type === 'bar' ? { borderRadius: 4 } : {}),
    ...(area ? { pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: byLabel ? undefined : color(m) } : {}),
    fill: o.fill ? (o.stacked ? (m === 0 ? 'origin' : '-1') : true) : false,
    tension: num(o.tension) ?? 0,
    ...series.extra
  }))
  const font = { family: theme.font }
  const legend = bool(o.legend) ?? (chart.series.length > 1 || radial)
  const plugins = {
    legend: {
      display: legend,
      position: text(o.legendPosition) ?? 'top',
      labels: { color: theme.text, font, usePointStyle: true, boxWidth: 8, boxHeight: 8 }
    },
    tooltip: {
      backgroundColor: theme.tooltip,
      titleColor: theme.strongText,
      bodyColor: theme.strongText,
      borderColor: theme.grid,
      borderWidth: 1,
      titleFont: font,
      bodyFont: font,
      padding: 10,
      boxPadding: 4,
      usePointStyle: true
    }
  }
  const common = {
    animation: { duration: 0 },
    responsive: true,
    maintainAspectRatio: false,
    color: theme.text,
    font,
    layout: { padding: num(o.padding) },
    plugins
  }
  const axisTitle = (value: unknown) => ({ display: Boolean(text(value)), text: text(value), color: theme.text, font })
  const ticks = { color: theme.text, font }

  let options: Record<string, unknown>
  if (type === 'radar' || type === 'polarArea') {
    options = {
      ...common,
      scales: {
        r: {
          grid: { color: theme.grid },
          angleLines: { color: theme.grid },
          beginAtZero: bool(o.beginAtZero),
          max: num(o.rMax),
          min: num(o.rMin),
          ticks: { ...ticks, backdropColor: 'transparent' },
          pointLabels: ticks
        }
      }
    }
  } else if (type === 'bar' || type === 'line') {
    const axis = (name: 'x' | 'y') => ({
      min: num(o[`${name}Min`]),
      max: num(o[`${name}Max`]),
      reverse: bool(o[`${name}Reverse`]),
      ticks: { ...ticks, display: bool(o[`${name}TickDisplay`]), padding: num(o[`${name}TickPadding`]) },
      display: bool(o[`${name}Display`]),
      stacked: bool(o.stacked),
      grid: { color: theme.grid },
      border: { color: theme.grid },
      title: axisTitle(o[`${name}Title`])
    })
    options = {
      ...common,
      indexAxis: o.indexAxis === 'y' ? 'y' : undefined,
      spanGaps: bool(o.spanGaps),
      scales: { y: { ...axis('y'), beginAtZero: bool(o.beginAtZero) }, x: axis('x') }
    }
  } else {
    options = { ...common, spanGaps: bool(o.spanGaps) }
  }
  return clean({ type, data: { labels: chart.labels, datasets }, options }) as ChartConfiguration
}
