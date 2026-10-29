/** Datos del arranque (la cuenta del propietario): la lógica y las cuentas están en apps/server/src/bootstrap.ts */
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { operation } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { bootstrapTokens, organizationMembers, organizations } from '../schema/organizations.ts'

export type PrepareResult =
  | { ok: true; organizationId: string; organizationName: string }
  | { ok: false; code: 'OWNER_EXISTS' | 'ORGANIZATION_NAME_REQUIRED' }

/**
 * Deja un único enlace de arranque válido. Usa la organización que ya haya (sin propietario) o crea una con el nombre
 * dado. Si ya hay propietario, no hace nada.
 */
export function prepareBootstrap(
  db: Database,
  input: { organizationName?: string | undefined; tokenHash: string; expiresAt: Date }
): Promise<PrepareResult> {
  return db.transaction(async (tx) => {
    const [owner] = await tx.select().from(organizationMembers).where(eq(organizationMembers.role, 'owner')).limit(1)
    if (owner) return { ok: false, code: 'OWNER_EXISTS' }
    let [organization] = await tx.select().from(organizations).limit(1)
    if (!organization) {
      const name = input.organizationName?.trim()
      if (!name) return { ok: false, code: 'ORGANIZATION_NAME_REQUIRED' }
      organization = await operation(
        tx,
        { actorId: null, via: 'system', action: 'createOrganization', details: { name } },
        (w) => w.insert(organizations, { name })
      )
    }
    await tx
      .delete(bootstrapTokens)
      .where(and(eq(bootstrapTokens.organizationId, organization.id), isNull(bootstrapTokens.usedAt)))
    await tx
      .insert(bootstrapTokens)
      .values({ organizationId: organization.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt })
    return { ok: true, organizationId: organization.id, organizationName: organization.name }
  })
}

const valid = (tokenHash: string, now: Date) =>
  and(eq(bootstrapTokens.tokenHash, tokenHash), isNull(bootstrapTokens.usedAt), gt(bootstrapTokens.expiresAt, now))

/** La organización a la que da entrada un enlace válido, o null */
export async function peekBootstrap(db: Database, tokenHash: string, now: Date) {
  const [found] = await db
    .select({ organizationName: organizations.name })
    .from(bootstrapTokens)
    .innerJoin(organizations, eq(organizations.id, bootstrapTokens.organizationId))
    .where(valid(tokenHash, now))
  return found ?? null
}

/** Gasta el enlace de forma atómica: de dos peticiones a la vez, solo una lo consigue */
export async function consumeBootstrap(db: Database, tokenHash: string, now: Date) {
  const [token] = await db
    .update(bootstrapTokens)
    .set({ usedAt: now })
    .where(valid(tokenHash, now))
    .returning({ id: bootstrapTokens.id, organizationId: bootstrapTokens.organizationId })
  return token ?? null
}

/** Devuelve un enlace gastado si la cuenta no llegó a crearse */
export async function releaseBootstrap(db: Database, tokenId: string) {
  await db.update(bootstrapTokens).set({ usedAt: null }).where(eq(bootstrapTokens.id, tokenId))
}

/** La cuenta nueva pasa a ser propietaria (queda en el historial) y el enlace apunta quién lo usó */
export function completeBootstrap(db: Database, input: { tokenId: string; organizationId: string; userId: string }) {
  return operation(
    db,
    { organizationId: input.organizationId, actorId: input.userId, via: 'system', action: 'bootstrapOwner' },
    async (w) => {
      await w.insert(organizationMembers, { organizationId: input.organizationId, userId: input.userId, role: 'owner' })
      await w.read.update(bootstrapTokens).set({ usedBy: input.userId }).where(eq(bootstrapTokens.id, input.tokenId))
    }
  )
}

/** Borra una cuenta que se quedó a medias (sin pertenencia) */
export async function deleteUser(db: Database, userId: string) {
  await db.delete(user).where(eq(user.id, userId))
}
