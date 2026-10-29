import { eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { invitationLinks } from '../schema/invitations.ts'
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
    .where(eq(invitationLinks.tokenHash, tokenHash))
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
