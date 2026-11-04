import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate.ts'
import { validateContent } from './file.ts'
import type { System } from './format.ts'
import { tryRoll } from './rolls.ts'
import { tryFormula } from './try.ts'
import { validateSystem } from './validate.ts'

/** Un personaje con habilidades (cada una con su característica) y armas que calculan su ataque con quien las lleva */
const system = {
  format: 1,
  id: 'prueba',
  name: 'Prueba',
  version: '1',
  languages: ['es'],
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        competencia: { kind: 'number', label: 'Competencia', default: 3 },
        fue: { kind: 'number', label: 'Fuerza', default: 16 },
        des: { kind: 'number', label: 'Destreza', default: 12 },
        fue_mod: { kind: 'derived', label: 'Mod. Fue', formula: 'floor((@fue - 10) / 2)' },
        des_mod: { kind: 'derived', label: 'Mod. Des', formula: 'floor((@des - 10) / 2)' },
        habilidades: {
          kind: 'set',
          label: 'Habilidades',
          elements: [
            { key: 'atletismo', label: 'Atletismo', values: { car: 'fue' } },
            { key: 'sigilo', label: 'Sigilo', values: { car: 'des' } }
          ],
          fields: {
            car: { kind: 'text', label: 'Característica' },
            total: { kind: 'derived', label: 'Total', formula: '@este.car == "fue" ? @fue_mod : @des_mod' }
          }
        },
        lleva: { kind: 'items', label: 'Lleva', of: ['arma'] }
      }
    },
    arma: {
      document: 'item',
      label: 'Arma',
      fields: {
        bono: { kind: 'number', label: 'Bono', default: 0 },
        marca: { kind: 'text', label: 'Marca' },
        ataque: { kind: 'derived', label: 'Ataque', formula: '@portador.fue_mod + @portador.competencia + @bono' }
      }
    }
  },
  rolls: { ataque: { label: 'Ataque', formula: '1d20 + @este.ataque', for: { items: ['arma'] } } }
} as unknown as System

const espada = { id: 'espada', type: 'arma', name: 'Espada', data: { bono: 1 } }

describe('los valores propios de cada elemento de un conjunto', () => {
  it('son los iniciales: Sigilo va con Destreza; lo guardado manda', () => {
    const habilidades = (data: Record<string, unknown>) =>
      evaluate(system, 'personaje', { data }).values.habilidades as Record<string, { car: string; total: number }>
    expect(habilidades({}).sigilo).toMatchObject({ car: 'des', total: 1 })
    expect(habilidades({}).atletismo).toMatchObject({ car: 'fue', total: 3 })
    expect(habilidades({ habilidades: { sigilo: { car: 'fue' } } }).sigilo).toMatchObject({ car: 'fue', total: 3 })
  })
})

describe('@portador, en las fórmulas de un objeto', () => {
  it('es quien lo lleva: el ataque de cada arma, en lo que lleva y en su tirada', () => {
    const r = evaluate(system, 'personaje', { data: {}, items: [espada] })
    expect(r.items).toEqual({ espada: { bono: 1, marca: null, ataque: 7, name: 'Espada' } })
    expect(
      tryRoll(system, 'personaje', { data: { fue: 18 }, items: [espada] }, 'ataque', {
        element: 'espada',
        roller: () => 10
      }).total
    ).toBe(18)
  })

  it('valida: lo que no tiene quien lo lleva se dice; «portador» no vale como nombre; un valor de un elemento, a un campo suyo', () => {
    expect(validateSystem(system).problems).toEqual([])
    const bad = structuredClone(system) as System
    const arma = bad.types.arma?.fields as Record<string, unknown>
    arma.ataque = { kind: 'derived', label: 'Ataque', formula: '@portador.nada' }
    arma.portador = { kind: 'number', label: 'Portador' }
    const set = ((bad.types.personaje?.fields ?? {}) as Record<string, { elements?: { values?: unknown }[] }>)
      .habilidades
    if (set?.elements?.[0]) set.elements[0].values = { nada: 'x' }
    expect(validateSystem(bad).problems.map((p) => `${p.path}: ${p.message}`)).toEqual([
      'types.personaje.fields.habilidades.elements[0].values.nada: No existe el campo «nada»',
      'types.arma.fields.portador: «portador» es un nombre que ponen las fórmulas: usa otro',
      'types.arma.fields.ataque.formula: «nada» no existe en «@portador»'
    ])
  })
})

describe('first', () => {
  it('da el primero que tiene algo de una lista', () => {
    const two = { data: {}, items: [espada, { ...espada, id: 'daga', data: { marca: 'Enana' } }] }
    expect(tryFormula(system, 'personaje', 'first(@lleva.marca)', two).value).toBe('Enana')
    expect(tryFormula(system, 'personaje', 'first(@lleva.bono)', two).value).toBe(1)
    expect(tryFormula(system, 'personaje', 'first(@lleva.marca)', { data: {} }).value).toBeNull()
  })
})

describe('las listas con opciones', () => {
  const danos = {
    ...system,
    types: {
      ...system.types,
      personaje: {
        ...(system.types.personaje as System['types'][string]),
        fields: {
          ...(system.types.personaje?.fields ?? {}),
          resistencias: {
            kind: 'list',
            label: 'Resistencias',
            options: [
              { value: 'fuego', label: { es: 'Fuego', en: 'Fire' } },
              { value: 'frio', label: { es: 'Frío', en: 'Cold' } }
            ]
          }
        }
      }
    }
  } as System

  it('solo valen sus opciones: lo guardado que no lo es se marca y se conserva', () => {
    expect(validateSystem(danos).problems).toEqual([])
    const r = evaluate(danos, 'personaje', { data: { resistencias: ['fuego', 'agua'] } })
    expect(r.values.resistencias).toEqual(['fuego', 'agua'])
    expect(r.problems).toEqual([{ path: 'resistencias', message: '«agua» no es una de sus opciones' }])
  })

  it('al validar: un valor inicial que no es una opción, una opción repetida y lo que añade un efecto', () => {
    const bad = structuredClone(danos)
    const list = bad.types.personaje?.fields.resistencias as { default?: string[]; options: { value: string }[] }
    list.default = ['agua']
    list.options.push({ value: 'fuego', label: 'Otra' } as never)
    expect(validateSystem(bad).problems.map((p) => `${p.path}: ${p.message}`)).toEqual([
      'types.personaje.fields.resistencias.options[2].value: «fuego» está repetida',
      'types.personaje.fields.resistencias.default[0]: «agua» no es una de sus opciones'
    ])
    const content = [
      {
        type: 'arma',
        key: 'x',
        source: null,
        data: { name: 'X' },
        mechanics: { effects: [{ target: 'resistencias', op: 'append', value: '"agua"' }] }
      }
    ]
    expect(validateContent(danos, content).map((p) => `${p.path}: ${p.message}`)).toEqual([
      'content[0].mechanics.effects[0].value: «agua» no es una de sus opciones'
    ])
  })
})
