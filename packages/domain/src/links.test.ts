import { describe, expect, it } from 'vitest'
import { editDistance, matchLinkTarget, type NamedPage, resolveName, searchNames } from './links.ts'

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

describe('a qué entrada lleva un enlace al compendio (ADR-0033)', () => {
  const entry = (key: string, es: string, en: string, type: string, label: string, world = false) => ({
    key,
    names: [es, en],
    type,
    typeLabels: [label, type],
    world
  })
  const items = [
    entry('escudo-conjuro', 'Escudo', 'Shield', 'conjuro', 'Conjuro'),
    entry('escudo-armadura', 'Escudo', 'Shield', 'objeto', 'Objeto'),
    entry('clima-costa', 'Clima', 'Weather', 'tabla', 'Tabla'),
    entry('trasgo', 'Trasgo', 'Goblin', 'criatura', 'Criatura'),
    entry('trasgo-mundo', 'Trasgo', 'Goblin', 'criatura', 'Criatura', true)
  ]

  it('por su nombre en cualquier idioma, lo del mundo antes', () => {
    expect(matchLinkTarget(items, 'goblin')?.key).toBe('trasgo-mundo')
    expect(matchLinkTarget(items, 'Escudo')?.key).toBe('escudo-conjuro')
  })

  it('con su tipo delante (por su clave o su nombre) para lo que se llama igual', () => {
    expect(matchLinkTarget(items, 'objeto/Escudo')?.key).toBe('escudo-armadura')
    expect(matchLinkTarget(items, 'Objeto/Shield')?.key).toBe('escudo-armadura')
    expect(matchLinkTarget(items, 'conjuro/escudo-conjuro')?.key).toBe('escudo-conjuro')
  })

  it('por su clave; y una barra que no es de un tipo es parte del nombre', () => {
    expect(matchLinkTarget(items, 'escudo-armadura')?.key).toBe('escudo-armadura')
    expect(matchLinkTarget(items, 'trasgo')?.key).toBe('trasgo-mundo')
    expect(
      matchLinkTarget([...items, entry('ida', 'Ida/vuelta', 'Round trip', 'regla', 'Regla')], 'Ida/vuelta')?.key
    ).toBe('ida')
    expect(matchLinkTarget(items, 'Nada')).toBeUndefined()
  })
})
