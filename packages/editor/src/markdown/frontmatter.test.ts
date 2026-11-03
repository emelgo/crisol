import { describe, expect, it } from 'vitest'
import {
  FrontmatterError,
  type ReadProperty,
  readFrontmatter,
  type WritableProperty,
  writeFrontmatter
} from './frontmatter.ts'

describe('las propiedades en YAML', () => {
  const properties: ReadProperty[] = [
    { name: 'alias', type: 'list', value: ['Puerto', 'La ciudad: libre'] },
    { name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] },
    { name: 'resumen', type: 'text', value: 'La última ciudad libre de la Costa Gris.' },
    { name: 'Población', type: 'number', value: 12000 },
    { name: 'Amurallada', type: 'boolean', value: true },
    { name: 'Gobierno', type: 'pages', value: ['p1', 'p2'] },
    { name: 'Lema', type: 'text', value: '"Sal y ceniza" #1' },
    { name: 'Código', type: 'text', value: '0042' },
    { name: 'Vacía', type: 'list', value: [] },
    { name: 'Varias líneas', type: 'text', value: 'Una\nDos' }
  ]
  const titles: Record<string, string> = { p1: 'Consejo de la Lonja', p2: 'Maela Varn' }

  it('se escriben como en Obsidian: listas en bloque, enlaces entre comillas y lo dudoso entre comillas', () => {
    expect(writeFrontmatter(properties, (id) => titles[id] ?? id)).toBe(
      [
        '---',
        'alias:',
        '  - Puerto',
        '  - "La ciudad: libre"',
        'etiquetas:',
        '  - lugar/ciudad',
        'resumen: La última ciudad libre de la Costa Gris.',
        'Población: 12000',
        'Amurallada: true',
        'Gobierno:',
        '  - "[[Consejo de la Lonja]]"',
        '  - "[[Maela Varn]]"',
        'Lema: "\\"Sal y ceniza\\" #1"',
        'Código: "0042"',
        'Vacía: []',
        'Varias líneas: "Una\\nDos"',
        '---',
        ''
      ].join('\n')
    )
    expect(writeFrontmatter([])).toBe('')
  })

  it('de ida y vuelta dan lo mismo, con las páginas por su título', () => {
    const markdown = `${writeFrontmatter(properties, (id) => titles[id] ?? id)}Texto de la página.\n`
    const read = readFrontmatter(markdown)
    expect(read.body).toBe('Texto de la página.\n')
    expect(read.properties).toEqual(
      properties.map((property) =>
        property.type === 'pages' ? { ...property, value: property.value.map((id) => titles[id]) } : property
      )
    )
  })

  it('los campos de plantilla: opciones como texto, un enlace solo sin lista y el reloj como «3/8»', () => {
    const fields: WritableProperty[] = [
      { name: 'Estado', field: 'estado', type: 'choice', value: 'Ha muerto', options: ['Vive', 'Ha muerto'] },
      { name: 'Facción', field: 'faccion', type: 'pages', single: true, value: ['p1'] },
      { name: 'Lugar', field: 'lugar', type: 'pages', single: true, value: [] },
      { name: 'Reloj', field: 'reloj', type: 'clock', value: 3, segments: 8 },
      { name: 'Población', field: 'poblacion', type: 'number', value: null }
    ]
    const yaml = writeFrontmatter(fields, (id) => titles[id] ?? id)
    expect(yaml).toBe(
      [
        '---',
        'Estado: Ha muerto',
        'Facción: "[[Consejo de la Lonja]]"',
        'Lugar: ""',
        'Reloj: "3/8"',
        'Población:',
        '---',
        ''
      ].join('\n')
    )
    // Se leen con los tipos de siempre: el servidor les devuelve su forma con la de la página o la plantilla
    expect(readFrontmatter(yaml).properties).toEqual([
      { name: 'Estado', type: 'text', value: 'Ha muerto' },
      { name: 'Facción', type: 'pages', value: ['Consejo de la Lonja'] },
      { name: 'Lugar', type: 'text', value: '' },
      { name: 'Reloj', type: 'text', value: '3/8' },
      { name: 'Población', type: 'text', value: '' }
    ])
  })

  it('lee el YAML que escribe una persona: listas en línea, comillas simples, comentarios y textos largos', () => {
    const { properties: read, body } = readFrontmatter(
      [
        '---',
        "alias: [Puerto, \"Ceniza, la vieja\", 'O''Brien']",
        'etiquetas: lugar',
        '# un comentario',
        'nivel: 3 # el peligro',
        'jefe: "[[Maela Varn]]"',
        'descripción: |',
        '  Primera línea',
        '  segunda línea',
        'nota: >',
        '  Todo',
        '  seguido',
        'vacía:',
        '---',
        '# Historia'
      ].join('\n')
    )
    expect(read).toEqual([
      { name: 'alias', type: 'list', value: ['Puerto', 'Ceniza, la vieja', "O'Brien"] },
      { name: 'etiquetas', type: 'list', value: ['lugar'] },
      { name: 'nivel', type: 'number', value: 3 },
      { name: 'jefe', type: 'pages', value: ['Maela Varn'] },
      { name: 'descripción', type: 'text', value: 'Primera línea\nsegunda línea' },
      { name: 'nota', type: 'text', value: 'Todo seguido' },
      { name: 'vacía', type: 'text', value: '' }
    ])
    expect(body).toBe('# Historia')
  })

  it('sin YAML, todo es el cuerpo', () => {
    expect(readFrontmatter('# Hola\n\n---\n\nTexto')).toEqual({ properties: [], body: '# Hola\n\n---\n\nTexto' })
  })

  it('lo que no entiende lo dice con su línea', () => {
    expect(() => readFrontmatter('---\nalias: [uno\n---\n')).toThrow(FrontmatterError)
    expect(() => readFrontmatter('---\nalias: [uno\n---\n')).toThrow(/línea 2/)
    expect(() => readFrontmatter('---\nsin cerrar: sí\n')).toThrow(/no se cierra/)
    expect(() => readFrontmatter('---\nmapa: {a: 1}\n---\n')).toThrow(/objeto/)
    expect(() => readFrontmatter('---\nuno: 1\nUno: 2\n---\n')).toThrow(/repetida/)
    expect(() => readFrontmatter('---\nesto no vale\n---\n')).toThrow(/nombre: valor/)
  })
})
