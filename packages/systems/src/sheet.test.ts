import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog/index.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'
import { defaultSheet, sheetView } from './sheet.ts'
import { validateSystem } from './validate.ts'

const fiveE = CATALOG.find((s) => s.id === '5e') as System

describe('la hoja por bloques', () => {
  it('la del 5e vale y sale con sus nombres: cifras con su tirada, conjuntos y pestañas', () => {
    expect(validateSystem(fiveE).problems.filter((p) => p.severity === 'error')).toEqual([])
    const view = sheetView(fiveE, 'personaje', 'es')
    expect(view[0]).toEqual({ kind: 'header' })
    expect(view[1]).toMatchObject({
      kind: 'stats',
      fields: expect.arrayContaining([{ key: 'iniciativa', label: 'Iniciativa', roll: 'iniciativa' }])
    })
    const columns = view.find((b) => b.kind === 'columns')
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
  })

  it('sin hoja en el sistema, una por defecto de sus campos', () => {
    const blocks = defaultSheet(fronteras.types.personaje?.fields ?? {})
    expect(blocks.map((b) => b.kind)).toEqual(['header', 'stats', 'resource', 'items', 'actions', 'uses'])
    expect(sheetView(fronteras, 'personaje')[1]).toMatchObject({
      kind: 'stats',
      fields: expect.arrayContaining([{ key: 'defensa', label: 'Defensa', roll: null }])
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
