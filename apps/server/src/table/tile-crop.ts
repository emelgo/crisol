/**
 * Las teselas del borde de la niebla, recortadas en el servidor (docs/specs/vision.md, ADR-0018 § 7): con el ajuste
 * «recortadas» de la campaña, lo que no ha explorado ni ve el grupo sale transparente. WebP con libwebp en wasm
 * (`@jsquash/webp`, Apache-2.0; libwebp, BSD-3-Clause): sin binarios nativos ni licencias copyleft
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { FogGrid, type TileRef } from '@crisol/tabletop'

type Codec = {
  decode: (bytes: ArrayBuffer) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>
  encode: (image: { data: Uint8ClampedArray; width: number; height: number }, options: object) => Promise<ArrayBuffer>
}

let codec: Promise<Codec> | null = null

/** WebAssembly del motor: los tipos de Node no lo declaran como valor (sin la librería del navegador) */
type CompiledWasm = object
const wasmEngine = (
  globalThis as unknown as {
    WebAssembly: { compile(bytes: Uint8Array): Promise<CompiledWasm>; validate(bytes: Uint8Array): boolean }
  }
).WebAssembly

/** El códec, al usarlo por primera vez: el wasm se lee del paquete (en Node no se puede pedir por fetch) */
function loadCodec(): Promise<Codec> {
  codec ??= (async () => {
    const require = createRequire(import.meta.url)
    const wasm = (path: string) => wasmEngine.compile(readFileSync(require.resolve(`@jsquash/webp/${path}`)))
    const dec = await import('@jsquash/webp/decode.js')
    const enc = await import('@jsquash/webp/encode.js')
    // El codificador elige su versión con SIMD si el motor la tiene: se le da el wasm que toca
    const simd = wasmEngine.validate(readFileSync(require.resolve('@jsquash/webp/codec/enc/webp_enc_simd.wasm')))
    const initDecoder = dec.init as unknown as (module: CompiledWasm) => Promise<unknown>
    const initEncoder = enc.init as unknown as (module: CompiledWasm) => Promise<unknown>
    await initDecoder(await wasm('codec/dec/webp_dec.wasm'))
    await initEncoder(await wasm(simd ? 'codec/enc/webp_enc_simd.wasm' : 'codec/enc/webp_enc.wasm'))
    return { decode: dec.default, encode: enc.default as unknown as Codec['encode'] }
  })()
  return codec
}

export interface CropRequest {
  /** La tesela tal cual (WebP) */
  bytes: Uint8Array
  /** Lo que puede ver la pantalla (lo explorado y lo visible), comprimido */
  mask: Uint8Array
  tile: TileRef
  tileSize: number
}

/** La tesela con lo que cae fuera de la máscara en transparente, en WebP */
export async function cropTile(request: CropRequest): Promise<Uint8Array> {
  const { decode, encode } = await loadCodec()
  const mask = FogGrid.decode(request.mask)
  const own = request.bytes.slice()
  const image = await decode(own.buffer)
  const scale = 2 ** request.tile.level
  const x0 = request.tile.x * request.tileSize
  const y0 = request.tile.y * request.tileSize
  const s = mask.cellSize
  const { data, width, height } = image
  for (let py = 0; py < height; py++) {
    const row = Math.floor(((y0 + py + 0.5) * scale) / s)
    for (let px = 0; px < width; px++) {
      const column = Math.floor(((x0 + px + 0.5) * scale) / s)
      if (mask.get(column, row)) continue
      const i = (py * width + px) * 4
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
  const out = await encode({ data, width, height }, { quality: 80, method: 2 })
  return new Uint8Array(out)
}

/** Las celdas de la niebla que pisa un rectángulo del mapa */
function cellsOf(mask: FogGrid, rect: { x: number; y: number; width: number; height: number }) {
  const s = mask.cellSize
  return {
    c0: Math.max(0, Math.floor(rect.x / s)),
    r0: Math.max(0, Math.floor(rect.y / s)),
    c1: Math.min(mask.columns - 1, Math.ceil((rect.x + rect.width) / s) - 1),
    r1: Math.min(mask.rows - 1, Math.ceil((rect.y + rect.height) / s) - 1)
  }
}

/** Una huella de lo que la máscara deja ver en un rectángulo: si no cambia, la tesela recortada es la misma */
export function maskSignature(mask: FogGrid, rect: { x: number; y: number; width: number; height: number }): string {
  const { c0, r0, c1, r1 } = cellsOf(mask, rect)
  const hash = createHash('sha1')
  const row = new Uint8Array(Math.max(0, c1 - c0 + 1))
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) row[c - c0] = mask.get(c, r) ? 1 : 0
    hash.update(row)
  }
  return hash.digest('base64url')
}

/** Cuánto de la tesela cae en la máscara: nada, una parte o entera (en celdas de la niebla) */
export function tileCoverage(
  mask: FogGrid,
  rect: { x: number; y: number; width: number; height: number }
): 'none' | 'partial' | 'full' {
  const { c0, r0, c1, r1 } = cellsOf(mask, rect)
  let on = 0
  let off = 0
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      if (mask.get(c, r)) on += 1
      else off += 1
      if (on > 0 && off > 0) return 'partial'
    }
  return on === 0 ? 'none' : off === 0 ? 'full' : 'partial'
}
