import { describe, expect, it } from 'vitest'
import { propertiesProblem } from './properties.ts'
import {
  applyTemplate,
  BUILT_IN_TEMPLATES,
  builtInTemplate,
  fieldKey,
  fillTemplate,
  instantiate,
  lineOf,
  TEMPLATE_ICONS
} from './templates.ts'

describe('las plantillas de serie', () => {
  it('son seis, con su id legible y en este orden', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.id)).toEqual(['pnj', 'lugar', 'faccion', 'objeto', 'mision', 'sesion'])
    expect(BUILT_IN_TEMPLATES.map((t) => t.name)).toEqual(['PNJ', 'Lugar', 'Facción', 'Objeto', 'Misión', 'Sesión'])
  })

  it('cada una es válida: campos sin repetir, con id, y enlaces que apuntan a plantillas de serie', () => {
    const ids = new Set(BUILT_IN_TEMPLATES.map((t) => t.id))
    for (const template of BUILT_IN_TEMPLATES) {
      expect(propertiesProblem(template.fields), template.id).toBeNull()
      expect(TEMPLATE_ICONS).toContain(template.icon)
      expect(template.builtIn).toBe(true)
      expect(template.basedOn).toBeNull()
      expect(template.line).toEqual([template.id])
      for (const field of template.fields) {
        expect(field.field, `${template.id}: ${field.name}`).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/)
        if (field.type === 'pages') for (const target of field.targets ?? []) expect(ids).toContain(target)
      }
      // El esqueleto: sus apartados como títulos
      expect(template.skeleton).toMatch(/^## /)
    }
  })

  it('PNJ trae sus campos, sin género en las opciones de Estado', () => {
    const pnj = builtInTemplate('pnj')
    expect(pnj?.fields.map((f) => f.name)).toEqual(['Especie', 'Rol', 'Facción', 'Lugar', 'Estado', 'Padres', 'Pareja'])
    expect(pnj?.fields.find((f) => f.field === 'faccion')).toEqual({
      name: 'Facción',
      field: 'faccion',
      type: 'pages',
      single: true,
      targets: ['faccion'],
      value: []
    })
    expect(pnj?.fields.find((f) => f.field === 'estado')).toMatchObject({
      type: 'choice',
      value: '',
      options: ['Vive', 'Ha muerto', 'En paradero desconocido', 'No se sabe']
    })
    expect(pnj?.skeleton).toBe('## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos\n')
  })

  it('traen sus tablas: los miembros de una facción, los habitantes de un lugar, lo que lleva un PNJ', () => {
    const tables = (id: string) =>
      builtInTemplate(id)
        ?.panel.filter((block) => block.type === 'related')
        .map((block) => [block.title, block.template, block.field])
    expect(tables('faccion')).toEqual([['Miembros', 'pnj', 'faccion']])
    expect(tables('lugar')).toEqual([
      ['Lugares dentro', 'lugar', 'dentro-de'],
      ['Habitantes', 'pnj', 'lugar']
    ])
    expect(tables('pnj')).toEqual([['Lleva encima', 'objeto', 'portador']])
    // Cada tabla apunta a un campo de enlace de su plantilla, y sus columnas son campos suyos
    for (const template of BUILT_IN_TEMPLATES) {
      for (const block of template.panel.filter((b) => b.type === 'related')) {
        const of = builtInTemplate(String(block.template))
        expect(of?.fields.find((f) => f.field === block.field)?.type).toBe('pages')
        for (const column of block.columns as string[]) expect(of?.fields.map((f) => f.field)).toContain(column)
      }
    }
  })

  it('una que no es de serie no se encuentra', () => {
    expect(builtInTemplate('frente')).toBeUndefined()
  })
})

describe('el linaje de una plantilla', () => {
  it('es ella y todas de las que viene, de la más cercana a la primera', () => {
    expect(lineOf('copia', null)).toEqual(['copia'])
    expect(lineOf('pnj-de-eana', ['pnj'])).toEqual(['pnj-de-eana', 'pnj'])
    expect(lineOf('nieta', ['pnj-de-eana', 'pnj'])).toEqual(['nieta', 'pnj-de-eana', 'pnj'])
  })
})

describe('crear una página desde una plantilla', () => {
  it('da sus campos con su valor inicial, su panel con ids nuevos, su esqueleto y su linaje', () => {
    const pnj = builtInTemplate('pnj')
    if (!pnj) throw new Error('sin PNJ')
    let n = 0
    const made = instantiate(pnj, () => `bloque${++n}`)
    expect(made.template).toBe('pnj')
    expect(made.line).toEqual(['pnj'])
    expect(made.properties).toEqual(pnj.fields)
    expect(made.markdown).toBe(pnj.skeleton)
    expect(made.panel.map((block) => block.id)).toEqual(pnj.panel.map((_, i) => `bloque${i + 1}`))
    expect(made.panel.map(({ id: _, ...rest }) => rest)).toEqual(pnj.panel.map(({ id: _, ...rest }) => rest))
  })

  it('cada página tiene sus propias copias: cambiarlas no toca la plantilla', () => {
    const lugar = builtInTemplate('lugar')
    if (!lugar) throw new Error('sin Lugar')
    const made = instantiate(lugar, () => 'abcdef')
    const first = made.properties[0]
    if (first?.type === 'choice') first.options.push('Isla')
    expect(lugar.fields[0]).toMatchObject({ type: 'choice' })
    expect(lugar.fields[0]?.type === 'choice' && lugar.fields[0].options).not.toContain('Isla')
  })
})

describe('las propiedades que se dan al crear con una plantilla', () => {
  const pnj = builtInTemplate('pnj')
  if (!pnj) throw new Error('sin PNJ')

  it('un nombre casa con su campo sin mirar mayúsculas ni tildes', () => {
    expect(fieldKey(' Facción ')).toBe(fieldKey('faccion'))
    expect(fieldKey('Dentro de')).toBe('dentro de')
  })

  it('cada una va a su campo con su forma; las que no se dan, con su valor inicial; las demás, detrás', () => {
    const filled = fillTemplate(pnj.fields, [
      { name: 'faccion', type: 'pages', value: ['raqisa'] },
      { name: 'Estado', type: 'text', value: 'Ha muerto' },
      { name: 'Apodo', type: 'text', value: 'La Vieja' }
    ])
    expect('properties' in filled && filled.properties.map((p) => [p.name, p.field, p.type])).toEqual([
      ['Especie', 'especie', 'text'],
      ['Rol', 'rol', 'text'],
      ['Facción', 'faccion', 'pages'],
      ['Lugar', 'lugar', 'pages'],
      ['Estado', 'estado', 'choice'],
      ['Padres', 'padres', 'pages'],
      ['Pareja', 'pareja', 'pages'],
      ['Apodo', undefined, 'text']
    ])
    expect('properties' in filled && filled.properties[2]).toMatchObject({
      single: true,
      targets: ['faccion'],
      value: ['raqisa']
    })
  })

  it('si una no cabe en su campo, dice cuál y qué campos tiene la plantilla', () => {
    const filled = fillTemplate(pnj.fields, [{ name: 'Facción', type: 'boolean', value: true }])
    expect(filled).toEqual({ problem: { given: 'Facción', field: 'Facción' } })
  })
})

describe('aplicar una plantilla a una página ya hecha', () => {
  const lugar = builtInTemplate('lugar')
  if (!lugar) throw new Error('sin Lugar')

  it('añade lo que falta sin borrar nada: campos, bloques y los apartados que no tiene, al final', () => {
    const applied = applyTemplate(
      lugar,
      {
        properties: [
          { name: 'Población', type: 'number', value: 12000 },
          { name: 'Clima', type: 'text', value: 'Niebla' }
        ],
        panel: [{ id: 'imagen1', type: 'image', fileId: null, caption: 'El puerto' }],
        headings: ['Descripción']
      },
      () => 'nuevo1'
    )
    // Población, a mano, toma el campo de la plantilla; Clima se queda; los demás, al final
    expect(applied.properties.map((p) => [p.name, p.field])).toEqual([
      ['Población', 'poblacion'],
      ['Clima', undefined],
      ['Tipo', 'tipo'],
      ['Dentro de', 'dentro-de'],
      ['Gobierna', 'gobierna']
    ])
    expect(applied.fields).toEqual([
      { name: 'Tipo', added: true },
      { name: 'Dentro de', added: true },
      { name: 'Población', added: false },
      { name: 'Gobierna', added: true }
    ])
    // La imagen ya estaba; las dos tablas, no
    expect(applied.panel.map((b) => b.type)).toEqual(['image', 'related', 'related'])
    expect(applied.blocks).toEqual(['Lugares dentro', 'Habitantes'])
    expect(applied.sections).toEqual(['Ganchos'])
    expect(applied.append).toBe('## Ganchos')
  })

  it('un campo que se llama igual pero no cabe se deja como está, sin repetirlo', () => {
    const applied = applyTemplate(
      lugar,
      { properties: [{ name: 'Población', type: 'list', value: ['muchos'] }], panel: [], headings: [] },
      () => 'nuevo1'
    )
    expect(applied.properties.filter((p) => p.name === 'Población')).toEqual([
      { name: 'Población', type: 'list', value: ['muchos'] }
    ])
  })
})
