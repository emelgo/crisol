import { describe, expect, it } from 'vitest'
import { applyChanges, ChangeError, parsePath } from './changes.ts'
import { fronteras } from './fixtures/index.ts'
import { validateSystem } from './validate.ts'

const doc = () => structuredClone(fronteras) as unknown as Record<string, unknown>

describe('cambiar un sistema por rutas', () => {
  it('lee las rutas de los problemas', () => {
    expect(parsePath('rolls.atributo.bands[1].if')).toEqual(['rolls', 'atributo', 'bands', 1, 'if'])
    expect(parsePath('types.personaje.fields.defensa.formula')).toHaveLength(5)
    for (const bad of ['', '.a', 'a..b', 'a[x]', 'a]', 'a.__proto__.b', 'constructor', 'a.prototype'])
      expect(() => parsePath(bad), bad).toThrow(ChangeError)
  })

  it('pone valores y trozos enteros, y quita lo que se pide; el original no cambia', () => {
    const original = doc()
    const changed = applyChanges(original, [
      { path: 'types.personaje.fields.defensa.formula', value: '8 + @vigor' },
      { path: 'types.personaje.fields.suerte', value: { kind: 'number', label: 'Suerte' } },
      { path: 'rolls.atributo.bands[3]', value: { if: 'true', label: 'Otro', tone: 'neutral' } },
      { path: 'rolls.atributo.modes[1]', remove: true },
      { path: 'settings', remove: true }
    ])
    const system = changed as unknown as typeof fronteras
    expect(system.types.personaje?.fields.defensa).toMatchObject({ formula: '8 + @vigor' })
    expect(Object.keys(system.types.personaje?.fields ?? {}).at(-1)).toBe('suerte')
    expect(system.rolls?.atributo?.bands).toHaveLength(4)
    expect(system.rolls?.atributo?.modes?.map((m) => m.key)).toEqual(['ventaja'])
    expect(system.settings).toBeUndefined()
    expect(original).toEqual(doc())
    expect(validateSystem(changed).problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('crea lo que falta hasta la ruta', () => {
    const changed = applyChanges(doc(), [{ path: 'rolls.dano.formula', value: '1d6' }]) as typeof fronteras
    expect(changed.rolls?.dano).toEqual({ formula: '1d6' })
  })

  it('todo o nada: si uno no se puede, lanza y no cambia nada', () => {
    const original = doc()
    for (const changes of [
      [
        { path: 'name', value: 'Otro' },
        { path: 'rolls.atributo.bands[9]', value: {} }
      ],
      [{ path: 'name.es', value: 'x' }],
      [{ path: 'rolls.nada', remove: true }],
      [{ path: 'types.personaje.fields[0]', value: 1 }],
      [{ path: 'name' }]
    ])
      expect(() => applyChanges(original, changes), JSON.stringify(changes)).toThrow(ChangeError)
    expect(original).toEqual(doc())
  })

  it('no toca los prototipos', () => {
    expect(() => applyChanges(doc(), [{ path: '__proto__.polluted', value: true }])).toThrow(ChangeError)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
