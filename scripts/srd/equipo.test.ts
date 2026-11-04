import { describe, expect, it } from 'vitest'
import {
  armorDoc,
  armorRows,
  armorSignature,
  concepts,
  costOf,
  pair,
  propertiesOf,
  sameName,
  type WeaponRow,
  weaponDoc,
  weaponRows,
  weaponSignature,
  weightOf
} from './equipo.ts'
import { clean, collapse, type Line, slug } from './texto.ts'

/** Unas líneas como las de pdftotext -layout, en una página */
const lines = (page: number, ...raw: string[]): Line[] =>
  raw.map((r) => {
    const c = clean(r)
    return { raw: c, text: collapse(c), page }
  })

describe('el texto', () => {
  it('limpia guiones blandos, rayas y tabuladores; una clave sin tildes', () => {
    expect(collapse(clean('Two-­‐handed\t  light'))).toBe('Two-handed light')
    expect(slug('Ballesta de mano')).toBe('ballesta_de_mano')
    expect(slug('Bastón')).toBe('baston')
  })
})

describe('los precios, los pesos y las propiedades', () => {
  it('los precios en piezas de oro; en español «pp» es plata', () => {
    expect(costOf('1,500 GP', 'en')).toBe(1500)
    expect(costOf('5 CP', 'en')).toBe(0.05)
    expect(costOf('2 pp', 'es')).toBe(0.2)
    expect(costOf('1500 po', 'es')).toBe(1500)
    expect(() => costOf('3 xx', 'en')).toThrow('Moneda desconocida')
  })

  it('los pesos en libras: del español, 1 kg son 2 lb', () => {
    expect(weightOf('1/4 lb.')).toBe(0.25)
    expect(weightOf('18 lb.')).toBe(18)
    expect(weightOf('1,5 kg')).toBe(3)
    expect(weightOf('125 g')).toBe(0.25)
    expect(weightOf('—')).toBeNull()
  })

  it('las propiedades, con su distancia y su daño a dos manos', () => {
    expect(propertiesOf('Ammunition (Range 80/320; Bolt), Loading, Two-Handed')).toEqual({
      keys: ['municion', 'recarga', 'a_dos_manos'],
      range: '80/320',
      versatile: null
    })
    expect(propertiesOf('Arrojadiza (alcance 6/18), versátil (1d8)')).toEqual({
      keys: ['arrojadiza', 'versatil'],
      range: '6/18',
      versatile: '1d8'
    })
    expect(propertiesOf('Gran alcance, sutil').keys).toEqual(['alcance', 'sutil'])
    expect(propertiesOf('—').keys).toEqual([])
    expect(() => propertiesOf('Rara')).toThrow('Propiedad desconocida')
  })
})

describe('las tablas', () => {
  it('las armas de 2024 en inglés, con sus grupos y lo que sigue en la línea de abajo', () => {
    const rows = weaponRows(
      lines(
        91,
        '     Simple Melee Weapons',
        '      Club              1d4 Bludgeoning   Light                                               Slow         2 lb.     1 SP',
        '     Martial Ranged Weapons',
        '      Light Crossbow    1d8 Piercing      Ammunition (Range 80/320; Bolt), Loading,           Slow         5 lb.    25 GP',
        '                                          Two-Handed'
      ),
      '2024',
      'en'
    )
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'Club',
        group: 'simple_melee',
        damage: '1d4',
        type: 'contundente',
        mastery: 'ralentizar',
        cost: 0.1,
        page: 91
      }),
      expect.objectContaining({
        name: 'Light Crossbow',
        group: 'martial_ranged',
        props: 'Ammunition (Range 80/320; Bolt), Loading, Two-Handed',
        weight: 5,
        cost: 25
      })
    ])
  })

  it('en español, una palabra partida con guion se une', () => {
    const [row] = weaponRows(
      lines(
        99,
        '     Armas a distancia marciales',
        '       Ballesta pesada        1d10 perforante   A dos manos, munición (alcance 30/120; virote), pe-    Empujar       9 kg    50 po',
        '                                                sada, recarga'
      ),
      '2024',
      'es'
    )
    expect(row).toMatchObject({
      name: 'Ballesta pesada',
      props: 'A dos manos, munición (alcance 30/120; virote), pesada, recarga',
      weight: 18
    })
  })

  it('las de 2014: el primer grupo, sin cabecera; un arma sin daño', () => {
    const rows = weaponRows(
      lines(
        66,
        ' Club    1   sp    1d4   bludgeoning    2   lb.    Light',
        'Martial   Ranged   Weapons',
        ' Net    1   gp    —    3   lb.    Special,   thrown   (range   5/15)'
      ),
      '2014',
      'en'
    )
    expect(rows.map((r) => [r.name, r.group, r.damage, r.type])).toEqual([
      ['Club', 'simple_melee', '1d4', 'contundente'],
      ['Net', 'martial_ranged', '0', null]
    ])
  })

  it('las armaduras: en español, un nombre que sigue abajo', () => {
    const rows = armorRows(
      lines(
        100,
        '      Armaduras ligeras (1 minuto para ponérselas o quitárselas)',
        '        Armadura de cuero         12 + modificador por Des             —             —                   6,5 kg     45 po',
        '        tachonado',
        '      Escudos (acción de utilizar para ponérselos o quitárselos)',
        '        Escudo                    +2                                   —             —                     3 kg     10 po'
      ),
      '2024',
      'es'
    )
    expect(rows.map((r) => [r.name, r.group, r.ac, r.weight])).toEqual([
      ['Armadura de cuero tachonado', 'ligera', '12 + modificador por Des', 13],
      ['Escudo', 'escudo', '+2', 6]
    ])
  })
})

describe('emparejar y escribir los documentos', () => {
  const row = (name: string, extra: Partial<WeaponRow> = {}): WeaponRow => ({
    name,
    group: 'martial_melee',
    damage: '1d10',
    type: 'cortante',
    props: 'Heavy, Reach, Two-Handed',
    mastery: null,
    weight: 6,
    cost: 20,
    page: 66,
    ...extra
  })

  it('por su firma; si dos dicen lo mismo, por la lista revisada; lo que no casa, se dice', () => {
    const en = [row('Glaive'), row('Halberd'), row('Longsword', { damage: '1d8', cost: 15 })]
    const es = [row('Alabarda'), row('Espada larga', { damage: '1d8', cost: 15 }), row('Guja')]
    expect(
      pair(en, es, weaponSignature, { Glaive: 'Guja', Halberd: 'Alabarda' }).map(([a, b]) => `${a.name}=${b.name}`)
    ).toEqual(['Glaive=Guja', 'Halberd=Alabarda', 'Longsword=Espada larga'])
    expect(() => pair(en, es, weaponSignature)).toThrow('casa con 2 en español')
    expect(() => pair(en.slice(2), es, weaponSignature, {})).toThrow('Sin pareja en inglés')
  })

  it('lo mismo en las dos ediciones, por su nombre en inglés; el concepto, por el español de 2024', () => {
    expect(sameName('Crossbow, light')).toBe('light crossbow')
    expect(sameName('Padded Armor')).toBe('padded')
    const c = concepts(
      [[row('Light Crossbow'), row('Ballesta ligera')]],
      [
        [row('Crossbow, light'), row('Ballesta ligera')],
        [row('Net'), row('Red')]
      ]
    )
    expect(c).toEqual({ newer: ['ballesta_ligera'], older: ['ballesta_ligera', 'red'] })
  })

  it('un arma y una armadura, como documentos del 5e', () => {
    const doc = weaponDoc(
      '2024',
      row('Longsword', {
        damage: '1d8',
        props: 'Versatile (1d10)',
        mastery: 'debilitar',
        weight: 3,
        cost: 15,
        page: 91
      }),
      row('Espada larga', { page: 99 }),
      'espada_larga'
    )
    expect(doc).toMatchObject({
      key: 'espada_larga_2024',
      source: 'srd521',
      data: {
        name: { es: 'Espada larga', en: 'Longsword' },
        dano_versatil: '1d10',
        maestria: 'debilitar',
        categoria: 'marcial'
      },
      mechanics: { automation: 'full' },
      ref: { pages: { en: 91, es: 99 } }
    })
    expect(
      weaponDoc('2014', row('Lance', { props: 'Reach, special' }), row('Lanza de caballería'), 'x').mechanics.automation
    ).toBe('partial')
    const armor = {
      name: 'Chain Mail',
      group: 'pesada' as const,
      ac: '16',
      strength: 13,
      stealth: true,
      weight: 55,
      cost: 75,
      page: 92
    }
    expect(armorSignature(armor)).toBe('pesada|16|13|true|75')
    expect(armorDoc('2024', armor, { ...armor, name: 'Cota de malla', page: 100 }, 'cota_de_malla')).toMatchObject({
      data: { ca_base: 16, fuerza: 13, sigilo_desventaja: true },
      mechanics: { effects: [{ op: 'base' }, { op: 'disadvantage' }, { op: 'add', target: 'velocidad' }] }
    })
    const shield = { ...armor, name: 'Shield', group: 'escudo' as const, ac: '+2', strength: null, stealth: false }
    expect(armorDoc('2024', shield, shield, 'escudo').mechanics).toMatchObject({
      effects: [{ op: 'add', when: '@este.embrazado' }]
    })
  })
})
