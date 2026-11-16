import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { type ChartSpec, chartFromRows, chartNumber, readChart, resolveChart, tableRows } from './chart-spec.ts'

const read = (source: string): ChartSpec => {
  const reading = readChart(source)
  if (!reading.chart) throw new Error(JSON.stringify(reading.error))
  return reading.chart
}

describe('un gráfico ```chart: leer su YAML', () => {
  it('lee el de barras, con sus etiquetas, sus series y lo demás tal cual', () => {
    const chart = read(
      'type: bar\nlabels: [Sesión 1, Sesión 2, Sesión 3, Sesión 4]\nseries:\n  - title: PX ganados\n    data: [450, 700, 1100, 900]\n  - title: Oro\n    data: [120, 60, 300, 45]\nbeginAtZero: true\n'
    )
    expect(chart.type).toBe('bar')
    expect(chart.labels).toEqual(['Sesión 1', 'Sesión 2', 'Sesión 3', 'Sesión 4'])
    expect(chart.series.map((s) => [s.title, s.data])).toEqual([
      ['PX ganados', [450, 700, 1100, 900]],
      ['Oro', [120, 60, 300, 45]]
    ])
    expect(chart.width).toBeNull()
    expect(chart.options.beginAtZero).toBe(true)
  })

  it('lee el radar con ancho y máximo, tabuladores, huecos y números escritos como texto', () => {
    const chart = read(
      'type: radar\nlabels: [FUE, DES, CON]\nseries:\n\t- title: Guerrero\n\t  data: [16, "12", ~]\n\t  fill: true\nwidth: 50%\nrMax: 20\n'
    )
    expect(chart.type).toBe('radar')
    expect(chart.width).toBe('50%')
    expect(chart.series[0]?.data).toEqual([16, 12, null])
    expect(chart.series[0]?.extra).toEqual({ fill: true })
  })

  it('los seis tipos: barras, líneas, tarta, donut, radar y área polar', () => {
    for (const type of ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'])
      expect(read(`type: ${type}\nlabels: [a]\nseries:\n  - data: [1]`).type).toBe(type)
  })

  it('dice lo que está mal', () => {
    const broken = readChart('type: bar\nlabels: [a, b\nseries: x')
    expect(broken.error?.code).toBe('yaml')
    expect(broken.error && 'detail' in broken.error && broken.error.detail).toBeTruthy()
    expect(readChart('').error).toEqual({ code: 'missing' })
    expect(readChart('labels: [a]\nseries: []').error).toEqual({ code: 'missing' })
    expect(readChart('type: bar\nseries: []').error).toEqual({ code: 'missing' })
    expect(readChart('type: pastel\nlabels: [a]\nseries: []').error).toEqual({ code: 'type', detail: 'pastel' })
    expect(readChart('type: bar\nlabels: [a]\nseries:\n  - title: x').error).toEqual({ code: 'series' })
  })

  it('añade la recta de ajuste (bestFit) a las líneas', () => {
    const chart = read(
      'type: line\nlabels: [1, 2, 3]\nseries:\n  - title: y\n    data: [2, 4, 6]\nbestFit: true\nbestFitTitle: Tendencia'
    )
    expect(chart.series.map((s) => s.title)).toEqual(['y', 'Tendencia'])
    expect(
      readChart('type: line\nlabels: [1, 2]\nseries:\n  - data: [1, 2]\nbestFit: true', 'Ajuste').chart?.series[1]
        ?.title
    ).toBe('Ajuste')
    expect(chart.series[1]?.data.map((v) => Math.round((v ?? 0) * 1000) / 1000)).toEqual([2, 4, 6])
  })

  it('un número: «12», 12 y «1,5»; vacío o raro, un hueco', () => {
    expect([chartNumber('12'), chartNumber(12), chartNumber(' 1,5 '), chartNumber(''), chartNumber('x')]).toEqual([
      12,
      12,
      1.5,
      null,
      null
    ])
  })
})

describe('un gráfico ```chart: los datos de una tabla de la página', () => {
  const rows = [
    ['Sesión', 'PX', 'Oro'],
    ['1', '450', '120'],
    ['2', '700', '60']
  ]

  it('con id, se leen de la tabla: por columnas (la primera da las etiquetas) o por filas', () => {
    const reading = readChart('type: line\nid: botin\nlayout: columns\nwidth: 80%')
    expect(reading.table).toEqual({ id: 'botin', byRows: false, select: null })
    expect(chartFromRows(rows, { id: 'botin', byRows: false, select: null })).toEqual({
      labels: ['1', '2'],
      series: [
        { title: 'PX', data: [450, 700], extra: {} },
        { title: 'Oro', data: [120, 60], extra: {} }
      ]
    })
    expect(chartFromRows(rows, { id: 'botin', byRows: true, select: null })).toEqual({
      labels: ['PX', 'Oro'],
      series: [
        { title: '1', data: [450, 120], extra: {} },
        { title: '2', data: [700, 60], extra: {} }
      ]
    })
  })

  it('select deja solo esas series; una tabla sin datos no vale', () => {
    expect(readChart('type: bar\nid: ^t\nselect: Oro').table).toEqual({ id: 't', byRows: false, select: ['Oro'] })
    expect(chartFromRows(rows, { id: 't', byRows: false, select: ['Oro'] })?.series.map((s) => s.title)).toEqual([
      'Oro'
    ])
    expect(chartFromRows([['Solo']], { id: 't', byRows: false, select: null })).toBeNull()
  })

  const cell = (text: string, type = 'tableCell'): JSONContent => ({
    type,
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
  })
  const doc: JSONContent = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'El botín.' }] },
      {
        type: 'table',
        attrs: { id: 'botin12' },
        content: rows.map((row, i) => ({
          type: 'tableRow',
          content: row.map((text) => cell(text, i === 0 ? 'tableHeader' : 'tableCell'))
        }))
      }
    ]
  }

  it('la tabla de la página por su id de bloque, como texto de cada celda', () => {
    expect(tableRows(doc, 'botin12')).toEqual(rows)
    expect(tableRows(doc, 'otra')).toBeNull()
  })

  it('resolveChart junta las dos cosas: el YAML y, si lo pide, la tabla de la página', () => {
    const resolved = resolveChart('type: pie\nid: botin12', doc)
    expect(resolved.chart?.labels).toEqual(['1', '2'])
    expect(resolved.chart?.series.map((s) => s.title)).toEqual(['PX', 'Oro'])
    expect(resolveChart('type: pie\nid: nada', doc).error).toEqual({ code: 'table', detail: 'nada' })
    expect(resolveChart('type: pie\nlabels: [a]\nseries:\n  - data: [1]', doc).chart?.labels).toEqual(['a'])
  })
})
