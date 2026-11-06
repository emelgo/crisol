import { describe, expect, it } from 'vitest'
import { validateContent } from './file.ts'
import { fronteras } from './fixtures/fronteras.ts'
import { TABLE_TYPE, withTables } from './table-entries.ts'

const tabla = (table: unknown, type = TABLE_TYPE) => ({
  type,
  key: 'encuentros',
  source: null,
  data: { name: 'Encuentros en el camino' },
  table
})
const rows = [
  { id: 'a', from: 1, to: 3, text: 'Nada' },
  { id: 'b', from: 4, to: 5, text: 'Bandidos', key: 'bandido' },
  { id: 'c', from: 6, to: 6, text: 'Otra tabla', key: 'tesoros' }
]

describe('las tablas del compendio (docs/specs/tablas-compendio.md)', () => {
  it('todo sistema tiene «Tabla», aunque no la declare; si la declara, la suya', () => {
    expect(fronteras.types[TABLE_TYPE]).toBeUndefined()
    expect(withTables(fronteras).types[TABLE_TYPE]?.label).toEqual({ es: 'Tabla', en: 'Table' })
    const own = {
      ...fronteras,
      types: { ...fronteras.types, tabla: { document: 'item' as const, label: 'Mía', fields: {} } }
    }
    expect(withTables(own)).toBe(own)
  })

  it('una tabla con sus filas vale en cualquier sistema; sus rangos con huecos, un aviso', () => {
    expect(validateContent(fronteras, [tabla({ formula: '1d6', replacement: false, rows })])).toEqual([])
    const gap = validateContent(fronteras, [tabla({ rows: [rows[0], { ...rows[2], from: 5, to: 6 }] })])
    expect(gap).toEqual([
      expect.objectContaining({ path: 'content[0].table', severity: 'warning', message: 'Falta del 4 al 4' })
    ])
  })

  it('las filas repetidas, sin filas o con una clave mal, un error; y solo las tablas llevan filas', () => {
    const errors = (table: unknown, type?: string) =>
      validateContent(fronteras, [tabla(table, type)])
        .filter((p) => p.severity === 'error')
        .map((p) => p.path)
    expect(errors({ rows: [rows[0], { ...rows[1], id: 'a' }] })).toEqual(['content[0].table.rows[1].id'])
    expect(errors({ rows: [] })).toEqual(['content[0].table.rows'])
    expect(errors({ rows: [{ ...rows[0], key: 'Con Espacios' }] })).toEqual(['content[0].table.rows[0].key'])
    expect(errors({ rows }, Object.keys(fronteras.types)[0])).toEqual(['content[0].table'])
  })

  it('una fórmula que no se entiende, una fila al revés o unas filas enormes, un error: no se podría tirar', () => {
    const errors = (table: unknown) =>
      validateContent(fronteras, [tabla(table)])
        .filter((p) => p.severity === 'error')
        .map((p) => `${p.path}: ${p.message}`)
    expect(errors({ formula: 'hola', rows })).toEqual(['content[0].table.formula: No se entiende la fórmula «hola»'])
    expect(errors({ rows: [{ id: 'a', from: 3, to: 1, text: 'Al revés' }] })).toEqual([
      'content[0].table.rows: La fila 3–1 empieza después de acabar'
    ])
    const big = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, from: i + 1, to: i + 1, text: 'x'.repeat(2000) }))
    expect(errors({ rows: big })).toEqual(['content[0].table.rows: Sus filas ocupan más de 256 KB'])
  })
})
