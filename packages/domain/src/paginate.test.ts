import { describe, expect, it } from 'vitest'
import { paginate, type SheetBlock } from './paginate.ts'

const b = (id: string, height: number, kind: SheetBlock['kind'] = 'block'): SheetBlock => ({ id, height, kind })

describe('la paginación de la hoja', () => {
  it('llena la primera columna, luego la segunda, y pasa de página sin partir bloques', () => {
    const pages = paginate([b('a', 60), b('b', 60), b('c', 60), b('d', 60), b('e', 60)], 130)
    expect(pages).toEqual([
      {
        rows: [
          {
            kind: 'columns',
            columns: [
              ['a', 'b'],
              ['c', 'd']
            ]
          }
        ],
        overflow: []
      },
      { rows: [{ kind: 'columns', columns: [['e'], []] }], overflow: [] }
    ])
  })

  it('los saltos fuerzan página y columna', () => {
    const pages = paginate(
      [b('a', 10), b('sc', 0, 'columnBreak'), b('b', 10), b('sp', 0, 'pageBreak'), b('c', 10)],
      100
    )
    expect(pages.map((p) => p.rows)).toEqual([
      [{ kind: 'columns', columns: [['a'], ['b']] }],
      [{ kind: 'columns', columns: [['c'], []] }]
    ])
  })

  it('un título no se queda solo al pie de una columna: va con lo que le sigue', () => {
    const pages = paginate([b('a', 80), b('t', 10, 'heading'), b('p', 30)], 100)
    expect(pages[0]?.rows).toEqual([{ kind: 'columns', columns: [['a'], ['t', 'p']] }])
  })

  it('antes de un bloque a lo ancho, las columnas se equilibran; después sigue en dos columnas', () => {
    const pages = paginate([b('a', 20), b('b', 20), b('c', 20), b('d', 20), b('w', 30, 'wide'), b('e', 10)], 200)
    expect(pages[0]?.rows).toEqual([
      {
        kind: 'columns',
        columns: [
          ['a', 'b'],
          ['c', 'd']
        ]
      },
      { kind: 'wide', id: 'w' },
      { kind: 'columns', columns: [['e'], []] }
    ])
  })

  it('un bloque a lo ancho que no cabe pasa a la página siguiente', () => {
    const pages = paginate([b('a', 90), b('w', 50, 'wide')], 100)
    expect(pages.map((p) => p.rows)).toEqual([[{ kind: 'columns', columns: [['a'], []] }], [{ kind: 'wide', id: 'w' }]])
  })

  it('lo que no cabe ni en una página vacía va igual, en una página nueva, y esa página lo avisa', () => {
    const pages = paginate([b('a', 10), b('enorme', 500), b('c', 10)], 100)
    expect(pages).toEqual([
      { rows: [{ kind: 'columns', columns: [['a'], []] }], overflow: [] },
      { rows: [{ kind: 'columns', columns: [['enorme'], ['c']] }], overflow: ['enorme'] }
    ])
  })

  it('una página grande (como la mayor de Eana, 518 KB): todo el texto, en orden y sin perder bloques', () => {
    const blocks = Array.from({ length: 4000 }, (_, i) =>
      b(`b${i}`, 20 + ((i * 37) % 90), i % 25 === 0 ? 'heading' : i % 300 === 299 ? 'wide' : 'block')
    )
    const start = performance.now()
    const pages = paginate(blocks, 1000)
    expect(performance.now() - start).toBeLessThan(200)
    const order = pages.flatMap((p) => p.rows.flatMap((r) => (r.kind === 'wide' ? [r.id] : r.columns.flat())))
    expect(order).toEqual(blocks.map((x) => x.id))
    expect(pages.every((p) => p.overflow.length === 0)).toBe(true)
  })
})
