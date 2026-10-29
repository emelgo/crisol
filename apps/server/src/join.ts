/**
 * Unirse a una campaña con su enlace. Abrir el enlace (GET) nunca une a nadie: los bots de vista previa de WhatsApp y
 * Discord lo abren. Unirse es un POST, con sesión o creando la cuenta en la misma petición (el enlace es el pase de
 * alta; el registro sigue cerrado para todo lo demás).
 */
import { bootstrapRepo, invitationsRepo } from '@crisol/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { ActionEnv } from './actions/context.ts'
import type { Auth } from './auth/auth.ts'
import { signUpAllowed } from './auth/signup.ts'
import { toHeaders } from './http.ts'
import { invitationChanged, memberJoined, membersChanged } from './realtime/events.ts'
import { hashSecret } from './secrets.ts'

const INVALID = { code: 'INVALID_LINK' } as const

/** El enlace, si vale y las invitaciones están abiertas */
async function validLink(env: ActionEnv, secret: string) {
  const found = await invitationsRepo.findInvitationByHash(env.db, hashSecret(secret))
  return found?.invitation.open ? found : null
}

type Link = NonNullable<Awaited<ReturnType<typeof validLink>>>

async function join(env: ActionEnv, link: Link, user: { id: string; name: string }) {
  const userId = user.id
  const result = await invitationsRepo.joinCampaign(
    env.db,
    {
      organizationId: link.organizationId,
      worldId: link.worldId,
      actorId: userId,
      via: 'ui',
      action: 'joinCampaign',
      details: { campaign: link.campaignName, world: link.worldName }
    },
    {
      invitationId: link.invitation.id,
      tokenHash: link.invitation.tokenHash,
      campaignId: link.invitation.campaignId,
      organizationId: link.organizationId,
      userId
    }
  )
  if (result.status === 'joined') {
    const scope = { campaignId: link.invitation.campaignId, worldId: link.worldId }
    env.realtime.publish(
      memberJoined(scope, link.campaignName, { userId, name: user.name }),
      membersChanged(scope),
      invitationChanged(scope),
      // Sus otras pestañas: tiene un mundo más
      { to: { userId }, message: { type: 'changed', what: 'worlds' } }
    )
  }
  return { ...result, campaignId: link.invitation.campaignId, worldId: link.worldId }
}

const signupInput = z.object({
  secret: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(10).max(128)
})

/** Clave del límite de intentos: la IP que manda Caddy (la app solo escucha en loopback, detrás de él) */
const clientIp = (request: FastifyRequest) => {
  const forwarded = request.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || request.ip
}
const limited = { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: clientIp } }

export function registerJoinRoutes(app: FastifyInstance, env: ActionEnv, auth: Auth) {
  // Con sesión, además, por cuenta (la spec pide los dos): cambiar de IP no da más intentos. Se mira en la ruta, con la
  // sesión ya leída (la librería solo aplica un límite por petición)
  const accountOf = new WeakMap<FastifyRequest, string>()
  const perAccount = app.createRateLimit({
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (request) => `cuenta:${accountOf.get(request) ?? ''}`
  })
  app.get<{ Params: { secret: string } }>('/api/join/:secret', { config: limited }, async (request, reply) => {
    const link = await validLink(env, request.params.secret)
    if (!link) return reply.code(404).send(INVALID)
    return {
      campaignName: link.campaignName,
      worldName: link.worldName,
      masterName: await invitationsRepo.campaignMasterName(env.db, link.invitation.campaignId)
    }
  })

  app.post('/api/join', { config: limited }, async (request, reply) => {
    const secret = z.object({ secret: z.string().min(1) }).safeParse(request.body)
    if (!secret.success) return reply.code(400).send({ code: 'INVALID_INPUT' })
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    accountOf.set(request, session.user.id)
    const limit = await perAccount(request)
    if (!limit.isAllowed && limit.isExceeded) return reply.code(429).send({ code: 'TOO_MANY_REQUESTS' })
    const link = await validLink(env, secret.data.secret)
    if (!link) return reply.code(404).send(INVALID)
    const result = await join(env, link, session.user)
    if (result.status === 'closed') return reply.code(404).send(INVALID)
    return result
  })

  app.post('/api/join/signup', { config: limited }, async (request, reply) => {
    const input = signupInput.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })
    const link = await validLink(env, input.data.secret)
    if (!link) return reply.code(404).send(INVALID)

    const { name, email, password } = input.data
    const created = await signUpAllowed(auth, { name, email, password })
    if (!created) return reply.code(409).send({ code: 'EMAIL_TAKEN' })
    // Sin entrar no hay alta (el registro está cerrado): si el enlace dejó de valer mientras se creaba la cuenta, o
    // algo falla al unirla, la cuenta se borra
    const drop = () => bootstrapRepo.deleteUser(env.db, created.response.user.id)
    const result = await join(env, link, created.response.user).catch(async (error: unknown) => {
      await drop()
      throw error
    })
    if (result.status === 'closed') {
      await drop()
      return reply.code(404).send(INVALID)
    }
    const cookies = created.headers.getSetCookie()
    if (cookies.length > 0) reply.header('set-cookie', cookies)
    return reply.code(201).send(result)
  })
}
