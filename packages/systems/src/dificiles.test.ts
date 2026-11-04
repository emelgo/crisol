/**
 * Punto de control 1 de srd-5e: los casos difíciles, escritos a mano, dan lo que dicen las reglas (SRD 5.1)
 */
import type { DieRoller } from '@crisol/dice'
import { describe, expect, it } from 'vitest'
import { actionsOf, prepareAction, tryAction } from './actions.ts'
import { type DocumentItem, evaluate } from './evaluate.ts'
import { validateContent } from './file.ts'
import { dificiles, dificilesContent, dragonRojoAdulto } from './fixtures/dificiles.ts'
import { tryRoll } from './rolls.ts'
import { validateSystem } from './validate.ts'

const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}

/** Un documento del contenido, como lo lleva un personaje: con lo que se elige (equipado, sintonizado, activo) */
const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
  const found = dificilesContent.find((c) => c.key === key)
  if (!found) throw new Error(key)
  const { name, ...rest } = found.data as { name: string }
  return {
    id: key,
    type: found.type,
    name,
    data: { ...rest, ...data },
    ...(found.mechanics ? { mechanics: found.mechanics } : {})
  }
}
const puesto = { equipado: true }

const pj = (
  scores: Partial<Record<'fue' | 'des' | 'con' | 'int' | 'sab' | 'car', number>>,
  items: DocumentItem[],
  nivel = 1
) => ({
  data: {
    nivel,
    caracteristicas: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { puntuacion: v }]))
  },
  items
})
const ca = (doc: ReturnType<typeof pj>) => evaluate(dificiles, 'personaje', doc).computed.ca

describe('los casos difíciles', () => {
  it('el sistema y su contenido validan', () => {
    expect(validateSystem(dificiles).problems.filter((p) => p.severity === 'error')).toEqual([])
    expect(validateContent(dificiles, dificilesContent)).toEqual([])
  })

  it('Defensa sin armadura del monje: sin armadura ni escudo; con cualquiera de los dos, no', () => {
    const monje = (items: DocumentItem[]) => pj({ des: 16, sab: 16 }, [carry('defensa_sin_armadura_monje'), ...items])
    expect(ca(monje([]))).toMatchObject({ value: 16 })
    expect(ca(monje([]))?.terms.map((t) => [t.label, t.value])).toEqual([
      ['Defensa sin armadura', 10],
      ['Destreza', 3],
      ['Sabiduría', 3]
    ])
    expect(ca(monje([carry('escudo', puesto)]))?.value).toBe(15)
    expect(ca(monje([carry('cota_de_malla', puesto), carry('escudo', puesto)]))?.value).toBe(18)
    // Llevarlos sin ponérselos no cuenta
    expect(ca(monje([carry('cota_de_malla'), carry('escudo')]))?.value).toBe(16)
  })

  it('la del bárbaro deja el escudo; una armadura media, con su tope de Destreza', () => {
    const barbaro = (items: DocumentItem[]) =>
      pj({ des: 14, con: 16 }, [carry('defensa_sin_armadura_barbaro'), ...items])
    expect(ca(barbaro([]))?.value).toBe(15)
    expect(ca(barbaro([carry('escudo', puesto)]))?.value).toBe(17)
    expect(ca(pj({ des: 18 }, [carry('cota_de_escamas', puesto)]))?.value).toBe(16)
  })

  it('el Anillo de protección, sintonizado: +1 a la CA y a las salvaciones; sin sintonizar, nada', () => {
    const anillo = (sintonizado: boolean) =>
      pj({ des: 14 }, [carry('anillo_de_proteccion', { equipado: true, sintonizado })])
    expect(ca(anillo(true))?.value).toBe(13)
    expect(ca(anillo(false))?.value).toBe(12)
    const salvacion = (sintonizado: boolean) =>
      tryRoll(dificiles, 'personaje', anillo(sintonizado), 'salvacion', { element: 'des', roller: fixed(10) }).total
    expect(salvacion(true)).toBe(13)
    expect(salvacion(false)).toBe(12)
  })

  it('la Furia activa: resistencias, ventaja en Fuerza (sola, en la tirada) y su daño; sus usos por nivel', () => {
    const barbaro = (activo: boolean, nivel = 5) =>
      pj({ fue: 16 }, [carry('furia', { activo }), carry('espada_larga')], nivel)
    const r = evaluate(dificiles, 'personaje', barbaro(true))
    expect(r.values.resistencias).toEqual(['contundente', 'perforante', 'cortante'])
    expect(r.resources).toEqual([
      { item: 'furia', key: 'usos', label: 'Furias', max: 3, used: 0, left: 3, recovery: 'long' }
    ])
    const prueba = tryRoll(dificiles, 'personaje', barbaro(true), 'prueba', { element: 'fue', roller: fixed(3, 15) })
    expect(prueba).toMatchObject({
      total: 18,
      mode: 'ventaja',
      because: [{ mode: 'advantage', label: 'Furia', origin: 'furia' }]
    })
    expect(
      tryRoll(dificiles, 'personaje', barbaro(true), 'prueba', { element: 'des', roller: fixed(3, 15) }).mode
    ).toBeNull()
    expect(
      tryRoll(dificiles, 'personaje', barbaro(true), 'prueba', { element: 'fue', mode: '', roller: fixed(3) }).total
    ).toBe(6)
    expect(
      tryRoll(dificiles, 'personaje', barbaro(true), 'dano', { element: 'espada_larga', roller: fixed(5) })
    ).toMatchObject({
      formula: '1d8+3[Fuerza]+2[Bono al daño con Fuerza]',
      total: 10
    })
    expect(
      tryRoll(dificiles, 'personaje', barbaro(true, 9), 'dano', { element: 'espada_larga', roller: fixed(5) }).total
    ).toBe(11)
    // Sin activar, nada
    expect(evaluate(dificiles, 'personaje', barbaro(false)).values.resistencias).toEqual([])
    expect(
      tryRoll(dificiles, 'personaje', barbaro(false), 'prueba', { element: 'fue', roller: fixed(3, 15) }).total
    ).toBe(6)
    expect(evaluate(dificiles, 'personaje', barbaro(false, 20)).resources[0]?.max).toBe(99)
  })

  it('Escudo, como reacción: mientras dura, +5 a la CA', () => {
    const mago = (activo: boolean) => pj({ des: 14 }, [carry('escudo_conjuro', { activo })])
    expect(actionsOf(dificiles, 'personaje', mago(false))).toMatchObject([
      { item: 'escudo_conjuro', key: 'lanzar', label: 'Escudo', activation: 'reaction' }
    ])
    expect(ca(mago(false))?.value).toBe(12)
    expect(ca(mago(true))?.value).toBe(17)
  })

  it('Bola de fuego a nivel 3 y a nivel 5, con la CD de quien la lanza', () => {
    const mago = pj({ int: 16 }, [carry('bola_de_fuego')], 5)
    const at = (level: number) => prepareAction(dificiles, 'personaje', mago, 'bola_de_fuego', 'lanzar', { level })
    expect(at(3)).toMatchObject({
      save: { ability: 'des', abilityLabel: 'Destreza', dc: 14, success: 'half' },
      range: '150 pies'
    })
    expect(at(3).damage).toMatchObject([{ formula: '8d6', average: 28, type: 'fuego' }])
    expect(at(5).damage).toMatchObject([{ formula: '10d6', average: 35, type: 'fuego' }])
  })

  it('el dragón rojo adulto: sus acciones dan los valores del SRD, y se tiran', () => {
    const list = actionsOf(dificiles, 'criatura', dragonRojoAdulto)
    const summary = list.map((a) => ({
      key: a.key,
      ...(a.bonus !== null ? { bonus: a.bonus } : {}),
      ...(a.save ? { dc: a.save.dc } : {}),
      damage: a.damage.map((d) => `${d.average} (${d.formula}) ${d.type}`)
    }))
    expect(summary).toEqual([
      { key: 'mordisco', bonus: 14, damage: ['19 (2d10+8) perforante', '7 (2d6) fuego'] },
      { key: 'garra', bonus: 14, damage: ['15 (2d6+8) cortante'] },
      { key: 'cola', bonus: 14, damage: ['17 (2d8+8) contundente'] },
      { key: 'presencia', dc: 19, damage: [] },
      { key: 'aliento', dc: 21, damage: ['63 (18d6) fuego'] },
      { key: 'alas', dc: 22, damage: ['15 (2d6+8) contundente'] }
    ])
    expect(list.find((a) => a.key === 'alas')).toMatchObject({ activation: 'legendary', cost: 2, uses: 'legendarias' })
    expect(list.find((a) => a.key === 'aliento')?.recharge).toBe('5-6')
    expect(
      evaluate(dificiles, 'criatura', dragonRojoAdulto).resources.map((r) => [r.label, r.max, r.recovery])
    ).toEqual([
      ['Acciones legendarias', 3, 'other'],
      ['Resistencia legendaria', 3, 'dawn']
    ])
    const bite = tryAction(dificiles, 'criatura', dragonRojoAdulto, null, 'mordisco', { roller: fixed(12, 3, 4, 2, 5) })
    expect(bite.attack?.total).toBe(26)
    expect(bite.damage.map((d) => d.result.total)).toEqual([15, 7])
  })
})
