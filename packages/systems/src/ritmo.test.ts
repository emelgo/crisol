/**
 * El ritmo que pide la spec: calcular un personaje de nivel 20 de un 5e grande (unos 300 campos y 100 objetos) en menos
 * de 20 ms, y validar un sistema de 2 MB en menos de 500 ms. Se mide la mediana, en el mismo proceso que las demás. En
 * test:coverage va aparte y sin la cobertura: el código instrumentado tarda varias veces más y no es el que se usa
 */
import { describe, expect, it } from 'vitest'
import { type DocumentItem, evaluate } from './evaluate.ts'
import { cinco } from './fixtures/cinco.ts'
import { FORMAT, type System } from './format.ts'
import { jsonLines } from './lines.ts'
import { tryRoll } from './rolls.ts'
import { tryFormula } from './try.ts'
import { fitsFormat, MAX_PROBLEMS, validateSystem } from './validate.ts'

const median = (run: () => void, times: number) => {
  const samples: number[] = []
  for (let i = 0; i < times; i++) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)] as number
}

/** El 5e de prueba con 18 habilidades, 250 números, 30 valores encadenados y bonos de los objetos */
function big(): System {
  const system: System = structuredClone(cinco)
  const fields = system.types.personaje?.fields as Record<string, unknown>
  fields.habilidades = {
    kind: 'set',
    label: 'Habilidades',
    elements: Array.from({ length: 18 }, (_, i) => ({ key: `h${i}`, label: `Habilidad ${i}` })),
    fields: {
      car: { kind: 'text', label: 'Característica' },
      grado: { kind: 'number', label: 'Grado', min: 0, max: 2, default: 0 },
      total: {
        kind: 'derived',
        label: 'Total',
        formula: '@caracteristicas[@este.car].mod + @este.grado * @competencia'
      }
    }
  }
  for (let i = 0; i < 250; i++) fields[`n${i}`] = { kind: 'number', label: `Número ${i}`, default: i % 7 }
  fields.c0 = { kind: 'derived', label: 'C0', formula: '@n0 + @caracteristicas.des.mod' }
  for (let i = 1; i < 30; i++)
    fields[`c${i}`] = { kind: 'derived', label: `C${i}`, formula: `@c${i - 1} + @n${i} * 2 - floor(@n${i + 1} / 2)` }
  return system
}

describe('el ritmo', () => {
  it('un personaje de nivel 20 con 100 objetos, en menos de 20 ms', () => {
    const system = big()
    const cars = ['fue', 'des', 'con', 'int', 'sab', 'car']
    const items: DocumentItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `o${i}`,
      type: 'objeto',
      name: `Objeto ${i}`,
      data: { equipado: i % 3 === 0, bono_ca: i % 2, peso: i % 5 }
    }))
    const doc = {
      data: {
        nivel: 20,
        caracteristicas: Object.fromEntries(cars.map((c, i) => [c, { puntuacion: 10 + i * 2 }])),
        habilidades: Object.fromEntries(
          Array.from({ length: 18 }, (_, i) => [`h${i}`, { car: cars[i % 6], grado: i % 3 }])
        )
      },
      items
    }
    const fieldCount = Object.keys(system.types.personaje?.fields ?? {}).length + 6 * 2 + 18 * 3
    expect(fieldCount).toBeGreaterThanOrEqual(300)
    const once = evaluate(system, 'personaje', doc)
    expect(once.computed.c29?.error).toBeUndefined()
    expect(once.computed.ca?.terms.filter((t) => t.kind === 'bonus')).toHaveLength(17)
    const ms = median(() => evaluate(system, 'personaje', doc), 30)
    console.info(`Nivel 20 (${fieldCount} campos, 100 objetos): ${ms.toFixed(2)} ms de mediana`)
    expect(ms).toBeLessThan(20)
  })

  it('validar un sistema de 2 MB, en menos de 500 ms', () => {
    const system: System & Record<string, unknown> = {
      format: FORMAT,
      id: 'grande',
      name: 'Grande',
      version: '1',
      languages: ['es'],
      types: {},
      rolls: {}
    }
    const help = 'Una ayuda larga para que el sistema pese lo que pesa uno de verdad. '.repeat(6)
    for (let t = 0; t < 34; t++) {
      const fields: Record<string, unknown> = {}
      for (let f = 0; f < 120; f++)
        fields[`f${f}`] =
          f % 4 === 0
            ? { kind: 'derived', label: `F${f}`, help, formula: `@f${f + 1} + 1` }
            : { kind: 'number', label: `F${f}`, help, min: 0, max: 99 }
      system.types[`t${t}`] = { document: t === 0 ? 'actor' : 'item', label: `Tipo ${t}`, fields: fields as never }
    }
    const bytes = new TextEncoder().encode(JSON.stringify(system)).length
    expect(bytes).toBeGreaterThan(1.8 * 1024 * 1024)
    expect(bytes).toBeLessThan(2 * 1024 * 1024)
    expect(validateSystem(system).problems).toEqual([])
    const ms = median(() => validateSystem(system), 5)
    console.info(`Validar ${(bytes / 1024 / 1024).toFixed(2)} MB: ${ms.toFixed(0)} ms de mediana`)
    expect(ms).toBeLessThan(500)

    // Lo que hace Avanzado con cada tecla: leer el JSON, ver su forma, validarlo y saber la línea de cada ruta
    const text = JSON.stringify(system, null, 2)
    const typing = median(() => {
      const parsed = JSON.parse(text) as unknown
      if (fitsFormat(parsed)) validateSystem(parsed)
      jsonLines(text)
    }, 5)
    console.info(
      `Escribir en Avanzado (${(text.length / 1024 / 1024).toFixed(2)} MB de texto): ${typing.toFixed(0)} ms de mediana`
    )
    expect(typing).toBeLessThan(500)
  })

  // Los ataques de las revisiones de código y de seguridad: un documento pequeño no puede bloquear el servidor
  describe('lo que no puede tardar', () => {
    const base = { format: FORMAT, version: '1', languages: ['es' as const] }
    const ms = (run: () => unknown) => {
      const began = performance.now()
      run()
      return performance.now() - began
    }

    it('tipos de objeto que se llevan unos a otros', () => {
      const types: Record<string, unknown> = { personaje: { document: 'actor', label: 'P', fields: {} } }
      const all = Array.from({ length: 14 }, (_, i) => `o${i}`)
      for (const key of all)
        types[key] = { document: 'item', label: key, fields: { dentro: { kind: 'items', label: 'D', of: all } } }
      expect(ms(() => validateSystem({ ...base, id: 'a', name: 'A', types }))).toBeLessThan(500)
    })

    it('muchas referencias que no existen, con nombres largos', () => {
      const fields: Record<string, unknown> = {}
      for (let f = 0; f < 500; f++) fields[`campo_${'x'.repeat(48)}_${f}`] = { kind: 'number', label: `C${f}` }
      for (let f = 0; f < 300; f++)
        fields[`d${f}`] = {
          kind: 'derived',
          label: `D${f}`,
          formula: Array.from({ length: 30 }, (_, i) => `@z${'q'.repeat(55)}${i}`).join(' + ')
        }
      const system = { ...base, id: 'b', name: 'B', types: { personaje: { document: 'actor', label: 'P', fields } } }
      let found = 0
      expect(ms(() => (found = validateSystem(system).problems.length))).toBeLessThan(1000)
      expect(found).toBeLessThanOrEqual(MAX_PROBLEMS + 1)
      // Un nombre de más de 60 no se lee, ni se compara
      expect(
        validateSystem({
          ...system,
          types: {
            personaje: {
              document: 'actor',
              label: 'P',
              fields: { d: { kind: 'derived', label: 'D', formula: `@${'z'.repeat(1990)}` } }
            }
          }
        }).problems[0]?.message
      ).toBe('Un nombre tiene como mucho 60 caracteres')
    })

    it('calcular con 200 objetos que se cuentan muchas veces: se para por el presupuesto', () => {
      const big: Record<string, unknown> = {}
      for (let f = 0; f < 500; f++) big[`f${f}`] = { kind: 'number', label: `F${f}` }
      const counts = Array.from({ length: 142 }, () => 'count(@lleva)').join(' + ')
      const fields: Record<string, unknown> = { lleva: { kind: 'items', label: 'Lleva', of: ['cosa'] } }
      for (let d = 0; d < 5; d++) fields[`d${d}`] = { kind: 'derived', label: `D${d}`, formula: counts }
      const system = {
        ...base,
        id: 'c',
        name: 'C',
        types: {
          personaje: { document: 'actor', label: 'P', fields },
          cosa: { document: 'item', label: 'Cosa', fields: big }
        }
      } as unknown as System
      const items = Array.from({ length: 200 }, (_, i) => ({ id: `i${i}`, type: 'cosa', name: `Cosa ${i}`, data: {} }))
      expect(ms(() => tryFormula(system, 'personaje', '@d0 + @d1', { data: {}, items }))).toBeLessThan(2000)
    })

    it('unos dados guardados con un millón de cifras', () => {
      const system = {
        ...base,
        id: 'd',
        name: 'D',
        types: { personaje: { document: 'actor', label: 'P', fields: { golpe: { kind: 'dice', label: 'Golpe' } } } },
        rolls: { dano: { label: 'Daño', formula: '@golpe + 1' } }
      } as unknown as System
      expect(
        ms(() => {
          try {
            tryRoll(system, 'personaje', { data: { golpe: '1'.repeat(1_000_000) } }, 'dano')
          } catch {
            // No son dados: que lo diga, pero enseguida
          }
        })
      ).toBeLessThan(200)
    })

    it('nombres que JavaScript hereda (constructor, toString…) no existen', () => {
      const types = {
        personaje: {
          document: 'actor',
          label: 'P',
          fields: { d: { kind: 'derived', label: 'D', formula: 'constructor(1) + @toString' } }
        }
      }
      const problems = validateSystem({ ...base, id: 'e', name: 'E', types }).problems.map((p) => p.message)
      expect(problems.some((m) => m.startsWith('No existe la función «constructor»'))).toBe(true)
    })
  })
})
