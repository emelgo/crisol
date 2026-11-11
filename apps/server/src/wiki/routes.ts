/** Las rutas de la wiki que no son acciones: exportar devuelve un .zip, no JSON */
import { exportInput } from '@crisol/contracts'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authorizedPage } from '../actions/access.ts'
import type { ActionEnv } from '../actions/context.ts'
import type { Auth } from '../auth/auth.ts'
import { clientIp, toHeaders } from '../http.ts'
import { exportZip, fileName } from './export.ts'
import type { PdfRenderer } from './pdf.ts'

const pdfParams = z.object({ id: z.uuid() })

export function registerWikiRoutes(app: FastifyInstance, env: ActionEnv, auth: Auth, pdf?: PdfRenderer) {
  // Exportar un mundo entero pesa: pocas veces seguidas
  app.post(
    '/api/export',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: clientIp } } },
    async (request, reply) => {
      const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
      if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
      const input = exportInput.safeParse(request.body ?? {})
      if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })
      const actor = actorFrom(session.user.id, await loadMemberships(env.db, session.user.id))
      try {
        const { name, zip } = await exportZip({ ...env, actor, via: 'ui' }, input.data)
        const ascii =
          name
            .normalize('NFD')
            .replace(/[^\x20-\x7e]/g, '')
            .replace(/"/g, '') || 'wiki'
        return reply
          .header('content-type', 'application/zip')
          .header(
            'content-disposition',
            `attachment; filename="${ascii}.zip"; filename*=UTF-8''${encodeURIComponent(`${name}.zip`)}`
          )
          .header('cache-control', 'no-store')
          .send(zip)
      } catch (error) {
        if (error instanceof NotFoundError) return reply.code(404).send({ code: 'NOT_FOUND' })
        if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
        throw error
      }
    }
  )

  // El PDF de la hoja de una página: lo saca Chromium de la ruta de impresión. Pesa: pocas veces seguidas
  app.get(
    '/api/pages/:id/pdf',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: clientIp } } },
    async (request, reply) => {
      const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
      if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
      const params = pdfParams.safeParse(request.params)
      if (!params.success) return reply.code(404).send({ code: 'NOT_FOUND' })
      const actor = actorFrom(session.user.id, await loadMemberships(env.db, session.user.id))
      let found: Awaited<ReturnType<typeof authorizedPage>>
      try {
        found = await authorizedPage({ ...env, actor, via: 'ui' }, 'page.read', params.data.id)
      } catch (error) {
        if (error instanceof NotFoundError) return reply.code(404).send({ code: 'NOT_FOUND' })
        if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
        throw error
      }
      if (!pdf) return reply.code(503).send({ code: 'PDF_UNAVAILABLE' })
      const query = request.query as Record<string, unknown>
      // Los secretos, si se piden; el aspecto de esta impresión (sin él, el de la página)
      const look = ['color', 'neutro', 'pergamino'].includes(String(query.tema)) ? String(query.tema) : null
      const search = new URLSearchParams({
        ...(query.secretos === '1' ? { secretos: '1' } : {}),
        ...(look ? { tema: look } : {})
      })
      const path = `/mundos/${found.wiki.worldId}/imprimir/${found.page.id}${search.size ? `?${search}` : ''}`
      let bytes: Buffer
      try {
        bytes = await pdf.render(path, request.headers.cookie ?? '')
      } catch (error) {
        request.log.error(error, 'No se pudo sacar el PDF')
        return reply.code(503).send({ code: 'PDF_UNAVAILABLE' })
      }
      const name = fileName(found.page.title)
      const ascii =
        name
          .normalize('NFD')
          .replace(/[^\x20-\x7e]/g, '')
          .replace(/"/g, '') || 'hoja'
      return reply
        .header('content-type', 'application/pdf')
        .header(
          'content-disposition',
          `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`
        )
        .header('cache-control', 'no-store')
        .send(bytes)
    }
  )
}
