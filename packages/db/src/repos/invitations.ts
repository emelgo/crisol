import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { invitationLinks } from '../schema/invitations.ts'
import { organizationMembers } from '../schema/organizations.ts'
import { worlds } from '../schema/worlds.ts'

/** Un secreto nuevo ya preparado por el servidor: su hash y su cifrado */
export interface PreparedSecret {
  tokenHash: string
  secretSealed: string
}

export async function findInvitation(db: Database, campaignId: string) {
  const [found] = await db.select().from(invitationLinks).where(eq(invitationLinks.campaignId, campaignId))
  return found ?? null
}

/** El enlace de un secreto, con su campaña, su mundo y su organización (para unirse) */
export async function findInvitationByHash(db: Database, tokenHash: string) {
  const [found] = await db
    .select({
      invitation: invitationLinks,
      campaignName: campaigns.name,
      worldId: worlds.id,
      worldName: worlds.name,
      organizationId: worlds.organizationId
    })
    .from(invitationLinks)
    .innerJoin(campaigns, eq(campaigns.id, invitationLinks.campaignId))
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    // Con la campaña o su mundo en la papelera, el enlace no vale
    .where(and(eq(invitationLinks.tokenHash, tokenHash), isNull(campaigns.deletedAt), isNull(worlds.deletedAt)))
  return found ?? null
}

/** Dentro de una operación: deja un enlace nuevo en la campaña (lo crea o sustituye el anterior, que deja de valer) */
export async function writeInvitation(w: Writer, campaignId: string, secret: PreparedSecret) {
  const [current] = await w.read.select().from(invitationLinks).where(eq(invitationLinks.campaignId, campaignId))
  if (!current) return w.insert(invitationLinks, { campaignId, ...secret })
  return w.update(invitationLinks, current.id, { ...secret, issuedAt: new Date(), joins: 0 })
}

/** Genera un enlace nuevo para la campaña; el anterior deja de valer al momento */
export function regenerateInvitation(
  db: Database,
  context: OperationContext,
  campaignId: string,
  secret: PreparedSecret
) {
  return operation(db, context, (w) => writeInvitation(w, campaignId, secret))
}

/** Abre o cierra las invitaciones sin cambiar el enlace */
export async function setInvitationsOpen(db: Database, context: OperationContext, campaignId: string, open: boolean) {
  const current = await findInvitation(db, campaignId)
  if (!current) return null
  return operation(db, context, (w) => w.update(invitationLinks, current.id, { open }))
}

/** El nombre de quien dirige la campaña (para la página de invitación) */
export async function campaignMasterName(db: Database, campaignId: string) {
  const [found] = await db
    .select({ name: user.name })
    .from(campaignMembers)
    .innerJoin(user, eq(user.id, campaignMembers.userId))
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.role, 'master')))
    .orderBy(asc(campaignMembers.createdAt))
    .limit(1)
  return found?.name ?? null
}

export type JoinResult = { status: 'joined' } | { status: 'member' } | { status: 'master' } | { status: 'closed' }

/**
 * La cuenta entra en la campaña como jugadora con el enlace, en una sola operación: su pertenencia a la campaña, la
 * de la organización si no la tenía y una entrada más en el enlace. Si ya estaba, no cambia nada.
 */
/**
 * Una cuenta a la vez en una organización: entrar en dos campañas a la vez, o entrar y salir, se ponen en fila (la fila
 * de la organización puede no existir aún, y entonces no hay nada que bloquear)
 */
export async function lockMembership(w: Writer, organizationId: string, userId: string) {
  await w.read.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId} || ':' || ${userId}))`)
}

export function joinCampaign(
  db: Database,
  context: OperationContext,
  input: { invitationId: string; tokenHash: string; campaignId: string; organizationId: string; userId: string }
): Promise<JoinResult> {
  return operation(db, context, async (w) => {
    await lockMembership(w, input.organizationId, input.userId)
    // El enlace se bloquea mientras dura la operación: un cierre o un cambio a la vez no se cuela. Con él bloqueado se
    // vuelve a mirar que sea el mismo (no se ha regenerado) y que la campaña no haya ido a la papelera
    const [link] = await w.read
      .select()
      .from(invitationLinks)
      .where(eq(invitationLinks.id, input.invitationId))
      .for('update')
    if (!link?.open || link.tokenHash !== input.tokenHash) return { status: 'closed' }
    const [alive] = await w.read
      .select({ id: campaigns.id })
      .from(campaigns)
      .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
      .where(and(eq(campaigns.id, input.campaignId), isNull(campaigns.deletedAt), isNull(worlds.deletedAt)))
    if (!alive) return { status: 'closed' }
    const [existing] = await w.read
      .select({ role: campaignMembers.role })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, input.campaignId), eq(campaignMembers.userId, input.userId)))
    if (existing) return { status: existing.role === 'master' ? 'master' : 'member' }
    await w.insert(campaignMembers, { campaignId: input.campaignId, userId: input.userId, role: 'player' })
    const [orgMember] = await w.read
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, input.organizationId), eq(organizationMembers.userId, input.userId))
      )
    if (!orgMember) {
      await w.insert(organizationMembers, {
        organizationId: input.organizationId,
        userId: input.userId,
        role: 'member'
      })
    }
    // El contador no pasa por el historial: es una estadística, y si cambiara la fila del enlace, cada entrada
    // impediría deshacer las anteriores
    await w.read
      .update(invitationLinks)
      .set({ joins: sql`${invitationLinks.joins} + 1` })
      .where(eq(invitationLinks.id, link.id))
    return { status: 'joined' }
  })
}
