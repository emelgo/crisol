import { describe, expect, it } from 'vitest'
import { fiveE } from './examples/5e/system.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'
import { defaultSheet, sheetOf, sheetView } from './sheet.ts'
import { validateSystem } from './validate.ts'

describe('la hoja por bloques', () => {
  it('la del 5e vale y sale con sus nombres: cifras con su tirada, conjuntos y pestañas', () => {
    expect(validateSystem(fiveE).problems.filter((p) => p.severity === 'error')).toEqual([])
    const view = sheetView(fiveE, 'personaje', 'es')
    expect(view[0]).toEqual({ kind: 'header' })
    expect(view[1]).toMatchObject({
      kind: 'stats',
      fields: expect.arrayContaining([
        { key: 'iniciativa', label: 'Iniciativa', kind: 'derived', signed: true, play: false, roll: 'iniciativa' }
      ])
    })
    // Lo que se cambia jugando: la inspiración (sí o no), el cansancio (con sus límites), las salvaciones contra
    // muerte, los estados, el inventario y las notas; lo calculado y lo elegido al crearlo, no
    const all = view.flatMap((b) =>
      b.kind === 'columns' ? b.blocks : b.kind === 'tabs' ? b.tabs.flatMap((t) => t.blocks) : [b]
    )
    const stats = all.find((b) => b.kind === 'stats' && b.fields.some((f) => f.key === 'inspiracion'))
    expect(stats?.kind === 'stats' && stats.fields).toEqual([
      { key: 'inspiracion', label: 'Inspiración heroica', kind: 'boolean', signed: false, play: true, roll: null },
      { key: 'cansancio', label: 'Cansancio', kind: 'number', signed: false, play: true, min: 0, max: 6, roll: null }
    ])
    expect(all.find((b) => b.kind === 'group' && b.field === 'salvaciones_muerte')).toMatchObject({
      play: true,
      fields: [
        expect.objectContaining({ key: 'exitos', play: true, max: 3 }),
        expect.objectContaining({ key: 'fallos' })
      ]
    })
    const items = (field: string) => all.find((b) => b.kind === 'items' && b.field === field)
    expect(items('estados')).toMatchObject({ play: true })
    expect(items('inventario')).toMatchObject({ play: true })
    expect(items('rasgos')).toMatchObject({ play: false })
    expect(all.find((b) => b.kind === 'text')).toMatchObject({ field: 'notas', play: true })
    expect(all.find((b) => b.kind === 'set')).toMatchObject({
      columns: [
        expect.objectContaining({ key: 'puntuacion', signed: false }),
        expect.objectContaining({ key: 'mod', signed: true })
      ]
    })
    const columns = view.find((b) => b.kind === 'columns' && b.blocks[0]?.kind === 'set')
    expect(columns?.kind === 'columns' && columns.blocks[0]).toMatchObject({
      kind: 'set',
      label: 'Características',
      roll: 'prueba',
      elements: expect.arrayContaining([{ key: 'fue', label: 'Fuerza' }])
    })
    const tabs = view.find((b) => b.kind === 'tabs')
    expect(tabs?.kind === 'tabs' && tabs.tabs.map((t) => t.label)).toEqual([
      'Acciones',
      'Inventario',
      'Conjuros',
      'Rasgos',
      'Notas'
    ])
    expect(sheetView(fiveE, 'personaje', 'en')[2]).toMatchObject({ kind: 'resource', label: 'Hit points' })
    // Un sí o no también va en las cifras
    expect(
      validateSystem({ ...fiveE, sheet: { blocks: [{ kind: 'stats', fields: ['inspiracion'] }] } }).problems.filter(
        (p) => p.severity === 'error'
      )
    ).toEqual([])
  })

  it('sin hoja en el sistema, una por defecto de sus campos', () => {
    const blocks = defaultSheet(fronteras.types.personaje?.fields ?? {})
    expect(blocks.map((b) => b.kind)).toEqual(['header', 'stats', 'resource', 'items', 'actions', 'uses'])
    expect(sheetView(fronteras, 'personaje')[1]).toMatchObject({
      kind: 'stats',
      fields: expect.arrayContaining([expect.objectContaining({ key: 'defensa', label: 'Defensa', roll: null })])
    })
  })

  it('lo que nombra cada bloque existe y es de su clase', () => {
    const system = structuredClone(fronteras) as System
    system.sheet = {
      blocks: [
        { kind: 'stats', fields: ['vigor', 'nada'], rolls: { vigor: 'nada', otro: 'atributo' } },
        { kind: 'resource', field: 'vigor' },
        { kind: 'set', field: 'heridas', columns: ['x'] },
        {
          kind: 'tabs',
          tabs: [{ label: 'Una', blocks: [{ kind: 'items', field: 'lleva', types: ['nave'], rolls: ['nada'] }] }]
        },
        {
          kind: 'columns',
          blocks: [
            { kind: 'list', fields: ['vigor'] },
            { kind: 'text', field: 'vigor' }
          ]
        },
        { kind: 'group', field: 'vigor' }
      ]
    }
    const messages = validateSystem(system).problems.map((p) => `${p.path}: ${p.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        'sheet.blocks[0].fields[1]: personaje no tiene el campo «nada»',
        'sheet.blocks[0].rolls.vigor: No existe la tirada «nada»',
        'sheet.blocks[0].rolls.otro: «otro» no está entre sus cifras',
        'sheet.blocks[1].field: «vigor» no es de los que van aquí (resource)',
        'sheet.blocks[2].field: «heridas» no es de los que van aquí (set)',
        'sheet.blocks[3].tabs[0].blocks[0].types[0]: No existe el tipo «nave»',
        'sheet.blocks[3].tabs[0].blocks[0].rolls[0]: No existe la tirada «nada»',
        'sheet.blocks[4].blocks[0].fields[0]: «vigor» no es de los que van aquí (list)',
        'sheet.blocks[4].blocks[1].field: «vigor» no es de los que van aquí (text)',
        'sheet.blocks[5].field: «vigor» no es de los que van aquí (group)'
      ])
    )
  })

  it('cada tipo de actor puede tener su hoja; sin ella, la del sistema es solo del personaje', () => {
    const system = structuredClone(fronteras) as System
    system.sheet = { blocks: [{ kind: 'header' }, { kind: 'stats', fields: ['defensa'] }] }
    system.types.bestia = {
      document: 'actor',
      label: 'Bestia',
      fields: { fuerza: { kind: 'number', label: 'Fuerza' }, aguante: { kind: 'resource', label: 'Aguante', max: 5 } }
    }
    // Sin hoja propia: la de por defecto de sus campos, no la del personaje
    expect(sheetOf(system, 'bestia').map((b) => b.kind)).toEqual(['header', 'stats', 'resource', 'actions', 'uses'])
    expect(sheetOf(system, 'personaje')).toEqual(system.sheet.blocks)
    system.types.bestia.sheet = { blocks: [{ kind: 'resource', field: 'aguante' }] }
    expect(sheetOf(system, 'bestia')).toEqual([{ kind: 'resource', field: 'aguante' }])
    expect(validateSystem(system).problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('la hoja de un tipo nombra sus campos; su daño, sus campos de lista; y solo los actores tienen hoja', () => {
    const system = structuredClone(fronteras) as System
    system.types.bestia = {
      document: 'actor',
      label: 'Bestia',
      fields: { fuerza: { kind: 'number', label: 'Fuerza' }, resiste: { kind: 'list', label: 'Resiste' } },
      sheet: {
        blocks: [
          { kind: 'resource', field: 'fuerza' },
          { kind: 'stats', fields: ['defensa'] }
        ]
      },
      damage: { resist: 'resiste', immune: 'fuerza', vulnerable: 'nada' }
    }
    const objeto = system.types.objeto
    if (!objeto) throw new Error('sin objeto')
    objeto.sheet = { blocks: [{ kind: 'header' }] }
    const messages = validateSystem(system).problems.map((p) => `${p.path}: ${p.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        'types.bestia.sheet.blocks[0].field: «fuerza» no es de los que van aquí (resource)',
        'types.bestia.sheet.blocks[1].fields[0]: bestia no tiene el campo «defensa»',
        'types.bestia.damage.immune: «fuerza» no es de los que van aquí (list)',
        'types.bestia.damage.vulnerable: bestia no tiene el campo «nada»',
        'types.objeto.sheet: Solo los actores (personajes y criaturas) tienen hoja'
      ])
    )
    expect(messages.some((m) => m.startsWith('types.bestia.damage.resist'))).toBe(false)
  })
})
