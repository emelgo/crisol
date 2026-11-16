import { readChart } from '@crisol/editor'
import { describe, expect, it } from 'vitest'
import { type ChartTheme, chartColors, chartConfig, withAlpha } from './chart-config.ts'

const THEME: ChartTheme = {
  colors: ['#e9b872', '#f07167', '#6fc3b2'],
  text: '#a1a1aa',
  strongText: '#e7e7ea',
  grid: '#2c2d33',
  background: '#17181b',
  tooltip: '#25262b',
  font: 'Barlow'
}
const chartOf = (yaml: string) => {
  const reading = readChart(yaml)
  if (!reading.chart) throw new Error('no se lee')
  return reading.chart
}
const datasets = (yaml: string) =>
  (chartConfig(chartOf(yaml), THEME).data.datasets ?? []) as unknown as Record<string, unknown>[]

describe('la configuración de Chart.js de un gráfico', () => {
  it('con transparencia: #rgb, #rrggbb y rgb()', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(withAlpha('#e9b872', 1)).toBe('rgba(233, 184, 114, 1)')
    expect(withAlpha('rgb(1, 2, 3)', 0.25)).toBe('rgba(1, 2, 3, 0.25)')
    expect(withAlpha('red', 0.5)).toBe('red')
  })

  it('barras: un color del tema por serie, macizo', () => {
    const [first, second] = datasets(
      'type: bar\nlabels: [A, B]\nseries:\n  - title: X\n    data: [1, 2]\n  - title: Y\n    data: [3, 4]'
    )
    expect(first?.backgroundColor).toBe('rgba(233, 184, 114, 0.85)')
    expect(second?.backgroundColor).toBe('rgba(240, 113, 103, 0.85)')
  })

  it('tarta: un color por etiqueta y solo la primera serie', () => {
    const all = datasets(
      'type: pie\nlabels: [A, B]\nseries:\n  - title: X\n    data: [1, 2]\n  - title: Y\n    data: [3, 4]'
    )
    expect(all).toHaveLength(1)
    expect(all[0]?.backgroundColor).toEqual(['rgba(233, 184, 114, 0.85)', 'rgba(240, 113, 103, 0.85)'])
  })

  it('los colores elegidos (colors) van delante de los del tema', () => {
    expect(chartColors({ options: { colors: ['#000000'] } }, THEME)).toEqual(['#000000', ...THEME.colors])
    const [first] = datasets('type: line\nlabels: [A]\nseries:\n  - title: X\n    data: [1]\ncolors: ["#112233"]')
    expect(first?.borderColor).toBe('#112233')
  })

  it('la leyenda: abajo o sin ella', () => {
    const below = chartConfig(
      chartOf('type: bar\nlabels: [A]\nseries:\n  - data: [1]\nlegendPosition: bottom\nlegend: true'),
      THEME
    )
    expect(below.options?.plugins?.legend).toMatchObject({ position: 'bottom' })
    const none = chartConfig(chartOf('type: pie\nlabels: [A]\nseries:\n  - data: [1]\nlegend: false'), THEME)
    expect(none.options?.plugins?.legend).toMatchObject({ display: false })
  })
})
