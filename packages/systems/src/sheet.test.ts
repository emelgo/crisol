import { describe, expect, it } from 'vitest'
import { fiveE } from './examples/5e/system.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'
import { defaultSheet, sheetView } from './sheet.ts'
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
})
