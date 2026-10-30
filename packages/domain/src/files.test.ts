import { describe, expect, it } from 'vitest'
import { sniff } from './files.ts'

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...Buffer.from(part)] : part)))

describe('el tipo de un archivo por sus primeros bytes', () => {
  it.each([
    ['PNG', bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'resto'), 'image/png'],
    ['JPEG', bytes([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    ['GIF', bytes('GIF89a...'), 'image/gif'],
    ['WebP', bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '), 'image/webp'],
    ['AVIF', bytes([0, 0, 0, 0x1c], 'ftypavif'), 'image/avif'],
    ['PDF', bytes('%PDF-1.7\n'), 'application/pdf'],
    ['PDF con algo delante', bytes('basura\n%PDF-1.4'), 'application/pdf'],
    ['SVG', bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">'), 'image/svg+xml']
  ])('%s', (_name, head, mime) => {
    expect(sniff(head, 'x').mime).toBe(mime)
  })

  it('lo que dice la extensión no cuenta: un .png que no lo es se guarda como otro', () => {
    expect(sniff(bytes('<html><script>'), 'mapa.png')).toEqual({ kind: 'other', mime: 'application/octet-stream' })
  })

  it('un SVG con un comentario largo delante se reconoce por la extensión, si empieza por <', () => {
    expect(sniff(bytes(`<!-- ${'x'.repeat(600)}`), 'escudo.svg').mime).toBe('image/svg+xml')
    expect(sniff(bytes('texto'), 'escudo.svg').kind).toBe('other')
  })
})
