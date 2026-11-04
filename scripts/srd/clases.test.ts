import { describe, expect, it } from 'vitest'
import { sections } from './clases.ts'
import type { Row } from './texto.ts'

const row = (text: string, x = 58, page = 48): Row => ({ text, x, y: 0, page })

describe('el texto de una clase, en secciones', () => {
  it('cada rasgo con su nivel; la subclase y los suyos; sin sus tablas; hasta la clase siguiente', () => {
    const s = sections(
      [
        row('Fighter'),
        row('Level 1: Second Wind'),
        row('You have a limited well of stamina. As a Bonus'),
        row('Action, you regain Hit Points equal to 1d10 plus your Fighter level.'),
        row('You can use this feature twice.', 66),
        row('Fighter Features'),
        row('1 +2 Fighting Style, Second Wind 2 3'),
        row('Level 5: Extra Attack', 330),
        row('You can attack twice instead of once when-', 330),
        row('ever you take the Attack action.', 330),
        row('Fighter Subclass: Champion', 58, 49),
        row('A Champion focuses on su d estreza.', 58, 49),
        row('Level 3: Improved Critical', 58, 49),
        row('Critical Hit on a roll of 19 or 20.', 58, 49),
        row('Monk', 330, 49),
        row('Level 1: Martial Arts', 330, 49)
      ],
      {
        heading: /^Level (\d+): (.+)$/,
        subclass: /^Fighter Subclass: (.+)$/,
        table: /^Fighter Features$/,
        stop: /^Monk$/
      }
    )
    expect(s.map((x) => [x.level, x.subclass, x.name, x.page])).toEqual([
      [1, null, 'Second Wind', 48],
      [5, null, 'Extra Attack', 48],
      [null, 'Champion', 'Champion', 49],
      [3, 'Champion', 'Improved Critical', 49]
    ])
    expect(s[0]?.text).toBe(
      'You have a limited well of stamina. As a Bonus Action, you regain Hit Points equal to 1d10 plus your Fighter level.\n\nYou can use this feature twice.'
    )
    expect(s[1]?.text).toBe('You can attack twice instead of once whenever you take the Attack action.')
    expect(s[2]?.text).toBe('A Champion focuses on su destreza.')
  })

  it('en 2014, los rasgos por su nombre, con su nivel (y las opciones, sin él)', () => {
    const s = sections(
      [row('Fighting Style'), row('Choose one.'), row('Defense'), row('+1 to AC.'), row('Second Wind'), row('Heal.')],
      {
        heading: new Map([
          ['Fighting Style', 1],
          ['Defense', null],
          ['Second Wind', 1]
        ]),
        subclass: /^(Champion)$/,
        table: /^The Fighter$/,
        stop: /^Monk$/
      }
    )
    expect(s.map((x) => [x.name, x.level, x.text])).toEqual([
      ['Fighting Style', 1, 'Choose one.'],
      ['Defense', null, '+1 to AC.'],
      ['Second Wind', 1, 'Heal.']
    ])
  })
})
