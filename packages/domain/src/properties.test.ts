import { describe, expect, it } from 'vitest'
import { propertiesProblem, tagCounts } from './properties.ts'

describe('las propiedades de una página', () => {
  it('nombres sin repetir, sin mirar mayúsculas ni espacios', () => {
    expect(
      propertiesProblem([
        { name: 'Región', type: 'text', value: 'Costa Gris' },
        { name: 'Población', type: 'number', value: 4200 }
      ])
    ).toBeNull()
    expect(
      propertiesProblem([
        { name: 'Región', type: 'text', value: 'a' },
        { name: ' región ', type: 'text', value: 'b' }
      ])
    ).toBe('DUPLICATE_PROPERTY')
  })

  it('las reservadas tienen su tipo: alias y etiquetas, lista; resumen, texto', () => {
    expect(propertiesProblem([{ name: 'alias', type: 'list', value: ['El Puerto'] }])).toBeNull()
    expect(propertiesProblem([{ name: 'Etiquetas', type: 'list', value: ['lugar/ciudad'] }])).toBeNull()
    expect(propertiesProblem([{ name: 'resumen', type: 'text', value: 'La última ciudad libre' }])).toBeNull()
    expect(propertiesProblem([{ name: 'alias', type: 'text', value: 'El Puerto' }])).toBe('RESERVED_PROPERTY_TYPE')
    expect(propertiesProblem([{ name: 'resumen', type: 'list', value: ['x'] }])).toBe('RESERVED_PROPERTY_TYPE')
  })

  it('una etiqueta no lleva espacios ni barras de sobra', () => {
    expect(propertiesProblem([{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad', 'costa'] }])).toBeNull()
    expect(propertiesProblem([{ name: 'etiquetas', type: 'list', value: ['lugar /ciudad'] }])).toBe('BAD_TAG')
    expect(propertiesProblem([{ name: 'etiquetas', type: 'list', value: ['/lugar'] }])).toBe('BAD_TAG')
    expect(propertiesProblem([{ name: 'etiquetas', type: 'list', value: ['lugar//ciudad'] }])).toBe('BAD_TAG')
  })
})

describe('el panel de etiquetas', () => {
  it('cuenta páginas por etiqueta, y cada madre cuenta también las de sus hijas sin repetir página', () => {
    const counts = tagCounts([
      { pageId: 'a', tags: ['lugar/ciudad', 'costa'] },
      { pageId: 'b', tags: ['lugar/ciudad'] },
      { pageId: 'c', tags: ['lugar', 'lugar/montaña'] },
      { pageId: 'd', tags: ['Costa'] }
    ])
    expect(counts).toEqual([
      { tag: 'costa', depth: 0, count: 2 },
      { tag: 'lugar', depth: 0, count: 3 },
      { tag: 'lugar/ciudad', depth: 1, count: 2 },
      { tag: 'lugar/montaña', depth: 1, count: 1 }
    ])
  })
})
