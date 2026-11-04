import { describe, expect, it } from 'vitest'
import { costOf } from './equipo.ts'
import { mountDoc, mountRows, mountSignature, statsText } from './monturas.ts'
import type { Row } from './texto.ts'

const rows = (...texts: string[]): Row[] => texts.map((text, i) => ({ text, x: 58, y: i * 10, page: 100 }))

describe('las monturas, los arreos y los vehículos', () => {
  it('los miles en español van con un espacio', () => {
    expect(costOf('10 000 po', 'es')).toBe(10000)
    expect(costOf('3000 po', 'es')).toBe(3000)
  })

  it('2014: las monturas con su velocidad y su carga, las sillas en su grupo, los barcos y las mercancías', () => {
    const found = mountRows(
      rows(
        'Monturas y otros animales',
        'Elemento Precio Velocidad de carga',
        'Camello 50 po 15 m 240 kg',
        'Arreos, arneses y vehículos tirados',
        'Elemento Precio Peso',
        'Barda ×4 ×2',
        'Carreta 15 po 100 kg',
        'Silla',
        'Exótica 60 po 20 kg',
        'Trineo 20 po 150 kg',
        'Vehículos acuáticos',
        'Galera 30 000 po 6 km/h',
        'Mercancías',
        'Precio Bienes',
        '1 pc 0,5 kg de trigo',
        '5 pp 0,5 kg de cobre o 0,8 m 2 de tela de algodón',
        'Un texto que ya no es de la tabla'
      ),
      '2014',
      'es'
    )
    expect(found.map((r) => [r.kind, r.name, r.cost, r.weight])).toEqual([
      ['montura', 'Camello', 50, null],
      ['vehiculo', 'Carreta', 15, 200],
      ['arreos', 'Silla exótica', 60, 40],
      ['vehiculo', 'Trineo', 20, 300],
      ['vehiculo', 'Galera', 30000, null],
      ['mercancia', '0,5 kg de trigo', 0.01, null],
      ['mercancia', '0,5 kg de cobre o 0,8 m² de tela de algodón', 0.5, null]
    ])
    expect(statsText(found[0] as never, 'es')).toBe('Velocidad 15 m; capacidad de carga 240 kg.')
    // La firma, igual en los dos idiomas: 15 m son 50 pies; 6 km/h, 4 mph; 240 kg, 480 lb
    expect(mountSignature(found[0] as never)).toBe('montura|50||50|480')
    expect(mountSignature(found[4] as never)).toBe('vehiculo|30000||4|')
  })

  it('2024: los vehículos grandes, con sus columnas en las dos mitades de la página (en español, la carga en la otra)', () => {
    const found = mountRows(
      rows(
        'Vehículos acuáticos y aéreos',
        'Aeronave 12 km/h 10 20',
        'Barcaza 1,5 km/h 1 6',
        'Un texto entre medias.',
        '1 13 300 — 40 000 po',
        '1/2 15 100 10 3000 po'
      ),
      '2024',
      'es'
    )
    expect(found.map((r) => [r.name, r.cost, r.stats.cargo, r.stats.ac])).toEqual([
      ['Aeronave', 40000, '1', '13'],
      ['Barcaza', 3000, '1/2', '15']
    ])
    expect(statsText(found[0] as never, 'es')).toBe(
      'Velocidad 12 km/h; tripulación 10; pasajeros 20; cargamento (t) 1; CA 13; PG 300; umbral de daño —.'
    )
    const doc = mountDoc('2024', found[0] as never, found[0] as never, 'aeronave')
    expect(doc).toMatchObject({ type: 'equipo', key: 'aeronave_2024', data: { categoria: 'vehiculo', coste: 40000 } })
  })
})
