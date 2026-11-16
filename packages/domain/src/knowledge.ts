/**
 * Lo que sabe cada campaña (ADR-0017): qué páginas, secretos, pestañas, pines y entradas del mundo ve quien lee.
 *
 * - Dos capas: la del mundo (marcas sin campaña: lo que sabe todo el mundo) y la de cada campaña, que manda sobre la
 *   del mundo en la misma cosa. Una campaña que empieza de cero no mira lo que el mundo conoce, pero sí lo que oculta
 *   («No lo sabe nadie»: lo nuevo bajo una página conocida nace así).
 * - Páginas: se sube desde la página y manda la primera marca que se encuentre. Sin ninguna, solo el máster. La
 *   herencia es viva porque se calcula al leer.
 * - Por personajes: una marca «la conocen» con personajes la ve la cuenta de sus dueños. En la capa del mundo y en las
 *   marcas «no la conocen», el público no cuenta.
 * - Secretos: su página y su marca. Pestañas, pines y regiones: siguen a su página, salvo su marca (de la campaña o del
 *   mundo) o `hidden` (la marca del mundo que ya tenían). Entradas del mundo: solo con su marca.
 * - Cronologías (módulo 8): solo con su marca, como las entradas del mundo. Sus eventos sueltos se ven salvo `hidden` o
 *   su marca (no cuelgan de ninguna página: siguen a la cronología en la que se leen).
 */
import { MAX_PAGE_DEPTH } from './tree.ts'

export type KnowledgeKind = 'page' | 'secret' | 'tab' | 'pin' | 'element' | 'content' | 'event' | 'chronology'

/** Una marca: en el mundo (campaignId null) o en una campaña */
export interface KnowledgeMark {
  campaignId: string | null
  kind: KnowledgeKind
  /** El id de la página, el documento del secreto, la pestaña, el pin o la región; la clave de la entrada */
  targetId: string
  /** La conocen o no la conocen */
  known: boolean
  /** null: todos; si no, los personajes que la conocen */
  characters: readonly string[] | null
}

/** Quién lee: el máster (lo ve todo) o un jugador de una campaña con sus personajes (o el máster viendo como uno) */
export type Reader =
  | { kind: 'master' }
  | { kind: 'player'; campaignId: string; characterIds: readonly string[]; knowsWorld: boolean }

export interface TreePage {
  id: string
  parentId: string | null
}

export interface Knowledge {
  seesPage(pageId: string): boolean
  /** Las páginas que ve */
  visiblePages(): ReadonlySet<string>
  /** La primera antecesora que ve (donde cuelga en su árbol), o null: arriba del todo */
  visibleParent(pageId: string): string | null
  /** Si en su árbol le cuelga alguna página */
  hasVisibleChildren(pageId: string): boolean
  seesSecret(documentId: string, pageId: string): boolean
  seesTab(tab: { id: string; pageId: string; hidden: boolean }): boolean
  /** Un pin o un elemento (región, ruta, etiqueta) de un mapa de esa página */
  seesMapItem(item: { kind: 'pin' | 'element'; id: string; pageId: string; hidden: boolean }): boolean
  seesContent(key: string): boolean
  /** Una cronología del mundo: solo con su marca */
  seesChronology(id: string): boolean
  /** Un evento suelto de las cronologías: su marca o, sin ella, visible salvo oculto */
  seesEvent(event: { id: string; hidden: boolean }): boolean
}

// La capa del mundo, con una marca que no puede ser el id de una campaña
const keyOf = (campaignId: string | null, kind: KnowledgeKind, targetId: string) =>
  `${campaignId ?? '*'}|${kind}|${targetId}`

function indexMarks(marks: readonly KnowledgeMark[]) {
  const byKey = new Map<string, KnowledgeMark>()
  for (const mark of marks) byKey.set(keyOf(mark.campaignId, mark.kind, mark.targetId), mark)
  return byKey
}

/** La marca del mundo, si cuenta: siempre lo que oculta; lo que conoce, solo si la campaña parte del mundo */
const worldMark = (mark: KnowledgeMark | undefined, knowsWorld: boolean) =>
  mark && (knowsWorld || !mark.known) ? mark : undefined

/** Si una marca deja ver a quien tiene esos personajes */
function admits(mark: KnowledgeMark, characterIds: readonly string[]): boolean {
  if (!mark.known) return false
  if (mark.campaignId === null || mark.characters === null) return true
  return mark.characters.some((id) => characterIds.includes(id))
}

const ALL: Knowledge = {
  seesPage: () => true,
  visiblePages: () => new Set(),
  visibleParent: () => null,
  hasVisibleChildren: () => false,
  seesSecret: () => true,
  seesTab: () => true,
  seesMapItem: () => true,
  seesContent: () => true,
  seesChronology: () => true,
  seesEvent: () => true
}

/** La marca que decide una página en una campaña (o en el mundo, sin campaña), con la página donde está */
function decider(
  parents: ReadonlyMap<string, string | null>,
  byKey: ReadonlyMap<string, KnowledgeMark>,
  campaignId: string | null,
  knowsWorld: boolean
) {
  const memo = new Map<string, { mark: KnowledgeMark; pageId: string } | null>()
  const decide = (pageId: string): { mark: KnowledgeMark; pageId: string } | null => {
    const known = memo.get(pageId)
    if (known !== undefined) return known
    // Subir sin recursión, guardando lo que se recorre para darle a todo la misma respuesta
    const path: string[] = []
    let current: string | null = pageId
    let found: { mark: KnowledgeMark; pageId: string } | null = null
    while (current !== null && path.length <= MAX_PAGE_DEPTH * 2) {
      const cached = memo.get(current)
      if (cached !== undefined) {
        found = cached
        break
      }
      path.push(current)
      const own =
        (campaignId !== null ? byKey.get(keyOf(campaignId, 'page', current)) : undefined) ??
        worldMark(byKey.get(keyOf(null, 'page', current)), knowsWorld)
      if (own) {
        found = { mark: own, pageId: current }
        break
      }
      current = parents.get(current) ?? null
    }
    for (const id of path) memo.set(id, found)
    return found
  }
  return decide
}

export function knowledgeFor(reader: Reader, tree: readonly TreePage[], marks: readonly KnowledgeMark[]): Knowledge {
  const parents = new Map(tree.map((p) => [p.id, p.parentId]))
  if (reader.kind === 'master') {
    const withChildren = new Set([...parents.values()].filter((id): id is string => id !== null))
    return {
      ...ALL,
      visiblePages: () => new Set(parents.keys()),
      visibleParent: (id) => parents.get(id) ?? null,
      hasVisibleChildren: (id) => withChildren.has(id)
    }
  }

  const byKey = indexMarks(marks)
  const { campaignId, characterIds, knowsWorld } = reader
  const decide = decider(parents, byKey, campaignId, knowsWorld)
  const seesPage = (pageId: string) => {
    if (!parents.has(pageId)) return false
    const decided = decide(pageId)
    return decided !== null && admits(decided.mark, characterIds)
  }
  /** La marca propia de algo que no hereda: la de la campaña y, si parte del mundo, la del mundo */
  const flat = (kind: KnowledgeKind, targetId: string) =>
    byKey.get(keyOf(campaignId, kind, targetId)) ?? worldMark(byKey.get(keyOf(null, kind, targetId)), knowsWorld)
  /** Lo que sigue a su página: su marca o, sin ella, visible salvo oculto */
  const follows = (kind: KnowledgeKind, id: string, pageId: string, hidden: boolean) => {
    if (!seesPage(pageId)) return false
    const own = flat(kind, id)
    return own ? admits(own, characterIds) : !hidden
  }
  let visible: Set<string> | null = null
  let withChildren: Set<string> | null = null
  const visibleParent = (pageId: string) => {
    let current = parents.get(pageId) ?? null
    for (let steps = 0; current !== null && steps <= MAX_PAGE_DEPTH * 2; steps++) {
      if (seesPage(current)) return current
      current = parents.get(current) ?? null
    }
    return null
  }
  const visiblePages = () => {
    visible ??= new Set([...parents.keys()].filter(seesPage))
    return visible
  }

  return {
    seesPage,
    visiblePages,
    visibleParent,
    hasVisibleChildren(pageId) {
      withChildren ??= new Set([...visiblePages()].map(visibleParent).filter((id): id is string => id !== null))
      return withChildren.has(pageId)
    },
    seesSecret(documentId, pageId) {
      const own = flat('secret', documentId)
      return seesPage(pageId) && own !== undefined && admits(own, characterIds)
    },
    seesTab: (tab) => follows('tab', tab.id, tab.pageId, tab.hidden),
    seesMapItem: (item) => follows(item.kind, item.id, item.pageId, item.hidden),
    seesContent(key) {
      const own = flat('content', key)
      return own !== undefined && admits(own, characterIds)
    },
    seesChronology(id) {
      const own = flat('chronology', id)
      return own !== undefined && admits(own, characterIds)
    },
    seesEvent(event) {
      const own = flat('event', event.id)
      return own ? admits(own, characterIds) : !event.hidden
    }
  }
}

/** De dónde viene lo que se ve: la página con la marca que decide y su capa */
export interface KnowledgeSource {
  pageId: string
  layer: 'world' | 'campaign'
}

/** Lo que ve una campaña de una página, para el máster */
export interface CampaignPageKnowledge {
  campaignId: string
  /** Su marca en esta página, si tiene */
  own: { known: boolean; characters: readonly string[] | null } | null
  /** Quién la ve: toda la campaña, nadie o esos personajes */
  audience: 'all' | 'none' | readonly string[]
  from: KnowledgeSource | null
}

export interface PageKnowledge {
  world: { own: { known: boolean } | null; known: boolean; from: KnowledgeSource | null }
  campaigns: CampaignPageKnowledge[]
}

/** Lo que ve cada campaña de una página y por qué (el panel «Quién la conoce») */
export function explainPage(
  pageId: string,
  tree: readonly TreePage[],
  marks: readonly KnowledgeMark[],
  campaigns: ReadonlyArray<{ id: string; knowsWorld: boolean }>
): PageKnowledge {
  const parents = new Map(tree.map((p) => [p.id, p.parentId]))
  const byKey = indexMarks(marks)
  const worldOwn = byKey.get(keyOf(null, 'page', pageId))
  const worldDecided = decider(parents, byKey, null, true)(pageId)
  return {
    world: {
      own: worldOwn ? { known: worldOwn.known } : null,
      known: worldDecided?.mark.known ?? false,
      from: worldDecided ? { pageId: worldDecided.pageId, layer: 'world' } : null
    },
    campaigns: campaigns.map((campaign) => {
      const own = byKey.get(keyOf(campaign.id, 'page', pageId))
      const decided = decider(parents, byKey, campaign.id, campaign.knowsWorld)(pageId)
      const mark = decided?.mark
      const audience: CampaignPageKnowledge['audience'] = !mark?.known
        ? 'none'
        : mark.campaignId === null || mark.characters === null
          ? 'all'
          : mark.characters
      return {
        campaignId: campaign.id,
        own: own ? { known: own.known, characters: own.characters } : null,
        audience,
        from: decided
          ? { pageId: decided.pageId, layer: decided.mark.campaignId === null ? 'world' : 'campaign' }
          : null
      }
    })
  }
}
