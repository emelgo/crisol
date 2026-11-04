import { describe, expect, it } from 'vitest'
import { systemDocs } from './docs.ts'
import { cinco, fronteras } from './fixtures/index.ts'
import { FUNCTIONS } from './formulas/functions.ts'

describe('la documentación del formato, para la IA', () => {
  const docs = systemDocs()

  it('sale del esquema: cada parte, con su descripción', () => {
    expect(docs).toContain('- `types` (por clave: objeto): Los tipos de documento')
    expect(docs).toContain('  - `fields` (por clave: un campo (ver «Los campos»)): Sus campos, por su clave')
    expect(docs).toContain('- `rolls` (por clave: objeto, opcional): Las tiradas del juego')
    expect(docs).toContain('`tone` ("critical" | "success" | "partial" | "failure" | "fumble" | "neutral")')
    expect(docs).toContain('`critical` ("none" | "d20" | "doubles" | "under")')
  })

  it('cada clase de campo, con lo suyo', () => {
    for (const kind of ['text', 'number', 'derived', 'set', 'items', 'table', 'group', 'resource'])
      expect(docs).toContain(`- \`"${kind}"\`: `)
    expect(docs).toContain('- `"derived"`: Un valor calculado con una fórmula, sin dados')
    expect(docs).toContain('  - `formula` (fórmula)')
  })

  it('el lenguaje de las fórmulas, con todas sus funciones y los nombres que pone Crisol', () => {
    for (const name of Object.keys(FUNCTIONS)) expect(docs).toContain(`${name}(`)
    expect(docs).toContain('@este, @total, @natural, @objetivo')
  })

  it('con sus dos ejemplos, enteros, y sin pasarse de tamaño', () => {
    const examples = [...docs.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1] as string))
    expect(examples).toEqual([fronteras, cinco])
    expect(docs.length).toBeLessThan(60_000)
  })
})
