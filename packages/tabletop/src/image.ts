/**
 * Las medidas de una imagen por su cabecera, sin descodificarla: PNG, JPEG, WebP y GIF. Para la escena que crea la IA
 * con un archivo del mundo y para un UVTT, que la trae dentro. null si no se reconoce
 */
/** El tipo de una imagen por sus primeros bytes */
export function imageType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg'
  const ascii = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp'
  return null
}

export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR')
    return { width: view.getUint32(16), height: view.getUint32(20) }
  if (bytes.length >= 10 && ascii(0, 3) === 'GIF')
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return webpSize(bytes, view, ascii)
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes, view)
  return null
}

function webpSize(bytes: Uint8Array, view: DataView, ascii: (at: number, length: number) => string) {
  const chunk = ascii(12, 4)
  // Con pérdida: el ancho y el alto, de 14 bits, tras la firma del fotograma
  if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  // Sin pérdida: 14 bits de ancho y 14 de alto, menos uno, empaquetados tras la firma 0x2f
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  // Extendida: 24 bits de ancho y de alto, menos uno
  if (chunk === 'VP8X') {
    const at = (offset: number) =>
      (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)
    return { width: at(24) + 1, height: at(27) + 1 }
  }
  return null
}

/** Recorre los segmentos hasta el primer «inicio de fotograma» (SOF0 a SOF15, salvo DHT, JPG y DAC) */
function jpegSize(bytes: Uint8Array, view: DataView) {
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1] ?? 0
    if (marker === 0xff) {
      at++
      continue
    }
    const length = view.getUint16(at + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
    at += 2 + length
  }
  return null
}
