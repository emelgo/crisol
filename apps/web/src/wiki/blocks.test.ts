import { describe, expect, it } from 'vitest'
import { es } from '../i18n.ts'
import { BLOCKS, findBlocks, fold } from './blocks.ts'

const name = (block: (typeof BLOCKS)[number]) => es.blocks[block.label]
const ids = (query: string, nested = false) => findBlocks(query, name, nested).map((block) => block.id)

describe('los bloques del menú «/»', () => {
  it('sin nada escrito salen todos, por grupos; dentro de un secreto, sin secretos ni notas ocultas', () => {
    expect(ids('')).toHaveLength(BLOCKS.length)
    expect(ids('')).toContain('secret')
    expect(ids('', true)).not.toContain('secret')
    expect(ids('', true)).not.toContain('note')
  })

  it('se filtran por su nombre y por otras palabras, sin tildes ni mayúsculas', () => {
    expect(ids('tabla')).toEqual(['table'])
    expect(ids('TÍTULO')).toEqual(['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'])
    expect(ids('codigo')).toEqual(['codeBlock'])
    expect(ids('aviso')).toEqual(['callout-warning'])
    expect(ids('voz')).toEqual(['callout-read-aloud'])
    expect(ids('recuadro')).toEqual([
      'callout-note',
      'callout-tip',
      'callout-warning',
      'callout-danger',
      'callout-read-aloud'
    ])
    expect(ids('xyz')).toEqual([])
  })

  it('cada bloque tiene su nombre en español', () => {
    for (const block of BLOCKS) {
      expect(es.blocks[block.label], block.id).toBeTruthy()
      if (block.hint) expect(es.blocks[block.hint], block.id).toBeTruthy()
    }
    expect(fold('Viñetas Ácidas')).toBe('vinetas acidas')
  })
})
