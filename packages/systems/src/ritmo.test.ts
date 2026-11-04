/**
 * El ritmo que pide la spec: calcular un personaje de nivel 20 de un 5e grande (unos 300 campos y 100 objetos) en menos
 * de 20 ms, y validar un sistema de 2 MB en menos de 500 ms. Se mide la mediana, en el mismo proceso que las demás
 */
import { describe, expect, it } from 'vitest'
import { type DocumentItem, evaluate } from './evaluate.ts'
import { cinco } from './fixtures/cinco.ts'
import { FORMAT, type System } from './format.ts'
import { validateSystem } from './validate.ts'

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
  })
})
