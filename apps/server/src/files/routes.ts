/**
 * Las rutas de los bytes de los archivos: subir y reemplazar en crudo (el cuerpo es el archivo, en streaming; el
 * progreso lo ve la web), y servirlos con la sesión, con Range para el visor de PDF
 */
import type { Readable } from 'node:stream'
import { FILE_NAME_FORBIDDEN, fileName } from '@crisol/contracts'
import { filesRepo, loadMemberships } from '@crisol/db'
import { actorFrom, MAX_FILE_BYTES, sniff } from '@crisol/domain'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authorizedWiki } from '../actions/access.ts'
import { type ActionContext, type ActionEnv, errorCode, historyContext } from '../actions/context.ts'
import { authorizedFile, fileView, withFreeName } from '../actions/files.ts'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { filesChanged } from '../realtime/events.ts'
import { resolvePendingFiles } from '../wiki/file-embeds.ts'
import { type Storage, TooLargeError } from './storage.ts'

const uploadQuery = z.object({ worldId: z.uuid(), name: fileName })
const fileParams = z.object({ id: z.uuid() })

/** Un trozo pedido con Range («bytes=a-b», «bytes=a-», «bytes=-n»); null si no se entiende o pide varios */
export function parseRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | 'invalid' | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null
  const [, from = '', to = ''] = match
  if (from === '' && to === '') return null
  let start: number
  let end: number
  if (from === '') {
    start = Math.max(0, size - Number(to))
    end = size - 1
  } else {
    start = Number(from)
    end = to === '' ? size - 1 : Math.min(Number(to), size - 1)
  }
  if (start > end || start >= size) return 'invalid'
  return { start, end }
}

/** El nombre para Content-Disposition: en ASCII por si acaso y, entero, en UTF-8 */
const disposition = (type: 'inline' | 'attachment', name: string) => {
  const ascii =
    name
      .normalize('NFD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '') || 'archivo'
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function registerFileRoutes(
  app: FastifyInstance,
  env: ActionEnv,
  auth: Auth,
  options: { maxBytes?: number } = {}
) {
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES
  // El cuerpo de una subida es el archivo tal cual: se pasa sin leer, como flujo
  app.addContentTypeParser('*', (_request, payload, done) => done(null, payload))

  /** La cuenta de la petición, como en las acciones; null si no hay sesión */
  const contextOf = async (request: FastifyRequest): Promise<ActionContext | null> => {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return null
    return { ...env, actor: actorFrom(session.user.id, await loadMemberships(env.db, session.user.id)), via: 'ui' }
  }

  /** Lo esperado (no existe, sin permiso…) con su código; lo demás sigue hacia arriba */
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof TooLargeError) return reply.code(413).send({ code: 'TOO_LARGE', maxBytes })
    const code = errorCode(error)
    if (code === 'NOT_FOUND') return reply.code(404).send({ code })
    if (code === 'FORBIDDEN') return reply.code(403).send({ code })
    if (code) return reply.code(400).send({ code })
    throw error
  }

  /** Guarda el cuerpo; si dice de antemano que pasa del límite, ni se lee */
  const store = async (storage: Storage, request: FastifyRequest, worldId: string, name: string) => {
    if (Number(request.headers['content-length'] ?? 0) > maxBytes) throw new TooLargeError()
    const stored = await storage.write(worldId, request.body as Readable, maxBytes)
    return { ...sniff(stored.head, name), size: stored.size, hash: stored.hash, storageKey: stored.key }
  }

  // Muchas seguidas al subir una carpeta: el límite es holgado
  const uploads = { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }

  app.post('/api/files', uploads, async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    // El nombre del archivo tal cual venga del disco: lo que no puede llevar se cambia por «-»
    const raw = request.query as Record<string, unknown>
    const query = uploadQuery.safeParse({ ...raw, name: String(raw.name ?? '').replace(FILE_NAME_FORBIDDEN, '-') })
    if (!query.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: query.error.issues })
    if (!env.storage) return reply.code(503).send({ code: 'NO_STORAGE' })
    try {
      const wiki = await authorizedWiki(ctx, 'page.write', query.data.worldId)
      const content = await store(env.storage, request, wiki.worldId, query.data.name)
      const file = await withFreeName(ctx.db, { worldId: wiki.worldId, name: query.data.name }, (name) =>
        filesRepo.createFile(ctx.db, historyContext(ctx, 'uploadFile', { name }, wiki), {
          worldId: wiki.worldId,
          name,
          ...content
        })
      )
      ctx.realtime.publish(filesChanged(wiki))
      // Las páginas que ya lo usaban por su nombre lo encuentran
      await resolvePendingFiles(ctx, wiki.worldId, ctx.actor.userId, [file.name])
      return reply.code(201).send(fileView(file))
    } catch (error) {
      return fail(reply, error)
    }
  })

  app.put('/api/files/:id', uploads, async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = fileParams.safeParse(request.params)
    if (!params.success) return reply.code(404).send({ code: 'NOT_FOUND' })
    if (!env.storage) return reply.code(503).send({ code: 'NO_STORAGE' })
    try {
      const { file, wiki } = await authorizedFile(ctx, 'page.write', params.data.id)
      const content = await store(env.storage, request, wiki.worldId, file.name)
      const context = historyContext(ctx, 'replaceFile', { name: file.name }, wiki)
      // La clave vieja se queda: deshacer vuelve a ella (la limpieza la quita cuando ya no la nombra nadie)
      await filesRepo.updateFile(ctx.db, context, file.id, content)
      ctx.realtime.publish(filesChanged(wiki))
      const replaced = await filesRepo.findFile(ctx.db, file.id)
      return reply.send(replaced ? fileView(replaced) : null)
    } catch (error) {
      return fail(reply, error)
    }
  })

  app.get('/api/files/:id', async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = fileParams.safeParse(request.params)
    if (!params.success || !env.storage) return reply.code(404).send({ code: 'NOT_FOUND' })
    let file: Awaited<ReturnType<typeof authorizedFile>>['file']
    try {
      ;({ file } = await authorizedFile(ctx, 'page.read', params.data.id))
    } catch (error) {
      return fail(reply, error)
    }
    const etag = `"${file.hash}"`
    reply
      // Privada: solo el navegador de quien la pidió; se revalida con la huella (reemplazar cambia los bytes)
      .header('cache-control', 'private, no-cache')
      .header('etag', etag)
      .header('x-content-type-options', 'nosniff')
      .header('cross-origin-resource-policy', 'same-origin')
      .header('accept-ranges', 'bytes')
      .header('content-type', file.mime)
      .header('content-disposition', disposition(file.kind === 'other' ? 'attachment' : 'inline', file.name))
    // Un SVG abierto a solas no puede ejecutar nada
    if (file.mime === 'image/svg+xml') {
      reply.header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
    }
    if (request.headers['if-none-match'] === etag) return reply.code(304).send()
    const range = parseRange(request.headers.range, file.size)
    if (range === 'invalid') return reply.code(416).header('content-range', `bytes */${file.size}`).send()
    if (range) {
      return reply
        .code(206)
        .header('content-range', `bytes ${range.start}-${range.end}/${file.size}`)
        .header('content-length', range.end - range.start + 1)
        .send(env.storage.read(file.storageKey, range))
    }
    return reply.header('content-length', file.size).send(env.storage.read(file.storageKey))
  })
}
