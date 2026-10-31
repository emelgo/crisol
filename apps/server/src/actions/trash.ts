import {
  deleteCampaign,
  deletePage,
  deleteWorld,
  listTrash,
  type RealtimeMessage,
  restoreCampaign,
  restorePage,
  restoreWorld
} from '@crisol/contracts'
import { pagesRepo, trashRepo, worldsRepo } from '@crisol/db'
import { authorize, can, NotFoundError, purgeAt } from '@crisol/domain'
import { campaignsChanged, pagesChanged } from '../realtime/events.ts'
import { resolvePending } from '../wiki/links.ts'
import { authorizedCampaign, authorizedPage, authorizedWiki, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

const worldsChangedFor = (userId: string) => ({
  to: { userId },
  message: { type: 'changed', what: 'worlds' } satisfies RealtimeMessage
})

/** Avisa a quienes estaban (o vuelven a estar): ven un mundo menos o uno más */
function tellPeople(ctx: ActionContext, people: Array<{ userId: string }>) {
  const users = new Set([ctx.actor.userId, ...people.map((p) => p.userId)])
  ctx.realtime.publish(...[...users].map(worldsChangedFor))
}

export const trashActions = [
  implement(deleteWorld, async (ctx, { worldId }) => {
    authorize(ctx.actor, 'world.delete', { worldId })
    const world = await worldsRepo.findWorld(ctx.db, worldId)
    if (!world) throw new NotFoundError('world')
    const people = await trashRepo.peopleOf(ctx.db, { worldId })
    await trashRepo.deleteWorld(ctx.db, historyContext(ctx, 'deleteWorld', { name: world.name }, world), worldId)
    // Los de sus campañas dejan de estar en ellas al momento
    for (const { userId, campaignId } of people) if (campaignId) ctx.realtime.revoke(userId, { worldId, campaignId })
    ctx.collab?.closeWorld(worldId)
    tellPeople(ctx, people)
    return {}
  }),

  implement(deleteCampaign, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.delete', campaignId)
    const people = await trashRepo.peopleOf(ctx.db, { campaignId })
    const world = await worldsRepo.findWorld(ctx.db, campaign.worldId)
    await trashRepo.deleteCampaign(
      ctx.db,
      historyContext(ctx, 'deleteCampaign', { name: campaign.name, world: world?.name ?? '' }, campaign),
      campaignId
    )
    const scope = { campaignId, worldId: campaign.worldId }
    for (const { userId } of people) ctx.realtime.revoke(userId, scope)
    ctx.realtime.publish(campaignsChanged(scope))
    return {}
  }),

  implement(deletePage, async (ctx, { pageId }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const below = await pagesRepo.deletePageTree(
      ctx.db,
      historyContext(ctx, 'deletePage', { title: page.title }, wiki),
      pageId
    )
    // Quien las tenga abiertas deja de editarlas
    ctx.collab?.closePages([pageId, ...below])
    ctx.realtime.publish(pagesChanged(wiki))
    return { subpages: below.length }
  }),

  implement(restorePage, async (ctx, { pageId }) => {
    const page = await pagesRepo.findTrashedPage(ctx.db, pageId)
    const wiki = await authorizedWiki(ctx, 'page.write', page?.worldId ?? '')
    if (!page) throw new NotFoundError('page')
    // Si su madre también está en la papelera, volvería sin sitio en el árbol: se restaura la madre
    if (page.parentInTrash) throw new InvalidRequestError('PARENT_IN_TRASH')
    await pagesRepo.restorePageTree(ctx.db, historyContext(ctx, 'restorePage', { title: page.title }, wiki), pageId)
    ctx.realtime.publish(pagesChanged(wiki))
    // Vuelve su nombre: lo que lo esperaba la encuentra
    await resolvePending(ctx, wiki.worldId, ctx.actor.userId, [page.title])
    return { id: page.id, name: page.title }
  }),

  implement(listTrash, async (ctx, { worldId, organizationId }) => {
    let scope: trashRepo.TrashScope
    if (worldId) {
      authorize(ctx.actor, 'world.trash', { worldId })
      scope = { worldId }
    } else {
      const target = targetOrganization(ctx, organizationId)
      authorize(ctx.actor, 'organization.trash', { organizationId: target })
      scope = { organizationId: target }
    }
    const all = await trashRepo.listTrash(ctx.db, scope)
    // En la de un mundo, los comunes solo para quien puede restaurarlos (quien administra la organización)
    const owner = 'worldId' in scope ? (await worldsRepo.findWorld(ctx.db, scope.worldId))?.organizationId : undefined
    const restoresCommon = owner !== undefined && can(ctx.actor, 'commonFiles.write', { organizationId: owner })
    const items = all.filter(
      (item) => !('worldId' in scope) || item.kind !== 'file' || item.worldId !== null || restoresCommon
    )
    return {
      items: items.map((item) => ({
        ...item,
        deletedAt: item.deletedAt.toISOString(),
        purgeAt: purgeAt(item.deletedAt).toISOString()
      }))
    }
  }),

  implement(restoreWorld, async (ctx, { worldId }) => {
    // Un mundo en la papelera no lo ve ni su máster: lo restaura el propietario, desde la de la organización
    const world = await trashRepo.findTrashedWorld(ctx.db, worldId)
    authorize(ctx.actor, 'organization.trash', { organizationId: world?.organizationId ?? '' })
    if (!world) throw new NotFoundError('world')
    await trashRepo.restoreWorld(ctx.db, historyContext(ctx, 'restoreWorld', { name: world.name }, world), worldId)
    tellPeople(ctx, await trashRepo.peopleOf(ctx.db, { worldId }))
    return { id: world.id, name: world.name }
  }),

  implement(restoreCampaign, async (ctx, { campaignId }) => {
    const campaign = await trashRepo.findTrashedCampaign(ctx.db, campaignId)
    if (campaign?.worldInTrash) {
      authorize(ctx.actor, 'organization.trash', { organizationId: campaign.organizationId })
      throw new InvalidRequestError('WORLD_IN_TRASH')
    }
    authorize(ctx.actor, 'world.trash', { worldId: campaign?.worldId ?? '' })
    if (!campaign) throw new NotFoundError('campaign')
    const world = await worldsRepo.findWorld(ctx.db, campaign.worldId)
    await trashRepo.restoreCampaign(
      ctx.db,
      historyContext(ctx, 'restoreCampaign', { name: campaign.name, world: world?.name ?? '' }, campaign),
      campaignId
    )
    ctx.realtime.publish(campaignsChanged({ campaignId, worldId: campaign.worldId }))
    tellPeople(ctx, await trashRepo.peopleOf(ctx.db, { campaignId }))
    return { id: campaign.id, name: campaign.name }
  })
]
