import { describe, expect, it } from 'vitest'
import { blank } from '../catalog/blank.ts'
import { CONTENT_KEY, type ContentItem, validateFile } from '../file.ts'
import { KEY, LIMITS, type System } from '../format.ts'
import { contentKeyOf, convertFoundry, keyOf, mergeFoundry } from './convert.ts'
import { foundryFixture } from './fixture.ts'
import { FoundryError } from './manifest.ts'

const textIn = (item: ContentItem | undefined) => (item?.data.description as { es?: string } | undefined)?.es ?? ''
const named = (items: readonly ContentItem[], name: string) =>
  items.find((i) => (i.data.name as { es?: string }).es === name)

describe('un sistema de Foundry, en un sistema de Crisol', () => {
  const { file, notes } = convertFoundry(foundryFixture())

  it('valida entero, con claves que valen', () => {
    const { file: valid, problems } = validateFile(file)
    expect(problems).toEqual([])
    expect(valid).not.toBeNull()
    expect(Object.keys(file.system.types).every((k) => KEY.test(k))).toBe(true)
    expect(file.content.every((c) => CONTENT_KEY.test(c.key))).toBe(true)
    expect(file.system).toMatchObject({ id: 'mazmorra', name: 'Mazmorra', version: '2.1.0', languages: ['es'] })
    expect(file.system.summary).toBe('Un juego de *prueba*.')
  })

  it('un tipo por clase de documento y subtipo: los diarios, reglas; las tablas, tablas; los efectos, fuera', () => {
    expect(Object.keys(file.system.types).sort()).toEqual(['monstruo', 'regla', 'spell', 'tabla', 'weapon'])
    expect(file.system.types.weapon).toMatchObject({ document: 'item', label: { es: 'Arma' } })
    expect(file.system.types.monstruo).toMatchObject({ document: 'actor', label: { es: 'Monstruo' } })
    expect(file.system.types.spell?.label).toEqual({ es: 'Spell' })
    expect(file.system.types.regla?.label).toEqual({ es: 'Regla', en: 'Rule' })
    expect(notes).toContain('Se deja fuera «Efectos»: sus documentos (ActiveEffect) no se traen')
  })

  it('los campos de `system`, aplanados y con su clase; sin textos largos, fuentes, imágenes ni lo que va por id', () => {
    const fields = file.system.types.weapon?.fields ?? {}
    expect(Object.keys(fields)).toEqual([
      'damage_dice',
      'weight',
      'kind',
      'finesse',
      'tags',
      'price_value',
      'folder',
      'description'
    ])
    expect(fields.weight).toMatchObject({ kind: 'number', integer: true })
    expect(fields.finesse).toMatchObject({ kind: 'boolean' })
    expect(fields.tags).toMatchObject({ kind: 'list' })
    expect(fields.damage_dice).toMatchObject({ kind: 'choice' })
    expect(fields.kind).toMatchObject({
      kind: 'choice',
      options: [
        { value: 'ligera', label: 'ligera' },
        { value: 'marcial', label: 'marcial' },
        { value: 'sencilla', label: 'sencilla' }
      ]
    })
    expect(fields.description).toMatchObject({ kind: 'text', lines: 8 })
    // Igual en todos (la moneda), fuera
    expect(fields.price_denomination).toBeUndefined()
    const daga = named(file.content, 'Daga')
    expect(daga?.data).toMatchObject({
      damage_dice: 'v_1d4',
      weight: 1,
      kind: 'ligera',
      finesse: true,
      tags: ['metal', 'ligera'],
      price_value: 5,
      folder: 'Sencillas',
      description: { es: 'Una **daga** de buen acero.' }
    })
    // En uno de pocos documentos, todo lo que tenga
    expect(Object.keys(file.system.types.spell?.fields ?? {})).toEqual(['level', 'description'])
  })

  it('el texto, con los enriquecedores leídos y los enlaces sin etiqueta por el nombre del documento', () => {
    expect(textIn(named(file.content, 'Bola de fuego'))).toBe(
      'Una explosión. Cada criatura hace una DC 15 dex o recibe 8d6 fire.\n\nVer Combate y Combate.'
    )
  })

  it('un actor: su texto (de sus campos de HTML) y lo que lleva, por tipos', () => {
    const trasgo = named(file.content, 'Trasgo')
    expect(trasgo?.data).toMatchObject({ pg_max: 7, cr: 0.25 })
    expect(textIn(trasgo)).toBe(
      'Pequeño y trasgo.\n\n## Armas\n\n**Cimitarra.** 1d6+2 de daño cortante.\n\n## Feat\n\n**Huida ágil.**'
    )
  })

  it('un diario: sus páginas de texto en su orden, con su nombre', () => {
    expect(textIn(named(file.content, 'Combate'))).toBe(
      '## El turno\n\n## Orden\n\n- Moverse\n- Actuar\n\n## Atacar\n\nTira 1d20.'
    )
  })

  it('una tabla: su texto, y sus filas de verdad, con la fórmula, si repite y lo que lleva a otro documento', () => {
    const botin = named(file.content, 'Botín')
    expect(textIn(botin)).toBe('Lo que llevan.')
    expect(botin?.table).toEqual({
      formula: '1d8',
      replacement: false,
      rows: [
        { id: 'r1', from: 1, to: 3, text: 'Nada | vacío' },
        { id: 'r2', from: 4, to: 4, text: 'Daga', key: named(file.content, 'Daga')?.key },
        { id: 'r3', from: 5, to: 6, text: 'Una *gema*' },
        // Lo que está fuera del zip, solo su texto
        { id: 'r4', from: 7, to: 8, text: 'Espada de otro' }
      ]
    })
    expect(validateFile(file).problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('una tabla con una fórmula de Foundry que no se entiende, por sus filas; un enlace, por su paquete y su id', () => {
    const input = foundryFixture()
    const tablas = input.packs.find((p) => p.name === 'tablas')
    const botin = tablas?.documents[0] as Record<string, unknown>
    botin.formula = '@prof + 1d4'
    // Otro documento con el mismo id en otro paquete: el enlace dice el suyo
    ;(botin.results as Record<string, unknown>[])[2] = {
      _id: 'r2',
      type: 'document',
      range: [4, 4],
      name: 'Botín',
      documentUuid: 'Compendium.prueba.tablas.RollTable.tabla00000000001'
    }
    const { file: converted, notes } = convertFoundry(input)
    const table = named(converted.content, 'Botín')?.table
    expect(table?.formula).toBeUndefined()
    expect(table?.rows[1]?.key).toBe(named(converted.content, 'Botín')?.key)
    expect(notes).toContain('«Botín»: su fórmula (@prof + 1d4) no se entiende; se tira por sus filas')
  })

  it('cada paquete, una fuente; el compendio, en el orden de los paquetes, con las carpetas', () => {
    expect(file.system.sources?.map((s) => s.key)).toEqual(['reglas', 'tablas', 'armas', 'conjuros', 'monstruos'])
    expect(file.system.sources?.[0]).toMatchObject({
      name: { es: 'Reglas' },
      license: 'MIT',
      attribution: 'Mazmorra 2.1.0'
    })
    expect(file.system.compendium?.sections).toEqual([
      { key: 'reglas', label: { es: 'Reglas' }, types: ['regla'] },
      { key: 'tablas', label: { es: 'Tablas' }, types: ['tabla'] },
      { key: 'armas', label: { es: 'Armas' }, types: ['weapon'] },
      { key: 'conjuros', label: { es: 'Conjuros' }, types: ['spell'] },
      { key: 'monstruos', label: { es: 'Monstruos' }, types: ['monstruo'] }
    ])
    expect(file.system.compendium?.types?.weapon).toEqual({ label: { es: 'Armas' }, folder: { field: 'folder' } })
    expect(named(file.content, 'Daga')?.source).toBe('armas')
  })

  it('las claves son estables: el mismo documento, la misma clave', () => {
    const again = convertFoundry(foundryFixture()).file
    expect(again.content.map((c) => c.key)).toEqual(file.content.map((c) => c.key))
    expect(named(file.content, 'Daga')?.key).toBe(contentKeyOf('Daga', 'armas/arma000000000001'))
    expect(contentKeyOf('¡Ñandú Ágil!', 'x')).toMatch(/^nandu-agil-[0-9a-z]{7}$/)
    expect(contentKeyOf('', 'x')).toMatch(/^doc-/)
    expect(keyOf('activationType.value')).toBe('activation_type_value')
    expect(keyOf('2024 stuff', 't')).toBe('t_2024_stuff')
  })

  it('en inglés, sus textos van en inglés', () => {
    const english = convertFoundry({ ...foundryFixture(), language: 'en' }).file
    expect(english.system.languages).toEqual(['en'])
    expect(named(english.content, 'Daga')).toBeUndefined()
    expect(english.content[0]?.data.name).toHaveProperty('en')
    expect(textIn(english.content.find((c) => c.type === 'tabla'))).toBe('')
  })
})

describe('lo que no cabe', () => {
  it('un documento de más de 64 KB: se recorta su texto', () => {
    const input = foundryFixture()
    const spells = input.packs.find((p) => p.name === 'conjuros')
    const spell = spells?.documents[0]
    if (!spell) throw new Error('sin conjuro')
    spell.system = { ...spell.system, description: { value: `<p>${'ñ'.repeat(LIMITS.contentBytes)}</p>` } }
    const { file, notes } = convertFoundry(input)
    expect(validateFile(file).problems).toEqual([])
    expect(textIn(named(file.content, 'Bola de fuego')).endsWith('…')).toBe(true)
    expect(notes).toContain('Se recortó el texto de 1 documento: no cabía entero')
  })

  it('un diario grande: una regla por página, con el diario de carpeta', () => {
    const input = foundryFixture()
    const journal = input.packs.find((p) => p.name === 'reglas')?.documents[0]
    if (!journal) throw new Error('sin diario')
    journal.pages = (journal.pages as Record<string, unknown>[]).map((p, i) =>
      p.type === 'text' ? { ...p, text: { content: `<p>${String(i).repeat(40_000)}</p>` } } : p
    )
    const { file } = convertFoundry(input)
    const rules = file.content.filter((c) => c.type === 'regla')
    expect(rules.map((r) => [(r.data.name as { es: string }).es, r.data.folder])).toEqual([
      ['El turno', 'Combate'],
      ['Atacar', 'Combate']
    ])
  })

  it('más documentos de los que caben: un error que dice cuántos son', () => {
    const input = foundryFixture()
    const weapons = input.packs.find((p) => p.name === 'armas')
    if (!weapons) throw new Error('sin armas')
    weapons.documents = Array.from({ length: LIMITS.contentDocuments }, (_, i) => ({
      _id: `a${i}`,
      name: `A${i}`,
      type: 'weapon'
    }))
    expect(() => convertFoundry(input)).toThrow(FoundryError)
    expect(() => convertFoundry(input)).toThrow(
      `Son ${LIMITS.contentDocuments + 4} documentos y caben ${LIMITS.contentDocuments}`
    )
  })
})

describe('el contenido de un módulo, dentro de un sistema que ya hay', () => {
  const base = convertFoundry(foundryFixture()).file

  it('añade sus tipos y sus campos, sus fuentes y su contenido; lo de la misma clave, lo cambia', () => {
    const input = foundryFixture()
    const daga = input.packs.find((p) => p.name === 'armas')?.documents[0]
    if (!daga) throw new Error('sin daga')
    daga.system = { ...daga.system, nueva: 'sí' }
    const module = convertFoundry({
      ...input,
      manifest: { ...input.manifest, kind: 'module', id: 'extra', title: 'Extra' },
      packs: input.packs.filter((p) => p.name === 'armas')
    }).file
    const merged = mergeFoundry({ system: base.system, content: base.content }, module)
    expect(validateFile(merged).problems).toEqual([])
    expect(merged.system.name).toBe('Mazmorra')
    expect(merged.content).toHaveLength(base.content.length)
    expect(named(merged.content, 'Daga')?.data.nueva).toBe('sí')
    expect(merged.system.types.weapon?.fields.nueva).toMatchObject({ kind: 'text' })
  })

  it('en uno sin esos tipos, se añaden con su sección y su fuente', () => {
    const own: System = { ...structuredClone(blank), id: 'propio' }
    const withLayout: System = {
      ...structuredClone(blank),
      id: 'propio',
      types: { ...blank.types, weapon: { document: 'actor', label: 'Choca', fields: {} } },
      compendium: { sections: [{ key: 'reglas', label: 'Reglas', types: ['weapon'] }] }
    }
    const kept: ContentItem = { type: 'weapon', key: 'mio', source: null, data: { name: 'Mío' } }
    const merged = mergeFoundry({ system: withLayout, content: [kept] }, base)
    expect(validateFile(merged).problems).toEqual([])
    // Un tipo con la misma clave pero de otra clase: el suyo, con otra clave
    expect(merged.system.types.weapon?.document).toBe('actor')
    expect(merged.system.types.weapon_2?.document).toBe('item')
    expect(named(merged.content, 'Daga')?.type).toBe('weapon_2')
    expect(merged.content.find((c) => c.key === 'mio')).toEqual(kept)
    expect(merged.system.compendium?.sections.map((s) => s.key)).toEqual([
      'reglas',
      'reglas_2',
      'tablas',
      'armas',
      'conjuros',
      'monstruos'
    ])
    expect(merged.system.sources?.length).toBe(5)
    expect(mergeFoundry({ system: own, content: [] }, base).system.compendium).toBeUndefined()
  })

  it('si se pasa de lo que cabe, un error', () => {
    const many = Array.from({ length: LIMITS.contentDocuments }, (_, i) => ({
      type: 'weapon',
      key: `k${i}`,
      source: null,
      data: { name: `K${i}` }
    }))
    expect(() => mergeFoundry({ system: base.system, content: many }, base)).toThrow(FoundryError)
  })
})
