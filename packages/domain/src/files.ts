/** Lo más que pesa un archivo del mundo (el mayor de Eana, 204 MB) */
export const MAX_FILE_BYTES = 250 * 1024 * 1024

/** De qué tipo es un archivo, por sus primeros bytes (no por lo que diga el navegador ni la extensión) */
export type Sniffed = { kind: 'image' | 'pdf' | 'other'; mime: string }

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, i) => bytes[i] === byte)

export function sniff(head: Uint8Array, name: string): Sniffed {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', mime: 'image/png' }
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg' }
  if (/^GIF8[79]a$/.test(ascii(head, 0, 6))) return { kind: 'image', mime: 'image/gif' }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' }
  if (ascii(head, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(head, 8, 12))) {
    return { kind: 'image', mime: 'image/avif' }
  }
  // Algunos PDF traen algo antes de la cabecera: se busca en los primeros bytes
  if (ascii(head, 0, Math.min(head.length, 1024)).includes('%PDF-')) return { kind: 'pdf', mime: 'application/pdf' }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(head).replace(/^﻿/, '').trimStart()
  if (text.startsWith('<') && (/<svg[\s>]/i.test(text) || /\.svg$/i.test(name))) {
    return { kind: 'image', mime: 'image/svg+xml' }
  }
  return { kind: 'other', mime: 'application/octet-stream' }
}
