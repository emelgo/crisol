import { monthGrid, timeColumns } from '@crisol/domain'
import { describe, expect, it } from 'vitest'
import { EANA } from './fixtures.ts'
import { columnAt, columnOffsets, distanceText, shortDate, weekSegments } from './layout.ts'

describe('la colocación de las vistas de una cronología', () => {
  it('las columnas: su ancho (las festividades, estrechas), su sitio y dónde cae un día', () => {
    const columns = timeColumns(EANA, 'months', 0, 363)
    const { offsets, total } = columnOffsets('months', columns)
    expect(offsets.slice(0, 3)).toEqual([0, 40, 128])
    expect(total).toBe(12 * 88 + 4 * 40)
    expect(columnAt(columns, 0)).toBe(0)
    expect(columnAt(columns, 7)).toBe(1)
    expect(columnAt(columns, 34)).toBe(1)
    expect(columnAt(columns, 35)).toBe(2)
    expect(columnAt(columns, 5000)).toBe(columns.length - 1)
  })

  it('un evento de varios días: un tramo por semana, en filas sin montarse, y si sigue a los lados', () => {
    const grid = monthGrid(EANA, 1250, 'siega')
    const first = grid.weeks[0]?.find((d) => d)?.dayNumber ?? 0
    const items = [
      { key: 'largo', startDay: first + 2, endDay: first + 12 },
      { key: 'corto', startDay: first + 3, endDay: first + 3 },
      { key: 'otro', startDay: first + 20, endDay: first + 20 }
    ]
    const week = grid.weeks.find((w) => w.some((d) => d?.dayNumber === first + 3)) ?? []
    const segments = weekSegments(week, items)
    const largo = segments.find((s) => s.item.key === 'largo')
    const corto = segments.find((s) => s.item.key === 'corto')
    expect(largo?.row).toBe(0)
    expect(corto?.row).toBe(1)
    expect(largo?.after).toBe(true)
    expect(segments.some((s) => s.item.key === 'otro')).toBe(false)
  })

  it('la fecha corta y la distancia al anterior', () => {
    expect(shortDate(EANA, { start: { year: 1250, month: 'siega', day: 18 } })).toBe('18 Sie 1250 RC')
    expect(
      shortDate(EANA, { start: { year: 1250, month: 'siega', day: 12 }, end: { year: 1250, month: 'trilla', day: 3 } })
    ).toBe('12 Sie – 3 Tri 1250 RC')
    expect(
      shortDate(EANA, { start: { year: 1250, month: 'siega', day: 9 }, end: { year: 1250, month: 'siega', day: 11 } })
    ).toBe('9–11 Sie 1250 RC')
    expect(shortDate(EANA, { start: { year: -312 } })).toBe('-312 RC')
    expect(distanceText(EANA, undefined, { start: { year: 1 } })).toBeNull()
    expect(distanceText(EANA, { start: { year: 1247 } }, { start: { year: 1250 } })).toBe('3 años después')
    expect(
      distanceText(
        EANA,
        { start: { year: 1250, month: 'siega', day: 6 } },
        { start: { year: 1250, month: 'siega', day: 18 } }
      )
    ).toBe('12 días después')
    // En la unidad natural: ni miles de días ni miles de meses
    expect(distanceText(EANA, { start: { year: -312 } }, { start: { year: 0, month: 'escarcha', day: 1 } })).toBe(
      '312 años después'
    )
    expect(
      distanceText(
        EANA,
        { start: { year: 32, month: 'florida', day: 12 } },
        { start: { year: 412, month: 'siega', day: 12 } }
      )
    ).toBe('380 años después')
    expect(
      distanceText(
        EANA,
        { start: { year: 1250, month: 'cierzo', day: 1 } },
        { start: { year: 1250, month: 'siega', day: 9 } }
      )
    ).toBe('6 meses después')
  })
})
