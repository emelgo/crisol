import { describe, expect, it } from 'vitest'
import { catalogContent } from './catalog/content.ts'
import { CATALOG } from './catalog/index.ts'
import { compendiumEntry, compendiumTypes } from './compendium.ts'
import { visibleContent } from './content.ts'

const fiveE = CATALOG.find((s) => s.id === '5e')
if (!fiveE) throw new Error('Falta el 5e')
const content = catalogContent('5e')
const both = { sources: ['srd51', 'srd521'], duplicates: 'both' as const }

describe('los tipos del compendio de una campaña', () => {
  it('los que tienen contenido en sus fuentes, en el orden del sistema y con cuántos hay', () => {
    const types = compendiumTypes(fiveE, content, both)
    expect(types.map((t) => t.key)).not.toContain('personaje')
    expect(types.map((t) => t.key).slice(0, 3)).toEqual(['criatura', 'clase', 'subclase'])
    const spells = types.find((t) => t.key === 'conjuro')
    expect(spells?.count).toBe(319 + 339)
    expect(spells?.label).toEqual({ es: 'Conjuro', en: 'Spell' })
    const only2014 = compendiumTypes(fiveE, content, { sources: ['srd51'], duplicates: 'both' })
    expect(only2014.find((t) => t.key === 'conjuro')?.count).toBe(319)
    const newest = compendiumTypes(fiveE, content, { sources: ['srd51', 'srd521'], duplicates: 'newest' })
    expect(newest.find((t) => t.key === 'conjuro')?.count).toBeLessThan(319 + 339)
    expect(compendiumTypes(fiveE, content, { sources: [], duplicates: 'both' })).toEqual([])
  })

  it('los campos que se leen: los sencillos, sin lo de la partida ni los calculados; su texto largo, aparte', () => {
    const spell = compendiumTypes(fiveE, content, both).find((t) => t.key === 'conjuro')
    const keys = spell?.fields.map((f) => f.key) ?? []
    expect(keys).toEqual(expect.arrayContaining(['nivel', 'escuela', 'tiempo', 'alcance', 'componentes', 'duracion']))
    expect(keys).not.toEqual(expect.arrayContaining(['cd']))
    expect(keys).not.toContain('descripcion')
    expect(spell?.text).toBe('descripcion')
    expect(spell?.fields.find((f) => f.key === 'escuela')?.options?.[0]).toEqual({
      value: 'abjuracion',
      label: { es: 'Abjuración', en: 'Abjuration' }
    })
    // Una criatura lleva su bloque de estadísticas en su texto: sus campos no se repiten
    const creature = compendiumTypes(fiveE, content, both).find((t) => t.key === 'criatura')
    expect(creature).toMatchObject({ document: 'actor', fields: [], text: 'descripcion' })
  })
})

describe('un documento del compendio', () => {
  const seen = visibleContent(fiveE, content, both)
  const entry = (key: string) => {
    const item = content.find((c) => c.key === key)
    if (!item) throw new Error(`Falta ${key}`)
    return compendiumEntry(fiveE, seen, item)
  }

  it('su edición, si es legado y sus otras versiones', () => {
    expect(entry('bola_de_fuego_2024')).toMatchObject({
      edition: '2024',
      legacy: false,
      versions: [{ key: 'bola_de_fuego_2014', edition: '2014', legacy: true }]
    })
    expect(entry('bola_de_fuego_2014')).toMatchObject({ legacy: true, versions: [{ key: 'bola_de_fuego_2024' }] })
  })

  it('lo que concede por nivel, de su edición, y lo que se elige', () => {
    const barbarian = entry('barbaro_2014')
    expect(barbarian.granted.slice(0, 2)).toEqual([
      { level: null, choose: { es: 'Habilidades', en: 'Skills' }, count: '2' },
      { level: 1, key: 'barbaro_furia_2014', type: 'rasgo', name: { es: 'Furia', en: 'Rage' } }
    ])
    expect(barbarian.granted).toContainEqual({ level: 3, choose: { es: 'Subclase', en: 'Subclass' }, count: '1' })
    // Ordenado por nivel, lo de sin nivel primero
    const levels = barbarian.granted.map((g) => g.level ?? 0)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(entry('bola_de_fuego_2024').granted).toEqual([])
  })
})
