import { describe, expect, it } from 'vitest'
import {
  dropCapName,
  durationOf,
  headLine,
  levelLine,
  parseSpell,
  rangeOf,
  type SpellRow,
  scalingOf,
  spellDoc,
  spellLists2014,
  spellMechanics,
  spellSignature,
  withEffects
} from './conjuros.ts'
import type { Row } from './texto.ts'

const row = (text: string, h = 11.5): Row => ({ text, x: 58, y: 0, h, page: 141 })
const spell = (over: Partial<SpellRow>): SpellRow => ({
  name: 'Fireball',
  level: 3,
  school: 'evocacion',
  ritual: false,
  castingTime: '1 action',
  range: '150 feet',
  components: 'V, S, M (a tiny ball of bat guano and sulfur)',
  duration: 'Instantaneous',
  classes: [],
  text: '',
  page: 141,
  ...over
})
const name = { es: 'Bola de fuego', en: 'Fireball' }

describe('la cabecera de un conjuro', () => {
  it('el nivel y la escuela en las dos ediciones y los dos idiomas (y el ritual y las clases de 2024)', () => {
    expect(levelLine('3rd-level evocation')).toEqual({ level: 3, school: 'evocacion', ritual: false, classes: [] })
    expect(levelLine('Evocation cantrip')).toMatchObject({ level: 0, school: 'evocacion' })
    expect(levelLine('Adivinación nivel 1 (ritual)')).toMatchObject({ level: 1, school: 'adivinacion', ritual: true })
    expect(levelLine('Evocación (truco)')).toMatchObject({ level: 0, school: 'evocacion' })
    expect(levelLine('Ilusionismo nivel 2')).toMatchObject({ level: 2, school: 'ilusion' })
    expect(levelLine('Level 3 Evocation (Sorcerer, Wizard)')).toEqual({
      level: 3,
      school: 'evocacion',
      ritual: false,
      classes: ['hechicero', 'mago']
    })
    expect(levelLine('Truco de evocación (hechicero, mago)')).toMatchObject({
      level: 0,
      classes: ['hechicero', 'mago']
    })
    expect(levelLine('Transmutación de nivel 2 (bardo, druida)')).toMatchObject({ level: 2, school: 'transmutacion' })
    expect(levelLine('Casting Time: 1 action')).toBeNull()
    expect(levelLine('Evocación')).toBeNull()
  })

  it('una línea de nivel partida (la lista de clases) va junta; un nombre con capitulares, también', () => {
    expect(headLine([row('Level 2 Abjuration (Bard, Cleric,'), row('Paladin)'), row('Casting Time: Action')])).toEqual([
      'Level 2 Abjuration (Bard, Cleric, Paladin)',
      2
    ])
    expect(dropCapName('A S', [row('cid plash'), row('Level 0')])).toEqual(['Acid Splash', [row('Level 0')]])
    expect(dropCapName('Aid', [row('Level 2')])).toEqual(['Aid', [row('Level 2')]])
  })

  it('sus campos, con los partidos en dos líneas, y el texto aparte', () => {
    const parsed = parseSpell(
      'Fireball',
      [
        row('3rd-level evocation'),
        row('Casting Time: 1 action'),
        row('Range: 150 feet'),
        row('Components: V, S, M (a tiny ball of bat'),
        row('guano and sulfur)'),
        row('Duration: Instantaneous'),
        row('A bright streak flashes.')
      ],
      141,
      (rows) => rows.map((r) => r.text).join(' ')
    )
    expect(parsed).toEqual(spell({ text: 'A bright streak flashes.' }))
    expect(() => parseSpell('Nada', [row('Nada')], 1, () => '')).toThrow('no entiendo')
    expect(() => parseSpell('Fireball', [row('3rd-level evocation')], 1, () => '')).toThrow('sin duración')
  })
})

describe('emparejar los conjuros', () => {
  it('el alcance en metros y la duración, iguales en los dos idiomas', () => {
    expect([rangeOf('150 feet'), rangeOf('45 m'), rangeOf('Self (15-foot cone)'), rangeOf('Lanzador')]).toEqual([
      '45',
      '45',
      'self',
      'self'
    ])
    expect([rangeOf('1,5 metros'), rangeOf('5 feet'), rangeOf('Touch'), rangeOf('1 mile'), rangeOf('1,5 km')]).toEqual([
      '1.5',
      '1.5',
      'touch',
      '1.5km',
      '1.5km'
    ])
    expect([rangeOf('Sight'), rangeOf('Unlimited'), rangeOf('Special')]).toEqual(['sight', 'unlimited', 'special'])
    expect([durationOf('Instantaneous'), durationOf('Concentración, hasta 1 minuto'), durationOf('8 hours')]).toEqual([
      'inst',
      '1m',
      '8h'
    ])
    expect([
      durationOf('Until dispelled'),
      durationOf('1 asalto'),
      durationOf('10 días'),
      durationOf('Special')
    ]).toEqual(['disp', '1r', '10d', 'special'])
  })

  it('la firma de un conjuro es la misma en inglés y en español', () => {
    const en = spell({ text: 'Each creature takes 8d6 fire damage. Roll a d20.' })
    const es = spell({
      name: 'Bola de fuego',
      castingTime: '1 acción',
      range: '45 m',
      components: 'V, S, M (una diminuta bola)',
      duration: 'Instantáneo',
      text: 'Recibe 8d6 de daño de fuego. Tira 1d20.'
    })
    expect(spellSignature(en)).toBe(spellSignature(es))
    expect(spellSignature(en)).toBe('3|evocacion|||VSM|action|1d20,8d6|45|inst')
    expect(
      spellSignature(spell({ castingTime: '1 bonus action', duration: 'Concentration, up to 1 minute' }))
    ).toContain('|C|VSM|bonus|')
    expect(spellSignature(spell({ castingTime: '1 reaction' }))).toContain('|reaction|')
    expect(spellSignature(spell({ castingTime: '1 hour' }))).toContain('|1h|')
  })
})

describe('la mecánica de un conjuro, del texto en inglés', () => {
  it('salvación con la mitad, daño y escalado por espacio', () => {
    const text =
      'Each creature must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.\n\nAt Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.'
    expect(spellMechanics(spell({ text }), name)).toEqual({
      actions: [
        {
          key: 'lanzar',
          label: name,
          activation: 'action',
          save: { ability: 'des', dc: '@este.cd', success: 'half' },
          damage: [{ formula: '8d6', type: 'fuego' }]
        }
      ],
      scaling: { mode: 'slot', base: 3, per: '1d6' },
      automation: 'partial'
    })
  })

  it('un ataque con el modificador, una curación y un truco que escala con el nivel', () => {
    const weapon = spellMechanics(
      spell({
        level: 2,
        castingTime: '1 bonus action',
        text: 'Make a melee spell attack. On a hit, the target takes force damage equal to 1d8 + your spellcasting ability modifier.'
      }),
      name
    )
    expect(weapon.actions).toEqual([
      {
        key: 'lanzar',
        label: name,
        activation: 'bonus',
        attack: '@este.ataque',
        damage: [{ formula: '1d8 + @este.mod', type: 'fuerza' }]
      }
    ])
    const cure = spellMechanics(
      spell({
        level: 1,
        text: 'A creature regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.\n\nUsing a Higher-Level Spell Slot. The healing increases by 2d8 for each spell slot level above 1.'
      }),
      name
    )
    expect(cure).toMatchObject({
      actions: [{ heal: '2d8 + @este.mod' }],
      scaling: { mode: 'slot', base: 1, per: '2d8' }
    })
    const bolt = spellMechanics(
      spell({
        level: 0,
        text: 'Make a ranged spell attack. On a hit, the target takes 1d10 fire damage. This spell’s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).'
      }),
      name
    )
    expect(bolt.scaling).toEqual({
      mode: 'level',
      by: '@nivel',
      at: [
        { level: 5, formula: '2d10' },
        { level: 11, formula: '3d10' },
        { level: 17, formula: '4d10' }
      ]
    })
    expect(spellMechanics(spell({ text: 'You restore 70 Hit Points. Nothing else.' }), name)).toMatchObject({
      actions: [{ heal: '70' }]
    })
    expect(spellMechanics(spell({ castingTime: '1 reaction', text: 'Takes 2d10 fire damage.' }), name)).toMatchObject({
      actions: [{ activation: 'reaction' }]
    })
    expect(spellMechanics(spell({ castingTime: '1 minute', text: 'Takes 2d10 fire damage.' }), name)).toMatchObject({
      actions: [{ activation: 'special' }]
    })
  })

  it('sin ataque, salvación, daño ni curación, solo el texto', () => {
    expect(spellMechanics(spell({ text: 'You learn a secret.' }), name)).toEqual({ automation: 'text' })
  })

  it('el escalado de la parte que nombra («the cold damage»); sin nada que escale, ninguno', () => {
    const damage = [
      { formula: '2d8', type: 'contundente' },
      { formula: '4d6', type: 'frio' }
    ]
    expect(scalingOf(4, 'the cold damage increases by 1d6 for each slot level above 4th', damage)).toEqual({
      mode: 'slot',
      base: 4,
      per: '1d6',
      parts: [1]
    })
    expect(scalingOf(4, 'You can target one more creature.', damage)).toBeNull()
    expect(scalingOf(0, 'Nothing.', damage)).toBeNull()
  })

  it('lo que cambia mientras dura (Armadura de mago, Escudo), con su acción y su duración', () => {
    const es = spell({ name: 'Armadura de mago', duration: '8 horas' })
    const mage = withEffects('2024', spell({ name: 'Mage Armor', duration: '8 hours' }), es, { automation: 'text' })
    expect(mage).toMatchObject({
      actions: [{ key: 'lanzar', activation: 'action', label: { es: 'Armadura de mago', en: 'Mage Armor' } }],
      effects: [{ target: 'ca', op: 'base', value: '13 + @caracteristicas.des.mod' }],
      toggle: { duration: { es: '8 horas', en: '8 hours' } },
      automation: 'partial'
    })
    const shield = withEffects('2014', spell({ name: 'Shield' }), es, { automation: 'text' })
    expect(shield).toMatchObject({ actions: [{ activation: 'reaction' }], effects: [{ value: '5' }] })
    const bark = (edition: '2014' | '2024') =>
      withEffects(edition, spell({ name: 'Barkskin' }), es, { automation: 'text' }).effects
    expect([bark('2014'), bark('2024')]).toMatchObject([[{ value: '16' }], [{ value: '17' }]])
    for (const n of ['Shield of Faith', 'Longstrider', 'Haste', 'Aid', 'Stoneskin'])
      expect(withEffects('2024', spell({ name: n }), es, { automation: 'text' }).effects).not.toHaveLength(0)
    expect(withEffects('2024', spell({ name: 'Fireball' }), es, { automation: 'text' })).toEqual({ automation: 'text' })
  })
})

describe('las listas de 2014 y el documento', () => {
  it('cada conjuro con las clases de las listas en las que sale', () => {
    const lists = spellLists2014([
      row('Bard Spells', 16.6),
      row('Cantrips (0 Level)', 14.3),
      row('Hunter’s Mark'),
      row('Wizard Spells', 16.6),
      row('Hunter’s Mark'),
      row('Wizard Spells', 16.6),
      row('Oddity', 9)
    ])
    expect([...lists]).toEqual([["Hunter's Mark", ['bardo', 'mago']]])
  })

  it('el documento lleva su cabecera en los dos idiomas, su concentración, sus clases y su página', () => {
    const doc = spellDoc(
      '2024',
      spell({ duration: 'Concentration, up to 1 minute', text: 'Takes 8d6 fire damage.' }),
      spell({ name: 'Bola de fuego', duration: 'Concentración, hasta 1 minuto', page: 160 }),
      'bola_de_fuego',
      ['mago']
    )
    expect(doc).toMatchObject({
      type: 'conjuro',
      key: 'bola_de_fuego_2024',
      source: 'srd521',
      data: {
        name: name,
        nivel: 3,
        escuela: 'evocacion',
        concentracion: true,
        clases: ['mago'],
        duracion: { es: 'Concentración, hasta 1 minuto', en: 'Concentration, up to 1 minute' }
      },
      mechanics: { actions: [{ damage: [{ formula: '8d6' }] }] },
      ref: { pages: { en: 141, es: 160 } }
    })
  })
})
