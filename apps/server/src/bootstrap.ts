/**
 * Arranque: la primera cuenta, la del propietario, se crea con un enlace de un solo uso que da `pnpm crisol arranque`.
 * Sin ese enlace nadie puede crear la primera cuenta (el registro está cerrado).
 */
import { type Database, schema } from '@crisol/db'
import { APIError } from 'better-auth/api'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Auth } from './auth/auth.ts'
import { allowSignup } from './auth/signup-gate.ts'
import { hashSecret, newSecret } from './secrets.ts'

const { bootstrapTokens, organizationMembers, organizations, user } = schema
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
export async function issueBootstrap(db: Database, options: { organizationName?: string; now?: Date }) {
  const now = options.now ?? new Date()
  return db.transaction(async (tx) => {
    const [owner] = await tx.select().from(organizationMembers).where(eq(organizationMembers.role, 'owner')).limit(1)
    if (owner) throw new BootstrapError('OWNER_EXISTS')
    const [existing] = await tx.select().from(organizations).limit(1)
    const organization = existing ?? (await createOrganization(tx, options.organizationName))
    await tx
      .delete(bootstrapTokens)
      .where(and(eq(bootstrapTokens.organizationId, organization.id), isNull(bootstrapTokens.usedAt)))
    const secret = newSecret()
    const expiresAt = new Date(now.getTime() + DAY)
    await tx
      .insert(bootstrapTokens)
      .values({ organizationId: organization.id, tokenHash: hashSecret(secret), expiresAt })
    return { secret, organizationId: organization.id, organizationName: organization.name, expiresAt }
  })
}

async function createOrganization(tx: Pick<Database, 'insert'>, name: string | undefined) {
  const trimmed = name?.trim()
  if (!trimmed) throw new BootstrapError('ORGANIZATION_NAME_REQUIRED')
  const [created] = await tx.insert(organizations).values({ name: trimmed }).returning()
  if (!created) throw new Error('No se pudo crear la organización')
  return created
}

/** La organización a la que da entrada un enlace válido, o null */
export async function peekBootstrap(db: Database, secret: string, now = new Date()) {
  const [row] = await db
    .select({ organizationName: organizations.name })
    .from(bootstrapTokens)
    .innerJoin(organizations, eq(organizations.id, bootstrapTokens.organizationId))
    .where(validToken(secret, now))
  return row ?? null
}

function validToken(secret: string, now: Date) {
  return and(
    eq(bootstrapTokens.tokenHash, hashSecret(secret)),
    isNull(bootstrapTokens.usedAt),
    gt(bootstrapTokens.expiresAt, now)
  )
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
  const [token] = await db.update(bootstrapTokens).set({ usedAt: now }).where(validToken(input.secret, now)).returning()
  if (!token) throw new BootstrapError('INVALID_LINK')
  const restore = () => db.update(bootstrapTokens).set({ usedAt: null }).where(eq(bootstrapTokens.id, token.id))

  let created: Awaited<ReturnType<typeof signUp>>
  try {
    created = await signUp(auth, input)
  } catch (error) {
    await restore()
    if (error instanceof APIError && error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      throw new BootstrapError('EMAIL_TAKEN')
    }
    throw error
  }
  const userId = created.response.user.id
  try {
    await db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values({ organizationId: token.organizationId, userId, role: 'owner' })
      await tx.update(bootstrapTokens).set({ usedBy: userId }).where(eq(bootstrapTokens.id, token.id))
    })
  } catch (error) {
    // Sin pertenencia la cuenta no sirve: se deshace todo
    await db.delete(user).where(eq(user.id, userId))
    await restore()
    throw error
  }
  return { headers: created.headers, userId, organizationId: token.organizationId }
}

function signUp(auth: Auth, { name, email, password }: { name: string; email: string; password: string }) {
  return allowSignup(() => auth.api.signUpEmail({ body: { name, email, password }, returnHeaders: true }))
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
