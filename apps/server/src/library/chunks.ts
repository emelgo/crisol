/**
 * Los trozos para buscar por significado (docs/specs/biblioteca.md): el texto de una página partido en trozos de unos
 * 300 tokens (unos 1.200 caracteres), por párrafos y, si uno no cabe, por frases. Su huella lleva su página
 */
import { createHash } from 'node:crypto'

const MAX_CHARS = 1200
/** Lo que no llega, no merece un trozo (un número de página suelto) */
const MIN_CHARS = 30

/** Lo de dentro de un párrafo largo, por frases (y una frase enorme, a cortes) */
function pieces(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHARS) return [paragraph]
  const out: string[] = []
  let current = ''
  for (const sentence of paragraph.split(/(?<=[.!?…])\s+/)) {
    for (let i = 0; i < sentence.length; i += MAX_CHARS) {
      const part = sentence.slice(i, i + MAX_CHARS)
      if (current && current.length + part.length + 1 > MAX_CHARS) {
        out.push(current)
        current = ''
      }
      current = current ? `${current} ${part}` : part
    }
  }
  if (current) out.push(current)
  return out
}

/** Un texto en trozos: los párrafos juntos mientras quepan */
export function chunksOf(text: string): string[] {
  const out: string[] = []
  let current = ''
  for (const paragraph of text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    for (const piece of pieces(paragraph)) {
      if (current && current.length + piece.length + 1 > MAX_CHARS) {
        out.push(current)
        current = ''
      }
      current = current ? `${current}\n${piece}` : piece
    }
  }
  if (current) out.push(current)
  return out.filter((chunk) => chunk.length >= MIN_CHARS)
}

/** Los trozos de las páginas de un libro, con su página, su orden y su huella */
export function bookChunks(pages: readonly string[]) {
  return pages.flatMap((text, i) =>
    chunksOf(text).map((chunk, position) => ({
      page: i + 1,
      position,
      text: chunk,
      hash: createHash('sha1')
        .update(`${i + 1}\n${chunk}`)
        .digest('hex')
    }))
  )
}
