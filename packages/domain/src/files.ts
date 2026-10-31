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
  // Audio y vídeo
  if (ascii(head, 0, 3) === 'ID3' || (head[0] === 0xff && [0xfb, 0xf3, 0xf2].includes(head[1] ?? 0))) {
    return { kind: 'other', mime: 'audio/mpeg' }
  }
  if (ascii(head, 0, 4) === 'OggS') return { kind: 'other', mime: 'audio/ogg' }
  if (ascii(head, 0, 4) === 'fLaC') return { kind: 'other', mime: 'audio/flac' }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WAVE') return { kind: 'other', mime: 'audio/wav' }
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12)
    if (brand.startsWith('M4A')) return { kind: 'other', mime: 'audio/mp4' }
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash'].includes(brand)) {
      return { kind: 'other', mime: 'video/mp4' }
    }
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'other', mime: 'video/webm' }
  // Texto: solo con su extensión y si de verdad es texto (sin bytes nulos, UTF-8 válido)
  const textType = TEXT_TYPES[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '']
  if (textType && !head.includes(0) && isUtf8(head)) return { kind: 'other', mime: textType }
  return { kind: 'other', mime: UNKNOWN }
}

const UNKNOWN = 'application/octet-stream'

/** El texto que se puede subir, por su extensión */
const TEXT_TYPES: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json'
}

/** Si los bytes son UTF-8 (el final puede venir cortado: solo se miran los primeros) */
function isUtf8(bytes: Uint8Array) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, Math.max(0, bytes.length - 4)))
    return true
  } catch {
    return false
  }
}

/**
 * Si se puede subir: imágenes, PDF, audio, vídeo y texto, reconocidos por su contenido. Nada más: ni programas (.exe),
 * ni scripts, ni páginas web, aunque cambien de extensión
 */
export const uploadable = (sniffed: Sniffed) => sniffed.mime !== UNKNOWN

/** Lo que se ofrece al elegir archivos (el servidor lo comprueba igualmente por su contenido) */
export const UPLOAD_ACCEPT = 'image/*,application/pdf,audio/*,video/*,.txt,.md,.markdown,.csv,.json'

/** Por su nombre, si parece de los que se pueden subir (para no intentar uno que el servidor rechazará) */
export const looksUploadable = (name: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|pdf|mp3|ogg|oga|opus|flac|wav|m4a|mp4|m4v|webm|txt|md|markdown|csv|json)$/i.test(name)
