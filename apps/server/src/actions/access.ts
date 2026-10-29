import { campaignsRepo, pagesRepo, worldsRepo } from '@crisol/db'
import { authorize, type Capability, NotFoundError, ownedOrganizations } from '@crisol/domain'
import { type ActionContext, InvalidRequestError } from './context.ts'

/** La campaña, si la cuenta puede hacer eso en ella. Si no existe, se decide como si nadie la viera: 404 */
export async function authorizedCampaign(ctx: ActionContext, capability: Capability, campaignId: string) {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  authorize(ctx.actor, capability, { campaignId, worldId: campaign?.worldId ?? '' })
  if (!campaign) throw new NotFoundError('campaign')
  return campaign
}

/** La organización que se pide o, si no se dice, la única de la que la cuenta es propietaria */
export function targetOrganization(ctx: ActionContext, organizationId: string | undefined): string {
  const owned = ownedOrganizations(ctx.actor)
  const target = organizationId ?? (owned.length === 1 ? owned[0] : undefined)
  if (!target) throw new InvalidRequestError('ORGANIZATION_REQUIRED')
  return target
}

/** La wiki de un mundo, con la organización de su fila: el máster y el propietario la ven (módulo 1) */
export interface WikiTarget {
  worldId: string
  organizationId: string
}

/** La wiki del mundo, si la cuenta puede hacer eso en ella. Un mundo que no existe (o en la papelera): 404 */
export async function authorizedWiki(ctx: ActionContext, capability: Capability, worldId: string): Promise<WikiTarget> {
  // Sin mundo (una página que no existe) no hay nada que buscar: se decide como si nadie la viera
  const world = worldId ? await worldsRepo.findWorld(ctx.db, worldId) : null
  const target = { worldId, organizationId: world?.organizationId ?? '' }
  authorize(ctx.actor, capability, target)
  if (!world) throw new NotFoundError('world')
  return target
}

/** La página (fuera de la papelera) y su wiki, si la cuenta puede hacer eso en ella. Si no, 404 */
export async function authorizedPage(ctx: ActionContext, capability: Capability, pageId: string) {
  const page = await pagesRepo.findPage(ctx.db, pageId)
  const wiki = await authorizedWiki(ctx, capability, page?.worldId ?? '')
  if (!page) throw new NotFoundError('page')
  return { page, wiki }
}
