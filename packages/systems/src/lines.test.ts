import { describe, expect, it } from 'vitest'
import { fronteras } from './fixtures/index.ts'
import { jsonLines, lineOf } from './lines.ts'
import { validateSystem } from './validate.ts'

describe('la línea de cada ruta en el JSON', () => {
  const text = JSON.stringify({ a: 1, b: { c: [10, { d: 'x' }] }, 'e.f': true }, null, 2)
  const lines = jsonLines(text)

  it('las claves y los elementos de las listas, cada uno en su línea', () => {
    expect(lines.get('a')).toBe(2)
    expect(lines.get('b')).toBe(3)
    expect(lines.get('b.c')).toBe(4)
    expect(lines.get('b.c[0]')).toBe(5)
    expect(lines.get('b.c[1]')).toBe(6)
    expect(lines.get('b.c[1].d')).toBe(7)
  })

  it('lo que falta está en la línea de lo que lo contiene; si no hay nada, en la primera', () => {
    expect(lineOf(lines, 'b.c[1].falta')).toBe(6)
    expect(lineOf(lines, 'b.c[7]')).toBe(4)
    expect(lineOf(lines, 'nada.de.nada')).toBe(1)
    expect(lineOf(lines, '')).toBe(1)
  })

  it('con el texto en una línea, o con escapes en las claves', () => {
    const flat = jsonLines('{"x": {"y\\"z": [1, 2]}}')
    expect(flat.get('x.y"z[1]')).toBe(1)
  })

  it('cada problema de un sistema lleva a su línea', () => {
    const broken = structuredClone(fronteras) as unknown as {
      types: { personaje: { fields: { defensa: { formula: string } } } }
    }
    broken.types.personaje.fields.defensa.formula = '7 + @vigr'
    const json = JSON.stringify(broken, null, 2)
    const problem = validateSystem(broken).problems.find((p) => p.path.endsWith('defensa.formula'))
    expect(problem).toBeDefined()
    const line = lineOf(jsonLines(json), problem?.path ?? '')
    expect(json.split('\n')[line - 1]).toContain('"formula": "7 + @vigr"')
  })
})
