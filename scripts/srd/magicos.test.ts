import { describe, expect, it } from 'vitest'
import {
  headerOf,
  likeness,
  type MagicRow,
  magicDoc,
  magicGroup,
  magicMechanics,
  numbersOf,
  pairByLikeness,
  parseMagicItem
} from './magicos.ts'
import type { Row } from './texto.ts'

const row = (text: string, h = 11.5): Row => ({ text, x: 58, y: 0, h, page: 207 })
const item = (over: Partial<MagicRow>): MagicRow => ({
  name: 'Ring of Protection',
  header: 'Ring, rare (requires attunement)',
  category: 'Ring',
  rarity: 'rara',
  attunement: true,
  text: '',
  page: 241,
  ...over
})
const name = { es: 'Anillo de protección', en: 'Ring of Protection' }

describe('la cabecera de un objeto mágico', () => {
  it('su categoría, su rareza (la primera que nombra) y su sintonización, en los dos idiomas', () => {
    expect(headerOf('Wondrous item, rare (requires attunement)')).toEqual({
      category: 'Wondrous item',
      rarity: 'rara',
      attunement: true
    })
    expect(headerOf('Weapon (any), uncommon (+1), rare (+2), or very rare (+3)')).toEqual({
      category: 'Weapon (any)',
      rarity: 'infrecuente',
      attunement: false
    })
    expect(headerOf('Armor (plate), very rare')).toMatchObject({ rarity: 'muy_rara' })
    expect(headerOf('Objeto maravilloso, muy raro (requiere sintonización)')).toMatchObject({
      category: 'Objeto maravilloso',
      rarity: 'muy_rara',
      attunement: true
    })
    expect(headerOf('Ring, rarity varies (requires attunement)')).toEqual({
      category: 'Ring',
      rarity: null,
      attunement: true
    })
    expect(headerOf('Poción, común')).toMatchObject({ rarity: 'comun' })
    expect(headerOf('Wondrous Item, Legendary')).toMatchObject({ rarity: 'legendaria' })
    expect(headerOf('This is just text.')).toBeNull()
  })

  it('una cabecera partida: por su alto (o, en el 5.1 inglés, por cómo acaba y cómo sigue)', () => {
    const text = (rows: readonly Row[]) => rows.map((r) => r.text).join(' ')
    const byHeight = parseMagicItem(
      'Adamantine Armor',
      [row('Armor (Any Medium or Heavy),', 13.3), row('Uncommon', 13.3), row('This suit is reinforced.', 34.1)],
      209,
      13.3,
      text
    )
    expect(byHeight).toMatchObject({
      header: 'Armor (Any Medium or Heavy), Uncommon',
      text: 'This suit is reinforced.'
    })
    const byShape = (lines: string[]) =>
      parseMagicItem('Shield', [...lines.map((l) => row(l)), row('While holding this shield.')], 242, null, text)
    expect(byShape(['Armor (shield), uncommon (+1), rare (+2), or very', 'rare (+3)'])).toMatchObject({
      header: 'Armor (shield), uncommon (+1), rare (+2), or very rare (+3)',
      text: 'While holding this shield.'
    })
    expect(
      byShape(['Weapon (any sword that deals slashing damage), very', 'rare (requires attunement)'])
    ).toMatchObject({
      rarity: 'muy_rara',
      attunement: true
    })
    expect(byShape(['Ammunition, uncommon (+1), rare', '(+2), or very rare (+3)'])?.header).toBe(
      'Ammunition, uncommon (+1), rare (+2), or very rare (+3)'
    )
    expect(parseMagicItem('Nada', [row('Nothing here.')], 1, null, text)).toBeNull()
  })
})

describe('emparejar los objetos mágicos', () => {
  it('su grupo: su clase, sus rarezas y su sintonización, iguales en los dos idiomas', () => {
    expect(magicGroup(item({}))).toBe('r|rara|S')
    expect(
      magicGroup(item({ category: 'Anillo', header: 'Anillo, raro (requiere sintonización)', attunement: true }))
    ).toBe('r|rara|S')
    expect(magicGroup(item({ category: 'Vara', header: 'Vara, infrecuente', attunement: false }))).toBe(
      'o|infrecuente|'
    )
    expect(magicGroup(item({ category: 'Varita', header: 'Varita, infrecuente', attunement: false }))).toBe(
      'v|infrecuente|'
    )
  })

  it('los dados y los números sin unidad ni separador de miles', () => {
    expect(numbersOf('It has 7 charges, regains 1d6 + 1, holds 1,000 pounds within 60 feet; DC 15.')).toEqual({
      dice: ['1d6'],
      numbers: ['7', '1', '15']
    })
    expect(numbersOf('Tiene 7 cargas, recupera 1d6 + 1, sostiene 450 kg a 18 m; CD 15. Pesa 1 000.')).toEqual({
      dice: ['1d6'],
      numbers: ['7', '1', '15', '1000']
    })
  })

  it('por parecido dentro de su grupo, con el sustantivo del nombre; la lista revisada antes', () => {
    const boots = item({
      name: 'Boots of Elvenkind',
      category: 'Wondrous item',
      header: 'Wondrous item, uncommon',
      text: 'Steps.'
    })
    const periapt = item({
      name: 'Periapt of Health',
      category: 'Wondrous item',
      header: 'Wondrous item, uncommon',
      text: 'Health.'
    })
    const botas = {
      ...boots,
      name: 'Botas élficas',
      category: 'Objeto maravilloso',
      header: 'Objeto maravilloso, infrecuente'
    }
    const talisman = {
      ...periapt,
      name: 'Talismán de salud',
      category: 'Objeto maravilloso',
      header: 'Objeto maravilloso, infrecuente'
    }
    expect(likeness(boots, botas)).toBeGreaterThan(likeness(boots, talisman))
    expect(pairByLikeness([boots, periapt], [talisman, botas]).map(([a, b]) => [a.name, b.name])).toEqual([
      ['Boots of Elvenkind', 'Botas élficas'],
      ['Periapt of Health', 'Talismán de salud']
    ])
    expect(
      pairByLikeness([boots, periapt], [talisman, botas], { 'Periapt of Health': 'Talismán de salud' }).map(
        ([, b]) => b.name
      )
    ).toEqual(['Botas élficas', 'Talismán de salud'])
    expect(() => pairByLikeness([boots], [talisman])).toThrow('Sin pareja: Boots of Elvenkind')
    expect(() => pairByLikeness([boots], [botas], { 'Boots of Elvenkind': 'Nada' })).toThrow('No está «Nada»')
  })
})

describe('la mecánica de un objeto mágico, del texto en inglés', () => {
  it('bonos a la CA y a las salvaciones, con sintonía; los brazales, sin armadura ni escudo', () => {
    expect(
      magicMechanics(
        '2014',
        item({ text: 'You gain a +1 bonus to AC and saving throws while wearing this ring.' }),
        name
      )
    ).toEqual({
      effects: [
        { target: 'ca', op: 'add', value: '1', when: '@este.sintonizado' },
        { target: 'bono_salvaciones', op: 'add', value: '1', when: '@este.sintonizado' }
      ],
      automation: 'partial'
    })
    const bracers = magicMechanics(
      '2024',
      item({
        text: 'While wearing these bracers, you have a +2 bonus to AC if you are wearing no armor and using no Shield.'
      }),
      name
    )
    expect(bracers.effects).toEqual([
      { target: 'ca', op: 'add', value: '2', when: '@este.sintonizado && !@con_armadura && !@con_escudo' }
    ])
    expect(
      magicMechanics('2014', item({ attunement: false, text: 'You have a +1 bonus to saving throws.' }), name).effects
    ).toEqual([{ target: 'bono_salvaciones', op: 'add', value: '1', when: '@este.equipado' }])
  })

  it('una característica fija, una resistencia, las cargas y una poción que cura', () => {
    expect(
      magicMechanics('2014', item({ text: 'Your Constitution score is 19 while you wear this amulet.' }), name).effects
    ).toEqual([{ target: 'caracteristicas.con.puntuacion', op: 'min', value: '19', when: '@este.sintonizado' }])
    expect(
      magicMechanics('2014', item({ text: 'You have resistance to cold damage and resistance to cold damage.' }), name)
        .effects
    ).toEqual([{ target: 'resistencias', op: 'append', value: '"frio"', when: '@este.sintonizado' }])
    expect(
      magicMechanics(
        '2014',
        item({ text: 'This wand has 7 charges. The wand regains 1d6 + 1 expended charges daily at dawn.' }),
        name
      ).resources
    ).toEqual([{ key: 'cargas', label: { es: 'Cargas', en: 'Charges' }, max: '7', recovery: 'dawn', amount: '1d6+1' }])
    expect(magicMechanics('2014', item({ text: 'It has 3 charges.' }), name).resources).toEqual([
      { key: 'cargas', label: { es: 'Cargas', en: 'Charges' }, max: '3' }
    ])
    const drink = (edition: '2014' | '2024') =>
      magicMechanics(edition, item({ text: 'You regain 4d4 + 4 Hit Points when you drink this potion.' }), name).actions
    expect(drink('2014')).toEqual([{ key: 'beber', label: name, activation: 'action', heal: '4d4+4' }])
    expect(drink('2024')).toMatchObject([{ activation: 'bonus' }])
    expect(magicMechanics('2014', item({ text: 'It glows.' }), name)).toEqual({ automation: 'text' })
  })

  it('el documento: su categoría en los dos idiomas, su rareza, su sintonía y su página', () => {
    const doc = magicDoc(
      '2024',
      item({ text: 'You gain a +1 bonus to AC.' }),
      item({ name: 'Anillo de protección', category: 'Anillo', page: 260 }),
      'anillo_de_proteccion'
    )
    expect(doc).toMatchObject({
      type: 'objeto_magico',
      key: 'anillo_de_proteccion_2024',
      source: 'srd521',
      data: { name, tipo: { es: 'Anillo', en: 'Ring' }, rareza: 'rara', sintonia: true },
      ref: { pages: { en: 241, es: 260 } }
    })
    expect(magicDoc('2014', item({ rarity: null }), item({}), 'x').data).not.toHaveProperty('rareza')
  })
})
