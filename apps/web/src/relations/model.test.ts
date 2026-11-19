import { describe, expect, it } from 'vitest'
import { i18next } from '../i18n.ts'
import { edgeLabel, initials, inWords, type ReadableEdge, templateColor } from './model.ts'

const t = i18next.t.bind(i18next)
const field = (source: string, target: string, name: string, inverseName?: string): ReadableEdge => ({
  source,
  target,
  kind: 'field',
  name,
  ...(inverseName ? { inverseName } : {})
})
const mention = (source: string, target: string, secret = false): ReadableEdge => ({
  source,
  target,
  kind: 'mention',
  name: '',
  ...(secret ? { secret: true as const } : {})
})
const titles: Record<string, string> = { ilsa: 'Ilsa', aldren: 'Aldren', lia: 'Lia', doran: 'Doran', guerra: 'Guerra' }
const titleOf = (id: string) => titles[id] ?? id

describe('cómo se lee una arista', () => {
  it('desde la página: su campo; desde la otra, el nombre al revés o «Campo de»', () => {
    const padres = field('ilsa', 'aldren', 'Padres', 'Hijos')
    expect(edgeLabel(padres, 'ilsa', t)).toBe('Padres')
    expect(edgeLabel(padres, 'aldren', t)).toBe('Hijos')
    expect(edgeLabel(field('doran', 'ilsa', 'Aliados'), 'ilsa', t)).toBe('Aliados de')
  })

  it('las menciones, en los dos sentidos', () => {
    expect(edgeLabel(mention('ilsa', 'guerra'), 'ilsa', t)).toBe('Menciona')
    expect(edgeLabel(mention('ilsa', 'guerra'), 'guerra', t)).toBe('Mencionada en')
  })
})

describe('en palabras', () => {
  it('sus campos primero, luego lo que apunta a ella y al final las menciones, juntando las páginas', () => {
    const edges = [
      mention('ilsa', 'guerra'),
      field('lia', 'ilsa', 'Padres', 'Hijos'),
      field('ilsa', 'aldren', 'Padres', 'Hijos'),
      field('doran', 'ilsa', 'Aliados'),
      field('ilsa', 'doran', 'Aliados'),
      // No la toca: no sale
      field('lia', 'doran', 'Aliados')
    ]
    expect(inWords('ilsa', edges, titleOf, t)).toEqual([
      { label: 'Padres', secret: false, pages: [{ id: 'aldren', title: 'Aldren' }] },
      { label: 'Aliados', secret: false, pages: [{ id: 'doran', title: 'Doran' }] },
      { label: 'Hijos', secret: false, pages: [{ id: 'lia', title: 'Lia' }] },
      { label: 'Aliados de', secret: false, pages: [{ id: 'doran', title: 'Doran' }] },
      { label: 'Menciona', secret: false, pages: [{ id: 'guerra', title: 'Guerra' }] }
    ])
  })

  it('lo de un secreto va aparte', () => {
    const rows = inWords('ilsa', [mention('ilsa', 'guerra'), mention('ilsa', 'doran', true)], titleOf, t)
    expect(rows.map((row) => [row.label, row.secret, row.pages.length])).toEqual([
      ['Menciona', false, 1],
      ['Menciona', true, 1]
    ])
  })
})

describe('iniciales y colores', () => {
  it('las iniciales de las palabras con mayúscula, sin numerales romanos', () => {
    expect(initials('Mirela de Varn')).toBe('MV')
    expect(initials('Rook')).toBe('RO')
    expect(initials('la torre')).toBe('LT')
    // Ni ordinales ni iniciales que parezcan uno
    expect(initials('Aldren IV')).toBe('AL')
    expect(initials('Ilsa de Varn')).toBe('IL')
  })

  it('cada plantilla, el color de su sitio; sin plantilla, el atenuado', () => {
    expect(templateColor('b', ['a', 'b'])).toBe('var(--color-series-2)')
    expect(templateColor('i', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])).toBe('var(--color-series-1)')
    expect(templateColor(null, ['a'])).toBe('var(--color-muted)')
  })
})
