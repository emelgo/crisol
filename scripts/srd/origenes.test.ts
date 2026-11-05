import { describe, expect, it } from 'vitest'
import {
  mergeSplitTables,
  type OriginText,
  originDocs,
  pairTraits,
  skillsOf,
  traitMechanics,
  traitsOf
} from './origenes.ts'

describe('los rasgos de una especie', () => {
  it('los párrafos que empiezan con su nombre; no las frases ni las opciones de un rasgo', () => {
    const text = [
      'Your dwarf character has inborn abilities.',
      'Darkvision. You can see in dim light.',
      'Dwarven Resilience. You have resistance against poison damage.',
      'Cloud’s Jaunt (Cloud Giant). As a Bonus Action, you teleport.',
      'You also always have the Speak with Animals spell prepared. It is nice.',
      'Cuando recibas daño, puedes usar una reacción. Bien.'
    ].join('\n\n')
    expect(traitsOf(text)).toEqual([
      { name: 'Darkvision', text: 'You can see in dim light.' },
      { name: 'Dwarven Resilience', text: 'You have resistance against poison damage.' }
    ])
  })

  it('se emparejan por la lista revisada (sin mayúsculas ni tildes) y, los demás, por su orden', () => {
    const en = [
      { name: 'Age', text: 'a' },
      { name: 'Alignment', text: 'b' },
      { name: 'Stonecunning', text: 'c' }
    ]
    const es = [
      { name: 'Alineamiento', text: 'B' },
      { name: 'Edad', text: 'A' },
      { name: 'Afinidad con la Piedra', text: 'C' }
    ]
    expect(pairTraits(en, es).map(([a, b]) => [a.name, b.name])).toEqual([
      ['Age', 'Edad'],
      ['Alignment', 'Alineamiento'],
      ['Stonecunning', 'Afinidad con la Piedra']
    ])
    expect(() => pairTraits([{ name: 'Nada', text: '' }], [], {})).toThrow('Rasgos sin pareja: Nada')
  })

  it('su mecánica, si sale clara: características, velocidad, PG por nivel, resistencias y habilidades', () => {
    expect(traitMechanics('Your Constitution score increases by 2.')).toEqual({
      effects: [{ target: 'caracteristicas.con.puntuacion', op: 'add', value: '2' }],
      automation: 'partial'
    })
    expect(traitMechanics('Your ability scores each increase by 1.').effects).toHaveLength(6)
    expect(
      traitMechanics('Your Charisma score increases by 2, and two other ability scores of your choice increase by 1.')
    ).toMatchObject({
      grants: [{ choose: { count: '2', set: 'caracteristicas', field: 'puntuacion', op: 'add', value: '1' } }]
    })
    expect(traitMechanics('Your base walking speed is 25 feet.').effects).toEqual([
      { target: 'velocidad', op: 'base', value: '25' }
    ])
    expect(
      traitMechanics('Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.')
        .effects
    ).toEqual([{ target: 'pg_max', op: 'add', value: '@nivel' }])
    expect(traitMechanics('You have resistance against poison damage.').effects).toEqual([
      { target: 'resistencias', op: 'append', value: '"veneno"' }
    ])
    expect(traitMechanics('You have proficiency in the Perception skill.').effects).toEqual([
      { target: 'habilidades.percepcion.grado', op: 'min', value: '1' }
    ])
    expect(traitMechanics('You like stones.')).toEqual({ automation: 'text' })
  })

  it('las habilidades de un trasfondo', () => {
    expect(skillsOf('Insight and Religion')).toEqual(['perspicacia', 'religion'])
    expect(skillsOf('Sleight of Hand, Stealth')).toEqual(['juego_de_manos', 'sigilo'])
    expect(skillsOf(undefined)).toEqual([])
  })
})

describe('los documentos de una edición', () => {
  const text = (name: string, body: string, header: Record<string, string> = {}, category = ''): OriginText => ({
    name,
    header,
    category,
    text: body,
    page: 3
  })

  it('una especie con sus rasgos y una subraza que concede su especie; un trasfondo y una dote', () => {
    const en = new Map<string, OriginText>()
    const es = new Map<string, OriginText>()
    const races: [string, string][] = [
      ['Dwarf', 'Enano'],
      ['Hill Dwarf', 'Enano de las colinas'],
      ['Elf', 'Elfo'],
      ['High Elf', 'Alto elfo'],
      ['Halfling', 'Mediano'],
      ['Lightfoot', 'Piesligeros'],
      ['Human', 'Humano'],
      ['Dragonborn', 'Dracónido'],
      ['Gnome', 'Gnomo'],
      ['Rock Gnome', 'Gnomo de las rocas'],
      ['Half-Elf', 'Semielfo'],
      ['Half-Orc', 'Semiorco'],
      ['Tiefling', 'Tiefling'],
      ['Acolyte', 'Acólito'],
      ['Grappler', 'Apresador']
    ]
    for (const [a, b] of races) {
      en.set(a, text(a, a === 'Dwarf' ? 'Speed. Your base walking speed is 25 feet.' : `${a} text.`))
      es.set(b, text(b, b === 'Enano' ? 'Velocidad. Tu velocidad base es de 7,5 m.' : `${b} texto.`))
    }
    en.set('Acolyte', text('Acolyte', 'Skill Proficiencies: Insight, Religion'))
    const docs = originDocs('2014', en, es, (it) => it.es.toLowerCase().replace(/\s+/g, '_'))
    const byKey = new Map(docs.map((d) => [d.key, d]))
    expect(byKey.get('enano_velocidad_2014')).toMatchObject({
      type: 'rasgo',
      data: { name: { es: 'Velocidad', en: 'Speed' }, procedencia: { es: 'Enano', en: 'Dwarf' }, nivel: 0 },
      mechanics: { effects: [{ target: 'velocidad', op: 'base', value: '25' }] }
    })
    expect(byKey.get('enano_2014')?.mechanics).toMatchObject({
      grants: [{ concept: 'enano_velocidad', type: 'rasgo' }]
    })
    expect(byKey.get('enano_de_las_colinas_2014')?.mechanics).toMatchObject({
      grants: [{ concept: 'enano', type: 'especie' }]
    })
    expect(byKey.get('acólito_2014')?.mechanics).toMatchObject({
      effects: [{ target: 'habilidades.perspicacia.grado' }, { target: 'habilidades.religion.grado' }]
    })
    expect(byKey.get('apresador_2014')).toMatchObject({
      type: 'dote',
      data: { repetible: false },
      mechanics: { automation: 'text' }
    })
    expect(() => originDocs('2014', new Map(), es, () => 'x')).toThrow('Falta «Dwarf»')
  })

  it('2024: la velocidad y el tamaño de la cabecera, la dote de origen del trasfondo y la categoría de una dote', () => {
    const en = new Map<string, OriginText>()
    const es = new Map<string, OriginText>()
    const items: [string, string][] = [
      ['Acolyte', 'Acólito'],
      ['Criminal', 'Criminal'],
      ['Sage', 'Erudito'],
      ['Soldier', 'Soldado'],
      ['Dragonborn', 'Dracónido'],
      ['Dwarf', 'Enano'],
      ['Elf', 'Elfo'],
      ['Gnome', 'Gnomo'],
      ['Goliath', 'Goliat'],
      ['Halfling', 'Mediano'],
      ['Human', 'Humano'],
      ['Orc', 'Orco'],
      ['Tiefling', 'Tiefling'],
      ['Alert', 'Alerta'],
      ['Magic Initiate', 'Iniciado en la magia'],
      ['Savage Attacker', 'Atacante salvaje'],
      ['Skilled', 'Habilidoso'],
      ['Ability Score Improvement', 'Mejora de característica'],
      ['Grappler', 'Apresador'],
      ['Archery', 'Tiro con arco'],
      ['Defense', 'Defensa'],
      ['Great Weapon Fighting', 'Combate con armas a dos manos'],
      ['Two-Weapon Fighting', 'Combate con dos armas'],
      ['Boon of Combat Prowess', 'Don de la pericia en combate'],
      ['Boon of Dimensional Travel', 'Don del viaje dimensional'],
      ['Boon of Fate', 'Don del destino'],
      ['Boon of Irresistible Offense', 'Don del ataque imparable'],
      ['Boon of Spell Recall', 'Don del recuerdo de conjuros'],
      ['Boon of the Night Spirit', 'Don del espíritu de la noche'],
      ['Boon of Truesight', 'Don de la visión verdadera']
    ]
    for (const [a, b] of items) {
      en.set(a, text(a, '', {}, 'General Feat (Prerequisite: Level 4+)'))
      es.set(b, text(b, '', {}, 'Dote general (requisitos: nivel 4 o más)'))
    }
    en.set('Dwarf', text('Dwarf', '', { Size: 'Medium (about 4–5 feet tall)', Speed: '30 feet' }))
    en.set(
      'Acolyte',
      text('Acolyte', '', {
        Feat: 'Magic Initiate (Cleric) (see “Feats”)',
        'Skill Proficiencies': 'Insight and Religion'
      })
    )
    en.set('Alert', text('Alert', 'Repeatable. You can take this feat more than once.', {}, 'Origin Feat'))
    const docs = originDocs(
      '2024',
      en,
      es,
      (it) => it.en.toLowerCase().replace(/\s+/g, '_'),
      new Map([['Magic Initiate', 'iniciado']])
    )
    const byKey = new Map(docs.map((d) => [d.key, d]))
    expect(byKey.get('dwarf_2024')).toMatchObject({
      data: { tamano: 'mediana' },
      mechanics: { effects: [{ target: 'velocidad', op: 'base', value: '30' }] }
    })
    expect(byKey.get('acolyte_2024')?.mechanics).toMatchObject({ grants: [{ concept: 'iniciado', type: 'dote' }] })
    expect(byKey.get('alert_2024')).toMatchObject({
      data: { categoria: { en: 'Origin Feat' }, repetible: true },
      mechanics: { effects: [{ target: 'bono_iniciativa', value: '@competencia' }] }
    })
    expect(byKey.get('grappler_2024')?.data).toMatchObject({
      categoria: { es: 'Dote general', en: 'General Feat' },
      requisito: { es: 'nivel 4 o más', en: 'Level 4+' }
    })
    expect(byKey.get('acolyte_2024')?.data.descripcion).toMatchObject({
      en: expect.stringContaining('**Feat:** Magic Initiate')
    })
  })
})

describe('las tablas partidas de las especies de 2024', () => {
  it('se quitan de donde caigan y se juntan, fila a fila, en su especie', () => {
    const entry = (name: string, text: string): OriginText => ({ name, header: {}, category: '', text, page: 84 })
    const texts = new Map([
      [
        'Elf',
        entry('Elf', 'Elf text.\n\n**Elven Lineages**\n\n| Lineage | Level 1 |\n| --- | --- |\n| Drow | Darkvision |')
      ],
      ['Gnome', entry('Gnome', 'Gnome text.\n\n| Level 3 | Level 5 |\n| --- | --- |\n| Faerie Fire | Darkness |')],
      ['Tiefling', entry('Tiefling', 'Tiefling text.')]
    ])
    mergeSplitTables(texts, 'en')
    expect(texts.get('Gnome')?.text).toBe('Gnome text.')
    expect(texts.get('Elf')?.text).toBe(
      'Elf text.\n\n**Elven Lineages**\n\n| Lineage | Level 1 | Level 3 | Level 5 |\n| --- | --- | --- | --- |\n| Drow | Darkvision | Faerie Fire | Darkness |'
    )
    expect(texts.get('Tiefling')?.text).toBe('Tiefling text.')
  })
})
