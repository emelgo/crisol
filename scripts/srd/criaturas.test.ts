import { describe, expect, it } from 'vitest'
import {
  actionOf,
  creatureData,
  creatureDoc,
  creatureMechanics,
  crOf,
  parseStatblock,
  type Statblock,
  statblockSignature,
  statblockText,
  xpOf
} from './criaturas.ts'
import type { Row } from './texto.ts'

const rows = (...lines: (string | [string, number])[]): Row[] =>
  lines.map((l) =>
    typeof l === 'string' ? { text: l, x: 58, y: 0, h: 12, page: 261 } : { text: l[0], x: l[1], y: 0, h: 12, page: 261 }
  )

const aboleth2014 = parseStatblock(
  'Aboleth',
  rows(
    'Large aberration, lawful evil',
    'Armor Class 17 (natural armor)',
    'Hit Points 135 (18d10 + 36)',
    'Speed 10 ft., swim 40 ft.',
    'STR DEX CON INT WIS CHA',
    '21 (+5) 9 (−1) 15 (+2) 18 (+4) 15 (+2) 18 (+4)',
    'Saving Throws Con +6, Int +8, Wis +6',
    'Skills History +12, Perception +10',
    'Senses darkvision 120 ft., passive',
    ['Perception 20', 67],
    'Languages Deep Speech, telepathy 120 ft.',
    'Challenge 10 (5,900 XP)',
    'Amphibious. The aboleth can breathe air and water.',
    'Actions',
    'Multiattack. The aboleth makes three tentacle attacks.',
    'Tentacle. Melee Weapon Attack: +9 to hit, reach 10 ft.,',
    'one target. Hit: 12 (2d6 + 5) bludgeoning damage.',
    'Enslave (3/Day). The aboleth targets one creature. The',
    'target must succeed on a DC 14 Wisdom saving throw.',
    ['Whenever the charmed target takes damage, it repeats.', 67],
    'Legendary Actions',
    'The aboleth can take 3 legendary actions, choosing from',
    'the options below.',
    'Psychic Drain (Costs 2 Actions). One creature takes 10',
    '(3d6) psychic damage.'
  ),
  261
)

describe('el perfil de una criatura', () => {
  it('2014: su cabecera, sus características, sus atributos y sus acciones, con sus párrafos', () => {
    expect(aboleth2014).toMatchObject({
      name: 'Aboleth',
      meta: 'Large aberration, lawful evil',
      fields: {
        ac: '17 (natural armor)',
        hp: '135 (18d10 + 36)',
        senses: 'darkvision 120 ft., passive Perception 20',
        cr: '10 (5,900 XP)'
      },
      scores: [21, 9, 15, 18, 15, 18],
      saves: null
    })
    expect(aboleth2014.sections.map((s) => [s.kind, s.entries.map((e) => e.name)])).toEqual([
      ['traits', ['Amphibious']],
      ['actions', ['Multiattack', 'Tentacle', 'Enslave (3/Day)']],
      ['legendary', ['Psychic Drain (Costs 2 Actions)']]
    ])
    expect(aboleth2014.sections[1]?.entries[2]?.text).toBe(
      'The aboleth targets one creature. The target must succeed on a DC 14 Wisdom saving throw.\n\nWhenever the charmed target takes damage, it repeats.'
    )
    expect(aboleth2014.sections[2]?.intro).toBe(
      'The aboleth can take 3 legendary actions, choosing from the options below.'
    )
  })

  it('2024: la CA con la iniciativa, sus salvaciones en la tabla (con la errata sin signo) y su VD con BC', () => {
    const s = parseStatblock(
      'Young White Dragon',
      rows(
        'Large Dragon (Chromatic), Chaotic Evil',
        'AC 17 Initiative +3 (13)',
        'HP 123 (13d10 + 52)',
        'Speed 40 ft., Burrow 20 ft.',
        'MOD SAVE MOD SAVE MOD SAVE',
        'S tr 18 +4 +4 D ex 10 +0 +3 C on 18 +4 +4',
        'I nt 6 −2 2 W is 11 +0 +3 C ha 12 +1 +1',
        'Immunities Cold; Poisoned',
        'CR 6 (2,300 XP; PB +3)',
        'Traits',
        'Ice Walk. The dragon can move across icy surfaces.'
      ),
      340
    )
    expect(s).toMatchObject({
      fields: { ac: '17', initiative: '+3 (13)', immune: 'Cold; Poisoned', cr: '6 (2,300 XP; PB +3)' },
      scores: [18, 10, 18, 6, 11, 12],
      saves: [4, 3, 4, -2, 3, 1]
    })
  })

  it('el VD, los PX y la firma', () => {
    expect([crOf('10 (5,900 XP)'), crOf('1/2 (100 XP)'), crOf('1/8 (25 PX)'), crOf('')]).toEqual([
      10,
      0.5,
      0.125,
      Number.NaN
    ])
    expect([
      xpOf('10 (5,900 XP)'),
      xpOf('10 (XP 5,900, or 7,200 in lair; PB +4)'),
      xpOf('10 (5900 PX)'),
      xpOf('')
    ]).toEqual([5900, 5900, 5900, Number.NaN])
    expect(statblockSignature(aboleth2014)).toBe('10|135|17|21,9,15,18,15,18')
  })
})

describe('sus acciones, con fórmulas que dan los valores del SRD', () => {
  const scores = [21, 9, 15, 18, 15, 18]
  const label = { es: 'Tentáculo', en: 'Tentacle' }

  it('un ataque de 2014 y uno de 2024: la competencia y el modificador que dan su bono, y su daño', () => {
    expect(
      actionOf(
        {
          name: 'Tentacle',
          text: 'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 12 (2d6 + 5) bludgeoning damage plus 7 (2d6) fire damage.'
        },
        'actions',
        scores,
        4,
        label
      )
    ).toEqual({
      action: {
        key: 'tentaculo',
        label,
        activation: 'action',
        attack: '@competencia + @caracteristicas.fue.mod',
        damage: [
          { formula: '2d6 + @caracteristicas.fue.mod', type: 'contundente' },
          { formula: '2d6', type: 'fuego' }
        ]
      }
    })
    const ranged = actionOf(
      { name: 'Longbow', text: 'Ranged Attack Roll: +3, range 150/600 ft. Hit: 4 (1d8 − 1) Piercing damage.' },
      'actions',
      scores,
      4,
      label
    )
    expect(ranged?.action).toMatchObject({
      attack: '@competencia + @caracteristicas.des.mod',
      damage: [{ formula: '1d8 + @caracteristicas.des.mod' }]
    })
    // Un bono que no da ninguna característica, tal cual; un daño sin dados, su número
    expect(
      actionOf(
        { name: 'Bite', text: 'Melee Attack Roll: +20, reach 5 ft. Hit: 1 Piercing damage.' },
        'actions',
        scores,
        4,
        label
      )?.action
    ).toMatchObject({ attack: '20', damage: [{ formula: '1', type: 'perforante' }] })
  })

  it('una salvación (la primera del texto), con la mitad; la recarga, los usos al día y el coste', () => {
    const breath = actionOf(
      {
        name: 'Fire Breath (Recharge 5–6)',
        text: 'Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 63 (18d6) Fire damage. Success: Half damage. Then a DC 10 Constitution saving throw.'
      },
      'actions',
      [27, 10, 25, 16, 13, 21],
      6,
      { es: 'Aliento de fuego', en: 'Fire Breath' }
    )
    expect(breath?.action).toMatchObject({
      key: 'aliento_de_fuego',
      save: { ability: 'des', dc: '8 + @competencia + @caracteristicas.con.mod', success: 'half' },
      damage: [{ formula: '18d6', type: 'fuego' }],
      recharge: '5-6'
    })
    const old = actionOf(
      { name: 'Enslave (3/Day)', text: 'The target must succeed on a DC 14 Wisdom saving throw or be charmed.' },
      'actions',
      scores,
      4,
      { es: 'Esclavizar (3/día)', en: 'Enslave (3/Day)' }
    )
    expect(old).toMatchObject({
      // 14 = 8 + 4 + Con (+2): la primera que lo da, en su orden
      action: {
        key: 'esclavizar',
        save: { ability: 'sab', dc: '8 + @competencia + @caracteristicas.con.mod', success: 'none' },
        uses: 'esclavizar'
      },
      resource: { key: 'esclavizar', max: '3', recovery: 'dawn' }
    })
    expect(
      actionOf(
        { name: 'Wing Attack (Costs 2 Actions)', text: 'DC 99 Dexterity saving throw.' },
        'legendary',
        scores,
        4,
        label
      )?.action
    ).toMatchObject({ activation: 'legendary', cost: 2, save: { dc: '99' } })
    expect(
      actionOf({ name: 'Recharge 6 (Recharge 6)', text: 'DC 14 Wisdom saving throw.' }, 'actions', scores, 4, label)
        ?.action.recharge
    ).toBe('6')
    // Un atributo o algo sin ataque ni salvación no es una acción
    expect(actionOf({ name: 'Amphibious', text: 'DC 14 Wisdom saving throw.' }, 'traits', scores, 4, label)).toBeNull()
    expect(actionOf({ name: 'Multiattack', text: 'Three attacks.' }, 'actions', scores, 4, label)).toBeNull()
  })

  it('las de un perfil: con su nombre en español, sus usos y las acciones legendarias como recurso', () => {
    const es: Statblock = {
      ...aboleth2014,
      sections: aboleth2014.sections.map((s) => ({
        ...s,
        entries: s.entries.map((e) => ({ ...e, name: e.name === 'Tentacle' ? 'Tentáculo' : e.name }))
      }))
    }
    const m = creatureMechanics(aboleth2014, es)
    expect(m.resources).toEqual([
      { key: 'enslave', label: { es: 'Enslave (3/Day)', en: 'Enslave (3/Day)' }, max: '3', recovery: 'dawn' },
      {
        key: 'legendarias',
        label: { es: 'Acciones legendarias', en: 'Legendary actions' },
        max: '3',
        recovery: 'other'
      }
    ])
    // Psychic Drain no tiene ataque ni salvación: va en el texto
    expect((m.actions as { key: string; uses?: string }[]).map((a) => [a.key, a.uses])).toEqual([
      ['tentaculo', undefined],
      ['enslave', 'enslave']
    ])
    const wing = {
      ...aboleth2014,
      sections: [
        {
          kind: 'legendary' as const,
          intro: 'Legendary Action Uses: 3.',
          entries: [{ name: 'Wing Attack (Costs 2 Actions)', text: 'DC 19 Dexterity saving throw.' }]
        }
      ]
    }
    expect(creatureMechanics(wing, wing).actions).toMatchObject([{ key: 'wing_attack', uses: 'legendarias', cost: 2 }])
    expect(creatureMechanics({ ...aboleth2014, sections: [] }, { ...aboleth2014, sections: [] })).toEqual({
      automation: 'text'
    })
  })
})

describe('lo que se cruzó con dnd5e (scripts/srd/comparar-dnd5e.ts)', () => {
  const dragon = (lines: string[]) =>
    parseStatblock(
      'Adult Red Dragon',
      rows(
        'Huge Dragon (Chromatic), Chaotic Evil',
        'AC 19 Initiative +12 (22)',
        'HP 256 (19d12 + 133)',
        'CR 17 (18,000 XP; PB +6)',
        'Actions',
        ...lines
      ),
      280
    )

  it('una línea que sigue a «Saving Throw:» o a «(2d6 + 3)» no empieza otra entrada', () => {
    const s = dragon([
      'Rend. Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8)',
      'Slashing damage plus 5 (2d4) Fire damage.',
      'Fire Breath (Recharge 5–6). Dexterity Saving Throw:',
      'DC 21, each creature in a 60-foot Cone. Failure: 59',
      '(17d6) Fire damage. Success: Half damage.'
    ])
    const actions = s.sections.find((x) => x.kind === 'actions')?.entries ?? []
    expect(actions.map((e) => e.name)).toEqual(['Rend', 'Fire Breath (Recharge 5–6)'])
    const m = creatureMechanics(s, s)
    expect(m.actions).toMatchObject([
      { key: 'rend', damage: [{ type: 'cortante' }, { formula: '2d4', type: 'fuego' }] },
      { recharge: '5-6', save: { ability: 'des' }, damage: [{ formula: '17d6', type: 'fuego' }] }
    ])
  })

  it('su nombre en español, por sus números aunque cambie el orden; un daño «si…» no se suma siempre', () => {
    const en = dragon([
      'Bite. Melee Attack Roll: +7, reach 5 ft. Hit: 15 (2d10 + 4) Piercing damage.',
      'Claw. Melee Attack Roll: +7, reach 5 ft. Hit: 13 (2d8 + 4) Slashing damage, plus 2 (1d4) Slashing damage if',
      'the attack roll had Advantage.'
    ])
    const es: Statblock = {
      ...en,
      sections: [
        {
          kind: 'actions',
          intro: '',
          entries: [
            {
              name: 'Garra',
              text: 'Tirada de ataque: +7, alcance 1,5 m. Impacto: 13 (2d8 + 4) de daño cortante, más 2 (1d4) si tenía ventaja.'
            },
            {
              name: 'Mordisco',
              text: 'Tirada de ataque: +7, alcance 1,5 m. Impacto: 15 (2d10 + 4) de daño perforante.'
            },
            { name: 'Ataque extra', text: 'Hace algo.' }
          ]
        }
      ]
    }
    const actions = creatureMechanics(en, es).actions as { label: { es: string }; damage: unknown[] }[]
    expect(actions.map((a) => a.label.es)).toEqual(['Mordisco', 'Garra'])
    expect(actions[1]?.damage).toHaveLength(1)
  })

  it('los alientos de un dragón de 2014 llevan la recarga de su «Breath Weapons»; el tipo, sin la «o» del tamaño', () => {
    const s = parseStatblock(
      'Adult Bronze Dragon',
      rows(
        'Huge dragon, lawful good',
        'Armor Class 19 (natural armor)',
        'Hit Points 212 (17d12 + 102)',
        'Challenge 15 (13,000 XP)',
        'Actions',
        'Breath Weapons (Recharge 5–6). The dragon uses one of the following breath weapons.',
        'Lightning Breath. Each creature must make a DC 19 Dexterity saving throw, taking 66 (12d10) lightning damage.',
        'Tail. Melee Weapon Attack: +12 to hit, reach 15 ft. Hit: 16 (2d8 + 7) bludgeoning damage.'
      ),
      120
    )
    expect(
      (creatureMechanics(s, s).actions as { key: string; recharge?: string }[]).map((a) => [a.key, a.recharge])
    ).toEqual([
      ['lightning_breath', '5-6'],
      ['tail', undefined]
    ])
    const human = { ...aboleth2014, meta: 'Medium or Small Humanoid, Neutral' }
    expect(creatureData('2024', human, { ...human, meta: 'Humanoide Mediano o Pequeño, neutral' })).toMatchObject({
      tipo: { es: 'Humanoide', en: 'Humanoid' }
    })
  })
})

describe('sus datos y su texto', () => {
  it('sus campos: tamaño, tipo, VD, PX, CA, PG, velocidad, salvaciones y habilidades con su grado', () => {
    const es = {
      ...aboleth2014,
      name: 'Aboleth',
      meta: 'Aberración Grande, legal malvada',
      fields: { ...aboleth2014.fields, speed: '3 m, nadar 12 m' }
    }
    const data = creatureData('2014', aboleth2014, es)
    expect(data).toMatchObject({
      tamano: 'grande',
      tipo: { es: 'Aberración', en: 'Aberration' },
      alineamiento: { es: 'legal malvada', en: 'lawful evil' },
      vd: 10,
      px: 5900,
      ca: 17,
      pg_max: 135,
      dados_golpe: '18d10+36',
      velocidad: 10,
      velocidades: { es: 'nadar 12 m', en: 'swim 40 ft.' },
      caracteristicas: { con: { puntuacion: 15, salvacion_grado: 1 }, fue: { puntuacion: 21 } },
      habilidades: { historia: { grado: 2 }, percepcion: { grado: 2 } }
    })
    expect(data).not.toHaveProperty('bono_iniciativa')
  })

  it('en 2024: las salvaciones de la tabla, el bono a la iniciativa y las inmunidades a daño y a estados', () => {
    const dragon: Statblock = {
      name: 'Young White Dragon',
      page: 340,
      meta: 'Large Dragon (Chromatic), Chaotic Evil',
      fields: {
        ac: '17',
        initiative: '+3 (13)',
        hp: '123 (13d10 + 52)',
        speed: '40 ft.',
        immune: 'Cold; Poisoned',
        cr: '6 (2,300 XP; PB +3)'
      },
      scores: [18, 10, 18, 6, 11, 12],
      saves: [4, 3, 4, -2, 3, 1],
      sections: []
    }
    const data = creatureData('2024', dragon, dragon)
    expect(data).toMatchObject({
      bono_iniciativa: 3,
      inmunidades: ['frio'],
      inmunidades_estados: ['envenenado'],
      caracteristicas: { des: { salvacion_grado: 1 }, sab: { salvacion_grado: 1 } }
    })
    expect(data.caracteristicas).toMatchObject({ fue: { puntuacion: 18 } })
    expect((data.caracteristicas as Record<string, object>).fue).not.toHaveProperty('salvacion_grado')
    expect(statblockText('en', '2024', dragon)).toContain('| +4 | +3 | +4 | −2 | +3 | +1 |')
  })

  it('su texto en Markdown y su documento', () => {
    const text = statblockText('en', '2014', aboleth2014)
    expect(text).toContain('*Large aberration, lawful evil*\n**Armor Class** 17 (natural armor)')
    expect(text).toContain('| 21 (+5) | 9 (−1) | 15 (+2) | 18 (+4) | 15 (+2) | 18 (+4) |')
    expect(text).toContain('### Actions\n\n**Multiattack.** The aboleth makes three tentacle attacks.')
    expect(creatureDoc('2014', aboleth2014, aboleth2014, 'aboleth')).toMatchObject({
      type: 'criatura',
      key: 'aboleth_2014',
      source: 'srd51',
      ref: { pages: { en: 261, es: 261 } }
    })
  })
})
