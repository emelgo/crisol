import { describe, expect, it } from 'vitest'
import {
  alsoOf,
  CLASSES,
  type ClassText,
  classDocsOf,
  classMechanics,
  type FeatureText,
  featureMechanics,
  levelOf,
  pairFeatures
} from './rasgos.ts'

const f = (name: string, text: string, level: number | null = null, page = 8): FeatureText => ({
  name,
  level,
  text,
  page
})
const barbarian = CLASSES.find((k) => k.concept === 'barbaro')
const warlock = CLASSES.find((k) => k.concept === 'brujo')
const paladin = CLASSES.find((k) => k.concept === 'paladin')
if (!barbarian || !warlock || !paladin) throw new Error('Faltan clases')

describe('los rasgos de una clase', () => {
  it('el nivel de un rasgo de 2014 por su texto, y los niveles en los que se repite', () => {
    expect(levelOf('Starting at 2nd level, you can throw aside all concern.')).toBe(2)
    expect(levelOf('By 7th level, your instinct is so honed.')).toBe(7)
    expect(levelOf('When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase.')).toBe(4)
    expect(levelOf('Starting when you choose this path at 3rd level, you can go into a frenzy.')).toBe(3)
    expect(levelOf('In battle, you fight with primal ferocity.')).toBeNull()
    expect(alsoOf('When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase.')).toEqual(
      [8, 12, 16, 19]
    )
    expect(alsoOf('Nothing more.')).toEqual([])
  })

  it('se emparejan: en 2014 por su orden; en 2024, dentro de su nivel, por su parecido y sus nombres comunes', () => {
    expect(pairFeatures('2014', [f('Rage', 'a')], [f('Furia', 'b')]).map(([a, b]) => [a.name, b.name])).toEqual([
      ['Rage', 'Furia']
    ])
    const en = [
      f('Extra Attack', 'You can attack twice.', 5),
      f('Fast Movement', 'Your speed increases by 10 feet.', 5)
    ]
    const es = [
      f('Movimiento rápido', 'Tu velocidad aumenta en 3 m.', 5),
      f('Ataque adicional', 'Puedes atacar dos veces.', 5)
    ]
    expect(pairFeatures('2024', en, es).map(([a, b]) => [a.name, b.name])).toEqual([
      ['Extra Attack', 'Ataque adicional'],
      ['Fast Movement', 'Movimiento rápido']
    ])
    expect(() => pairFeatures('2024', en, es.slice(1))).toThrow('2 rasgos en inglés y 1 en español')
    expect(() => pairFeatures('2024', en, [f('A', '', 5), f('B', '', 6)])).toThrow('Nivel 5')
  })

  it('la mecánica de la clase: salvaciones y competencias de la primera, habilidades, subclase y nivel de lanzador', () => {
    const m = classMechanics(barbarian, '2014', 3, 'senda_del_berserker')
    expect(m.effects).toEqual(
      expect.arrayContaining([
        { target: 'caracteristicas.fue.salvacion_grado', op: 'min', value: '1', when: '@este.inicial' },
        { target: 'competencias_armas', op: 'append', value: '"marcial"' },
        { target: 'competencias_armaduras', op: 'append', value: '"escudo"', when: '@este.inicial' }
      ])
    )
    expect(m.grants).toMatchObject([
      { choose: { count: '2', set: 'habilidades' } },
      { level: 3, choose: { type: 'subclase', from: ['senda_del_berserker'] } }
    ])
    expect(classMechanics(warlock, '2024', 3, 'x').effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ target: 'pacto_nivel' })])
    )
    const half = (edition: '2014' | '2024') =>
      (classMechanics(paladin, edition, 3, 'x').effects as { target: string; value: string }[]).find(
        (e) => e.target === 'nivel_lanzador'
      )?.value
    expect(half('2024')).toBe('ceil(@este.nivel / 2)')
    expect(half('2014')).toContain('floor(@este.nivel / 2)')
  })

  it('la de los rasgos clave (la furia, la defensa sin armadura, el ataque furtivo), y nada de los demás', () => {
    expect(featureMechanics('barbaro', 'Rage', '2014')).toMatchObject({
      resources: [{ key: 'furias', max: expect.stringContaining('@origen.nivel >= 20 ? 99') }],
      toggle: {}
    })
    expect(featureMechanics('barbaro', 'Rage', '2024')?.resources).toMatchObject([
      { max: expect.not.stringContaining('99') }
    ])
    expect(featureMechanics('monje', 'Unarmored Defense', '2024')).toMatchObject({ effects: [{ op: 'base' }] })
    expect(featureMechanics('picaro', 'Sneak Attack', '2014')).toMatchObject({
      scaling: { mode: 'level', by: '@origen.nivel', at: expect.arrayContaining([{ level: 19, formula: '10d6' }]) }
    })
    for (const [k, n] of [
      ['monje', 'Ki'],
      ['hechicero', 'Font of Magic'],
      ['bardo', 'Bardic Inspiration'],
      ['paladin', 'Lay on Hands'],
      ['explorador', 'Extra Attack']
    ] as const)
      expect(featureMechanics(k, n, '2024')).not.toBeNull()
    expect(featureMechanics('mago', 'Spellcasting', '2024')).toBeNull()
  })
})

describe('los documentos de una clase', () => {
  const text = (lang: 'en' | 'es'): ClassText => ({
    features: [
      f(lang === 'en' ? 'Rage' : 'Furia', 'In battle you rage.'),
      f(lang === 'en' ? 'Primal Path' : 'Senda Primordial', 'At 3rd level, you choose a path.'),
      f(
        lang === 'en' ? 'Ability Score Improvement' : 'Mejora de Característica',
        'When you reach 4th level, and again at 8th level, you can increase.'
      )
    ],
    extras: [],
    subclass: {
      name: lang === 'en' ? 'Path of the Berserker' : 'Senda del Berserker',
      text: 'Some barbarians.',
      page: 9,
      features: [
        f(lang === 'en' ? 'Frenzy' : 'Frenesí', 'Starting when you choose this path at 3rd level, frenzy.'),
        f(lang === 'en' ? 'Frenzy' : 'Frenesí', 'At 6th level, again.')
      ]
    }
  })

  it('la clase con sus datos y lo que concede por nivel; su subclase; cada rasgo con su nivel y su clave', () => {
    const docs = classDocsOf(barbarian, '2014', text('en'), text('es'))
    const byKey = new Map(docs.map((d) => [d.key, d]))
    expect(byKey.get('barbaro_2014')).toMatchObject({
      type: 'clase',
      data: { name: { es: 'Bárbaro', en: 'Barbarian' }, dado: 12, dado_golpe: '1d12', lanzamiento: '' }
    })
    const grants = byKey.get('barbaro_2014')?.mechanics.grants as { level?: number; concept?: string }[]
    expect(grants.filter((g) => g.concept).map((g) => [g.level, g.concept])).toEqual([
      [1, 'barbaro_furia'],
      [3, 'barbaro_senda_primordial'],
      [4, 'barbaro_mejora_de_caracteristica'],
      [8, 'barbaro_mejora_de_caracteristica']
    ])
    expect(grants[1]).toMatchObject({ level: 3, choose: { from: ['senda_del_berserker'] } })
    expect(byKey.get('senda_del_berserker_2014')).toMatchObject({ type: 'subclase', data: { clase: 'barbaro' } })
    expect(byKey.get('barbaro_furia_2014')?.mechanics).toMatchObject({ resources: [{ key: 'furias' }] })
    // Un rasgo repetido, con su nivel en la clave
    expect([...byKey.keys()]).toEqual(
      expect.arrayContaining(['senda_del_berserker_frenesi_2014', 'senda_del_berserker_frenesi_6_2014'])
    )
    expect(byKey.get('senda_del_berserker_frenesi_6_2014')?.data.nivel).toBe(6)
  })
})
