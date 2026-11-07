/**
 * El hilo que trocea el mapa de una escena (ADR-0018 § 7): lee la imagen (o el UVTT, que la trae dentro), la parte en
 * teselas WebP con un lienzo fuera de pantalla y las sube; y busca la rejilla en el nivel que cabe en el análisis. Un
 * mapa de 90 MB no pasa por la página ni por el servidor entero
 */
import {
  detectGrid,
  normalizeGrid,
  parseUvtt,
  type TilePyramid,
  type TileRef,
  tilePyramid,
  tileRect,
  uvttScene
} from '@crisol/tabletop'
import {
  analysisLevel,
  type DetectedGrid,
  type PreparedUvtt,
  PrepareError,
  type PrepareSource,
  prepareTiles,
  sourceRect,
  type WorkerReply,
  type WorkerRequest
} from './prepare.ts'

const reply = (message: WorkerReply) => self.postMessage(message)
const QUALITY = 0.85
/** Lo más que mide de lado (como MAX_SCENE_SIDE de los contratos, que no se cargan en este hilo) */
const MAX_SIDE = 32_768

/** La imagen del mapa y, si era un UVTT, lo que trae para la escena */
async function readSource(
  source: Exclude<PrepareSource, { kind: 'bitmap' }>
): Promise<{ image: Blob; uvtt: PreparedUvtt | null }> {
  if (source.kind === 'image') return { image: source.blob, uvtt: null }
  const parsed = parseUvtt(await source.blob.text())
  if (!parsed.ok) throw new PrepareError('BAD_UVTT', parsed.error)
  const scene = uvttScene(parsed.value)
  if (!scene.ok) throw new PrepareError('BAD_UVTT', scene.error)
  const { image, imageType } = parsed.value
  return {
    image: new Blob([image as Uint8Array<ArrayBuffer>], { type: `image/${imageType}` }),
    uvtt: { grid: scene.value.grid, imported: scene.value.imported }
  }
}

async function decode(image: Blob) {
  try {
    return await createImageBitmap(image)
  } catch {
    throw new PrepareError('BAD_IMAGE')
  }
}

const tileUrl = (sceneId: string, version: string, ref: TileRef) =>
  `/api/scenes/${sceneId}/tiles/${version}/${ref.level}/${ref.x}/${ref.y}`

async function prepare(sceneId: string, version: string, source: PrepareSource) {
  const { image, uvtt } = source.kind === 'bitmap' ? { image: null, uvtt: null } : await readSource(source)
  const bitmap = source.kind === 'bitmap' ? source.bitmap : await decode(image as Blob)
  try {
    const { width, height } = bitmap
    if (width > MAX_SIDE || height > MAX_SIDE) throw new PrepareError('TOO_BIG')
    const pyramid = tilePyramid(width, height)
    const total = pyramid.levels.reduce((sum, level) => sum + level.columns * level.rows, 0)
    reply({ type: 'image', width, height, preview: image, total })
    const canvas = new OffscreenCanvas(pyramid.tileSize, pyramid.tileSize)
    const context = canvas.getContext('2d')
    if (!context) throw new PrepareError('BAD_IMAGE')
    await prepareTiles(pyramid, {
      encode: async (ref) => {
        const out = tileRect(pyramid, ref)
        const from = sourceRect(pyramid, ref)
        // Cambiar el tamaño lo deja en blanco (y transparente)
        canvas.width = out.width
        canvas.height = out.height
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(bitmap, from.x, from.y, from.width, from.height, 0, 0, out.width, out.height)
        return canvas.convertToBlob({ type: 'image/webp', quality: QUALITY })
      },
      upload: async (ref, tile) => {
        const response = await fetch(tileUrl(sceneId, version, ref), {
          method: 'PUT',
          body: tile,
          headers: { 'content-type': 'image/webp' }
        })
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { code?: string }
          throw new PrepareError(body.code ?? 'UPLOAD_FAILED')
        }
      },
      onProgress: (done) => reply({ type: 'progress', done, total })
    })
    reply({ type: 'prepared', width, height, size: pyramid.tileSize, levels: pyramid.levels.length, uvtt })
  } finally {
    bitmap.close()
  }
}

/** El nivel que cabe en el análisis, pegado de sus teselas, y la rejilla que se ve en él, a escala real */
async function detect(sceneId: string, version: string, pyramid: TilePyramid): Promise<DetectedGrid | null> {
  const level = pyramid.levels[analysisLevel(pyramid)]
  if (!level) return null
  const canvas = new OffscreenCanvas(level.width, level.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.columns; x++) {
      const response = await fetch(tileUrl(sceneId, version, { level: level.level, x, y }))
      if (!response.ok) throw new PrepareError('BAD_IMAGE')
      const tile = await decode(await response.blob())
      context.drawImage(tile, x * pyramid.tileSize, y * pyramid.tileSize)
      tile.close()
    }
  }
  const pixels = context.getImageData(0, 0, level.width, level.height)
  const found = detectGrid({ width: level.width, height: level.height, data: pixels.data })
  if (!found) return null
  const { grid, stretch } = found
  // Celdas algo rectangulares: la escena las quiere cuadradas, con el lado medio
  const k = 1 / level.scale
  const sx = stretch?.x ?? 1
  const sy = stretch?.y ?? 1
  const normalized = normalizeGrid({
    type: grid.type,
    size: ((grid.size / sx + grid.size / sy) / 2) * k,
    offsetX: (grid.offsetX / sx) * k,
    offsetY: (grid.offsetY / sy) * k
  })
  return { type: normalized.type, size: normalized.size, offsetX: normalized.offsetX, offsetY: normalized.offsetY }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'prepare') await prepare(request.sceneId, request.version, request.source)
    else {
      const full = tilePyramid(request.width, request.height, request.size)
      const pyramid = { ...full, levels: full.levels.slice(0, request.levels) }
      reply({ type: 'detected', grid: await detect(request.sceneId, request.version, pyramid) })
    }
  } catch (error) {
    reply({ type: 'failed', code: error instanceof PrepareError ? error.code : 'UPLOAD_FAILED' })
  }
}
