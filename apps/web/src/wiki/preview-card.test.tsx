import { describe, expect, it } from 'vitest'
import { PREVIEW_BLOCKS, previewOf, sectionOf } from './preview-card.tsx'

const chapter = [
  '# Capítulo 4 {p100}',
  '',
  'Intro.',
  '',
  '## Encuentros {p105}',
  '',
  '![[img/dragon.webp|Un dragón|400]]',
  '*El dragón rojo*',
  '',
  'Uno con [[Capítulo 2#Mapas|los mapas]].',
  '',
  '> [!nota|p106] Consejo',
  '> Dentro.',
  '>',
  '> Más.',
  '',
  'Tres.',
  '',
  'Cuatro.',
  '',
  'Cinco.',
  '',
  '## Tesoros',
  '',
  'Oro.'
].join('\n')

describe('la vista previa de un apartado de un capítulo', () => {
  it('va desde su título (con su página) hasta el siguiente del mismo nivel', () => {
    const text = sectionOf(chapter, 'Encuentros')
    expect(text.startsWith('## Encuentros {p105}')).toBe(true)
    expect(text).not.toContain('Tesoros')
  })

  it('corta tras unos bloques, con la imagen y su pie juntos y el recuadro entero, y dice si queda más', () => {
    const { text, more } = previewOf(chapter, 'Encuentros')
    expect(PREVIEW_BLOCKS).toBe(4)
    expect(text).toContain('*El dragón rojo*')
    expect(text).toContain('> Más.')
    expect(text).toContain('Tres.')
    expect(text).not.toContain('Cuatro.')
    expect(more).toBe(true)
  })

  it('sin más que enseñar, no dice que quede', () => {
    expect(previewOf(chapter, 'Tesoros')).toEqual({ text: '## Tesoros\n\nOro.', more: false })
  })
})
