import { describe, expect, it } from 'vitest'
import { imageSize } from './image-size.ts'

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part)))

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u16le = (n: number) => [n & 255, (n >>> 8) & 255]
const u16be = (n: number) => [(n >>> 8) & 255, n & 255]

describe('imageSize', () => {
  it('lee un PNG', () => {
    const png = bytes([0x89], 'PNG', [13, 10, 26, 10], u32be(13), 'IHDR', u32be(6000), u32be(4200), [8, 6, 0, 0, 0])
    expect(imageSize(png)).toEqual({ width: 6000, height: 4200 })
  })

  it('lee un GIF', () => {
    expect(imageSize(bytes('GIF89a', u16le(320), u16le(200), [0, 0]))).toEqual({ width: 320, height: 200 })
  })

  it('lee un JPEG saltando los segmentos de antes del fotograma', () => {
    const app0 = [0xff, 0xe0, ...u16be(16), ...new Array(14).fill(0)]
    const sof = [0xff, 0xc0, ...u16be(17), 8, ...u16be(1080), ...u16be(1920), 3, ...new Array(9).fill(0)]
    expect(imageSize(bytes([0xff, 0xd8], app0, sof))).toEqual({ width: 1920, height: 1080 })
  })

  it('no confunde la tabla de Huffman con un fotograma', () => {
    const dht = [0xff, 0xc4, ...u16be(4), 0, 0]
    const sof = [0xff, 0xc2, ...u16be(17), 8, ...u16be(50), ...u16be(70), 3, ...new Array(9).fill(0)]
    expect(imageSize(bytes([0xff, 0xd8], dht, sof))).toEqual({ width: 70, height: 50 })
  })

  it('lee los tres tipos de WebP', () => {
    const riff = (chunk: string, body: number[]) => bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [0, 0, 0, 0], body)
    const lossy = riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(2048), ...u16le(1536)])
    expect(imageSize(lossy)).toEqual({ width: 2048, height: 1536 })
    const w = 999
    const h = 777
    const packed = (w - 1) | ((h - 1) << 14)
    const lossless = riff('VP8L', [
      0x2f,
      packed & 255,
      (packed >>> 8) & 255,
      (packed >>> 16) & 255,
      (packed >>> 24) & 255,
      0,
      0,
      0,
      0,
      0,
      0
    ])
    expect(imageSize(lossless)).toEqual({ width: 999, height: 777 })
    const big = 20_000 - 1
    const extended = riff('VP8X', [0, 0, 0, 0, big & 255, (big >>> 8) & 255, big >>> 16, 99, 0, 0])
    expect(imageSize(extended)).toEqual({ width: 20_000, height: 100 })
  })

  it('null si no la reconoce', () => {
    expect(imageSize(bytes('%PDF-1.7'))).toBeNull()
    expect(imageSize(new Uint8Array())).toBeNull()
  })
})
