/**
 * El 5e de serie: valida y, con personajes escritos a mano, da lo que dicen las reglas (sus características, su
 * competencia, sus salvaciones, sus habilidades, su CA, sus PG, su iniciativa, su pasiva y sus conjuros)
 */
import type { DieRoller } from '@crisol/dice'
import { describe, expect, it } from 'vitest'
import { prepareAction } from '../../actions.ts'
import { type DocumentItem, evaluate, type SystemDocument } from '../../evaluate.ts'
import { validateContent } from '../../file.ts'
import type { Mechanics } from '../../mechanics.ts'
import { rollsOf, tryRoll } from '../../rolls.ts'
import { validateSystem } from '../../validate.ts'
import { catalogSystem } from '../index.ts'
import { fiveE } from './system.ts'

const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}

type Scores = Partial<Record<'fue' | 'des' | 'con' | 'int' | 'sab' | 'car', number>>
const pj = (scores: Scores, items: DocumentItem[], data: Record<string, unknown> = {}): SystemDocument => ({
  data: {
    caracteristicas: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { puntuacion: v }])),
    ...data
  },
  items
})
const item = (
  id: string,
  type: string,
  name: string,
  data: Record<string, unknown>,
  mechanics?: Mechanics
): DocumentItem => ({
  id,
  type,
  name,
  data,
  ...(mechanics ? { mechanics } : {})
})

/** Una clase escrita a mano: su dado, sus salvaciones (si es la primera) y sus competencias con armas */
const clase = (
  id: string,
  name: string,
  nivel: number,
  {
    dado,
    salvaciones = [],
    armas = [],
    lanzamiento = '',
    lanzador
  }: {
    dado: number
    salvaciones?: string[]
    armas?: string[]
    lanzamiento?: string
    lanzador?: string
  },
  inicial = true
) =>
  item(
    id,
    'clase',
    name,
    { nivel, inicial, dado, dado_golpe: `1d${dado}`, lanzamiento },
    {
      effects: [
        ...salvaciones.map((c) => ({
          target: `caracteristicas.${c}.salvacion_grado`,
          op: 'min' as const,
          value: '1',
          when: '@este.inicial'
        })),
        ...armas.map((a) => ({ target: 'competencias_armas', op: 'append' as const, value: `"${a}"` })),
        ...(lanzador ? [{ target: 'nivel_lanzador', op: 'add' as const, value: lanzador }] : [])
      ]
    }
  )

const armadura = (id: string, name: string, data: Record<string, unknown>) =>
  item(id, 'armadura', name, data, {
    effects:
      data.categoria === 'escudo'
        ? [{ target: 'ca', op: 'add', value: '@este.ca', when: '@este.embrazado' }]
        : [{ target: 'ca', op: 'base', value: '@este.ca', when: '@este.puesta' }]
  })

const guerrero = (nivel = 5) =>
  clase('guerrero', 'Guerrero', nivel, { dado: 10, salvaciones: ['fue', 'con'], armas: ['sencilla', 'marcial'] })
const cota = armadura('cota_de_malla', 'Cota de malla', { categoria: 'pesada', ca_base: 16, equipado: true })
const escudo = armadura('escudo', 'Escudo', { categoria: 'escudo', ca_base: 2, equipado: true })
const espada = item('espada_larga', 'arma', 'Espada larga', {
  categoria: 'marcial',
  base: 'espada_larga',
  propiedades: ['versatil'],
  dano: '1d8',
  dano_versatil: '1d10',
  tipo_dano: 'cortante',
  equipado: true,
  peso: 3
})
const estoque = item('estoque', 'arma', 'Estoque', { categoria: 'marcial', propiedades: ['sutil'], dano: '1d8' })

describe('el 5e de serie', () => {
  it('está en el catálogo y valida', () => {
    expect(catalogSystem('5e')).toBe(fiveE)
    expect(validateSystem(fiveE).problems).toEqual([])
  })

  it('el guerrero de nivel 5 con cota de malla y espada larga: CA 16, PG 44 y un ataque de +6', () => {
    const doc = pj({ fue: 16, des: 12, con: 14 }, [guerrero(), cota, espada], {
      habilidades: { atletismo: { grado: 1 } }
    })
    const r = evaluate(fiveE, 'personaje', doc)
    expect(r.values).toMatchObject({
      nivel: 5,
      competencia: 3,
      ca: 16,
      pg_max: 44,
      iniciativa: 1,
      percepcion_pasiva: 10
    })
    expect(r.computed.ca?.terms).toEqual([{ label: 'Cota de malla', value: 16, kind: 'base', origin: 'cota_de_malla' }])
    expect(r.computed.pg_max?.terms.map((t) => [t.label, t.value])).toEqual([
      ['PG de las clases', 34],
      ['Por la Constitución', 10]
    ])
    const car = r.values.caracteristicas as Record<string, { mod: number; salvacion: number }>
    expect([car.fue?.salvacion, car.des?.salvacion, car.con?.salvacion]).toEqual([6, 1, 5])
    const hab = r.values.habilidades as Record<string, { total: number }>
    expect([hab.atletismo?.total, hab.sigilo?.total, hab.percepcion?.total]).toEqual([6, 1, 0])
    expect(r.items.espada_larga).toMatchObject({ ataque: 6, dano_bono: 3, competente: true, caracteristica: 'fue' })
    expect(r.values.carga).toBe(3)

    const ataque = tryRoll(fiveE, 'personaje', doc, 'ataque', { element: 'espada_larga', roller: fixed(20) })
    expect(ataque).toMatchObject({ label: 'Ataque · Espada larga', total: 26, band: { tone: 'critical' } })
    expect(tryRoll(fiveE, 'personaje', doc, 'dano', { element: 'espada_larga', roller: fixed(5) }).total).toBe(8)
    expect(
      tryRoll(fiveE, 'personaje', doc, 'dano_dos_manos', { element: 'espada_larga', roller: fixed(7) }).total
    ).toBe(10)
    expect(tryRoll(fiveE, 'personaje', doc, 'dado_golpe', { element: 'guerrero', roller: fixed(6) }).total).toBe(8)
    expect(rollsOf(fiveE, 'personaje', 'es', doc).map((roll) => roll.key)).toEqual([
      'prueba',
      'salvacion',
      'habilidad',
      'iniciativa',
      'ataque',
      'dano',
      'dano_dos_manos',
      'salvacion_muerte',
      'dado_golpe'
    ])
  })

  it('la CA: sin armadura, con escudo; un arma sutil usa la mejor; sin competencia, sin bono', () => {
    expect(evaluate(fiveE, 'personaje', pj({ des: 16 }, [])).values.ca).toBe(13)
    expect(evaluate(fiveE, 'personaje', pj({ des: 16 }, [escudo])).values.ca).toBe(15)
    const r = evaluate(fiveE, 'personaje', pj({ fue: 10, des: 16 }, [estoque]))
    expect(r.items.estoque).toMatchObject({ caracteristica: 'des', competente: false, ataque: 3 })
  })

  it('las reglas de 2024: el cansancio resta 2 por nivel a las pruebas d20; con las de 2014, no', () => {
    const cansado = pj({ des: 14 }, [], { cansancio: 2 })
    const iniciativa = (reglas: string) =>
      tryRoll(fiveE, 'personaje', cansado, 'iniciativa', { roller: fixed(10), settings: { reglas } }).total
    expect(iniciativa('e2024')).toBe(8)
    expect(iniciativa('e2014')).toBe(12)
  })

  it('lanzar conjuros: la característica de su clase, su CD, su ataque y sus espacios', () => {
    const mago = clase('mago', 'Mago', 5, { dado: 6, lanzamiento: 'int', lanzador: '@este.nivel' })
    const bola = item(
      'bola_de_fuego',
      'conjuro',
      'Bola de fuego',
      { nivel: 3 },
      {
        actions: [
          {
            key: 'lanzar',
            label: 'Bola de fuego',
            save: { ability: 'des', dc: '@este.cd', success: 'half' },
            damage: [{ formula: '8d6', type: 'fuego' }]
          }
        ],
        scaling: { mode: 'slot', base: 3, per: '1d6' }
      }
    )
    const doc = pj({ int: 16, con: 12 }, [mago, bola])
    const r = evaluate(fiveE, 'personaje', doc)
    expect(r.values).toMatchObject({
      caracteristica_conjuros: 'int',
      cd_conjuros: 14,
      ataque_conjuros: 6,
      nivel_lanzador: 5
    })
    expect(r.values.espacios).toMatchObject({ n1: { max: 4 }, n2: { max: 3 }, n3: { max: 2 }, n4: { max: 0 } })
    expect(r.items.bola_de_fuego).toMatchObject({ cd: 14, ataque: 6 })
    expect(prepareAction(fiveE, 'personaje', doc, 'bola_de_fuego', 'lanzar', { level: 5 })).toMatchObject({
      save: { abilityLabel: 'Destreza', dc: 14 },
      damage: [{ formula: '10d6', average: 35 }]
    })
    expect(r.values.pg_max).toBe(6 + 4 * 4 + 5)
  })

  it('con multiclase: los espacios por el nivel de lanzador de todas, y cada conjuro con la característica de su clase', () => {
    const mago = clase('mago', 'Mago', 3, { dado: 6, lanzamiento: 'int', lanzador: '@este.nivel' })
    const clerigo = clase('clerigo', 'Clérigo', 2, { dado: 8, lanzamiento: 'sab', lanzador: '@este.nivel' }, false)
    const curar = item('curar_heridas', 'conjuro', 'Curar heridas', { nivel: 1, caracteristica: 'sab' })
    const r = evaluate(fiveE, 'personaje', pj({ int: 16, sab: 12 }, [mago, clerigo, curar]))
    expect(r.values).toMatchObject({ nivel: 5, nivel_lanzador: 5, caracteristica_conjuros: 'int', cd_conjuros: 14 })
    expect(r.values.espacios).toMatchObject({ n1: { max: 4 }, n2: { max: 3 }, n3: { max: 2 } })
    expect(r.items.curar_heridas).toMatchObject({ cd: 12, ataque: 4 })
    // Los PG: el dado entero solo en la primera clase
    expect(r.values.pg_max).toBe(6 + 2 * 4 + 2 * 5)
  })

  it('un medio lanzador de 2014 empieza a nivel 2; la magia de pacto va aparte', () => {
    const half = '@este.nivel >= 2 ? ceil(@este.nivel / 2) : 0'
    const paladin = (nivel: number) =>
      clase('paladin', 'Paladín', nivel, { dado: 10, lanzamiento: 'car', lanzador: half })
    const slotsAt = (nivel: number) => evaluate(fiveE, 'personaje', pj({}, [paladin(nivel)])).values.espacios
    expect(slotsAt(1)).toMatchObject({ n1: { max: 0 } })
    expect(slotsAt(2)).toMatchObject({ n1: { max: 2 } })
    expect(slotsAt(5)).toMatchObject({ n1: { max: 4 }, n2: { max: 2 }, n3: { max: 0 } })
    const brujo = item(
      'brujo',
      'clase',
      'Brujo',
      { nivel: 5, inicial: true, dado: 8, lanzamiento: 'car' },
      {
        effects: [
          {
            target: 'pacto_espacios',
            op: 'add',
            value: '@este.nivel >= 17 ? 4 : @este.nivel >= 11 ? 3 : @este.nivel >= 2 ? 2 : 1'
          },
          { target: 'pacto_nivel', op: 'add', value: 'min(5, ceil(@este.nivel / 2))' }
        ]
      }
    )
    const r = evaluate(fiveE, 'personaje', pj({ car: 16 }, [brujo]))
    expect(r.values).toMatchObject({ pacto_espacios: 2, pacto_nivel: 3, pacto: { max: 2 }, nivel_lanzador: 0 })
  })

  it('una criatura: sus salvaciones y habilidades salen de su VD y sus características', () => {
    const dragon = {
      data: {
        vd: 17,
        caracteristicas: {
          fue: { puntuacion: 27 },
          des: { puntuacion: 10, salvacion_grado: 1 },
          sab: { puntuacion: 13 }
        },
        habilidades: { percepcion: { grado: 2 }, sigilo: { grado: 1 } }
      }
    }
    const r = evaluate(fiveE, 'criatura', dragon)
    const car = r.values.caracteristicas as Record<string, { salvacion: number }>
    const hab = r.values.habilidades as Record<string, { total: number }>
    // Dragón rojo adulto (SRD 5.1): Des +6, Percepción +13, Sigilo +6, Percepción pasiva 23
    expect([
      r.values.competencia,
      car.des?.salvacion,
      hab.percepcion?.total,
      hab.sigilo?.total,
      r.values.percepcion_pasiva
    ]).toEqual([6, 6, 13, 6, 23])
  })
})

describe('las clases: lo que concede, lo elegido y lo que sale de su nivel', () => {
  const guerrero = (nivel: number, choices: Record<string, string[]> = {}): DocumentItem => ({
    id: 'guerrero',
    type: 'clase',
    name: 'Guerrero',
    data: { nivel, inicial: true, dado: 10, dado_golpe: '1d10' },
    choices,
    mechanics: {
      grants: [
        {
          choose: {
            key: 'habilidades',
            label: 'Habilidades',
            count: '2',
            set: 'habilidades',
            from: ['acrobacias', 'atletismo', 'percepcion'],
            when: '@este.inicial'
          }
        }
      ]
    }
  })
  const rasgo = (id: string, mechanics: Mechanics, from = 'guerrero'): DocumentItem => ({
    id,
    type: 'rasgo',
    name: id,
    data: {},
    from,
    mechanics
  })
  const tomarAliento = rasgo('tomar_aliento', {
    resources: [
      {
        key: 'usos',
        label: 'Usos',
        max: '@origen.nivel >= 10 ? 4 : @origen.nivel >= 4 ? 3 : 2',
        recovery: 'short',
        amount: '1'
      }
    ],
    actions: [{ key: 'usar', label: 'Tomar aliento', activation: 'bonus', heal: '1d10 + @origen.nivel', uses: 'usos' }]
  })
  const ataqueAdicional = rasgo('ataque_adicional', {
    effects: [{ target: 'ataques', op: 'min', value: '@origen.nivel >= 20 ? 4 : @origen.nivel >= 11 ? 3 : 2' }]
  })

  it('un rasgo sale del nivel de la clase que lo concede (@origen): sus usos, su curación y sus ataques', () => {
    const doc = pj({ fue: 16, con: 14 }, [guerrero(5), tomarAliento, ataqueAdicional])
    const r = evaluate(fiveE, 'personaje', doc)
    expect(r.values.ataques).toBe(2)
    expect(r.resources).toEqual([
      { item: 'tomar_aliento', key: 'usos', label: 'Usos', max: 3, used: 0, left: 3, recovery: 'short', amount: '1' }
    ])
    expect(prepareAction(fiveE, 'personaje', doc, 'tomar_aliento', 'usar')).toMatchObject({
      heal: { formula: '1d10+5' }
    })
    expect(evaluate(fiveE, 'personaje', pj({}, [guerrero(11), ataqueAdicional])).values.ataques).toBe(3)
    // Sin lo que lo concedió, cuenta como sin nivel
    const suelto = { ...ataqueAdicional, from: 'nada' }
    expect(evaluate(fiveE, 'personaje', pj({}, [suelto])).values.ataques).toBe(2)
  })

  it('lo elegido de un conjunto: las dos habilidades, competentes; de la lista, solo si es su primera clase', () => {
    const doc = pj({ fue: 16, sab: 12 }, [guerrero(5, { habilidades: ['atletismo', 'percepcion'] })])
    const hab = evaluate(fiveE, 'personaje', doc).values.habilidades as Record<string, { total: number }>
    expect([hab.atletismo?.total, hab.percepcion?.total, hab.acrobacias?.total]).toEqual([6, 4, 0])
    const segunda = guerrero(5, { habilidades: ['atletismo'] })
    segunda.data.inicial = false
    const otra = evaluate(fiveE, 'personaje', pj({ fue: 16 }, [segunda])).values.habilidades as Record<
      string,
      { total: number }
    >
    expect(otra.atletismo?.total).toBe(3)
  })

  it('la mejora de característica de 2014: +1 a dos (o +2 a una, eligiendo la misma dos veces)', () => {
    const mejora = rasgo('mejora_4', {
      grants: [
        {
          level: 4,
          choose: { key: 'mejora', label: 'Mejora', count: '2', set: 'caracteristicas', field: 'puntuacion', op: 'add' }
        }
      ]
    })
    const elegida = (picks: string[], nivel = 4) =>
      evaluate(
        fiveE,
        'personaje',
        pj({ fue: 15, con: 14 }, [guerrero(nivel), { ...mejora, choices: { mejora: picks } }])
      ).values.caracteristicas as Record<string, { puntuacion: number }>
    expect([elegida(['fue', 'con']).fue?.puntuacion, elegida(['fue', 'con']).con?.puntuacion]).toEqual([16, 15])
    expect(elegida(['fue', 'fue']).fue?.puntuacion).toBe(17)
    // Antes de su nivel, nada
    expect(elegida(['fue', 'fue'], 3).fue?.puntuacion).toBe(15)
  })

  it('el crítico mejorado del campeón: crítico con 19 en el ataque', () => {
    const critico = rasgo(
      'critico_mejorado',
      { effects: [{ target: 'critico_desde', op: 'max', value: '19' }] },
      'campeon'
    )
    const doc = pj({ fue: 16 }, [guerrero(3), critico, espada])
    expect(evaluate(fiveE, 'personaje', doc).values.critico_desde).toBe(19)
    expect(tryRoll(fiveE, 'personaje', doc, 'ataque', { element: 'espada_larga', roller: fixed(19) }).band?.tone).toBe(
      'critical'
    )
  })

  it('una elección de un conjunto que no existe, o con algo que no es suyo, se dice', () => {
    const bad = (choose: Record<string, unknown>) =>
      validateContent(fiveE, [
        {
          type: 'clase',
          key: 'x',
          source: null,
          data: { name: 'X' },
          mechanics: { grants: [{ choose: { key: 'c', label: 'C', count: '1', ...choose } }] }
        }
      ]).map((p) => `${p.path}: ${p.message}`)
    expect(bad({ set: 'nada' })).toEqual([
      'content[0].mechanics.grants[0].choose.set: Ningún personaje tiene el conjunto «nada»'
    ])
    expect(bad({ set: 'habilidades', field: 'nada', from: ['volar'] })).toEqual([
      'content[0].mechanics.grants[0].choose.field: «habilidades» no tiene el campo «nada»',
      'content[0].mechanics.grants[0].choose.from[0]: «habilidades» no tiene «volar»'
    ])
    expect(bad({ set: 'habilidades', type: 'rasgo' })[0]).toMatch(/Elige de un tipo o de un conjunto/)
  })
})
