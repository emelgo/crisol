import { describe, expect, it } from 'vitest'
import { summarizeBooks } from './books.ts'
import { defaultChoices, normalizeChoices } from './choices.ts'
import { visibleContent } from './content.ts'
import { cinco } from './fixtures/cinco.ts'
import { validateSystem } from './validate.ts'

const entry = (type: string, key: string, source: string | null, name: string, review?: unknown) => ({
  type,
  key,
  source,
  name: { es: name },
  ...(review ? { review } : {})
})

const content = [
  entry('objeto', 'guerrero', 'srd52', 'Guerrero'),
  entry('objeto', 'mago', 'srd52', 'Mago'),
  entry('personaje', 'escudo', 'srd52', 'Escudo'),
  entry('personaje', 'lanza', 'srd52', 'Lanza de ceniza', { page: 88, notes: [] }),
  entry('objeto', 'monje', 'srd51', 'Monje'),
  entry('objeto', 'propia', null, 'Propia')
]

describe('los libros de un sistema', () => {
  it('un libro valida con su descripción, su portada, su origen, su PDF, a qué amplía y su versión', () => {
    const system = structuredClone(cinco)
    const [viejo, nuevo] = system.sources ?? []
    if (!viejo || !nuevo) throw new Error('sin libros')
    Object.assign(nuevo, {
      description: 'Las reglas de 2024.',
      cover: { fileId: crypto.randomUUID(), x: 50, y: 40 },
      origin: 'pdf',
      file: crypto.randomUUID(),
      requires: [viejo.key],
      version: 2
    })
    expect(validateSystem(system).problems).toEqual([])
  })

  it('amplía solo a libros que existen y que no son él mismo', () => {
    const system = structuredClone(cinco)
    const [viejo] = system.sources ?? []
    if (!viejo) throw new Error('sin libros')
    viejo.requires = ['no_existe', viejo.key]
    expect(validateSystem(system).problems.map((p) => p.message)).toEqual([
      'No existe el libro «no_existe»',
      'Un libro no se amplía a sí mismo'
    ])
  })

  it('cuenta por libro y por tipo lo aceptado, con unos ejemplos; lo pendiente y lo excluido, aparte', () => {
    const [srd51, srd52] = summarizeBooks(cinco, content, { excluded: ['mago'] })
    expect(srd52).toMatchObject({ key: 'srd52', count: 3, excluded: 1, pending: 1 })
    expect(srd52?.byType.map((t) => [t.type, t.count, t.examples])).toEqual([
      ['personaje', 1, ['Escudo']],
      ['objeto', 2, ['Guerrero', 'Mago']]
    ])
    expect(srd51).toMatchObject({ key: 'srd51', count: 1, excluded: 0, pending: 0 })
  })
})

describe('lo que la campaña deja fuera y lo pendiente de revisar', () => {
  it('lo excluido de un libro no se ve; lo del mundo (sin libro) sale siempre; lo pendiente nunca', () => {
    const keys = visibleContent(cinco, content, {
      sources: ['srd51', 'srd52'],
      duplicates: 'both',
      excluded: ['mago', 'propia']
    }).map((s) => s.item.key)
    expect(keys).toEqual(['guerrero', 'escudo', 'monje', 'propia'])
  })

  it('lo excluido se guarda sin repetir y por clave; sin excluir nada, ni aparece', () => {
    expect(defaultChoices(cinco).excluded).toBeUndefined()
    expect(normalizeChoices(cinco, { excluded: ['mago', 'mago', 'escudo'] }).choices.excluded).toEqual([
      'mago',
      'escudo'
    ])
    expect(normalizeChoices(cinco, { excluded: [] }).choices.excluded).toBeUndefined()
    expect(normalizeChoices(cinco, { excluded: [3] as unknown as string[] }).problems).toEqual([
      'Lo excluido no vale así'
    ])
  })
})
