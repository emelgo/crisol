import { describe, expect, it } from 'vitest'
import { conformTo, keepShapes, outsideOptions, type PageProperty, propertiesProblem, tagCounts } from './properties.ts'

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

describe('los campos: tipos nuevos y su id', () => {
  it('opciones: un valor que no está en la lista vale, pero se nota', () => {
    const estado = {
      name: 'Estado',
      type: 'choice',
      value: 'Vive',
      options: ['Vive', 'Ha muerto']
    } satisfies PageProperty
    expect(propertiesProblem([estado])).toBeNull()
    expect(outsideOptions(estado)).toBe(false)
    expect(outsideOptions({ ...estado, value: 'Prisionera' })).toBe(true)
    // Vacío no está fuera: aún no se ha elegido
    expect(outsideOptions({ ...estado, value: '' })).toBe(false)
  })

  it('un reloj tiene de 2 a 12 segmentos y no pasa del máximo', () => {
    expect(propertiesProblem([{ name: 'Reloj', type: 'clock', value: 3, segments: 8 }])).toBeNull()
    expect(propertiesProblem([{ name: 'Reloj', type: 'clock', value: 9, segments: 8 }])).toBe('BAD_CLOCK')
    expect(propertiesProblem([{ name: 'Reloj', type: 'clock', value: 0, segments: 1 }])).toBe('BAD_CLOCK')
    expect(propertiesProblem([{ name: 'Reloj', type: 'clock', value: 0, segments: 13 }])).toBe('BAD_CLOCK')
  })

  it('un enlace a una sola página no lleva más de una', () => {
    const one = { name: 'Facción', type: 'pages', single: true, value: ['a'] } satisfies PageProperty
    expect(propertiesProblem([one])).toBeNull()
    expect(propertiesProblem([{ ...one, value: [] }])).toBeNull()
    expect(propertiesProblem([{ ...one, value: ['a', 'b'] }])).toBe('BAD_PROPERTY')
  })

  it('el id de un campo no se repite en una página', () => {
    expect(
      propertiesProblem([
        { name: 'Facción', field: 'faccion', type: 'pages', value: [] },
        { name: 'Bando', field: 'faccion', type: 'pages', value: [] }
      ])
    ).toBe('DUPLICATE_FIELD')
  })
})

describe('dar a un valor la forma de un campo', () => {
  const faccion = {
    name: 'Facción',
    field: 'faccion',
    type: 'pages',
    single: true,
    targets: ['faccion'],
    value: []
  } satisfies PageProperty

  it('un enlace leído toma el id, una sola página y a qué apunta', () => {
    expect(conformTo(faccion, { name: 'Facción', type: 'pages', value: ['raqisa'] })).toEqual({
      ...faccion,
      value: ['raqisa']
    })
    // Vacío, sin página
    expect(conformTo(faccion, { name: 'Facción', type: 'text', value: '' })).toEqual(faccion)
  })

  it('un enlace de una sola página no admite dos: se queda con varias, pero con su id', () => {
    expect(conformTo(faccion, { name: 'Facción', type: 'pages', value: ['a', 'b'] })).toEqual({
      name: 'Facción',
      field: 'faccion',
      type: 'pages',
      targets: ['faccion'],
      value: ['a', 'b']
    })
  })

  it('un texto toma las opciones de un desplegable', () => {
    const estado = {
      name: 'Estado',
      field: 'estado',
      type: 'choice',
      value: 'Vive',
      options: ['Vive', 'Ha muerto']
    } satisfies PageProperty
    expect(conformTo(estado, { name: 'Estado', type: 'text', value: 'Ha muerto' })).toEqual({
      ...estado,
      value: 'Ha muerto'
    })
    expect(conformTo(estado, { name: 'Estado', type: 'number', value: 3 })).toEqual({ ...estado, value: '3' })
    // Unas opciones nuevas que se dan se quedan
    expect(conformTo(estado, { name: 'Estado', type: 'choice', value: 'Presa', options: ['Libre', 'Presa'] })).toEqual({
      ...estado,
      value: 'Presa',
      options: ['Libre', 'Presa']
    })
  })

  it('un reloj se lee de «3/8» o de un número, y se queda con sus segmentos', () => {
    const reloj = { name: 'Reloj', field: 'reloj', type: 'clock', value: 0, segments: 8 } satisfies PageProperty
    expect(conformTo(reloj, { name: 'Reloj', type: 'text', value: '3/8' })).toEqual({ ...reloj, value: 3 })
    expect(conformTo(reloj, { name: 'Reloj', type: 'text', value: '5/6' })).toEqual({ ...reloj, value: 5, segments: 6 })
    expect(conformTo(reloj, { name: 'Reloj', type: 'number', value: 2 })).toEqual({ ...reloj, value: 2 })
    expect(conformTo(reloj, { name: 'Reloj', type: 'text', value: 'mucho' })).toBeNull()
  })

  it('número, sí/no y texto, de lo que se pueda leer', () => {
    expect(
      conformTo(
        { name: 'Población', field: 'poblacion', type: 'number', value: 0 },
        { name: 'Población', type: 'text', value: '12000' }
      )
    ).toEqual({ name: 'Población', field: 'poblacion', type: 'number', value: 12000 })
    expect(
      conformTo({ name: 'Rol', field: 'rol', type: 'text', value: '' }, { name: 'Rol', type: 'number', value: 7 })
    ).toEqual({ name: 'Rol', field: 'rol', type: 'text', value: '7' })
    expect(
      conformTo(
        { name: 'Sintonización', field: 'sint', type: 'boolean', value: false },
        { name: 'Sintonización', type: 'text', value: 'quizá' }
      )
    ).toBeNull()
  })

  it('al reescribir las propiedades se conservan los campos que ya había, por su nombre', () => {
    const before = [faccion, { name: 'Notas', type: 'text', value: 'x' }] satisfies PageProperty[]
    const after = keepShapes(before, [
      { name: 'facción', type: 'pages', value: ['raqisa'] },
      { name: 'Notas', type: 'text', value: 'y' },
      { name: 'Nueva', type: 'number', value: 1 }
    ])
    expect(after).toEqual([
      { ...faccion, name: 'facción', value: ['raqisa'] },
      { name: 'Notas', type: 'text', value: 'y' },
      { name: 'Nueva', type: 'number', value: 1 }
    ])
  })

  it('si el valor nuevo no cabe en el campo, se queda como viene, sin el id', () => {
    const reloj = { name: 'Reloj', field: 'reloj', type: 'clock', value: 0, segments: 8 } satisfies PageProperty
    expect(keepShapes([reloj], [{ name: 'Reloj', type: 'text', value: 'mucho' }])).toEqual([
      { name: 'Reloj', type: 'text', value: 'mucho' }
    ])
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
