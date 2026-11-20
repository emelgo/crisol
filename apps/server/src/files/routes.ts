/**
 * Las rutas de los bytes de los archivos: subir y reemplazar en crudo (el cuerpo es el archivo, en streaming; el
 * progreso lo ve la web), y servirlos con la sesión, con Range para el visor de PDF
 */
import type { Readable } from 'node:stream'
import { FILE_NAME_FORBIDDEN, fileName } from '@crisol/contracts'
import {
  campaignsRepo,
  filesRepo,
  loadMemberships,
  logRepo,
  soundRepo,
  systemImagesRepo,
  systemsRepo,
  visionRepo,
  worldsRepo
} from '@crisol/db'
import { actorFrom, can, MAX_FILE_BYTES, sniff, uploadable } from '@crisol/domain'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authorizedWiki } from '../actions/access.ts'
import { type ActionContext, type ActionEnv, errorCode, historyContext } from '../actions/context.ts'
import {
  authorizedCommon,
  authorizedFile,
  type FilePlace,
  filesTouched,
  fileView,
  folderIn,
  scopeOf,
  withFreeName
} from '../actions/files.ts'
import { requesterOf, viaOf } from '../auth/api-tokens.ts'
import type { Auth } from '../auth/auth.ts'
import { clientIp } from '../http.ts'
import { playerOpensFile } from '../wiki/reader.ts'
import { NotAStreamError, type Storage, TooLargeError } from './storage.ts'

/** A un mundo (worldId) o, sin él, a los comunes de una organización (organizationId); folderId: a esa carpeta */
const uploadQuery = z.union([
  z.object({ worldId: z.uuid(), name: fileName, folderId: z.uuid().optional() }),
  z.object({ organizationId: z.uuid(), name: fileName, folderId: z.uuid().optional() })
])
const fileParams = z.object({ id: z.uuid() })

/**
 * Adónde va lo que se sube a un mundo: a él o, si es el de las plantillas (ADR-0024), a los archivos comunes de su
 * cuenta (lo que se pone al editar una plantilla tiene que verse en las páginas que se hagan con ella, en cualquier mundo)
 */
async function uploadPlace(ctx: ActionContext, worldId: string): Promise<FilePlace> {
  const place = await authorizedWiki(ctx, 'page.write', worldId)
  const world = await worldsRepo.findWorld(ctx.db, worldId)
  return world?.purpose === 'templates' ? authorizedCommon(ctx, true, place.organizationId) : place
}

/** Lo subido no es de lo que se admite */
class BadTypeError extends Error {}

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

/** El archivo, si un jugador lo puede abrir: del mundo en el que juega, o común, usado en alguno de sus mundos */
async function playerFile(ctx: ActionContext, fileId: string) {
  const file = await filesRepo.findFile(ctx.db, fileId)
  if (!file) return null
  const worlds = file.worldId ? [file.worldId] : [...new Set([...ctx.actor.campaigns.values()].map((c) => c.worldId))]
  for (const worldId of worlds) if (await playerOpensFile(ctx, worldId, file.id)) return file
  // Una imagen que le enseñó el máster (y sigue en el registro de su campaña)
  const campaignIds = [...ctx.actor.campaigns.keys()]
  if (await logRepo.wasShownFile(ctx.db, { userId: ctx.actor.userId, campaignIds, fileId: file.id })) return file
  // Un audio de una lista que suena en su campaña (docs/specs/sonido.md)
  if (file.mime.startsWith('audio/') && (await soundRepo.fileIsPlaying(ctx.db, campaignIds, file.id))) return file
  // Un audio que suena en el mapa de la escena que enseña su campaña (docs/specs/sonido-mapa.md)
  if (file.mime.startsWith('audio/') && (await visionRepo.fileInPresentedSounds(ctx.db, campaignIds, file.id)))
    return file
  return null
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

  /** La cuenta de la petición, como en las acciones (la sesión o un token de acceso); null si no hay ninguna */
  const contextOf = async (request: FastifyRequest): Promise<ActionContext | null> => {
    const requester = await requesterOf(request, auth, env.db)
    if (!requester) return null
    const actor = actorFrom(requester.userId, await loadMemberships(env.db, requester.userId))
    return { ...env, actor, ...viaOf(requester) }
  }

  /** Lo esperado (no existe, sin permiso…) con su código; lo demás sigue hacia arriba */
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof TooLargeError) return reply.code(413).send({ code: 'TOO_LARGE', maxBytes })
    if (error instanceof NotAStreamError) return reply.code(415).send({ code: 'NOT_RAW' })
    if (error instanceof BadTypeError) return reply.code(415).send({ code: 'BAD_TYPE' })
    const code = errorCode(error)
    if (code === 'NOT_FOUND') return reply.code(404).send({ code })
    if (code === 'FORBIDDEN') return reply.code(403).send({ code })
    if (code) return reply.code(400).send({ code })
    throw error
  }

  /** Guarda el cuerpo, bajo su mundo o, si es común, su organización; si dice de antemano que pasa del límite, ni se lee */
  const store = async (storage: Storage, request: FastifyRequest, place: FilePlace, name: string) => {
    if (Number(request.headers['content-length'] ?? 0) > maxBytes) throw new TooLargeError()
    const stored = await storage.write(place.worldId ?? place.organizationId, request.body as Readable, maxBytes)
    const sniffed = sniff(stored.head, name)
    // Solo imágenes, PDF, audio, vídeo y texto, por su contenido: lo demás (programas, scripts…) se tira
    if (!uploadable(sniffed)) {
      await storage.remove(stored.key)
      throw new BadTypeError()
    }
    return { ...sniffed, size: stored.size, hash: stored.hash, storageKey: stored.key }
  }

  // Muchas seguidas al subir una carpeta: el límite es holgado (por quien las manda, no por el proxy)
  const uploads = { config: { rateLimit: { max: 600, timeWindow: '1 minute', keyGenerator: clientIp } } }

  app.post('/api/files', uploads, async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    // El nombre del archivo tal cual venga del disco: lo que no puede llevar se cambia por «-»
    const raw = request.query as Record<string, unknown>
    const query = uploadQuery.safeParse({ ...raw, name: String(raw.name ?? '').replace(FILE_NAME_FORBIDDEN, '-') })
    if (!query.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: query.error.issues })
    if (!env.storage) return reply.code(503).send({ code: 'NO_STORAGE' })
    try {
      const place: FilePlace =
        'worldId' in query.data
          ? await uploadPlace(ctx, query.data.worldId)
          : authorizedCommon(ctx, true, query.data.organizationId)
      const folder = await folderIn(ctx, place, query.data.folderId)
      const content = await store(env.storage, request, place, query.data.name)
      const scope = place.worldId ? place : { organizationId: place.organizationId }
      const file = await withFreeName(ctx.db, { scope: scopeOf(place), name: query.data.name }, (name) =>
        filesRepo.createFile(ctx.db, historyContext(ctx, 'uploadFile', { name }, scope), {
          organizationId: place.organizationId,
          worldId: place.worldId,
          folderId: folder?.id ?? null,
          name,
          ...content
        })
      )
      // Las páginas que ya lo usaban por su nombre lo encuentran (con un común, en todos los mundos)
      await filesTouched(ctx, place, [file.name])
      // Un PDF: su texto, en segundo plano
      if (file.kind === 'pdf') await env.library?.enqueue(file.id)
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
      const { file, place } = await authorizedFile(ctx, 'page.write', params.data.id)
      const content = await store(env.storage, request, place, file.name)
      const scope = place.worldId ? place : { organizationId: place.organizationId }
      const context = historyContext(ctx, 'replaceFile', { name: file.name }, scope)
      // La clave vieja se queda: deshacer vuelve a ella (la limpieza la quita cuando ya no la nombra nadie)
      await filesRepo.updateFile(ctx.db, context, file.id, content)
      await filesTouched(ctx, place)
      const replaced = await filesRepo.findFile(ctx.db, file.id)
      if (replaced?.kind === 'pdf') await env.library?.enqueue(replaced.id)
      return reply.send(replaced ? fileView(replaced) : null)
    } catch (error) {
      return fail(reply, error)
    }
  })

  // Las imágenes de un sistema (docs/specs/imagenes.md), por su ruta: a quien lee el sistema (su cuenta) o juega en una
  // campaña que lo usa. Sus bytes no cambian para una ruta hasta que se vuelve a importar (la huella va en la etiqueta)
  app.get('/api/system-images/:systemId', async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = z.object({ systemId: z.uuid() }).safeParse(request.params)
    const path = String((request.query as Record<string, unknown>).path ?? '')
    if (!params.success || !path || !env.storage) return reply.code(404).send({ code: 'NOT_FOUND' })
    const system = await systemsRepo.findSystem(ctx.db, params.data.systemId)
    const reads =
      system &&
      (can(ctx.actor, 'systems.read', { organizationId: system.organizationId }) ||
        (await campaignsRepo.campaignsUsingSystems(ctx.db, [system.id])).some((c) =>
          can(ctx.actor, 'campaign.read', { campaignId: c.id, worldId: c.worldId })
        ))
    const image = reads ? await systemImagesRepo.findImage(ctx.db, params.data.systemId, path) : null
    if (!image) return reply.code(404).send({ code: 'NOT_FOUND' })
    const etag = `"${image.storageKey}"`
    reply
      .header('cache-control', 'private, max-age=86400, stale-while-revalidate=604800')
      .header('etag', etag)
      .header('x-content-type-options', 'nosniff')
      .header('cross-origin-resource-policy', 'same-origin')
      .header('content-type', image.mime)
      .header('content-length', image.bytes)
    if (image.mime === 'image/svg+xml')
      reply.header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
    if (request.headers['if-none-match'] === etag) return reply.code(304).send()
    return reply.send(env.storage.read(image.storageKey))
  })

  app.get('/api/files/:id', async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = fileParams.safeParse(request.params)
    if (!params.success || !env.storage) return reply.code(404).send({ code: 'NOT_FOUND' })
    let file: Awaited<ReturnType<typeof authorizedFile>>['file']
    let player = false
    try {
      ;({ file } = await authorizedFile(ctx, 'page.read', params.data.id))
    } catch (error) {
      // Un jugador (ADR-0017): si está en algo que ve en alguna de sus campañas
      const found = await playerFile(ctx, params.data.id)
      if (!found) return fail(reply, error)
      file = found
      player = true
    }
    const etag = `"${file.hash}"`
    // Privada: solo el navegador de quien la pidió. Con su versión en la dirección (?v=), esos bytes no cambian nunca:
    // se guardan sin volver a preguntar. Sin ella (una portada), se enseña al momento lo guardado y se comprueba por
    // detrás con la huella (reemplazar cambia los bytes)
    const versioned = String((request.query as Record<string, unknown>).v ?? '') === String(file.version)
    reply
      .header(
        'cache-control',
        // A un jugador, sin guardar: si se lo ocultan, la próxima vez ya no lo tiene (con la huella, no se vuelve a bajar)
        player
          ? 'private, no-cache'
          : versioned
            ? 'private, max-age=31536000, immutable'
            : 'private, max-age=0, stale-while-revalidate=604800'
      )
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
