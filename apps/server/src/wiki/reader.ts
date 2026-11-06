/**
 * Quién lee la wiki de un mundo y lo que ve (ADR-0017). El servidor lo decide con la sesión y la campaña pedida, nunca
 * con lo que diga el cliente: el máster (o el propietario) lo ve todo; un jugador, lo que sabe su campaña por sus
 * personajes; el máster puede leer como un personaje de una campaña («Ver como jugador»)
 */
import { campaignsRepo, charactersRepo, knowledgeRepo, worldsRepo } from '@crisol/db'
import {
  authorize,
  can,
  explainPage,
  type Knowledge,
  type KnowledgeKind,
  knowledgeFor,
  NotFoundError,
  type Reader
} from '@crisol/domain'
import type { WikiTarget } from '../actions/access.ts'
import { type ActionContext, InvalidRequestError } from '../actions/context.ts'

/** Cómo pide leer: en qué campaña y, el máster, como qué personaje («campaign»: la campaña, sin excepciones) */
export interface ReadAs {
  campaignId?: string | undefined
  asCharacterId?: string | 'campaign' | undefined
}

/** Lo que ve quien lee: todo (el máster) o lo que decide el motor */
export class WikiView {
  readonly reader: Reader
  private readonly knowledge: Knowledge | null

  constructor(reader: Reader, knowledge: Knowledge | null) {
    this.reader = reader
    this.knowledge = knowledge
  }

  /** Lo ve todo, sin filtrar (el máster leyendo como máster) */
  get full(): boolean {
    return this.knowledge === null
  }

  /** La campaña desde la que lee un jugador (o el máster viendo como uno) */
  get campaignId(): string | null {
    return this.reader.kind === 'player' ? this.reader.campaignId : null
  }

  seesPage(pageId: string): boolean {
    return this.knowledge?.seesPage(pageId) ?? true
  }

  /** Las que ve de esas, en su orden */
  pages<T>(rows: readonly T[], idOf: (row: T) => string = (row) => (row as { id: string }).id): T[] {
    return this.knowledge ? rows.filter((row) => this.seesPage(idOf(row))) : [...rows]
  }

  /** Las páginas que ve; null: todas */
  visiblePageIds(): string[] | null {
    return this.knowledge ? [...this.knowledge.visiblePages()] : null
  }

  /** Dónde cuelga una página en su árbol: su madre o, si no la ve, la primera antecesora que ve */
  parentOf(pageId: string, parentId: string | null): string | null {
    return this.knowledge ? this.knowledge.visibleParent(pageId) : parentId
  }

  seesSecret(documentId: string, pageId: string): boolean {
    return this.knowledge?.seesSecret(documentId, pageId) ?? true
  }

  seesTab(tab: { id: string; pageId: string; hidden: boolean }): boolean {
    return this.knowledge?.seesTab(tab) ?? true
  }

  seesMapItem(item: { kind: 'pin' | 'element'; id: string; pageId: string; hidden: boolean }): boolean {
    return this.knowledge?.seesMapItem(item) ?? true
  }

  seesContent(id: string): boolean {
    return this.knowledge?.seesContent(id) ?? true
  }
}

const MASTER = new WikiView({ kind: 'master' }, null)

/** Si la cuenta lleva la wiki del mundo (la ve entera) */
export const managesWiki = (ctx: ActionContext, wiki: WikiTarget) => can(ctx.actor, 'page.write', wiki)

/** Las campañas del mundo en las que juega la cuenta */
const campaignsIn = (ctx: ActionContext, worldId: string) =>
  [...ctx.actor.campaigns].filter(([, c]) => c.worldId === worldId).map(([id]) => id)

/** Quién lee: el máster, un jugador en una campaña o el máster como un personaje */
export async function readerFor(ctx: ActionContext, wiki: WikiTarget, as: ReadAs = {}): Promise<Reader> {
  if (managesWiki(ctx, wiki)) {
    if (as.asCharacterId === undefined) return { kind: 'master' }
    if (!as.campaignId) throw new InvalidRequestError('CAMPAIGN_REQUIRED')
    const campaignId = as.campaignId
    // Una campaña de este mundo (en la papelera, no existe)
    const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
    if (!campaign || campaign.worldId !== wiki.worldId) throw new NotFoundError('campaign')
    const knowsWorld = campaign.knowsWorld
    if (as.asCharacterId === 'campaign') return { kind: 'player', campaignId, characterIds: [], knowsWorld }
    const character = await charactersRepo.findCharacter(ctx.db, as.asCharacterId)
    if (!character || character.campaignId !== campaignId) throw new NotFoundError('character')
    return { kind: 'player', campaignId, characterIds: [character.id], knowsWorld }
  }
  // Un jugador: la campaña pedida, o la única que juega en este mundo
  const mine = campaignsIn(ctx, wiki.worldId)
  const campaignId = as.campaignId ?? (mine.length === 1 ? mine[0] : undefined)
  if (!campaignId) throw new InvalidRequestError('CAMPAIGN_REQUIRED')
  if (!mine.includes(campaignId)) throw new NotFoundError('campaign')
  const knows = (await knowledgeRepo.knowsWorld(ctx.db, [campaignId])).get(campaignId) ?? true
  const characterIds = await knowledgeRepo.characterIdsOf(ctx.db, campaignId, ctx.actor.userId)
  return { kind: 'player', campaignId, characterIds, knowsWorld: knows }
}

/** Lo que ve ese lector en el mundo: carga el árbol y las marcas una vez */
export async function viewFor(
  ctx: ActionContext,
  worldId: string,
  reader: Reader,
  kinds?: readonly KnowledgeKind[]
): Promise<WikiView> {
  if (reader.kind === 'master') return MASTER
  const [tree, marks] = await Promise.all([
    knowledgeRepo.worldTree(ctx.db, worldId),
    knowledgeRepo.listMarks(ctx.db, { worldId, campaignIds: [reader.campaignId], ...(kinds ? { kinds } : {}) })
  ])
  return new WikiView(reader, knowledgeFor(reader, tree, marks))
}

/** La wiki del mundo con lo que ve quien la pide (page.view). Un mundo que no existe: 404 */
export async function authorizedView(
  ctx: ActionContext,
  worldId: string,
  as: ReadAs = {}
): Promise<{ wiki: WikiTarget; view: WikiView }> {
  const world = worldId ? await worldsRepo.findWorld(ctx.db, worldId) : null
  const wiki = { worldId, organizationId: world?.organizationId ?? '' }
  authorize(ctx.actor, 'page.view', wiki)
  if (!world) throw new NotFoundError('world')
  return { wiki, view: await viewFor(ctx, worldId, await readerFor(ctx, wiki, as)) }
}

/** Si alguna campaña del mundo (o todo el mundo) ve esa página: lo que se crea debajo nace oculto (ADR-0017) */
export async function knownBySomeone(ctx: ActionContext, worldId: string, pageId: string): Promise<boolean> {
  const [tree, marks, campaigns] = await Promise.all([
    knowledgeRepo.worldTree(ctx.db, worldId),
    knowledgeRepo.listMarks(ctx.db, { worldId, campaignIds: 'all', kinds: ['page'] }),
    campaignsRepo.listCampaigns(ctx.db, { worldId, userId: ctx.actor.userId, onlyMember: false })
  ])
  if (marks.length === 0) return false
  const explained = explainPage(pageId, tree, marks, campaigns)
  return explained.world.known || explained.campaigns.some((c) => c.audience !== 'none')
}

/** Lo que un jugador puede encontrar al buscar: las páginas que ve y sus secretos y pestañas de texto visibles (null: todo) */
export async function searchScope(
  ctx: Pick<ActionContext, 'db'>,
  worldId: string,
  view: WikiView
): Promise<{ pages: string[]; separates: string[] } | null> {
  const pages = view.visiblePageIds()
  if (!pages) return null
  const separates = (await knowledgeRepo.separatesOf(ctx.db, worldId)).filter((doc) =>
    doc.kind === 'secret'
      ? view.seesSecret(doc.id, doc.pageId)
      : doc.tabId !== null && view.seesTab({ id: doc.tabId, pageId: doc.pageId, hidden: doc.hidden ?? false })
  )
  return { pages, separates: separates.map((doc) => doc.id) }
}
