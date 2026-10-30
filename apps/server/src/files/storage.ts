/**
 * El almacenamiento de los bytes de los archivos (ADR-0001): de momento, el disco del VPS. Cada archivo va por una clave
 * `mundo/uuid` que no se reutiliza: reemplazar escribe otra, y la vieja se borra cuando ya no la nombra nadie
 */
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface StoredBytes {
  key: string
  size: number
  /** sha256 en hexadecimal */
  hash: string
  /** Los primeros bytes, para saber de qué tipo es */
  head: Uint8Array
}

export interface Storage {
  /** Guarda un flujo con una clave nueva; si pasa del límite, lo corta, lo borra y lanza TooLargeError */
  write(worldId: string, body: Readable, maxBytes: number): Promise<StoredBytes>
  /** Lee los bytes (o un trozo, de start a end incluidos) */
  read(key: string, range?: { start: number; end: number }): Readable
  remove(key: string): Promise<void>
  /** Todas las claves guardadas, con cuándo se escribieron: para la limpieza de lo que ya no nombra nadie */
  keys(): Promise<Array<{ key: string; writtenAt: Date }>>
}

export class NotAStreamError extends Error {
  constructor() {
    super('El cuerpo no es el archivo en crudo')
    this.name = 'NotAStreamError'
  }
}

export class TooLargeError extends Error {
  constructor() {
    super('El archivo pasa del límite')
    this.name = 'TooLargeError'
  }
}

const HEAD_BYTES = 512
const KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/

/** El disco, bajo una carpeta: cada mundo, su subcarpeta */
export function diskStorage(root: string): Storage {
  const pathOf = (key: string) => {
    // Una clave siempre es nuestra (mundo/uuid): nada de rutas que salgan de la carpeta
    if (!KEY.test(key)) throw new Error(`Clave no válida: ${key}`)
    return join(root, ...key.split('/'))
  }
  return {
    async write(worldId, body, maxBytes) {
      // Lo que no es un flujo (un cuerpo que ya se leyó como JSON o texto) ni se intenta: no queda nada abierto
      if (typeof (body as Partial<Readable> | undefined)?.pipe !== 'function') throw new NotAStreamError()
      const key = `${worldId}/${randomUUID()}`
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      const hash = createHash('sha256')
      const head: Buffer[] = []
      let size = 0
      let headSize = 0
      const count = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length
          if (size > maxBytes) return done(new TooLargeError())
          if (headSize < HEAD_BYTES) {
            head.push(chunk.subarray(0, HEAD_BYTES - headSize))
            headSize += Math.min(chunk.length, HEAD_BYTES - headSize)
          }
          hash.update(chunk)
          done(null, chunk)
        }
      })
      // El cuerpo no entra en el pipeline: si pasa del límite, se suelta y se tira lo que quede, sin romper la petición
      // (así aún se le puede contestar)
      const written = pipeline(count, createWriteStream(path, { flags: 'wx' }))
      const abort = (error: Error) => count.destroy(error)
      body.once('error', abort)
      body.pipe(count)
      try {
        await written
      } catch (error) {
        body.unpipe(count)
        body.resume()
        await rm(path, { force: true })
        throw error
      } finally {
        body.off('error', abort)
      }
      return { key, size, hash: hash.digest('hex'), head: new Uint8Array(Buffer.concat(head)) }
    },
    read(key, range) {
      return createReadStream(pathOf(key), range ?? {})
    },
    async remove(key) {
      await rm(pathOf(key), { force: true })
    },
    async keys() {
      const worlds = await readdir(root, { withFileTypes: true }).catch(() => [])
      const keys: Array<{ key: string; writtenAt: Date }> = []
      for (const world of worlds) {
        if (!world.isDirectory()) continue
        for (const name of await readdir(join(root, world.name))) {
          const key = `${world.name}/${name}`
          if (KEY.test(key)) keys.push({ key, writtenAt: (await stat(pathOf(key))).mtime })
        }
      }
      return keys
    }
  }
}
