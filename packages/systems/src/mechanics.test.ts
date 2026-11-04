import { describe, expect, it } from 'vitest'
import { type ContentItem, validateContent } from './file.ts'
import { fronteras } from './fixtures/index.ts'
import type { System } from './format.ts'
import { validateSystem } from './validate.ts'

/** Fronteras con dos fuentes (las dos ediciones de un juego) y una tirada por característica */
const system = (): System => ({
  ...structuredClone(fronteras),
  sources: [
    {
      key: 'viejo',
      name: 'Reglas de antes',
      license: 'CC BY 4.0',
      attribution: 'De antes',
      edition: '2014',
      released: '2014-07-03'
    },
    {
      key: 'nuevo',
      name: 'Reglas de ahora',
      license: 'CC BY 4.0',
      attribution: 'De ahora',
      edition: '2024',
      released: '2025-04-22',
      publisher: 'Una editorial'
    }
  ]
})

const item = (mechanics: unknown, extra: Partial<ContentItem> = {}): ContentItem =>
  ({ type: 'objeto', key: 'anillo', source: 'nuevo', data: { name: 'Anillo' }, mechanics, ...extra }) as ContentItem

const problemsOf = (content: unknown[], s = system()) =>
  validateContent(s, content).map((p) => `${p.path}: ${p.message}`)

describe('las fuentes, con su edición', () => {
  it('su edición, su editorial y su fecha valen; una fecha mal escrita no', () => {
    expect(validateSystem(system()).problems.filter((p) => p.severity === 'error')).toEqual([])
    const bad = system()
    ;(bad.sources?.[0] as { released: string }).released = 'ayer'
    expect(validateSystem(bad).problems.map((p) => p.path)).toContain('sources[0].released')
  })
})

describe('la mecánica de un documento de contenido', () => {
  it('efectos, recursos, acciones, lo que concede, escalado y su grado de automatización', () => {
    const ok = item(
      {
        effects: [
          { target: 'defensa', op: 'add', value: '1', when: '@este.equipado' },
          { target: 'carga', op: 'base', value: '5 + @vigor' }
        ],
        resources: [{ key: 'cargas', label: 'Cargas', max: '3', recovery: 'dawn', amount: '1d3' }],
        actions: [
          {
            key: 'golpe',
            label: 'Golpe',
            activation: 'action',
            attack: '@vigor + 2',
            damage: [{ formula: '1d8 + @vigor', type: 'cortante' }]
          },
          {
            key: 'aliento',
            label: 'Aliento',
            save: { ability: 'vigor', dc: '8 + @vigor', success: 'half' },
            damage: [{ formula: '6d6', type: 'fuego' }]
          }
        ],
        grants: [
          { level: 3, concept: 'segundo_aire' },
          { choose: { key: 'estilo', label: 'Estilo', count: '1', type: 'movimiento' } }
        ],
        scaling: { mode: 'slot', base: 3, per: '1d6' },
        toggle: { duration: '1 minuto' },
        automation: 'partial',
        manual: 'Lo de decapitar se lleva a mano'
      },
      { concept: 'anillo', ref: { pages: { en: 210, es: 230 } } }
    )
    expect(problemsOf([ok])).toEqual([])
  })

  it('cada error, con su ruta: un nombre que no existe, dados donde no van, una operación sin valor', () => {
    const bad = item({
      effects: [
        { target: 'defensa', op: 'add', value: '@vigr' },
        { target: 'defensa', op: 'add' },
        { target: 'defensa', op: 'add', value: '1d4' },
        { target: 'nada', op: 'add', value: '1' },
        { target: 'lleva', op: 'add', value: '1' }
      ],
      resources: [{ key: 'usos', label: 'Usos', max: '@nada' }],
      actions: [{ key: 'golpe', label: 'Golpe', attack: '1d20', damage: [{ formula: '@vigr', type: 'cortante' }] }]
    })
    expect(problemsOf([bad])).toEqual([
      'content[0].mechanics.effects[0].value: No existe «@vigr» en Personaje. ¿Quizás «@vigor»?',
      'content[0].mechanics.effects[1].value: Esta operación necesita un valor',
      'content[0].mechanics.effects[2].value: Un efecto no lleva dados: los dados van en las acciones',
      'content[0].mechanics.effects[3].target: Ningún personaje tiene «nada»',
      'content[0].mechanics.effects[4].target: «lleva» no es un número ni un calculado de los personajes',
      'content[0].mechanics.resources[0].max: No existe «@nada» en Personaje',
      'content[0].mechanics.actions[0].attack: Un bono de ataque no lleva dados: es lo que se suma al dado',
      'content[0].mechanics.actions[0].damage[0].formula: No existe «@vigr» en Personaje. ¿Quizás «@vigor»?'
    ])
  })

  it('@este es el documento; las ventajas, a una tirada que existe; añadir, a una lista', () => {
    const s = system()
    s.types.personaje = {
      ...(s.types.personaje as System['types'][string]),
      fields: { ...(s.types.personaje?.fields ?? {}), idiomas: { kind: 'list', label: 'Idiomas' } }
    }
    const ok = item({
      effects: [
        { target: 'atributo', op: 'advantage', when: '@este.equipado' },
        { target: 'atributo.vigor', op: 'disadvantage' },
        { target: 'idiomas', op: 'append', value: '"Dracónico"' }
      ]
    })
    expect(problemsOf([ok], s)).toEqual([])
    const bad = item({
      effects: [
        { target: 'nada', op: 'advantage' },
        { target: 'defensa', op: 'append', value: '"x"' },
        { target: 'defensa', op: 'add', value: '@este.nada' }
      ]
    })
    expect(problemsOf([bad], s)).toEqual([
      'content[0].mechanics.effects[0].target: No existe la tirada «nada»',
      'content[0].mechanics.effects[1].target: «defensa» no es una lista de los personajes',
      'content[0].mechanics.effects[2].value: «nada» no existe en «@este»'
    ])
  })

  it('el escalado: por nivel dice cuál, sin dados; a una acción que tiene', () => {
    const golpe = { key: 'golpe', label: 'Golpe', damage: [{ formula: '1d8' }] }
    expect(
      problemsOf([
        item({ actions: [golpe], scaling: { mode: 'level', by: '@vigor', at: [{ level: 5, formula: '2d8' }] } })
      ])
    ).toEqual([])
    expect(
      problemsOf([
        item({ actions: [golpe], scaling: { mode: 'level' } }),
        item({ actions: [golpe], scaling: { mode: 'level', by: '1d4' } }, { key: 'otro' }),
        item({ actions: [golpe], scaling: { mode: 'slot', base: 1, per: '1d8', action: 'nada' } }, { key: 'tercero' })
      ])
    ).toEqual([
      'content[0].mechanics.scaling.by: Por nivel: di cuál, como @nivel',
      'content[1].mechanics.scaling.by: Un nivel no lleva dados',
      'content[2].mechanics.scaling.action: No tiene la acción «nada»'
    ])
  })

  it('el concepto y la página, con su forma', () => {
    expect(
      problemsOf([item(undefined, { concept: 'Con Espacios' as never, ref: { pages: { en: 0 } } as never })])
    ).toEqual([
      'content[0].concept: Una clave va en minúsculas, sin espacios ni tildes, como «defensa» o «bono_ataque»',
      'content[0].ref.pages.en: Como poco, 1'
    ])
  })
})
