import { describe, expect, it } from 'vitest'
import { catalogContent } from './catalog/content.ts'
import { contentTables, diceTableOf, tableRowOf } from './content-tables.ts'

describe('las tablas de tirar del texto de un documento', () => {
  it('las de un dado en su primera columna, con el rango de cada fila (y «00», el máximo)', () => {
    const text = [
      'Saca una ficha al azar.',
      '',
      '| d100 | Ficha |',
      '| --- | --- |',
      '| 01–20 | Ancla |',
      '| 21–35 | **Pájaro** |',
      '| 36–00 | Abanico |',
      '',
      '| Nivel | Daño |',
      '| --- | --- |',
      '| 1 | 1d6 |',
      '',
      '| 1d8 | Criatura |',
      '| --- | --- |',
      '| 1 | Comadreja |',
      '| 2-3 | Rata |'
    ].join('\n')
    const tables = contentTables(text)
    expect(tables.map((t) => t.formula)).toEqual(['1d100', '1d8'])
    expect(tables[0]?.rows.map((r) => [r.from, r.to])).toEqual([
      [1, 20],
      [21, 35],
      [36, 100]
    ])
    expect(tableRowOf(tables[0] as never, 100)).toMatchObject({ cells: ['36–00', 'Abanico'], line: 2, column: 0 })
    expect(tableRowOf(tables[1] as never, 3)?.cells[1]).toBe('Rata')
    expect(tableRowOf(tables[1] as never, 9)).toBeNull()
  })

  it('lo que no es de tirar: sin raya, sin dado o sin filas con rango', () => {
    expect(diceTableOf(['| d6 | x |'])).toBeNull()
    expect(diceTableOf(['| Nivel | x |', '| --- | --- |', '| 1 | a |'])).toBeNull()
    expect(diceTableOf(['| d6 | x |', '| --- | --- |', '| uno | a |'])).toBeNull()
  })

  it('las del SRD: la Bolsa de trucos gris (1d8) y Confusión (1d10)', () => {
    const content = catalogContent('5e')
    const text = (key: string) =>
      (content.find((i) => i.key === key)?.data.descripcion as { es?: string } | undefined)?.es ?? ''
    const bag = contentTables(text('bolsa_de_trucos_2024'))
    expect(bag.map((t) => t.formula)).toEqual(['1d8', '1d8', '1d8'])
    expect(bag[0]?.rows).toHaveLength(8)
    // En dos mitades: el 5 es la primera línea de la segunda mitad
    expect(tableRowOf(bag[0] as never, 5)).toMatchObject({ cells: ['5', 'Pantera'], line: 0, column: 2 })
    const confusion = contentTables(text('confusion_2024'))[0]
    expect(confusion?.formula).toBe('1d10')
    expect(tableRowOf(confusion as never, 10)).not.toBeNull()
  })
})
