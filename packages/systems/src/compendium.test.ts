import { describe, expect, it } from 'vitest'
import { catalogContent } from './catalog/content.ts'
import { CATALOG } from './catalog/index.ts'
import { browseContent, compendiumEntry, compendiumSections, compendiumTypes } from './compendium.ts'
import { visibleContent } from './content.ts'
import { validateSystem } from './validate.ts'

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

describe('el compendio ordenado como una biblioteca: secciones, tipos y carpetas', () => {
  const newest = { sources: ['srd51', 'srd521'], duplicates: 'newest' as const }

  it('las secciones del 5e, en su orden, con los tipos que tienen contenido', () => {
    const sections = compendiumSections(fiveE, compendiumTypes(fiveE, content, newest))
    expect(sections.map((s) => s.key)).toEqual([
      'reglas',
      'clases',
      'origenes',
      'rasgos',
      'dotes',
      'conjuros',
      'equipo',
      'objetos_magicos',
      'criaturas'
    ])
    expect(sections.find((s) => s.key === 'equipo')?.types.map((t) => t.key)).toEqual(['arma', 'armadura', 'equipo'])
    expect(sections.find((s) => s.key === 'equipo')?.types[0]?.label).toEqual({ es: 'Armas', en: 'Weapons' })
  })

  it('sin compendio en el sistema, una sección por tipo; los tipos que no nombra, al final', () => {
    const bare = { ...structuredClone(fiveE), compendium: undefined }
    const types = compendiumTypes(bare, content, newest)
    expect(compendiumSections(bare, types).map((s) => s.key)).toEqual(types.map((t) => t.key))
    const partial = {
      ...structuredClone(fiveE),
      compendium: { sections: [{ key: 'magia', label: 'Magia', types: ['conjuro'] }] }
    }
    const sections = compendiumSections(partial, compendiumTypes(partial, content, newest))
    expect(sections[0]).toMatchObject({ key: 'magia', types: [{ key: 'conjuro' }] })
    expect(sections.map((s) => s.key)).toContain('criatura')
  })

  it('los conjuros, por nivel: «Trucos» y «Nivel N», en orden; dentro, por su nombre', () => {
    const { items, folders } = browseContent(fiveE, content, { type: 'conjuro', ...newest, language: 'es' })
    expect(folders.map((f) => f.label)).toEqual(['Trucos', ...Array.from({ length: 9 }, (_, i) => `Nivel ${i + 1}`)])
    const fireball = items.find((i) => i.name === 'Bola de fuego' && !i.legacy)
    expect(fireball).toMatchObject({ folder: '3', edition: '2024' })
    const third = items.filter((i) => i.folder === '3').map((i) => i.name)
    expect(third).toEqual([...third].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it('las criaturas, por su tipo sin lo de dentro del paréntesis; el equipo, por su categoría con su nombre', () => {
    const creatures = browseContent(fiveE, content, { type: 'criatura', ...newest, language: 'es' })
    const labels = creatures.folders.map((f) => f.label)
    expect(labels).toContain('Dragón')
    expect(labels).not.toContain('Dragón (cromático)')
    // «Humanoide o bestia» (o cortado: «Humanoide o») va con «Humanoide»
    expect(labels.filter((l) => l.startsWith('Humanoide'))).toEqual(['Humanoide'])
    const subclasses = browseContent(fiveE, content, { type: 'subclase', ...newest, language: 'es' })
    expect(subclasses.folders.map((f) => f.label)).toContain('Bárbaro')
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'es')))
    expect(creatures.items.find((i) => i.name === 'Dragón rojo adulto')?.folder).toBe(
      creatures.folders.find((f) => f.label === 'Dragón')?.key
    )
    const gear = browseContent(fiveE, content, { type: 'arma', ...newest, language: 'es' })
    expect(gear.folders.map((f) => f.label)).toEqual(['Sencillas', 'Marciales'])
    const english = browseContent(fiveE, content, { type: 'conjuro', ...newest, language: 'en' })
    expect(english.folders[0]?.label).toBe('Cantrips')
  })

  it('un tipo sin carpetas: todo suelto', () => {
    const { folders, items } = browseContent(fiveE, content, { type: 'estado', ...newest, language: 'es' })
    expect(folders).toEqual([])
    expect(items.every((i) => i.folder === null)).toBe(true)
  })

  it('lo que nombra el compendio de un sistema existe', () => {
    const broken = structuredClone(fiveE)
    broken.compendium = {
      sections: [
        { key: 'a', label: 'A', types: ['conjuro', 'nada'] },
        { key: 'b', label: 'B', types: ['conjuro'] }
      ],
      types: { nada: {}, conjuro: { folder: { field: 'nivelx' } } }
    }
    const messages = validateSystem(broken).problems.map((p) => `${p.path}: ${p.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        'compendium.sections[0].types[1]: No existe el tipo «nada»',
        'compendium.sections[1].types[0]: «conjuro» ya está en otra sección',
        'compendium.types.nada: No existe el tipo «nada»',
        'compendium.types.conjuro.folder.field: «conjuro» no tiene el campo «nivelx»'
      ])
    )
    expect(validateSystem(fiveE).problems.filter((p) => p.severity === 'error')).toEqual([])
  })
})
