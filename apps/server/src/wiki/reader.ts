/**
 * Quién lee la wiki de un mundo y lo que ve (ADR-0017). El servidor lo decide con la sesión y la campaña pedida, nunca
 * con lo que diga el cliente: el máster (o el propietario) lo ve todo; un jugador, lo que sabe su campaña por sus
 * personajes; el máster puede leer como un personaje de una campaña («Ver como jugador»)
 */
import { campaignsRepo, charactersRepo, knowledgeRepo, worldsRepo } from '@crisol/db'
import {
  type Actor,
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

  /** Si en su árbol le cuelga alguna (solo para quien no lo ve todo) */
  hasChildren(pageId: string): boolean {
    return this.knowledge?.hasVisibleChildren(pageId) ?? false
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

/** Lo que hace falta para saber quién lee: la base de datos y la cuenta */
type ReaderContext = Pick<ActionContext, 'db' | 'actor'>

/** Si la cuenta lleva la wiki del mundo (la ve entera) */
export const managesWiki = (ctx: ReaderContext, wiki: WikiTarget) => can(ctx.actor, 'page.write', wiki)

/** Las campañas del mundo en las que juega la cuenta */
const campaignsIn = (ctx: ReaderContext, worldId: string) =>
  [...ctx.actor.campaigns].filter(([, c]) => c.worldId === worldId).map(([id]) => id)

/** Quién lee: el máster, un jugador en una campaña o el máster como un personaje */
export async function readerFor(ctx: ReaderContext, wiki: WikiTarget, as: ReadAs = {}): Promise<Reader> {
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
  const [knows, characterIds] = await Promise.all([
    knowledgeRepo.knowsWorld(ctx.db, [campaignId]),
    knowledgeRepo.characterIdsOf(ctx.db, campaignId, ctx.actor.userId)
  ])
  return { kind: 'player', campaignId, characterIds, knowsWorld: knows.get(campaignId) ?? true }
}

/** Lo que ve ese lector en el mundo: carga el árbol y las marcas una vez */
export async function viewFor(
  ctx: ReaderContext,
  worldId: string,
  reader: Reader,
  kinds?: readonly KnowledgeKind[],
  /** El árbol, si ya se pidió (a la vez que se miraba quién lee) */
  early?: Promise<{ id: string; parentId: string | null }[]>
): Promise<WikiView> {
  if (reader.kind === 'master') return MASTER
  const [tree, marks] = await Promise.all([
    early ?? knowledgeRepo.worldTree(ctx.db, worldId),
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
  // Quien no lo ve todo necesita el árbol: se pide a la vez que se mira quién lee
  const full = managesWiki(ctx, wiki) && as.asCharacterId === undefined
  const tree = full ? undefined : knowledgeRepo.worldTree(ctx.db, worldId)
  tree?.catch(() => undefined)
  return { wiki, view: await viewFor(ctx, worldId, await readerFor(ctx, wiki, as), undefined, tree) }
}

/**
 * De lo del compendio del mundo, lo que ve quien lo pide en su campaña: lo que se le reveló (ADR-0017). Sin el árbol:
 * las marcas de contenido no dependen de las páginas. null: quien lleva el mundo, todo
 */
export async function contentSeen(
  ctx: ActionContext,
  wiki: WikiTarget,
  campaignId: string
): Promise<((key: string) => boolean) | null> {
  if (managesWiki(ctx, wiki)) return null
  const reader = await readerFor(ctx, wiki, { campaignId })
  const view = await viewFor(ctx, wiki.worldId, reader, ['content'], Promise.resolve([]))
  return (key) => view.seesContent(key)
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

/**
 * Lo que ve una cuenta desde cada una de sus campañas del mundo, guardado un momento (1,5 s): una página con varias
 * imágenes las pide a la vez y no hace falta calcularlo para cada una. Revocar tarda, como mucho, eso
 */
const RECENT_MS = 1500
const recent = new Map<string, { at: number; views: Promise<WikiView[]> }>()
function recentViews(ctx: ReaderContext, worldId: string): Promise<WikiView[]> {
  const key = `${ctx.actor.userId}|${worldId}`
  const now = Date.now()
  const hit = recent.get(key)
  if (hit && now - hit.at < RECENT_MS) return hit.views
  for (const [k, v] of recent) if (now - v.at >= RECENT_MS) recent.delete(k)
  const wiki = { worldId, organizationId: '' }
  const views = Promise.all(
    campaignsIn(ctx, worldId).map(async (campaignId) =>
      viewFor(ctx, worldId, await readerFor(ctx, wiki, { campaignId }))
    )
  )
  recent.set(key, { at: now, views })
  return views
}

/**
 * Si un jugador puede abrir un archivo del mundo: si está en algo que ve en alguna de sus campañas de ese mundo (la
 * portada o el panel de una página, un documento, un mapa) o es la portada del mundo o de una de sus campañas
 */
export async function playerOpensFile(ctx: ActionContext, worldId: string, fileId: string): Promise<boolean> {
  const mine = campaignsIn(ctx, worldId)
  if (mine.length === 0) return false
  const uses = await knowledgeRepo.fileUses(ctx.db, worldId, fileId)
  if (uses.worldCover || uses.campaignCovers.some((id) => mine.includes(id))) return true
  for (const view of await recentViews(ctx, worldId)) {
    if ([...uses.covers, ...uses.panels].some((pageId) => view.seesPage(pageId))) return true
    if (uses.maps.some((map) => view.seesTab({ id: map.tabId, pageId: map.pageId, hidden: map.hidden }))) return true
    const seesEmbed = (e: (typeof uses.embeds)[number]) =>
      e.kind === 'body'
        ? view.seesPage(e.pageId)
        : e.kind === 'secret'
          ? view.seesSecret(e.documentId, e.pageId)
          : e.kind === 'tab' && e.tabId !== null && view.seesTab({ id: e.tabId, pageId: e.pageId, hidden: e.hidden })
    if (uses.embeds.some(seesEmbed)) return true
  }
  return false
}

/** Qué páginas de un mundo ve una cuenta desde sus campañas allí (para los avisos en tiempo real) */
export async function actorPageView(db: ActionContext['db'], actor: Actor, worldId: string) {
  const ctx = { db, actor }
  const wiki = { worldId, organizationId: '' }
  const views = await Promise.all(
    campaignsIn(ctx, worldId).map(async (campaignId) =>
      viewFor(ctx, worldId, await readerFor(ctx, wiki, { campaignId }))
    )
  )
  return (pageId: string) => views.some((view) => view.seesPage(pageId))
}
