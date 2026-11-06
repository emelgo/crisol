import { describe, expect, it } from 'vitest'
import { contentDiff, contentFingerprint, pullFields, withWorld } from './layers.ts'

interface Entry {
  type: string
  key: string
  source: string | null
  concept: string | null
  name: unknown
}

const goblin: Entry = { type: 'criatura', key: 'goblin', source: 'srd', concept: 'goblin', name: { es: 'Goblin' } }
const ogro: Entry = { type: 'criatura', key: 'ogro', source: 'srd', concept: 'ogro', name: { es: 'Ogro' } }

describe('withWorld: las dos capas del compendio de una campaña', () => {
  it('lo del mundo va sin fuente y marcado, junto a lo del sistema', () => {
    const jefe = { type: 'criatura', key: 'goblin-jefe', concept: null, name: { es: 'Goblin jefe' } }
    const all = withWorld([goblin, ogro], [jefe])
    expect(all.map((e) => e.key)).toEqual(['goblin', 'goblin-jefe', 'ogro'])
    expect(all.find((e) => e.key === 'goblin-jefe')).toMatchObject({ source: null, world: true })
    expect(all.find((e) => e.key === 'goblin')).not.toHaveProperty('world')
  })

  it('si una clave está en las dos, manda la del mundo', () => {
    const suyo = { type: 'criatura', key: 'goblin', concept: null, name: { es: 'Goblin del valle' } }
    const all = withWorld([goblin, ogro], [suyo])
    expect(all.filter((e) => e.key === 'goblin')).toEqual([{ ...suyo, source: null, world: true }])
  })

  it('sin nada del mundo, lo del sistema tal cual', () => {
    expect(withWorld([goblin, ogro], [])).toEqual([goblin, ogro])
  })
})

describe('contentFingerprint: la huella de una entrada', () => {
  const a = {
    type: 'criatura',
    data: { name: 'Goblin', pg: 7, ca: 15 },
    mechanics: { actions: [{ key: 'cimitarra' }] }
  }

  it('no depende del orden de las claves', () => {
    const b = {
      type: 'criatura',
      data: { ca: 15, pg: 7, name: 'Goblin' },
      mechanics: { actions: [{ key: 'cimitarra' }] }
    }
    expect(contentFingerprint(a)).toBe(contentFingerprint(b))
  })

  it('cambia con cualquier dato o con su mecánica', () => {
    expect(contentFingerprint({ ...a, data: { ...a.data, pg: 8 } })).not.toBe(contentFingerprint(a))
    expect(contentFingerprint({ ...a, mechanics: null })).not.toBe(contentFingerprint(a))
    expect(contentFingerprint({ ...a, type: 'pnj' })).not.toBe(contentFingerprint(a))
  })

  it('sin mecánica es lo mismo que con mecánica vacía de valor', () => {
    expect(contentFingerprint({ type: 't', data: {} })).toBe(
      contentFingerprint({ type: 't', data: {}, mechanics: null })
    )
  })
})

describe('contentDiff: lo que cambió entre dos versiones de una entrada', () => {
  const before = { data: { name: 'Goblin', pg: 7, ca: 15, texto: 'Pequeño' }, mechanics: { actions: [] } }

  it('cada campo de los datos que cambió, se añadió o se quitó, y la mecánica entera', () => {
    const after = {
      data: { name: 'Goblin', pg: 10, texto: 'Pequeño', velocidad: 30 },
      mechanics: { actions: [{ key: 'arco' }] }
    }
    expect(contentDiff(before, after)).toEqual([
      { key: 'ca', before: 15, after: undefined },
      { key: 'pg', before: 7, after: 10 },
      { key: 'velocidad', before: undefined, after: 30 },
      { key: 'mechanics', before: { actions: [] }, after: { actions: [{ key: 'arco' }] } }
    ])
  })

  it('lo igual no sale, aunque sus claves vayan en otro orden', () => {
    const after = { data: { texto: 'Pequeño', ca: 15, pg: 7, name: 'Goblin' }, mechanics: { actions: [] } }
    expect(contentDiff(before, after)).toEqual([])
  })
})

describe('pullFields: traer a la copia lo elegido del original', () => {
  const copy = { data: { name: 'Goblin jefe', pg: 12, ca: 15 }, mechanics: { actions: [] } }
  const original = { data: { name: 'Goblin', pg: 7, ca: 16, velocidad: 30 }, mechanics: { actions: [{ key: 'arco' }] } }

  it('solo los campos elegidos, y la mecánica si se elige', () => {
    expect(pullFields(copy, original, ['ca', 'velocidad'])).toEqual({
      data: { name: 'Goblin jefe', pg: 12, ca: 16, velocidad: 30 },
      mechanics: { actions: [] }
    })
    expect(pullFields(copy, original, ['mechanics']).mechanics).toEqual({ actions: [{ key: 'arco' }] })
  })

  it('un campo que el original ya no tiene se quita de la copia', () => {
    expect(pullFields(copy, { data: { name: 'Goblin' }, mechanics: null }, ['pg']).data).toEqual({
      name: 'Goblin jefe',
      ca: 15
    })
  })
})
