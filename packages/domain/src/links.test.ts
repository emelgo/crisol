import { describe, expect, it } from 'vitest'
import { editDistance, type NamedPage, resolveName, searchNames } from './links.ts'

const page = (id: string, path: string[], aliases: string[] = []): NamedPage => ({
  id,
  title: path.at(-1) ?? '',
  aliases,
  path
})
const pages = [
  page('puerto', ['Lugares', 'Costa Gris', 'Puerto Ceniza'], ['Puerto']),
  page('maela', ['Personajes', 'Maela Varn'], ['La Maestre']),
  page('notas1', ['Lugares', 'Notas']),
  page('notas2', ['Personajes', 'Notas']),
  page('dragon', ['Criaturas', 'Dragón rojo'])
]
const ids = (found: readonly { id: string }[]) => found.map((p) => p.id)
const hits = (found: readonly { page: { id: string } }[]) => found.map((f) => f.page.id)

describe('resolver un nombre', () => {
  it('por título o alias, sin mayúsculas ni espacios de más', () => {
    expect(ids(resolveName('puerto ceniza', pages))).toEqual(['puerto'])
    expect(ids(resolveName('  Puerto  ', pages))).toEqual(['puerto'])
    expect(ids(resolveName('la maestre', pages))).toEqual(['maela'])
    expect(ids(resolveName('Nadie', pages))).toEqual([])
  })

  it('con títulos repetidos, varias; con su ruta, la que toca', () => {
    expect(ids(resolveName('Notas', pages))).toEqual(['notas1', 'notas2'])
    expect(ids(resolveName('Personajes/Notas', pages))).toEqual(['notas2'])
    expect(ids(resolveName('Lugares/Costa Gris/Puerto Ceniza', pages))).toEqual(['puerto'])
    expect(ids(resolveName('Costa Gris/Puerto', pages))).toEqual(['puerto'])
    expect(ids(resolveName('Otra/Notas', pages))).toEqual([])
  })
})

describe('buscar al escribir [[', () => {
  it('primero lo que empieza así, luego lo que lo contiene; también por alias', () => {
    expect(hits(searchNames('pue', pages))).toEqual(['puerto'])
    expect(searchNames('maestre', pages)[0]).toMatchObject({ page: { id: 'maela' }, name: 'La Maestre' })
    expect(hits(searchNames('notas', pages))).toEqual(['notas1', 'notas2'])
    expect(hits(searchNames('rojo', pages))).toEqual(['dragon'])
  })

  it('con erratas y sin tildes', () => {
    expect(hits(searchNames('dragon', pages))).toEqual(['dragon'])
    expect(hits(searchNames('dargon rojo', pages))).toEqual(['dragon'])
    expect(hits(searchNames('Mela Varn', pages))).toEqual(['maela'])
    expect(hits(searchNames('mela', pages))).toEqual(['maela'])
    expect(hits(searchNames('drgon', pages))).toEqual(['dragon'])
    expect(searchNames('xyzw', pages)).toEqual([])
  })

  it('la distancia de edición', () => {
    expect(editDistance('dragon', 'dargon')).toBe(2)
    expect(editDistance('casa', 'casa')).toBe(0)
    expect(editDistance('a', 'abcdef', 2)).toBe(3)
  })
})
