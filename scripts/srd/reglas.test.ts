import { describe, expect, it } from 'vitest'
import { cut, joinDropCaps, type Profile, textOf } from './reglas.ts'
import type { Box, Row } from './texto.ts'

const row = (text: string, x = 58, y = 0, h = 10, page = 358): Row => ({ text, x, y, h, page })

describe('el texto de las reglas', () => {
  it('párrafos por la sangría, con las palabras partidas unidas', () => {
    const text = textOf([
      row('Conditions alter a creature’s capa-'),
      row('bilities in a variety of ways.'),
      row('A condition lasts until it is countered.', 67),
      row('Or for a duration.')
    ])
    expect(text).toBe(
      'Conditions alter a creature’s capabilities in a variety of ways.\n\nA condition lasts until it is countered. Or for a duration.'
    )
  })

  it('une la letra suelta de una palabra partida («d estreza»), pero no la unidad tras un número («1,5 m o menos»)', () => {
    expect(textOf([row('salvación de d estreza a 1,5 m o menos')])).toBe('salvación de destreza a 1,5 m o menos')
  })

  it('viñetas: la línea sangrada que sigue es de la viñeta; las seguidas van en una lista', () => {
    const text = textOf([
      row('• A blinded creature can’t see and automatically'),
      row('fails any ability check that requires sight.', 67),
      row('• Attack rolls against the creature have advantage.'),
      row('After the list.', 67)
    ])
    expect(text).toBe(
      '- A blinded creature can’t see and automatically fails any ability check that requires sight.\n- Attack rolls against the creature have advantage. After the list.'
    )
  })

  it('una tabla sencilla, como tabla de Markdown, y lo que la sigue en otro párrafo', () => {
    const text = textOf(
      [
        row('Exhaustion is measured in six levels.'),
        row('Level Effect'),
        row('1 Disadvantage on ability checks', 67),
        row('2 Speed halved', 67),
        row('If an already exhausted creature suffers another effect')
      ],
      { tables: /^(Level Effect|Nivel Efecto)$/ }
    )
    expect(text).toBe(
      [
        'Exhaustion is measured in six levels.',
        '| Level | Effect |\n| --- | --- |\n| 1 | Disadvantage on ability checks |\n| 2 | Speed halved |',
        'If an already exhausted creature suffers another effect'
      ].join('\n\n')
    )
  })

  it('cortar por títulos (uno partido en dos líneas va junto) y parar donde se dice', () => {
    const big = 14
    const entries = cut(
      [
        row('Intro', 58, 0),
        row('Blinded', 58, 10, big),
        row('• Can’t see.', 58, 30),
        row('Opportunity', 58, 50, big),
        row('Attack', 58, 64, big),
        row('Text.', 58, 80),
        row('Appendix PH-B', 58, 100, 30),
        row('Lost.', 58, 120)
      ],
      (r) => r.h === big,
      /^Appendix/
    )
    expect(entries.map((e) => [e.name, e.rows.map((r) => r.text)])).toEqual([
      ['Blinded', ['• Can’t see.']],
      ['Opportunity Attack', ['Text.']]
    ])
  })
})

describe('el texto de las reglas, con el perfil de un PDF', () => {
  // Como el 2024: texto 34.1, apartados 16.7 y 14.3, tablas 12.5 y 11, recuadros 11.9 y 10.4
  const profile: Profile = {
    headings: [[16.7], [14.3]],
    tableTitles: [12.5],
    cells: [11],
    sidebar: { title: 11.9, body: 10.4 },
    body: [34.1]
  }
  const r = (text: string, h: number, x = 63, y = 0, cells?: string[]): Row => ({
    text,
    x,
    y,
    h,
    page: 6,
    ...(cells ? { cells } : {})
  })

  it('apartados (uno partido en dos líneas va junto), tablas con su título y recuadros', () => {
    const text = textOf(
      [
        r('Ability', 16.7, 63, 10),
        r('Checks', 16.7, 63, 30),
        r('An ability check represents a creature.', 34.1, 63, 50),
        r('Typical Difficulty Classes', 12.5, 63, 70),
        r('Task DC', 11, 63, 80, ['Task', 'DC']),
        r('Very easy 5', 11, 63, 90, ['Very easy', '5']),
        r('Nearly impossible, even for', 11, 63, 100, ['Nearly impossible, even for', '30']),
        r('heroes', 11, 90, 110, ['heroes']),
        r('Round Down', 11.9, 72, 130),
        r('Whenever you divide a number,', 10.4, 72, 140),
        r('round down.', 10.4, 72, 150),
        r('Modifier', 14.3, 63, 170)
      ],
      { profile }
    )
    expect(text).toBe(
      [
        '### Ability Checks',
        'An ability check represents a creature.',
        '**Typical Difficulty Classes**',
        '| Task | DC |\n| --- | --- |\n| Very easy | 5 |\n| Nearly impossible, even for | 30 heroes |',
        '### Round Down',
        'Whenever you divide a number, round down.',
        '#### Modifier'
      ].join('\n\n')
    )
  })

  it('el párrafo que corta una tabla sigue después, si no acabó; un apartado en medio lo cierra', () => {
    const rows = [
      r('The rules for advancing beyond level 1 provided', 34.1, 63, 10),
      r('Equipment', 12.5, 63, 20),
      r('Level Money', 11, 63, 30, ['Level', 'Money']),
      r('in the Level Advancement section.', 34.1, 63, 40)
    ]
    expect(textOf(rows, { profile })).toBe(
      [
        'The rules for advancing beyond level 1 provided in the Level Advancement section.',
        '**Equipment**',
        '| Level | Money |\n| --- | --- |'
      ].join('\n\n')
    )
    const closed = textOf([rows[0] as Row, r('Next', 16.7, 63, 20), r('in another part.', 34.1, 63, 40)], { profile })
    expect(closed).toBe('The rules for advancing beyond level 1 provided\n\n### Next\n\nin another part.')
  })

  it('las tablas que no van: sus filas, en las dos columnas, fuera; las de otra tabla con título, dentro', () => {
    const text = textOf(
      [
        r('Every weapon falls into a category.', 34.1, 63, 10),
        r('Mace 1d6', 11, 63, 5, ['Mace', '1d6']),
        r('Weapons', 12.5, 63, 20),
        r('Name Damage', 11, 63, 30, ['Name', 'Damage']),
        r('Simple Melee Weapons', 10.8, 63, 40),
        r('Weapon Proficiency', 16.7, 313, 10),
        r('Anyone can wield a weapon.', 34.1, 313, 20),
        r('Mastery Weight', 11, 313, 30, ['Mastery', 'Weight']),
        r('Donning', 12.5, 313, 40),
        r('Category Don', 11, 313, 50, ['Category', 'Don'])
      ],
      { profile, dropTables: /^Weapons$/ }
    )
    expect(text).toBe(
      [
        'Every weapon falls into a category.',
        '### Weapon Proficiency',
        'Anyone can wield a weapon.',
        '**Donning**',
        '| Category | Don |\n| --- | --- |'
      ].join('\n\n')
    )
  })
})

describe('las capitulares de los títulos de los recuadros', () => {
  const box = (text: string, x: number, xMax: number, y: number, h: number): Box => ({ text, x, xMax, y, h, page: 5 })

  it('cada letra va con su palabra; un número del mismo alto, en la línea del título', () => {
    const joined = joinDropCaps(
      [
        box('E', 72.1, 79.3, 516.2, 17),
        box('xceptions', 79.5, 130.2, 519.9, 11.9),
        box('L', 300, 307, 516.2, 17),
        box('as', 307.5, 320, 519.9, 11.9),
        box('Level', 72, 100, 600, 11.9),
        box('20', 104, 115, 597, 17)
      ],
      17
    )
    expect(joined.map((b) => [b.text, b.x, b.y, b.h])).toEqual([
      ['Exceptions', 72.1, 519.9, 11.9],
      ['Las', 300, 519.9, 11.9],
      ['Level', 72, 600, 11.9],
      ['20', 104, 600, 11.9]
    ])
  })
})
