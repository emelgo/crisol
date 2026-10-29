/**
 * Arranque: la primera cuenta, la del propietario, se crea con un enlace de un solo uso que da `pnpm crisol arranque`.
 * Sin ese enlace nadie puede crear la primera cuenta (el registro está cerrado).
 */
import { bootstrapRepo, type Database } from '@crisol/db'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Auth } from './auth/auth.ts'
import { signUpAllowed } from './auth/signup.ts'
import { hashSecret, newSecret } from './secrets.ts'

const DAY = 24 * 60 * 60 * 1000

type BootstrapErrorCode = 'OWNER_EXISTS' | 'ORGANIZATION_NAME_REQUIRED' | 'INVALID_LINK' | 'EMAIL_TAKEN'

export class BootstrapError extends Error {
  readonly code: BootstrapErrorCode

  constructor(code: BootstrapErrorCode) {
    super(code)
    this.code = code
    this.name = 'BootstrapError'
  }
}

/**
 * Da un enlace de arranque (24 h). Si ya hay una organización sin propietario la reutiliza y anula sus enlaces sin
 * usar; si no, crea una con el nombre dado.
 */
export async function issueBootstrap(db: Database, options: { organizationName?: string | undefined; now?: Date }) {
  const now = options.now ?? new Date()
  const secret = newSecret()
  const expiresAt = new Date(now.getTime() + DAY)
  const result = await bootstrapRepo.prepareBootstrap(db, {
    organizationName: options.organizationName,
    tokenHash: hashSecret(secret),
    expiresAt
  })
  if (!result.ok) throw new BootstrapError(result.code)
  return { secret, organizationId: result.organizationId, organizationName: result.organizationName, expiresAt }
}

/** La organización a la que da entrada un enlace válido, o null */
export function peekBootstrap(db: Database, secret: string, now = new Date()) {
  return bootstrapRepo.peekBootstrap(db, hashSecret(secret), now)
}

const redeemInput = z.object({
  secret: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(10).max(128)
})

/**
 * Crea la cuenta del propietario con el enlace. El enlace se gasta primero, de forma atómica, para que dos peticiones
 * a la vez no creen dos propietarios; si algo falla después, se devuelve.
 */
export async function redeemBootstrap(db: Database, auth: Auth, input: z.infer<typeof redeemInput>, now = new Date()) {
  const token = await bootstrapRepo.consumeBootstrap(db, hashSecret(input.secret), now)
  if (!token) throw new BootstrapError('INVALID_LINK')

  let created: Awaited<ReturnType<typeof signUpAllowed>>
  try {
    created = await signUpAllowed(auth, { name: input.name, email: input.email, password: input.password })
  } catch (error) {
    await bootstrapRepo.releaseBootstrap(db, token.id)
    throw error
  }
  if (!created) {
    await bootstrapRepo.releaseBootstrap(db, token.id)
    throw new BootstrapError('EMAIL_TAKEN')
  }
  const userId = created.response.user.id
  try {
    await bootstrapRepo.completeBootstrap(db, { tokenId: token.id, organizationId: token.organizationId, userId })
  } catch (error) {
    // Sin pertenencia la cuenta no sirve: se deshace todo
    await bootstrapRepo.deleteUser(db, userId)
    await bootstrapRepo.releaseBootstrap(db, token.id)
    throw error
  }
  return { headers: created.headers, userId, organizationId: token.organizationId }
}

const STATUS: Record<BootstrapErrorCode, number> = {
  OWNER_EXISTS: 409,
  ORGANIZATION_NAME_REQUIRED: 400,
  INVALID_LINK: 400,
  EMAIL_TAKEN: 409
}

export function registerBootstrapRoutes(app: FastifyInstance, db: Database, auth: Auth) {
  app.get<{ Params: { secret: string } }>('/api/bootstrap/:secret', async (request, reply) => {
    const found = await peekBootstrap(db, request.params.secret)
    if (!found) return reply.code(404).send({ code: 'INVALID_LINK' })
    return found
  })

  app.post('/api/bootstrap', async (request, reply) => {
    const input = redeemInput.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })
    try {
      const result = await redeemBootstrap(db, auth, input.data)
      const cookies = result.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)
      return reply.code(201).send({ userId: result.userId, organizationId: result.organizationId })
    } catch (error) {
      if (error instanceof BootstrapError) return reply.code(STATUS[error.code]).send({ code: error.code })
      throw error
    }
  })
}
