/** API en memoria para las pruebas de componentes: mundos, campañas y sus miembros de una organización */
import type {
  AiMode,
  Approval,
  Campaign,
  CampaignTableView,
  Character,
  CombatView,
  DiceRoll,
  EncounterView,
  FileView,
  FolderView,
  HistoryEntry,
  Invitation,
  LightView,
  MapPinView,
  MapView,
  MarkView,
  Member,
  Organization,
  Page,
  PageProperty,
  PageTables,
  PageTabView,
  PageTemplate,
  RandomTable,
  SceneGrid,
  SceneImported,
  SceneView,
  SceneViewport,
  ScreenCamera,
  SnapshotView,
  TagView,
  TokenView,
  TrashItem,
  WallView,
  WidgetView,
  World
} from '@crisol/contracts'
import { DiceSyntaxError, rollDice as rollFormula, rowFor, tableFormula, tableProblems } from '@crisol/dice'
import {
  applyTemplate,
  BUILT_IN_TEMPLATES,
  builtInTemplate,
  instantiate,
  removeTagIn,
  renameTagIn,
  tagKey,
  tagTree,
  uniqueTags
} from '@crisol/domain'
import {
  addCondition,
  applyChanges,
  applyChoices,
  type Build,
  browseContent,
  CATALOG,
  ChangeError,
  type Choices,
  type ContentItem,
  catalogSystem,
  changeResource,
  characterView,
  coinsOf,
  compendiumEntry,
  compendiumSections,
  compendiumTypes,
  contentDiff,
  contentFingerprint,
  contentTables,
  creatureView,
  damageTaken,
  defensesOf,
  fileName,
  type Mechanics,
  mechanicsText,
  moveCoins as movedCoins,
  newContentKey,
  nextNumbers,
  normalizeChoices,
  PARTY_CONTAINER,
  PartyError,
  type Party as PartyValues,
  type Play,
  partyContainers,
  partyFields,
  pickPaths,
  playedDocument,
  pullFields,
  putInParty,
  putInPlay,
  RollError,
  removeCondition,
  resourcePaths,
  rest,
  SYSTEM_FILE,
  type System,
  searchContent,
  splitCoins as splitEvenly,
  startingPlay,
  systemOverview,
  type Text,
  tableRowOf,
  takeFromParty,
  takeFromPlay,
  textFieldOf,
  textOf,
  toFile,
  tryAction,
  tryFormula as tryFormulaIn,
  tryRoll,
  validateContent,
  validateFile,
  validateSystem,
  visibleContent,
  withCoins,
  withWorld
} from '@crisol/systems'
import { FogGrid, tokensInTemplate } from '@crisol/tabletop'
import { readFoundryZip } from '../systems/foundry-zip.ts'
import { type ActionInput, type ActionName, type ActionOutput, type ApiClient, ApiError } from './client.ts'

export function fakeApi(
  options: {
    organizations?: Organization[]
    worlds?: World[]
    campaigns?: Campaign[]
    /** Por campaña */
    members?: Record<string, Member[]>
    /** De lo más reciente a lo más antiguo */
    history?: HistoryEntry[]
    /** Las operaciones que no se pueden deshacer, con la que lo impide */
    conflicts?: Record<string, HistoryEntry | null>
    /** Lo que pidió la IA de la cuenta */
    approvals?: Approval[]
    /** Los sistemas de la cuenta (documentos), además de los de serie */
    /** Los personajes de las campañas (la cuenta de las pruebas es «yo») */
    characters?: Character[]
    systems?: System[]
    /** El contenido de los de la cuenta, por su id */
    systemContent?: Record<string, ContentItem[]>
    /** El texto de los PDF, por el id del archivo (una página por elemento); sin él, aún sin leer */
    bookPages?: Record<string, string[]>
    /** Las imágenes que nombra lo que se importa de Foundry */
    foundryImages?: Array<{ path: string; credit: string | null }>
    /** El compendio de los mundos: sus entradas, por mundo y sistema (copiadas, con el original del que salen) */
    worldContent?: Array<{ worldId: string; systemId: string; item: ContentItem; copyOf?: ContentItem }>
    /** Las páginas de la wiki, en su orden entre hermanas */
    pages?: Array<{
      id?: string
      worldId: string
      parentId?: string | null
      title: string
      icon?: string | null
      properties?: PageProperty[]
      /** La plantilla de la que salió */
      template?: string
    }>
    /** Los archivos de los mundos (usedBy: cuántas páginas lo usan) */
    files?: Array<Pick<FileView, 'worldId' | 'name'> & Partial<FileView> & { usedBy?: number }>
    /** Las carpetas de los archivos */
    folders?: FolderView[]
    /** Las tiradas de las campañas, en el orden en que se tiraron */
    rolls?: DiceRoll[]
  } = {}
) {
  const organizations = options.organizations ?? []
  const worlds = [...(options.worlds ?? [])]
  const campaigns = [...(options.campaigns ?? [])]
  const history = [...(options.history ?? [])]
  const rolls = [...(options.rolls ?? [])]
  // Lo borrado, con lo que hace falta para devolverlo
  const trash: Array<{ item: TrashItem; world?: World; campaign?: Campaign }> = []
  const DAY = 24 * 60 * 60 * 1000
  const trashed = (kind: TrashItem['kind'], id: string, name: string, world: World | undefined): TrashItem => ({
    kind,
    id,
    name,
    worldId: world?.id ?? '',
    worldName: world?.name ?? '',
    deletedAt: new Date().toISOString(),
    purgeAt: new Date(Date.now() + 30 * DAY).toISOString()
  })

  let fileCount = 0
  // La organización de un archivo: la de su mundo; los comunes (sin mundo), la que digan o la del propietario
  const organizationOf = (worldId: string | null) =>
    worlds.find((w) => w.id === worldId)?.organizationId ??
    organizations.find((o) => o.role === 'owner')?.id ??
    '00000000-0000-4000-8000-0000000000aa'
  const fileOf = (file: Pick<FileView, 'worldId' | 'name'> & Partial<FileView>): FileView => {
    const id = file.id ?? `00000000-0000-4000-8000-${String(++fileCount).padStart(12, '0')}`
    return {
      organizationId: organizationOf(file.worldId),
      kind: 'image',
      mime: 'image/png',
      size: 1024,
      url: `/api/files/${id}`,
      tags: [],
      folderId: null,
      version: 1,
      updatedAt: new Date().toISOString(),
      ...file,
      id
    }
  }
  const files = (options.files ?? []).map(({ usedBy: _, ...file }) => fileOf(file))
  const fileUses = new Map((options.files ?? []).map((file, i) => [files[i]?.id ?? '', file.usedBy ?? 0]))
  const trashedFiles: FileView[] = []
  const folders: FolderView[] = [...(options.folders ?? [])]
  const folderById = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) throw new ApiError('NOT_FOUND', 404)
    return folder
  }
  const fileById = (fileId: string) => {
    const file = files.find((f) => f.id === fileId)
    if (!file) throw new ApiError('NOT_FOUND', 404)
    return file
  }

  const members = new Map(Object.entries(options.members ?? {}).map(([id, list]) => [id, [...list]]))
  const membersOf = (campaignId: string) => ({ members: (members.get(campaignId) ?? []).map((m) => ({ ...m })) })
  const calls: string[] = []
  let aiMode: AiMode = 'copilot'
  const approvals = [...(options.approvals ?? [])]
  const aiSettings = () => ({ mode: aiMode, connectorUrl: 'https://crisol.test/mcp' })
  // Como el servidor: lo aprobado se hace (aquí, sin más) y lo rechazado no
  const decide = (approvalId: string, status: 'done' | 'rejected') => {
    const found = approvals.find((a) => a.id === approvalId)
    if (!found) throw new ApiError('NOT_FOUND', 404)
    if (found.status !== 'pending') throw new ApiError('ALREADY_DECIDED', 400)
    Object.assign(found, { status, decidedAt: new Date().toISOString() })
    return { ...found }
  }
  const invitations = new Map<string, Invitation>()
  const link = () => `https://crisol.test/unirse/${crypto.randomUUID()}`
  const invitationOf = (campaignId: string) => {
    const current = invitations.get(campaignId) ?? {
      campaignId,
      url: link(),
      open: true,
      issuedAt: new Date().toISOString(),
      joins: 0
    }
    invitations.set(campaignId, current)
    return { ...current }
  }

  // La wiki: el orden entre hermanas es el de la lista
  type StoredPage = {
    id: string
    worldId: string
    parentId: string | null
    title: string
    icon: string | null
    properties: PageProperty[]
    locked?: boolean
    cover?: Page['cover']
    sheet?: Page['sheet']
    panel?: Page['panel']
    template?: string | null
    version: number
  }
  const pages: StoredPage[] = (options.pages ?? []).map((page) => ({
    id: page.id ?? crypto.randomUUID(),
    worldId: page.worldId,
    parentId: page.parentId ?? null,
    title: page.title,
    icon: page.icon ?? null,
    properties: page.properties ?? [],
    ...(page.template ? { template: page.template } : {}),
    version: 1
  }))
  // Las páginas borradas, cada una con las subpáginas que se fueron con ella (todas siguen en la lista, apartadas)
  const trashedPages: Array<{ root: StoredPage; below: StoredPage[] }> = []
  // Pestañas y marcadores de la cuenta, por mundo
  type Stored = {
    tabs: { pageId: string; pinned: boolean }[]
    bookmarks: { name: string; pages: string[] }[]
    simplePages?: string[]
  }
  const preferences = new Map<string, Stored>()
  const preferencesOf = (worldId: string): Stored => preferences.get(worldId) ?? { tabs: [], bookmarks: [] }
  const preferencesView = (worldId: string) => {
    const stored = preferencesOf(worldId)
    const titleOf = (id: string) => pages.find((p) => p.id === id)?.title
    return {
      tabs: stored.tabs.flatMap((tab) => {
        const title = titleOf(tab.pageId)
        return title === undefined ? [] : [{ ...tab, title }]
      }),
      bookmarks: stored.bookmarks.map((group) => ({
        name: group.name,
        pages: group.pages.flatMap((id) => {
          const title = titleOf(id)
          return title === undefined ? [] : [{ id, title }]
        })
      })),
      simplePages: [...(stored.simplePages ?? [])]
    }
  }
  const pageById = (pageId: string) => {
    const found = pages.find((page) => page.id === pageId)
    if (!found) throw new ApiError('NOT_FOUND', 404)
    return found
  }
  const childrenOf = (worldId: string, parentId: string | null) =>
    pages.filter((page) => page.worldId === worldId && page.parentId === parentId)
  const summary = (page: StoredPage) => ({
    id: page.id,
    worldId: page.worldId,
    parentId: page.parentId,
    title: page.title,
    icon: page.icon,
    template: page.template ?? null,
    hasChildren: childrenOf(page.worldId, page.id).length > 0,
    version: page.version
  })
  // Las plantillas de la cuenta (las de serie, en el dominio)
  const ownTemplates: Array<PageTemplate & { deleted: boolean }> = []
  const templateById = (id: string): PageTemplate | undefined =>
    (builtInTemplate(id) as PageTemplate | undefined) ?? ownTemplates.find((t) => t.id === id && !t.deleted)
  // Las tablas que se llenan solas, como el servidor: las de su plantilla (o sus copias) con el campo hacia esta página
  const lineOf = (page: StoredPage) =>
    page.template
      ? (builtInTemplate(page.template)?.line ??
        ownTemplates.find((t) => t.id === page.template)?.line ?? [page.template])
      : []
  const tablesOf = (page: StoredPage): PageTables => {
    const blocks = (page.panel ?? []).filter((block) => block.type === 'related')
    const linked = new Map<string, string>()
    const tables = blocks.map((block) => {
      const template = templateById(block.template)
      const rows = pages
        .filter(
          (other) =>
            other.id !== page.id &&
            other.worldId === page.worldId &&
            lineOf(other).includes(block.template) &&
            other.properties.some((p) => p.field === block.field && p.type === 'pages' && p.value.includes(page.id))
        )
        .sort((a, b) => a.title.localeCompare(b.title, 'es'))
        .map((other) => {
          const cells = block.columns.map((column) => other.properties.find((p) => p.field === column) ?? null)
          for (const cell of cells) {
            if (cell?.type === 'pages') {
              for (const id of cell.value) linked.set(id, pages.find((p) => p.id === id)?.title ?? '')
            }
          }
          return { id: other.id, title: other.title, icon: other.icon, cells }
        })
      const usable = !template || template.fields.some((f) => f.field === block.field && f.type === 'pages')
      return {
        blockId: block.id,
        title: block.title,
        problem: usable ? null : ('field' as const),
        columns: block.columns.map((field) => ({
          field,
          name: template?.fields.find((f) => f.field === field)?.name ?? field
        })),
        rows: usable ? rows : [],
        more: false
      }
    })
    return { tables, linked: [...linked].map(([id, title]) => ({ id, title })) }
  }
  const pageView = (page: StoredPage): Page => {
    const path: { id: string; title: string }[] = []
    for (let at: StoredPage | undefined = page; at; at = pages.find((p) => p.id === at?.parentId)) {
      path.unshift({ id: at.id, title: at.title })
    }
    return {
      ...summary(page),
      properties: page.properties.map((p) => ({ ...p })) as PageProperty[],
      locked: page.locked ?? false,
      cover: page.cover ?? null,
      sheet: page.sheet ?? null,
      panel: (page.panel ?? []).map((b) => ({ ...b })),
      path,
      updatedAt: new Date().toISOString()
    }
  }
  /** La pone en la lista delante o detrás de su vecina, o detrás de la última de sus hermanas */
  const place = (page: StoredPage, before?: string, after?: string) => {
    const neighbour = before ?? after
    const siblings = childrenOf(page.worldId, page.parentId).filter((p) => p.id !== page.id)
    const anchor = neighbour ? siblings.find((p) => p.id === neighbour) : siblings.at(-1)
    if (neighbour && !anchor) throw new ApiError('BAD_PLACEMENT', 400)
    const index = anchor ? pages.indexOf(anchor) + (before ? 0 : 1) : pages.length
    pages.splice(index, 0, page)
  }

  // Las etiquetas de la cuenta (ADR-0006): las guardadas y las que llevan páginas y archivos
  const tagRows: { id: string; organizationId: string; name: string; color: TagView['color'] }[] = []
  const tagsOfPage = (page: StoredPage) => {
    const found = page.properties.find((p) => p.name.toLowerCase() === 'etiquetas')
    return found?.type === 'list' ? found.value : []
  }
  const ownOrganization = (organizationId?: string) =>
    organizationId ?? organizations.find((o) => o.role === 'owner')?.id ?? ''
  const catalogOf = (organizationId: string): TagView[] =>
    tagTree<TagView['color']>({
      rows: tagRows.filter((row) => row.organizationId === organizationId),
      pages: pages
        .filter((page) => worlds.find((w) => w.id === page.worldId)?.organizationId === organizationId)
        .map((page) => ({ worldId: page.worldId, tags: tagsOfPage(page) })),
      files: files.filter((file) => file.organizationId === organizationId)
    }).map((node) => ({
      id: node.id,
      name: node.name,
      depth: node.depth,
      color: node.color,
      pages: node.pages,
      files: node.files,
      worlds: [...node.worlds].map(([worldId, count]) => ({
        worldId,
        name: worlds.find((w) => w.id === worldId)?.name ?? '',
        pages: count
      }))
    }))
  const tagIn = (organizationId: string, name: string) => {
    const found = catalogOf(organizationId).find((tag) => tagKey(tag.name) === tagKey(name))
    if (!found) throw new ApiError('TAG_NOT_FOUND', 400)
    return found
  }
  /** Renombra (to) o quita (null) una etiqueta y sus hijas en todo lo que la lleva */
  const retag = (organizationId: string, from: string, to: string | null) => {
    const change = (list: readonly string[]) => (to === null ? removeTagIn(list, from) : renameTagIn(list, from, to))
    let changedPages = 0
    let changedFiles = 0
    for (const page of pages.filter((p) => worlds.find((w) => w.id === p.worldId)?.organizationId === organizationId)) {
      const next = change(tagsOfPage(page))
      if (!next) continue
      page.properties = page.properties.flatMap((p): PageProperty[] =>
        p.name.toLowerCase() !== 'etiquetas'
          ? [p]
          : next.length > 0
            ? [{ name: p.name, type: 'list', value: next }]
            : []
      )
      changedPages++
    }
    for (const file of files.filter((f) => f.organizationId === organizationId)) {
      const next = change(file.tags)
      if (!next) continue
      file.tags = next
      changedFiles++
    }
    for (const row of [...tagRows]) {
      if (row.organizationId !== organizationId) continue
      const next = change([row.name])
      if (!next) continue
      if (next[0]) row.name = next[0]
      else tagRows.splice(tagRows.indexOf(row), 1)
    }
    return { pages: changedPages, files: changedFiles }
  }

  /** Archivos a la papelera y carpetas quitadas con lo que tienen dentro; devuelve cuántos archivos */
  const trashItems = (fileIds: readonly string[], folderIds: readonly string[]) => {
    const gone = new Set<string>()
    let level = [...folderIds]
    while (level.length > 0) {
      for (const id of level) gone.add(id)
      level = folders.filter((f) => f.parentId && level.includes(f.parentId)).map((f) => f.id)
    }
    const doomed = files.filter((file) => fileIds.includes(file.id) || (file.folderId && gone.has(file.folderId)))
    for (const file of doomed) {
      files.splice(files.indexOf(file), 1)
      trashedFiles.unshift({ ...file, folderId: null })
    }
    for (const id of gone)
      folders.splice(
        folders.findIndex((f) => f.id === id),
        1
      )
    return doomed.length
  }

  // La página de portada de cada mundo
  const homes = new Map<string, string>()
  // Las pestañas de las páginas y sus mapas (los pines, dentro de cada mapa)
  const pageTabs: PageTabView[] = []
  const maps: MapView[] = []
  const tabById = (tabId: string) => {
    const tab = pageTabs.find((t) => t.id === tabId)
    if (!tab) throw new ApiError('NOT_FOUND', 404)
    return tab
  }
  const mapById = (mapId: string) => {
    const map = maps.find((m) => m.id === mapId)
    if (!map) throw new ApiError('NOT_FOUND', 404)
    return map
  }
  const pinById = (pinId: string) => {
    for (const map of maps) {
      const pin = map.pins.find((p) => p.id === pinId)
      if (pin) return { map, pin }
    }
    throw new ApiError('NOT_FOUND', 404)
  }
  const copyMap = (map: MapView): MapView => ({ ...map, pins: map.pins.map((pin) => ({ ...pin })) })
  // Las escenas (sueltas, ADR-0020, o una por pestaña «Escena») y la mesa de cada campaña, como el servidor
  type StoredScene = {
    id: string
    worldId: string
    /** La suelta, sin pestaña ni página y con su nombre */
    tabId: string | null
    pageId: string | null
    name: string | null
    image: SceneView['image']
    grid: SceneGrid
    initialView: SceneViewport | null
    imported: SceneImported | null
  }
  const scenes: StoredScene[] = []
  const sceneById = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) throw new ApiError('NOT_FOUND', 404)
    return scene
  }
  const sceneView = (scene: StoredScene): SceneView => ({
    id: scene.id,
    tabId: scene.tabId,
    pageId: scene.pageId,
    pageTitle: scene.pageId ? pageById(scene.pageId).title : null,
    name: scene.name ?? (scene.tabId ? tabById(scene.tabId).name : ''),
    image: scene.image ? { ...scene.image } : null,
    grid: { ...scene.grid },
    initialView: scene.initialView ? { ...scene.initialView } : null,
    hasImported: scene.imported !== null
  })
  type StoredTable = { open: string | null; presented: string | null; hidden: boolean; camera: ScreenCamera }
  const tables = new Map<string, StoredTable>()
  const campaignTableOf = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) throw new ApiError('NOT_FOUND', 404)
    if (campaign.role !== 'master') throw new ApiError('FORBIDDEN', 403)
    const table = tables.get(campaignId) ?? { open: null, presented: null, hidden: false, camera: { mode: 'follow' } }
    tables.set(campaignId, table)
    return { campaign, table }
  }
  const tableView = (campaignId: string): CampaignTableView => {
    const { table } = campaignTableOf(campaignId)
    const of = (id: string | null) => {
      const scene = id ? scenes.find((s) => s.id === id) : undefined
      return scene ? sceneView(scene) : null
    }
    return {
      campaignId,
      open: of(table.open),
      presented: of(table.presented),
      screenHidden: table.hidden,
      camera: structuredClone(table.camera),
      tokens: tokens.filter((token) => token.campaignId === campaignId && token.sceneId === table.open).map(tokenOf),
      combat: combats.has(campaignId) ? sortCombat(combats.get(campaignId) as CombatView) : null,
      vision: table.open ? fakeTableVision(campaignId, table.open) : null,
      marks: tableMarks
        .filter((m) => m.campaignId === campaignId && m.sceneId === table.open)
        .map((m) => withTargets(markOf(m))),
      widgets: widgets.filter((w) => w.campaignId === campaignId).map(widgetOf),
      measureOnScreen: measureOnScreen.has(campaignId)
    }
  }
  /**
   * La visión de la escena abierta, sin calcular lo que ven las fichas: lo explorado y lo visible son lo destapado a mano
   * (menos lo tapado); el grupo no ve las fichas ocultas
   */
  const fogOps = new Map<string, Array<ActionInput<'changeFog'>>>()
  const tileFits = new Map<string, 'whole' | 'cropped'>()
  const base64 = (bytes: Uint8Array) => {
    let text = ''
    for (const byte of bytes) text += String.fromCharCode(byte)
    return btoa(text)
  }
  const fakeTableVision = (campaignId: string, sceneId: string): CampaignTableView['vision'] => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene?.image) return null
    const vision = visionOf(sceneId)
    const mask = new FogGrid(scene.image.width, scene.image.height)
    for (const op of fogOps.get(`${campaignId}|${sceneId}`) ?? []) {
      const value = op.mode === 'reveal'
      if (op.shape === 'rectangle')
        mask.fillRect({ x: op.x ?? 0, y: op.y ?? 0, width: op.width ?? 0, height: op.height ?? 0 }, value)
      else if (op.shape === 'brush') mask.fillBrush(op.points ?? [], op.radius ?? 0, value)
      else if (op.shape === 'lasso') mask.fillPolygon(op.points ?? [], value)
    }
    const encoded = base64(mask.encode())
    return {
      sceneId,
      version: vision.version,
      automaticVision: vision.automaticVision,
      darkness: vision.darkness,
      tileFit: tileFits.get(campaignId) ?? 'whole',
      doors: Object.fromEntries(
        vision.walls.filter((w) => w.door).map((w) => [w.id, doors.get(`${campaignId}|${w.id}`) ?? w.open])
      ),
      explored: encoded,
      visible: encoded,
      notSeen: tokens.filter((t) => t.campaignId === campaignId && t.sceneId === sceneId && t.hidden).map((t) => t.id)
    }
  }
  // Las fichas (de momento, solo de personajes de la campaña) y los encuentros de cada mundo
  type TokenRow = Omit<TokenView, 'actor'> & {
    campaignId: string
    actor: { kind: 'character' | 'creature'; id: string }
  }
  const tokens: TokenRow[] = []
  /** La ficha con lo vital de quien está en ella, leído de su personaje o su criatura en este momento */
  const tokenOf = ({ campaignId: _, actor, ...token }: TokenRow): TokenView => {
    if (actor.kind === 'character') {
      const found = characters.find((c) => c.id === actor.id)
      return structuredClone({
        ...token,
        actor: {
          kind: 'character' as const,
          id: actor.id,
          name: found?.name ?? '',
          img: null,
          version: found?.version ?? 1,
          life: null,
          stats: [],
          conditions: ((found?.play as Play | undefined)?.conditions ?? []).map((c) => ({ ...c }))
        }
      })
    }
    const row = creatureById(actor.id)
    const { card } = creatureCard(row)
    return structuredClone({
      ...token,
      actor: {
        kind: 'creature' as const,
        id: actor.id,
        name: card.name,
        img: card.img,
        version: card.version,
        life: card.life ? { value: card.life.value, max: card.life.max, temp: card.life.temp } : null,
        stats: card.stats ?? [],
        conditions: (row.play.conditions ?? []).map((c) => ({ ...c }))
      }
    })
  }
  const tokenById = (tokenId: string) => {
    const token = tokens.find((t) => t.id === tokenId)
    if (!token) throw new ApiError('NOT_FOUND', 404)
    return token
  }
  const encounters: EncounterView[] = []
  /** Dónde va: en píxeles o en una casilla de la rejilla de la escena */
  const pointOf = (sceneId: string, p: { x?: number; y?: number; column?: number; row?: number }) => {
    if (p.x !== undefined && p.y !== undefined) return { x: p.x, y: p.y }
    const { grid } = sceneById(sceneId)
    return {
      x: grid.offsetX + ((p.column ?? 0) + 0.5) * grid.size,
      y: grid.offsetY + ((p.row ?? 0) + 0.5) * grid.size
    }
  }
  // El combate de cada campaña (uno a la vez), con sus fichas: sin tiradas (la iniciativa se escribe)
  const combats = new Map<string, CombatView>()
  const combatOf = (campaignId: string) => {
    const combat = combats.get(campaignId)
    if (!combat) throw new ApiError('NO_COMBAT', 400)
    return combat
  }
  const combatantOf = (token: TokenView) => ({
    id: crypto.randomUUID(),
    kind: token.actor.kind,
    actorId: token.actor.id,
    name: token.actor.name,
    img: token.actor.img,
    tokenId: token.id,
    initiative: null,
    modifier: null,
    group: null,
    sort: null,
    generic: token.actor.kind === 'creature' && !creatureById(token.actor.id).unique,
    defeated: false,
    hidden: token.hidden,
    active: false,
    life: token.actor.life,
    conditions: []
  })
  /** El orden: por iniciativa (de mayor a menor), su modificador y, si empatan, el orden a mano */
  const sortCombat = (combat: CombatView) => {
    // Lo vital, el de ahora de cada uno
    for (const c of combat.combatants) {
      const row = c.tokenId ? tokens.find((t) => t.id === c.tokenId) : undefined
      if (!row) continue
      const { actor } = tokenOf(row)
      c.life = actor.life
      c.conditions = actor.conditions
      c.defeated = Boolean(actor.life && actor.life.max > 0 && actor.life.value <= 0)
    }
    combat.combatants.sort(
      (a, b) =>
        (b.initiative ?? Number.NEGATIVE_INFINITY) - (a.initiative ?? Number.NEGATIVE_INFINITY) ||
        (b.modifier ?? 0) - (a.modifier ?? 0) ||
        (a.sort ?? 0) - (b.sort ?? 0)
    )
    for (const c of combat.combatants) c.active = c.id === combat.turnId
    return structuredClone(combat)
  }
  /** Pasa el turno hacia delante (1) o hacia atrás (-1), saltando a los derrotados si se pide */
  const moveTurn = (combat: CombatView, step: 1 | -1) => {
    const order = combat.combatants.filter((c) => !(combat.skipDefeated && c.defeated))
    if (order.length === 0) return
    const at = order.findIndex((c) => c.id === combat.turnId)
    if (at < 0) {
      combat.turnId = order[0]?.id ?? null
      combat.round = Math.max(1, combat.round)
      return
    }
    const next = at + step
    if (next >= order.length) combat.round++
    if (next < 0) combat.round = Math.max(1, combat.round - 1)
    combat.turnId = order[(next + order.length) % order.length]?.id ?? null
  }
  // La visión de cada escena (muros, puertas y luces) y las puertas abiertas en cada campaña; la niebla no se calcula
  const visions = new Map<
    string,
    { version: number; darkness: number; automaticVision: boolean; walls: WallView[]; lights: LightView[] }
  >()
  const doors = new Map<string, boolean>()
  const visionOf = (sceneId: string) => {
    sceneById(sceneId)
    const vision = visions.get(sceneId) ?? { version: 1, darkness: 0, automaticVision: true, walls: [], lights: [] }
    visions.set(sceneId, vision)
    return vision
  }
  const visionView = (sceneId: string, campaignId?: string) => {
    const vision = visionOf(sceneId)
    return {
      sceneId,
      ...structuredClone(vision),
      ...(campaignId
        ? {
            doors: Object.fromEntries(
              vision.walls.filter((w) => w.door).map((w) => [w.id, doors.get(`${campaignId}|${w.id}`) ?? w.open])
            )
          }
        : {})
    }
  }
  const wallOf = (input: Partial<WallView> & { a: WallView['a']; b: WallView['b'] }): WallView => ({
    id: crypto.randomUUID(),
    kind: 'wall',
    sight: 'full',
    light: 'full',
    move: 'full',
    sound: 'full',
    direction: 'both',
    door: null,
    locked: false,
    open: false,
    ...input
  })
  const lightOf = (input: Partial<LightView> & { x: number; y: number }): LightView => ({
    id: crypto.randomUUID(),
    bright: 20,
    dim: 40,
    color: '#ffffff',
    intensity: 1,
    angle: 360,
    rotation: 0,
    walls: true,
    darkness: false,
    enabled: true,
    activeBelowAmbient: null,
    ...input
  })
  // Lo dejado en el mapa (por campaña y escena), los widgets y las instantáneas de cada campaña
  const tableMarks: Array<MarkView & { campaignId: string }> = []
  const widgets: Array<WidgetView & { campaignId: string }> = []
  const snapshots: Array<SnapshotView & { campaignId: string }> = []
  const measureOnScreen = new Set<string>()
  const sceneFor = (campaignId: string, sceneId?: string) => {
    const target = sceneId ?? campaignTableOf(campaignId).table.open
    if (!target) throw new ApiError('NO_OPEN_SCENE', 400)
    return sceneOfCampaign(campaignId, target).id
  }
  const markOf = ({ campaignId: _, ...mark }: MarkView & { campaignId: string }): MarkView => structuredClone(mark)
  /** Las fichas de la escena que caen en una plantilla (como el servidor, con el núcleo) */
  const insideOf = (template: Extract<MarkView, { kind: 'template' }>) => {
    const { grid } = sceneById(template.sceneId)
    const core =
      grid.type === 'none' ? null : { type: grid.type, size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY }
    const onScene = tokens.filter((t) => t.sceneId === template.sceneId)
    return tokensInTemplate(template, onScene, core, grid.type === 'none' ? 100 : grid.size)
  }
  const withTargets = (mark: MarkView): MarkView =>
    mark.kind === 'template' ? { ...mark, tokenIds: insideOf(mark).map((t) => t.id) } : mark
  const targetOf = (row: TokenRow) => {
    const token = tokenOf(row)
    return {
      tokenId: token.id,
      label: token.label,
      name: token.actor.name,
      kind: token.actor.kind,
      actorId: token.actor.id,
      hidden: token.hidden
    }
  }
  /** Lo que guarda cada instantánea: dónde estaba cada ficha y lo dejado en el mapa */
  const snapshotData = new Map<string, { tokens: Array<{ id: string; x: number; y: number }>; marks: MarkView[] }>()
  const widgetOf = ({ campaignId: _, ...widget }: WidgetView & { campaignId: string }): WidgetView =>
    structuredClone(widget)
  /** Mover una marca: sus puntos y su sitio */
  const shifted = (mark: MarkView, dx: number, dy: number): MarkView => {
    const move = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy })
    if (mark.kind === 'template') return { ...mark, a: move(mark.a), b: move(mark.b) }
    if (mark.kind === 'drawing') return { ...mark, points: mark.points.map(move) }
    return { ...mark, x: mark.x + dx, y: mark.y + dy }
  }
  /** La escena tiene que ser del mundo de la campaña */
  const sceneOfCampaign = (campaignId: string, sceneId: string) => {
    const { campaign } = campaignTableOf(campaignId)
    const scene = sceneById(sceneId)
    if (scene.worldId !== campaign.worldId) throw new ApiError('NOT_FOUND', 404)
    return scene
  }

  // Los sistemas de la cuenta: como en el servidor, validados enteros con @crisol/systems
  const ownSystems: Array<{
    id: string
    version: number
    basedOn: { id: string; version: number } | null
    document: System
    content: ContentItem[]
    deleted: boolean
  }> = (options.systems ?? []).map((document) => ({
    id: document.id,
    version: 1,
    basedOn: null,
    document: structuredClone(document),
    content: structuredClone(options.systemContent?.[document.id] ?? []),
    deleted: false
  }))
  // El compendio de los mundos (docs/specs/compendio-mundo.md), con el origen de las copias
  type FakeOrigin = {
    systemId: string
    key: string
    fingerprint: string
    data: Record<string, unknown>
    mechanics: unknown
  }
  const originOf = (systemId: string, original: ContentItem): FakeOrigin => ({
    systemId,
    key: original.key,
    fingerprint: contentFingerprint(original),
    data: structuredClone(original.data),
    mechanics: structuredClone(original.mechanics ?? null)
  })
  const worldEntries: Array<{
    id: string
    worldId: string
    systemId: string
    item: ContentItem
    version: number
    origin: FakeOrigin | null
  }> = (options.worldContent ?? []).map((each) => ({
    id: crypto.randomUUID(),
    worldId: each.worldId,
    systemId: each.systemId,
    item: { ...structuredClone(each.item), source: null },
    version: 1,
    origin: each.copyOf ? originOf(each.systemId, each.copyOf) : null
  }))
  const entriesOf = (worldId: string, systemId: string) =>
    worldEntries.filter((e) => e.worldId === worldId && e.systemId === systemId)
  /** Quien lleva el mundo: en la falsa, el propietario */
  const leadsWorlds = () => organizations.some((o) => o.role === 'owner')
  // Las imágenes subidas de los sistemas (en la falsa, sin sus bytes)
  const systemImages: Array<{ systemId: string; path: string; license: string }> = []
  // Las criaturas en juego (docs/specs/criaturas.md), en la falsa: las del máster
  const creatures: Array<{
    id: string
    campaignId: string
    key: string
    name: string
    number: number | null
    unique: boolean
    play: Play
    overrides: Record<string, number>
    version: number
    hidden?: boolean
  }> = []
  const worldEntry = (worldId: string, systemId: string, key: string) => {
    const found = entriesOf(worldId, systemId).find((e) => e.item.key === key)
    if (!found) throw new ApiError('NOT_FOUND', 404)
    return found
  }
  const originalNow = (origin: FakeOrigin) =>
    ownSystems.find((s) => s.id === origin.systemId && !s.deleted)?.content.find((c) => c.key === origin.key) ?? null

  /** El documento de prueba: lo escrito y lo que viene del contenido de un sistema de la cuenta, por su clave */
  const testDocument = (
    systemId: string,
    given:
      | {
          content?: string | undefined
          data?: Record<string, unknown> | undefined
          mechanics?: Record<string, unknown> | undefined
          items?:
            | {
                id: string
                content?: string | undefined
                type?: string | undefined
                name?: string | undefined
                data?: Record<string, unknown> | undefined
                mechanics?: Record<string, unknown> | undefined
                from?: string | undefined
                choices?: Record<string, string[]> | undefined
                uses?: Record<string, number> | undefined
              }[]
            | undefined
        }
      | undefined
  ) => {
    const content = ownSystems.find((s) => s.id === systemId)?.content ?? []
    const find = (key: string | undefined) => (key ? content.find((c) => c.key === key) : undefined)
    const name = (value: unknown) => (typeof value === 'string' ? value : textOf(value as never))
    const own = find(given?.content)
    const mechanics = given?.mechanics ?? own?.mechanics
    return {
      data: { ...(own?.data ?? {}), ...(given?.data ?? {}) },
      ...(mechanics ? { mechanics: mechanics as never } : {}),
      items: (given?.items ?? []).map((item) => {
        const from = find(item.content)
        const itemMechanics = item.mechanics ?? from?.mechanics
        return {
          id: item.id,
          type: item.type ?? from?.type ?? '',
          name: item.name ?? (from ? name(from.data.name) : item.id),
          data: { ...(from?.data ?? {}), ...(item.data ?? {}) },
          ...(itemMechanics ? { mechanics: itemMechanics as never } : {}),
          ...(item.from ? { from: item.from } : {}),
          ...(item.choices ? { choices: item.choices } : {}),
          ...(item.uses ? { uses: item.uses } : {})
        }
      })
    }
  }
  const systemById = (id: string) =>
    catalogSystem(id) ?? ownSystems.find((s) => s.id === id && !s.deleted)?.document ?? null
  const systemView = (id: string) => {
    const own = ownSystems.find((s) => s.id === id && !s.deleted)
    const document = own?.document ?? catalogSystem(id)
    if (!document) throw new ApiError('NOT_FOUND', 404)
    const { defaultRoll: _, critical: __, ...overview } = systemOverview(document)
    return {
      id,
      ...overview,
      builtIn: !own,
      version: own?.version ?? 1,
      basedOn: own?.basedOn
        ? { ...own.basedOn, name: textOf(systemById(own.basedOn.id)?.name) || own.basedOn.id }
        : null,
      content: own?.content.length ?? 0,
      campaigns: campaigns.filter((c) => c.system?.id === id).map((c) => ({ id: c.id, name: c.name })),
      document: structuredClone(document) as unknown as Record<string, unknown>
    }
  }
  const validSystem = (document: unknown) => {
    const { system, problems } = validateSystem(document)
    if (!system) throw new ApiError('SYSTEM_INVALID', 400)
    return { system, warnings: problems.filter((p) => p.severity === 'warning') }
  }
  /** El sistema de una campaña, como lo da la API */
  const campaignSystem = (id: string) => {
    const document = systemById(id)
    if (!document) throw new ApiError('BAD_SYSTEM', 400)
    const { name, defaultRoll, critical } = systemOverview(document)
    return { id, name, defaultRoll, critical }
  }
  const chooseSystem = (
    campaign: Campaign,
    system: string | null | undefined,
    choices: Record<string, unknown> | undefined
  ) => {
    if (system === undefined && choices === undefined) return
    const target = system !== undefined ? system : (campaign.system?.id ?? null)
    if (target === null) {
      campaign.system = null
      campaign.systemChoices = null
      return
    }
    const document = systemById(target)
    if (!document) throw new ApiError('BAD_SYSTEM', 400)
    const base = target === campaign.system?.id ? (campaign.systemChoices ?? {}) : {}
    const { choices: normalized, problems } = normalizeChoices(document, { ...base, ...(choices ?? {}) })
    if (problems.length > 0) throw new ApiError('BAD_SYSTEM_CHOICES', 400)
    campaign.system = campaignSystem(target)
    campaign.systemChoices = normalized
  }

  // Los personajes y sus versiones: «yo» ve los suyos o, si es máster de su campaña, todos
  const characters: Character[] = structuredClone(options.characters ?? [])
  const characterVersions: Array<{
    id: string
    characterId: string
    kind: 'created' | 'level'
    level: number
    snapshot: Pick<Character, 'name' | 'status' | 'build' | 'play' | 'summary'>
    createdAt: string
  }> = []
  const visibleCharacter = (characterId: string) => {
    const found = characters.find((c) => c.id === characterId)
    const campaign = campaigns.find((c) => c.id === found?.campaignId)
    if (!found || !campaign || (campaign.role !== 'master' && found.owner?.id !== 'yo'))
      throw new ApiError('NOT_FOUND', 404)
    return found
  }
  /** Monta un personaje con su sistema y lo que eligió su campaña (en la falsa, el contenido de los de la cuenta) */
  const stateOf = (character: Character) => {
    const document = systemById(character.system)
    const campaign = campaigns.find((c) => c.id === character.campaignId)
    if (!document) throw new ApiError('NOT_FOUND', 404)
    const { choices } = normalizeChoices(document, (campaign?.systemChoices ?? {}) as Partial<Choices>)
    const content = ownSystems.find((s) => s.id === document.id && !s.deleted)?.content ?? []
    return characterView(document, content, choices, character.build as Build, character.play as Play).view
  }
  const touch = (character: Character) => {
    character.version++
    character.updatedAt = new Date().toISOString()
  }

  // Las tablas aleatorias de las pestañas «Tabla» (se crean vacías con la pestaña) y lo sacado por campaña
  const randomTables = new Map<string, RandomTable>()
  const draws = new Map<string, string[]>()
  const tableOf = (tabId: string) => {
    const tab = pageTabs.find((t) => t.id === tabId && t.kind === 'table')
    if (!tab) throw new ApiError('NOT_FOUND', 404)
    let table = randomTables.get(tabId)
    if (!table) {
      table = { tabId, name: tab.name, pageId: tab.pageId, formula: null, replacement: true, rows: [], version: 1 }
      randomTables.set(tabId, table)
    }
    return table
  }

  const creatureById = (id: string) => {
    const found = creatures.find((c) => c.id === id)
    if (!found || !leadsWorlds()) throw new ApiError('NOT_FOUND', 404)
    return found
  }
  /** Su hoja y lo que se ve de ella en la lista, como en el servidor */
  const creatureCard = (row: (typeof creatures)[number]) => {
    const found = compendiumOf(row.campaignId)
    const entry = found?.content.find((c) => c.key === row.key)
    if (!found || !entry) throw new ApiError('ENTRY_GONE', 400)
    const { view } = creatureView(found.document, found.content, found.choices, entry, row.play, row.overrides)
    const [first] = resourcePaths(found.document.types[entry.type]?.fields ?? {})
    const at = first
      ? (view.sheet[first.path] as { value?: number; max?: number; temp?: number } | undefined)
      : undefined
    const life =
      first && typeof at?.max === 'number'
        ? { path: first.path, value: at.value ?? at.max, max: at.max, temp: at.temp ?? 0 }
        : null
    const statsBlock = view.layout.find((b) => b.kind === 'stats') as
      | { fields?: { key: string; label: string }[] }
      | undefined
    const stats = (statsBlock?.fields ?? []).slice(0, 2).flatMap((f) => {
      const value = view.sheet[f.key]
      return typeof value === 'number' || typeof value === 'string'
        ? [{ key: f.key, label: f.label, value: String(value) }]
        : []
    })
    const condition: 'ok' | 'bloodied' | 'down' = !life
      ? 'ok'
      : life.value <= 0
        ? 'down'
        : life.value <= life.max / 2
          ? 'bloodied'
          : 'ok'
    return {
      view,
      card: {
        id: row.id,
        key: row.key,
        name: row.name,
        number: row.number,
        unique: row.unique,
        hidden: Boolean(row.hidden),
        type: entry.type,
        img: entry.img ?? null,
        version: row.version,
        life,
        stats,
        condition,
        play: row.play as Record<string, unknown>
      }
    }
  }

  const linkablesOf = (worldId: string) =>
    campaigns
      .filter((c) => c.worldId === worldId && c.system)
      .flatMap((c) => {
        const found = compendiumOf(c.id)
        if (!found) return []
        return found.content.map((item) => ({
          key: item.key,
          name: textOf(item.data.name as Text, 'es') || item.key,
          type: item.type,
          typeLabel: textOf(found.document.types[item.type]?.label as Text, 'es') || item.type,
          world: found.worldKeys.has(item.key),
          systemId: found.document.id,
          campaignId: c.id
        }))
      })

  /** El sistema de una campaña, con lo que eligió y su contenido (en la falsa, el de los de la cuenta) */
  const compendiumOf = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) throw new ApiError('NOT_FOUND', 404)
    const document = campaign.system ? systemById(campaign.system.id) : null
    if (!campaign.system || !document) return null
    const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
    const own = ownSystems.find((s) => s.id === document.id && !s.deleted)
    const world = own && leadsWorlds() ? { worldId: campaign.worldId, systemId: own.id } : null
    const system = own?.content ?? []
    const content = world
      ? withWorld(
          system,
          entriesOf(world.worldId, world.systemId).map((e) => e.item)
        )
      : system
    const worldKeys = new Set(world ? entriesOf(world.worldId, world.systemId).map((e) => e.item.key) : [])
    // Un jugador no ve los tipos que la campaña le oculta (docs/specs/compendio-jugadores.md)
    const hidden = campaign.role === 'player' ? (campaign.hiddenTypes ?? []) : []
    return { document, choices, content: content.filter((c) => !hidden.includes(c.type)), world, worldKeys }
  }

  // El inventario del grupo de cada campaña, con el mismo motor que el servidor (sin historial de verdad)
  const parties = new Map<string, PartyValues & { version: number; moves: ActionOutput<'getParty'>['moves'] }>()
  const partyOf = (campaignId: string) => {
    if (!campaigns.some((c) => c.id === campaignId)) throw new ApiError('NOT_FOUND', 404)
    return parties.get(campaignId) ?? { version: 0, containers: [], items: [], coins: {}, moves: [] }
  }
  const partyView = (p: PartyValues & { version: number }) => ({
    version: p.version,
    containers: partyContainers(p),
    items: p.items.map((i) => ({ ...i, note: i.note ?? null })),
    coins: p.coins
  })
  const partyFieldsOf = (campaignId: string) => {
    const found = compendiumOf(campaignId)
    return found ? partyFields(found.document) : { items: null, coins: null }
  }
  /** Cambia el grupo (y lo que llevan unos personajes): los fallos del motor, como los del servidor */
  const changeParty = (
    campaignId: string,
    action: string,
    details: Record<string, unknown>,
    fn: (party: PartyValues) => PartyValues
  ) => {
    const before = partyOf(campaignId)
    let next: PartyValues
    try {
      next = fn(before)
    } catch (error) {
      if (error instanceof PartyError) throw new ApiError(error.code, 400)
      throw error
    }
    const saved = {
      ...next,
      version: before.version + 1,
      moves: [
        { id: crypto.randomUUID(), action, details, by: 'Enrique', ai: false, at: new Date().toISOString() },
        ...before.moves
      ].slice(0, 10)
    }
    parties.set(campaignId, saved)
    return partyView(saved)
  }
  const movableCharacter = (campaignId: string, characterId: string) => {
    const character = visibleCharacter(characterId)
    if (character.campaignId !== campaignId) throw new ApiError('NOT_FOUND', 404)
    return character
  }
  const contentName = (campaignId: string, key: string) => {
    const found = compendiumOf(campaignId)
    const item = found?.content.find((each) => each.key === key)
    return (item && textOf(item.data.name as Text, found?.choices.language ?? 'es')) || key
  }

  // Las páginas enseñadas (showPage), para las pruebas
  const shownPages: { campaignId: string; pageId: string }[] = []
  const marks = new Map<string, { known: boolean; characters: string[] | null }>()
  // Quién de cada campaña escribe en cada página (docs/specs/pagina-de-jugadores.md): campaña|página → personajes o null
  const editors = new Map<string, string[] | null>()
  const knowledgeOf = (page: { id: string; worldId: string }) => {
    const own = (campaignId: string | null) => marks.get(`${campaignId ?? ''}|page|${page.id}`) ?? null
    const world = own(null)
    return {
      pageId: page.id,
      world: {
        own: world ? world.known : null,
        known: world?.known ?? false,
        from: world ? { pageId: page.id, title: '', layer: 'world' as const } : null
      },
      campaigns: campaigns
        .filter((c) => c.worldId === page.worldId)
        .map((c) => {
          const mark = own(c.id)
          const decided = mark ?? (c.knowsWorld === false ? null : world)
          return {
            campaignId: c.id,
            name: c.name,
            knowsWorld: c.knowsWorld ?? true,
            own: mark ? { known: mark.known, characters: mark.characters } : null,
            audience: !decided?.known
              ? ('none' as const)
              : decided.characters
                ? decided.characters.map((id) => ({ id, name: id }))
                : ('all' as const),
            from: decided
              ? { pageId: page.id, title: '', layer: mark ? ('campaign' as const) : ('world' as const) }
              : null,
            characters: [],
            editors: !editors.has(`${c.id}|${page.id}`)
              ? ('none' as const)
              : (editors.get(`${c.id}|${page.id}`) ?? null) === null
                ? ('all' as const)
                : (editors.get(`${c.id}|${page.id}`) ?? []).map((id) => ({ id, name: id }))
          }
        })
    }
  }

  const handlers: { [N in ActionName]: (input: ActionInput<N>) => ActionOutput<N> } = {
    listOrganizations: () => ({ organizations }),
    // Copias, como las de la API real (JSON nuevo en cada respuesta)
    // En el orden en que se crearon, como el servidor
    listWorlds: () => ({ worlds: worlds.map((w) => ({ ...w })) }),
    createWorld: ({ name }) => {
      const owned = organizations.find((o) => o.role === 'owner')
      if (!owned) throw new ApiError('ORGANIZATION_REQUIRED', 400)
      const world: World = {
        id: crypto.randomUUID(),
        organizationId: owned.id,
        name: name.trim(),
        description: '',
        icon: null,
        color: null,
        cover: null,
        role: 'master',
        version: 1
      }
      worlds.push(world)
      return world
    },
    renameWorld: ({ worldId, name }) => {
      const world = worlds.find((w) => w.id === worldId)
      if (!world) throw new ApiError('NOT_FOUND', 404)
      world.name = name.trim()
      world.version++
      return { ...world }
    },
    updateWorld: ({ worldId, ...patch }) => {
      const world = worlds.find((w) => w.id === worldId)
      if (!world) throw new ApiError('NOT_FOUND', 404)
      if (patch.name !== undefined) world.name = patch.name.trim()
      if (patch.description !== undefined) world.description = patch.description.trim()
      if (patch.icon !== undefined) world.icon = patch.icon
      if (patch.color !== undefined) world.color = patch.color
      if (patch.cover !== undefined) world.cover = patch.cover
      world.version++
      return { ...world }
    },
    listCampaigns: ({ worldId }) => ({
      // En el orden en que se crearon
      campaigns: campaigns.filter((c) => c.worldId === worldId).map((c) => ({ ...c }))
    }),
    createCampaign: ({ worldId, name, system, systemChoices }) => {
      const campaign: Campaign = {
        id: crypto.randomUUID(),
        worldId,
        name: name.trim(),
        description: '',
        color: null,
        cover: null,
        role: 'master',
        version: 1,
        system: null,
        systemChoices: null
      }
      chooseSystem(campaign, system, systemChoices)
      campaigns.push(campaign)
      return campaign
    },
    updateCampaign: ({ campaignId, system, systemChoices, ...patch }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      chooseSystem(campaign, system, systemChoices)
      if (patch.name !== undefined) campaign.name = patch.name.trim()
      if (patch.description !== undefined) campaign.description = patch.description.trim()
      if (patch.color !== undefined) campaign.color = patch.color
      if (patch.cover !== undefined) campaign.cover = patch.cover
      if (patch.hiddenTypes !== undefined) campaign.hiddenTypes = [...patch.hiddenTypes]
      campaign.version++
      return { ...campaign }
    },
    listWorldsWithCampaigns: () => ({
      worlds: handlers.listWorlds({}).worlds.map((w) => ({
        ...w,
        campaigns: handlers.listCampaigns({ worldId: w.id }).campaigns
      }))
    }),
    getCampaign: ({ campaignId }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      const world = worlds.find((w) => w.id === campaign?.worldId)
      if (!campaign || !world) throw new ApiError('NOT_FOUND', 404)
      return { campaign: { ...campaign }, world: { id: world.id, name: world.name }, ...membersOf(campaignId) }
    },
    renameCampaign: ({ campaignId, name }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      campaign.name = name.trim()
      campaign.version++
      return { ...campaign }
    },
    getInvitation: ({ campaignId }) => invitationOf(campaignId),
    regenerateInvitation: ({ campaignId }) => {
      invitations.set(campaignId, { ...invitationOf(campaignId), url: link(), joins: 0 })
      return invitationOf(campaignId)
    },
    setInvitationsOpen: ({ campaignId, open }) => {
      invitations.set(campaignId, { ...invitationOf(campaignId), open })
      return invitationOf(campaignId)
    },
    listMembers: ({ campaignId }) => membersOf(campaignId),
    removeMember: ({ campaignId, userId }) => {
      const list = members.get(campaignId) ?? []
      const member = list.find((m) => m.userId === userId)
      if (!member) throw new ApiError('NOT_FOUND', 404)
      if (member.role === 'master') throw new ApiError('MASTER_NOT_REMOVABLE', 400)
      members.set(
        campaignId,
        list.filter((m) => m !== member)
      )
      return membersOf(campaignId)
    },
    // Como el servidor: el de un mundo, para su máster; el de la organización, para su propietario
    listHistory: ({ worldId, before, limit = 50 }) => {
      if (worldId && worlds.find((w) => w.id === worldId)?.role !== 'master') throw new ApiError('FORBIDDEN', 403)
      if (!worldId && !organizations.some((o) => o.role === 'owner')) throw new ApiError('ORGANIZATION_REQUIRED', 400)
      const scoped = history.filter((e) => !worldId || e.worldId === worldId)
      const start = before ? scoped.findIndex((e) => e.id === before) + 1 : 0
      const entries = scoped.slice(start, start + limit).map((e) => ({ ...e }))
      return { entries, next: start + limit < scoped.length ? (entries.at(-1)?.id ?? null) : null }
    },
    undoOperation: ({ operationId }) => {
      const original = history.find((e) => e.id === operationId)
      if (!original) throw new ApiError('NOT_FOUND', 404)
      if (original.undoneBy) throw new ApiError('ALREADY_UNDONE', 400)
      if (options.conflicts && operationId in options.conflicts) {
        const by = options.conflicts[operationId] ?? null
        return { status: 'conflict' as const, by: by ? { ...by } : null }
      }
      const undo: HistoryEntry = {
        ...original,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        action: 'undoOperation',
        details: { action: original.action, details: original.details },
        undoneBy: null,
        undoes: original.id
      }
      original.undoneBy = undo.id
      history.unshift(undo)
      return { status: 'undone' as const, entry: { ...undo } }
    },
    deleteWorld: ({ worldId }) => {
      const index = worlds.findIndex((w) => w.id === worldId)
      const world = worlds[index]
      if (!world) throw new ApiError('NOT_FOUND', 404)
      if (world.role !== 'master') throw new ApiError('FORBIDDEN', 403)
      worlds.splice(index, 1)
      trash.unshift({ item: trashed('world', world.id, world.name, world), world })
      return {}
    },
    deleteCampaign: ({ campaignId }) => {
      const index = campaigns.findIndex((c) => c.id === campaignId)
      const campaign = campaigns[index]
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      campaigns.splice(index, 1)
      const world = worlds.find((w) => w.id === campaign.worldId)
      trash.unshift({ item: trashed('campaign', campaign.id, campaign.name, world), campaign })
      return {}
    },
    // Como el servidor: las campañas de un mundo borrado no salen sueltas, vuelven con él
    listTrash: ({ worldId }) => ({
      items: [
        ...trashedFiles
          .filter((f) => !worldId || f.worldId === worldId)
          .map((f) =>
            trashed(
              'file',
              f.id,
              f.name,
              worlds.find((w) => w.id === f.worldId)
            )
          ),
        ...trashedPages
          .filter((t) => !worldId || t.root.worldId === worldId)
          .map((t) => ({
            ...trashed(
              'page',
              t.root.id,
              t.root.title,
              worlds.find((w) => w.id === t.root.worldId)
            ),
            subpages: t.below.length
          })),
        ...trash
          .map((t) => ({ ...t.item }))
          .filter((item) =>
            worldId
              ? item.kind === 'campaign' && item.worldId === worldId
              : item.kind === 'world' || worlds.some((w) => w.id === item.worldId)
          )
      ]
    }),
    restoreWorld: ({ worldId }) => {
      const index = trash.findIndex((t) => t.world?.id === worldId)
      const found = trash[index]
      if (!found?.world) throw new ApiError('NOT_FOUND', 404)
      trash.splice(index, 1)
      worlds.push(found.world)
      return { id: found.world.id, name: found.world.name }
    },
    restoreCampaign: ({ campaignId }) => {
      const index = trash.findIndex((t) => t.campaign?.id === campaignId)
      const found = trash[index]
      if (!found?.campaign) throw new ApiError('NOT_FOUND', 404)
      if (!worlds.some((w) => w.id === found.campaign?.worldId)) throw new ApiError('WORLD_IN_TRASH', 400)
      trash.splice(index, 1)
      campaigns.push(found.campaign)
      return { id: found.campaign.id, name: found.campaign.name }
    },
    getAiSettings: () => aiSettings(),
    setAiMode: ({ mode }) => {
      aiMode = mode
      return aiSettings()
    },
    listApprovals: () => ({
      pending: approvals.filter((a) => a.status === 'pending').map((a) => ({ ...a })),
      recent: approvals.filter((a) => a.status !== 'pending').map((a) => ({ ...a }))
    }),
    approve: ({ approvalId }) => decide(approvalId, 'done'),
    reject: ({ approvalId }) => decide(approvalId, 'rejected'),
    // Quien sale deja de ver la campaña
    leaveCampaign: ({ campaignId }) => {
      const index = campaigns.findIndex((c) => c.id === campaignId)
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      campaigns.splice(index, 1)
      return {}
    },
    createPage: ({ worldId, title, parentId, before, after, template }) => {
      if (parentId) pageById(parentId)
      // Con plantilla, sus campos y su panel, como el servidor (el esqueleto del texto no se simula)
      const from = template ? templateById(template) : undefined
      if (template && !from) throw new ApiError('TEMPLATE_NOT_FOUND', 400)
      const made = from ? instantiate(from, () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)) : null
      const page: StoredPage = {
        id: crypto.randomUUID(),
        worldId,
        parentId: parentId ?? null,
        title,
        icon: null,
        properties: (made?.properties ?? []) as PageProperty[],
        ...(made ? { panel: made.panel as Page['panel'], template: made.template } : {}),
        version: 1
      }
      place(page, before, after)
      return pageView(page)
    },
    updatePage: ({ pageId, title, icon, locked, cover, sheet }) => {
      const page = pageById(pageId)
      Object.assign(page, {
        ...(title !== undefined ? { title } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(locked !== undefined ? { locked } : {}),
        ...(cover !== undefined ? { cover } : {}),
        ...(sheet !== undefined ? { sheet } : {}),
        version: page.version + 1
      })
      return pageView(page)
    },
    sortPageChildren: ({ worldId, parentId, order }) => {
      const kids = childrenOf(worldId, parentId).sort((a, b) =>
        order === 'asc' ? a.title.localeCompare(b.title, 'es') : b.title.localeCompare(a.title, 'es')
      )
      for (const kid of kids) {
        pages.splice(pages.indexOf(kid), 1)
        pages.push(kid)
      }
      return { sorted: kids.length }
    },
    setPagePanel: ({ pageId, blocks }) => {
      const page = pageById(pageId)
      Object.assign(page, { panel: blocks.map((b) => ({ ...b })), version: page.version + 1 })
      return pageView(page)
    },
    setPageProperties: ({ pageId, properties }) => {
      const page = pageById(pageId)
      Object.assign(page, { properties: properties.map((p) => ({ ...p })), version: page.version + 1 })
      return pageView(page)
    },
    listTags: ({ worldId }) => {
      const counts = new Map<string, Set<string>>()
      for (const page of pages.filter((p) => p.worldId === worldId)) {
        const tags = page.properties.find((p) => p.name.toLowerCase() === 'etiquetas')
        for (const tag of tags?.type === 'list' ? tags.value : []) {
          const parts = tag.toLowerCase().split('/')
          parts.forEach((_, i) => {
            const prefix = parts.slice(0, i + 1).join('/')
            counts.set(prefix, (counts.get(prefix) ?? new Set()).add(page.id))
          })
        }
      }
      return {
        tags: [...counts]
          .sort(([a], [b]) => a.localeCompare(b, 'es'))
          .map(([tag, ids]) => ({ tag, depth: tag.split('/').length - 1, count: ids.size }))
      }
    },
    movePage: ({ pageId, parentId, before, after }) => {
      const page = pageById(pageId)
      for (let at = parentId; at; at = pageById(at).parentId) {
        if (at === pageId) throw new ApiError('CYCLE', 400)
      }
      pages.splice(pages.indexOf(page), 1)
      Object.assign(page, { parentId, version: page.version + 1 })
      place(page, before, after)
      return pageView(page)
    },
    getPage: ({ pageId }) => pageView(pageById(pageId)),
    // Sin edición en vivo en estas pruebas: solo el id
    createPageDocument: ({ pageId }) => {
      pageById(pageId)
      return { id: crypto.randomUUID() }
    },
    // Lo de Claude (Markdown) no se usa desde la web: lo mínimo para el tipo
    readPage: ({ pageId }) => ({
      page: pageView(pageById(pageId)),
      markdown: '',
      tables: tablesOf(pageById(pageId)).tables
    }),
    getPageTables: ({ pageId }) => tablesOf(pageById(pageId)),
    // Lo que sabe cada campaña (ADR-0017): marcas propias de la página, sin herencia (basta para la interfaz)
    getPageKnowledge: ({ pageId }) => knowledgeOf(pageById(pageId)),
    reveal: ({ campaignId, kind, targetId, characters }) => {
      const id = campaignId ?? campaigns[0]?.id ?? ''
      marks.set(`${id}|${kind}|${targetId}`, { known: true, characters: characters ?? null })
      return { told: 1, pageUnknown: false }
    },
    // Enseñar: lo conocen todos si la página está marcada para la campaña; si no, nadie
    showPage: ({ campaignId, pageId }) => {
      shownPages.push({ campaignId, pageId })
      return marks.get(`${campaignId}|page|${pageId}`)?.known ? { shown: 2, unknown: 0 } : { shown: 0, unknown: 2 }
    },
    hide: ({ campaignId, kind, targetId }) => {
      marks.delete(`${campaignId}|${kind}|${targetId}`)
      return { ok: true as const }
    },
    listCampaignKnowledge: () => ({ campaign: [], world: [], knowsWorld: true }),
    getSecretsKnowledge: () => ({ secrets: [], campaigns: [] }),
    listNews: () => ({ news: [] }),
    seeNews: () => ({ ok: true as const }),
    listKnownPages: () => ({
      pageIds: [...marks].flatMap(([key, mark]) =>
        mark.known && key.split('|')[1] === 'page' ? [key.split('|')[2] ?? ''] : []
      )
    }),
    setPageEditors: ({ campaignId, pageId, editors: who }) => {
      const id = campaignId ?? campaigns[0]?.id ?? ''
      if (who === null) editors.delete(`${id}|${pageId}`)
      else editors.set(`${id}|${pageId}`, who === 'all' ? null : [...who])
      return { ok: true as const }
    },
    setKnowledge: ({ campaignId, kind, targetId, known, characters }) => {
      const key = `${campaignId ?? ''}|${kind}|${targetId}`
      if (known === null) marks.delete(key)
      else marks.set(key, { known, characters: campaignId && known ? (characters ?? null) : null })
      return { page: kind === 'page' ? knowledgeOf(pageById(targetId)) : null }
    },
    createPages: () => {
      throw new ApiError('UNSUPPORTED', 400)
    },
    editPage: ({ pageId, template }) => {
      const page = pageById(pageId)
      // Con plantilla, lo que le falta, como el servidor (los apartados del texto no se simulan)
      const from = template ? templateById(template) : undefined
      if (template && !from) throw new ApiError('TEMPLATE_NOT_FOUND', 400)
      if (from) {
        const applied = applyTemplate(
          from as unknown as Parameters<typeof applyTemplate>[0],
          { properties: page.properties, panel: page.panel ?? [], headings: [] },
          () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        )
        Object.assign(page, {
          properties: applied.properties,
          panel: applied.panel,
          template: from.id,
          version: page.version + 1
        })
      }
      return { page: pageView(page), changedBlocks: [], changedSinceRequest: false }
    },
    deletePage: ({ pageId }) => {
      const root = pageById(pageId)
      const below: StoredPage[] = []
      const collect = (id: string) => {
        for (const child of pages.filter((p) => p.parentId === id)) {
          below.push(child)
          collect(child.id)
        }
      }
      collect(pageId)
      for (const page of [root, ...below]) pages.splice(pages.indexOf(page), 1)
      trashedPages.push({ root, below })
      return { subpages: below.length }
    },
    getWikiPreferences: ({ worldId }) => preferencesView(worldId),
    setWikiTabs: ({ worldId, tabs }) => {
      preferences.set(worldId, { ...preferencesOf(worldId), tabs: tabs.map((tab) => ({ ...tab })) })
      return preferencesView(worldId)
    },
    setPageView: ({ worldId, pageId, view }) => {
      const stored = preferencesOf(worldId)
      const others = (stored.simplePages ?? []).filter((id) => id !== pageId)
      preferences.set(worldId, { ...stored, simplePages: view === 'simple' ? [...others, pageId] : others })
      return preferencesView(worldId)
    },
    setBookmarks: ({ worldId, bookmarks }) => {
      preferences.set(worldId, { ...preferencesOf(worldId), bookmarks: bookmarks.map((g) => ({ ...g })) })
      return preferencesView(worldId)
    },
    restorePage: ({ pageId }) => {
      const index = trashedPages.findIndex((t) => t.root.id === pageId)
      const found = trashedPages[index]
      if (!found) throw new ApiError('NOT_FOUND', 404)
      trashedPages.splice(index, 1)
      pages.push(found.root, ...found.below)
      return { id: found.root.id, name: found.root.title }
    },
    listPageChildren: ({ worldId, parentId }) => ({ pages: childrenOf(worldId, parentId ?? null).map(summary) }),
    // Sin documentos en estas pruebas: sin enlaces
    getPageLinks: ({ pageId }) => {
      pageById(pageId)
      return { incoming: [], outgoing: [], mentions: [], fields: [] }
    },
    listUnresolvedLinks: () => ({ links: [] }),
    listPageVersions: () => ({ versions: [] }),
    getPageVersion: () => {
      throw new ApiError('NOT_FOUND', 404)
    },
    restorePageVersion: () => ({ restored: false }),
    // Por el título, sin tildes ni mayúsculas (la de verdad la prueban las del servidor)
    // Las plantillas: las de serie y las de la cuenta, como el servidor
    listTemplates: () => ({
      templates: structuredClone([...BUILT_IN_TEMPLATES, ...ownTemplates.filter((t) => !t.deleted)]) as PageTemplate[],
      deleted: ownTemplates.filter((t) => t.deleted).map((t) => ({ id: t.id, name: t.name, icon: t.icon }))
    }),
    getTemplate: ({ templateId }) => {
      const found = templateById(templateId)
      if (!found) throw new ApiError('NOT_FOUND', 404)
      return structuredClone(found) as PageTemplate
    },
    createTemplate: ({ name, icon, copyOf }) => {
      const base = copyOf
        ? (templateById(copyOf) ?? [...BUILT_IN_TEMPLATES, ...ownTemplates].find((t) => t.name === copyOf))
        : undefined
      if (copyOf && !base) throw new ApiError('TEMPLATE_NOT_FOUND', 400)
      if ([...BUILT_IN_TEMPLATES, ...ownTemplates].some((t) => !('deleted' in t && t.deleted) && t.name === name)) {
        throw new ApiError('TEMPLATE_TAKEN', 400)
      }
      const id = crypto.randomUUID()
      const template = {
        id,
        name,
        icon: icon ?? 'template',
        basedOn: base?.id ?? null,
        line: [id, ...(base?.line ?? [])],
        builtIn: false,
        fields: structuredClone(base?.fields ?? []),
        panel: structuredClone(base?.panel ?? []),
        skeleton: base?.skeleton ?? '',
        deleted: false
      } as PageTemplate & { deleted: boolean }
      ownTemplates.push(template)
      return structuredClone(template) as PageTemplate
    },
    updateTemplate: ({ templateId, ...patch }) => {
      const found = ownTemplates.find((t) => t.id === templateId && !t.deleted)
      if (!found) throw new ApiError('NOT_FOUND', 404)
      const fields = patch.fields?.map((f) => (f.field ? f : { ...f, field: crypto.randomUUID().slice(0, 8) }))
      Object.assign(found, { ...patch, ...(fields ? { fields } : {}) })
      return structuredClone(found) as PageTemplate
    },
    // Las tiradas: aquí las tira la web de pruebas; la de verdad, el servidor
    rollDice: ({ campaignId, formula, visibility = 'all' }) => {
      if (!campaigns.some((c) => c.id === campaignId)) throw new ApiError('NOT_FOUND', 404)
      let result: ReturnType<typeof rollFormula>
      try {
        result = rollFormula(formula)
      } catch (error) {
        if (error instanceof DiceSyntaxError) throw new ApiError('BAD_FORMULA', 400)
        throw error
      }
      const roll: DiceRoll = {
        id: `00000000-0000-4000-8000-${String(rolls.length + 1).padStart(12, '0')}`,
        campaignId,
        // Quien tira en las pruebas: la cuenta de siempre
        by: { userId: 'yo', name: 'Enrique', color: null },
        ai: false,
        formula: result.formula,
        label: result.comment ?? null,
        total: result.total,
        detail: result.detail,
        critical: result.critical,
        dice: result.terms.flatMap((t) => t.dice.map((d) => ({ sides: t.sides, value: d.value, kept: d.kept }))),
        visibility,
        createdAt: new Date().toISOString()
      }
      rolls.push(roll)
      return { roll: { ...roll } }
    },
    tryDice: ({ formula, critical }) => {
      try {
        const result = rollFormula(formula, undefined, critical ? { critical } : {})
        return {
          formula: result.formula,
          label: result.comment ?? null,
          total: result.total,
          detail: result.detail,
          critical: result.critical,
          dice: result.terms.flatMap((t) => t.dice.map((d) => ({ sides: t.sides, value: d.value, kept: d.kept })))
        }
      } catch (error) {
        if (error instanceof DiceSyntaxError) throw new ApiError('BAD_FORMULA', 400)
        throw error
      }
    },
    listRolls: ({ campaignId, before }) => {
      const all = rolls.filter((r) => r.campaignId === campaignId)
      const end = before ? all.findIndex((r) => r.id === before) : all.length
      const page = all.slice(Math.max(0, end - 50), end)
      return { rolls: page.map((r) => ({ ...r })), next: end > 50 ? (page[0]?.id ?? null) : null }
    },
    listSystems: () => ({
      // Como el servidor: sin sistemas de serie, solo los de la cuenta
      systems: ownSystems
        .filter((s) => !s.deleted)
        .map((s) => s.id)
        .map((id) => {
          const { document: _, ...summary } = systemView(id)
          return summary
        })
    }),
    getSystem: ({ systemId }) => systemView(systemId),
    createSystem: ({ name, from = 'blank' }) => {
      const source = systemById(from)
      if (!source) throw new ApiError('NOT_FOUND', 404)
      const id = crypto.randomUUID()
      const { system } = validSystem({ ...structuredClone(source), id, name })
      const own = ownSystems.find((s) => s.id === from)
      ownSystems.push({
        id,
        version: 1,
        basedOn: { id: from, version: own?.version ?? 1 },
        document: system,
        content: structuredClone(own?.content ?? []),
        deleted: false
      })
      return systemView(id)
    },
    updateSystem: ({ systemId, version, changes, document, name }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own) throw new ApiError('NOT_FOUND', 404)
      let base: Record<string, unknown> = document ?? (own.document as unknown as Record<string, unknown>)
      if (changes) {
        try {
          base = applyChanges(own.document as unknown as Record<string, unknown>, changes)
        } catch (error) {
          if (error instanceof ChangeError) throw new ApiError('BAD_SYSTEM_CHANGE', 400)
          throw error
        }
      }
      const { system, warnings } = validSystem({
        ...structuredClone(base),
        id: systemId,
        ...(name !== undefined ? { name } : {})
      })
      if (own.version !== version) throw new ApiError('SYSTEM_CHANGED', 400)
      own.document = system
      own.version++
      return { system: systemView(systemId), warnings }
    },
    deleteSystem: ({ systemId }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own) throw new ApiError('NOT_FOUND', 404)
      if (campaigns.some((c) => c.system?.id === systemId)) throw new ApiError('SYSTEM_IN_USE', 400)
      own.deleted = true
      return { id: systemId, name: textOf(own.document.name) }
    },
    exportSystem: ({ systemId }) => {
      const document = systemById(systemId)
      if (!document) throw new ApiError('NOT_FOUND', 404)
      const content = ownSystems.find((s) => s.id === systemId)?.content ?? []
      return { name: fileName(document), file: toFile(document, content) as unknown as Record<string, unknown> }
    },
    // El contenido de los de la cuenta; el de serie es del servidor y no viene en la web
    searchSystemContent: ({ systemId, organizationId: _, ...options }) => {
      const document = systemById(systemId)
      if (!document) throw new ApiError('NOT_FOUND', 404)
      const content = ownSystems.find((s) => s.id === systemId && !s.deleted)?.content ?? []
      const entries = content.map((item) => ({
        key: item.key,
        type: item.type,
        source: item.source,
        concept: item.concept ?? null,
        name: item.data.name,
        automation: item.mechanics?.automation ?? null
      }))
      return searchContent(document, entries, options)
    },
    getSystemContent: ({ systemId, keys }) => {
      if (!systemById(systemId)) throw new ApiError('NOT_FOUND', 404)
      const content = ownSystems.find((s) => s.id === systemId && !s.deleted)?.content ?? []
      const wanted = [...new Set(keys)]
      const items = wanted.flatMap((k) => content.filter((item) => item.key === k).map((item) => structuredClone(item)))
      return { items, missing: wanted.filter((k) => !items.some((item) => item.key === k)) }
    },
    listCharacters: ({ campaignId }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      return {
        characters: characters
          .filter((c) => c.campaignId === campaignId && (campaign.role === 'master' || c.owner?.id === 'yo'))
          .map(({ build: _, play: __, ...card }) => structuredClone(card))
      }
    },
    getCharacter: ({ characterId }) => {
      const character = visibleCharacter(characterId)
      return { character: structuredClone(character), state: stateOf(character) }
    },
    createCharacter: ({ campaignId, name, ownerId }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      if (!campaign.system) throw new ApiError('NO_SYSTEM', 400)
      const owner = ownerId ? (membersOf(campaignId).members.find((m) => m.userId === ownerId) ?? null) : null
      const character: Character = {
        id: crypto.randomUUID(),
        campaignId,
        owner: owner ? { id: owner.userId, name: owner.name } : { id: 'yo', name: 'Enrique' },
        name: name?.trim() || 'Sin nombre',
        system: campaign.system.id,
        status: 'creating',
        summary: {},
        version: 1,
        updatedAt: new Date().toISOString(),
        build: {},
        play: {}
      }
      characters.push(character)
      return { character: structuredClone(character), state: stateOf(character) }
    },
    updateCharacter: ({ characterId, version, name, build, play, ownerId, confirm }) => {
      const character = visibleCharacter(characterId)
      if (character.version !== version) throw new ApiError('CHARACTER_CHANGED', 400)
      if (name !== undefined) character.name = name.trim()
      if (build !== undefined) character.build = structuredClone(build)
      if (play !== undefined) character.play = structuredClone(play)
      if (ownerId !== undefined) {
        const member = ownerId ? membersOf(character.campaignId).members.find((m) => m.userId === ownerId) : null
        character.owner = member ? { id: member.userId, name: member.name } : null
      }
      const state = stateOf(character)
      if (build !== undefined) character.summary = state.summary
      if (confirm === 'created') {
        if (!state.complete) throw new ApiError('INCOMPLETE', 400)
        character.status = 'ready'
      }
      touch(character)
      if (confirm) {
        const { name: now, status, build: chosen, play: playing, summary } = structuredClone(character)
        characterVersions.unshift({
          id: crypto.randomUUID(),
          characterId,
          kind: confirm,
          level: state.level,
          snapshot: { name: now, status, build: chosen, play: playing, summary },
          createdAt: new Date().toISOString()
        })
      }
      return { character: structuredClone(character), state }
    },
    chooseForCharacter: ({ characterId, version, confirm, ...choose }) => {
      const character = visibleCharacter(characterId)
      const document = systemById(character.system)
      if (!document) throw new ApiError('NOT_FOUND', 404)
      const build = applyChoices(document, character.build as Build, choose, () => crypto.randomUUID().slice(0, 8))
      return handlers.updateCharacter({
        characterId,
        version,
        build: build as Record<string, unknown>,
        ...(confirm ? { confirm } : {})
      })
    },
    rollForCharacter: ({ characterId, roll, visibility = 'all' }) => {
      const character = visibleCharacter(characterId)
      const document = systemById(character.system)
      const campaign = campaigns.find((c) => c.id === character.campaignId)
      if (!document || !campaign || !roll) throw new ApiError('BAD_ROLL', 400)
      const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
      const content = ownSystems.find((s) => s.id === document.id && !s.deleted)?.content ?? []
      const { type, document: doc } = playedDocument(
        document,
        content,
        choices,
        character.build as Build,
        character.play as Play
      )
      const result = tryRoll(document, type, doc, roll.key, {
        ...(roll.element ? { element: roll.element } : {}),
        ...(roll.mode ? { mode: roll.mode } : {})
      })
      const out = handlers.rollDice({ campaignId: campaign.id, formula: result.formula, visibility })
      const stored = rolls.find((r) => r.id === out.roll.id)
      for (const each of stored ? [out.roll, stored] : [out.roll]) each.label = `${character.name} · ${result.label}`
      return { roll: out.roll }
    },
    getParty: ({ campaignId }) => {
      const p = partyOf(campaignId)
      const campaign = campaigns.find((c) => c.id === campaignId)
      const fields = partyFieldsOf(campaignId)
      const language = compendiumOf(campaignId)?.choices.language ?? 'es'
      return {
        party: partyView(p),
        coins: (fields.coins?.coins ?? []).map((coin) => ({ key: coin.key, label: textOf(coin.label, language) })),
        types: fields.items?.types ?? [],
        characters: characters
          .filter((c) => c.campaignId === campaignId && (campaign?.role === 'master' || c.owner?.id === 'yo'))
          .map((c) => ({
            id: c.id,
            name: c.name,
            mine: c.owner?.id === 'yo',
            coins: fields.coins ? coinsOf(c.play as Play, fields.coins.field) : {}
          })),
        master: campaign?.role === 'master',
        moves: structuredClone(p.moves)
      }
    },
    updateParty: ({
      campaignId,
      version,
      add,
      remove,
      edit,
      addContainer,
      renameContainer,
      removeContainer,
      coins
    }) => {
      if (coins !== undefined && partyOf(campaignId).version !== version) throw new ApiError('PARTY_CHANGED', 400)
      const id = () => crypto.randomUUID().slice(0, 8)
      return {
        party: changeParty(campaignId, 'updateParty', { change: 'edit' }, (party) => {
          if (add) {
            const thing = add.key
              ? { key: add.key, name: contentName(campaignId, add.key), note: add.note }
              : { key: null, name: add.name ?? '', note: add.note }
            return putInParty(party, thing, add.quantity ?? 1, add.container ?? PARTY_CONTAINER, id)
          }
          if (remove) {
            const item = party.items.find((i) => i.id === remove.item)
            if (!item) throw new PartyError('NOT_IN_PARTY', '')
            return takeFromParty(party, item.id, remove.quantity ?? item.quantity).party
          }
          if (edit)
            return {
              ...party,
              items: party.items.map((i) =>
                i.id === edit.item
                  ? {
                      ...i,
                      ...(edit.name !== undefined ? { name: edit.name } : {}),
                      ...(edit.note !== undefined ? { note: edit.note } : {}),
                      ...(edit.container !== undefined ? { container: edit.container } : {})
                    }
                  : i
              )
            }
          if (addContainer)
            return { ...party, containers: [...party.containers, { id: id(), name: addContainer.name }] }
          if (renameContainer)
            return {
              ...party,
              containers: partyContainers(party).map((c) =>
                c.id === renameContainer.id ? { ...c, name: renameContainer.name } : c
              )
            }
          if (removeContainer)
            return {
              ...party,
              containers: party.containers.filter((c) => c.id !== removeContainer.id),
              items: party.items.map((i) =>
                i.container === removeContainer.id ? { ...i, container: PARTY_CONTAINER } : i
              )
            }
          return { ...party, coins: { ...party.coins, ...(coins ?? {}) } }
        })
      }
    },
    moveItem: ({ campaignId, from, to, quantity }) => {
      const id = () => crypto.randomUUID().slice(0, 8)
      const changed: Array<{ character: Character; play: Play }> = []
      const details: Record<string, unknown> = {}
      const view = changeParty(campaignId, 'moveItem', details, (party) => {
        let next = party
        let thing: { key: string | null; name: string; quantity: number }
        if ('party' in from) {
          const item = party.items.find((i) => i.id === from.party)
          if (!item) throw new PartyError('NOT_IN_PARTY', '')
          const taken = takeFromParty(party, item.id, quantity ?? item.quantity)
          next = taken.party
          thing = taken.taken
        } else {
          const source = movableCharacter(campaignId, from.character)
          const has = ((source.play as Play).items ?? []).find((i) => i.id === from.item)
          if (!has) throw new PartyError('NOT_CARRIED', '')
          const taken = takeFromPlay(source.play as Play, has.id, quantity ?? has.quantity ?? 1)
          changed.push({ character: source, play: taken.play })
          thing = {
            key: taken.taken.key,
            name: contentName(campaignId, taken.taken.key),
            quantity: taken.taken.quantity ?? 1
          }
        }
        const source = 'character' in from ? movableCharacter(campaignId, from.character).name : null
        if ('container' in to) {
          const container = partyContainers(next).find((c) => c.id === to.container)?.name ?? ''
          Object.assign(details, { name: thing.name, quantity: thing.quantity, from: source, to: null, container })
          return putInParty(next, thing, thing.quantity, to.container, id)
        }
        if (!thing.key) throw new PartyError('HANDWRITTEN_STAYS', '')
        const target = movableCharacter(campaignId, to.character)
        Object.assign(details, { name: thing.name, quantity: thing.quantity, from: source, to: target.name })
        const base = changed.find((c) => c.character.id === target.id)?.play ?? (target.play as Play)
        const put = putInPlay(base, thing.key, thing.quantity, id)
        const already = changed.find((c) => c.character.id === target.id)
        if (already) already.play = put
        else changed.push({ character: target, play: put })
        return next
      })
      for (const c of changed) {
        c.character.play = c.play as Record<string, unknown>
        c.character.version += 1
      }
      return {
        party: view,
        characters: changed.map((c) => ({ id: c.character.id, version: c.character.version, play: c.character.play }))
      }
    },
    moveCoins: ({ campaignId, character, toParty, coins }) => {
      const field = partyFieldsOf(campaignId).coins
      if (!field) throw new ApiError('NO_COINS', 400)
      const target = movableCharacter(campaignId, character)
      const allowed = field.coins.map((c) => c.key)
      let mine: Record<string, number> = {}
      const view = changeParty(campaignId, 'moveCoins', { toParty }, (party) => {
        const own = coinsOf(target.play as Play, field.field)
        const moved = toParty
          ? movedCoins(own, party.coins, coins, allowed)
          : movedCoins(party.coins, own, coins, allowed)
        mine = toParty ? moved.from : moved.to
        return { ...party, coins: toParty ? moved.to : moved.from }
      })
      target.play = withCoins(target.play as Play, field.field, mine) as Record<string, unknown>
      target.version += 1
      return { party: view, characters: [{ id: target.id, version: target.version, play: target.play }] }
    },
    splitCoins: ({ campaignId, characters: ids, coins, amounts }) => {
      const field = partyFieldsOf(campaignId).coins
      if (!field) throw new ApiError('NO_COINS', 400)
      if (campaigns.find((c) => c.id === campaignId)?.role !== 'master') throw new ApiError('NOT_FOUND', 404)
      const targets = [...new Set(ids)].map((characterId) => movableCharacter(campaignId, characterId))
      let each: Record<string, number> = {}
      const view = changeParty(campaignId, 'splitCoins', { count: targets.length }, (party) => {
        const wanted = (amounts ??
          Object.fromEntries(Object.entries(party.coins).filter(([coin]) => !coins || coins.includes(coin)))) as Record<
          string,
          number
        >
        const split = splitEvenly(wanted, targets.length)
        each = split.each
        return { ...party, coins: { ...party.coins, ...split.left } }
      })
      for (const target of targets) {
        const own = coinsOf(target.play as Play, field.field)
        const sum = Object.fromEntries(Object.entries(each).map(([coin, n]) => [coin, (own[coin] ?? 0) + n]))
        target.play = withCoins(target.play as Play, field.field, sum) as Record<string, unknown>
        target.version += 1
      }
      return {
        party: view,
        each,
        characters: targets.map((c) => ({ id: c.id, version: c.version, play: c.play }))
      }
    },
    listInPlay: ({ campaignId }) => ({
      creatures: creatures.filter((c) => c.campaignId === campaignId).map((c) => creatureCard(c).card)
    }),
    // Lo que ven los jugadores: las que están a la vista, con su estado en palabras
    listVisibleInPlay: ({ campaignId }) => ({
      creatures: creatures
        .filter((c) => c.campaignId === campaignId && !c.hidden)
        .map((c) => {
          const { card } = creatureCard(c)
          const life = card.life
          const state =
            !life || life.max <= 0
              ? null
              : life.value <= 0
                ? ('down' as const)
                : life.value >= life.max
                  ? ('unhurt' as const)
                  : life.value <= life.max / 4
                    ? ('dying' as const)
                    : life.value <= life.max / 2
                      ? ('bloodied' as const)
                      : ('hurt' as const)
          return { id: card.id, name: card.name, number: card.number, img: card.img, state }
        })
    }),
    setCreatureHidden: ({ creatureId, hidden }) => {
      const row = creatureById(creatureId)
      row.hidden = hidden
      row.version++
      return { ok: true as const }
    },
    getInPlay: ({ creatureId }) => {
      const { card, view } = creatureCard(creatureById(creatureId))
      return { creature: card, state: view }
    },
    putInPlay: ({ campaignId, key, count, unique, hp, name, hidden }) => {
      const found = compendiumOf(campaignId)
      const entry = found?.content.find((c) => c.key === key)
      if (!found || !entry) throw new ApiError('NOT_FOUND', 404)
      if (found.document.types[entry.type]?.document !== 'actor') throw new ApiError('NOT_A_CREATURE', 400)
      if (unique && creatures.some((c) => c.campaignId === campaignId && c.key === key && c.unique))
        throw new ApiError('UNIQUE_TAKEN', 400)
      const base = name ?? textOf(entry.data.name as Text, found.choices.language)
      const numbers = unique
        ? [null]
        : nextNumbers(
            creatures
              .filter((c) => c.campaignId === campaignId && c.key === key && c.number !== null)
              .map((c) => c.number as number),
            count ?? 1
          )
      const made = numbers.map((number) => {
        const start = startingPlay(found.document, entry, { hp: hp ?? 'average' })
        const row = {
          id: crypto.randomUUID(),
          campaignId,
          key,
          name: number === null ? base : `${base} ${number}`,
          number,
          unique: Boolean(unique),
          play: start.play,
          overrides: start.overrides,
          version: 1,
          hidden: Boolean(hidden)
        }
        creatures.push(row)
        return row
      })
      return { creatures: made.map((c) => creatureCard(c).card) }
    },
    playCreature: ({ creatureId, version, damage, heal, temp, max, name, play, condition }) => {
      const row = creatureById(creatureId)
      if (row.version !== version) throw new ApiError('CREATURE_CHANGED', 400)
      if (play) row.play = structuredClone(play) as Play
      if (condition?.add) row.play = addCondition(row.play, condition.add, crypto.randomUUID())
      if (condition?.remove) row.play = removeCondition(row.play, condition.remove)
      const { card } = creatureCard(row)
      if (max) {
        const path = max.resource ?? card.life?.path ?? ''
        if (max.value === null) delete row.overrides[path]
        else row.overrides[path] = max.value
      }
      if (damage !== undefined || heal !== undefined || temp !== undefined) {
        const life = creatureCard(row).card.life
        if (!life) throw new ApiError('BAD_PLAY', 400)
        row.play = changeResource(row.play, life.path, life.max, {
          ...(damage !== undefined ? { damage } : {}),
          ...(heal !== undefined ? { heal } : {}),
          ...(temp !== undefined ? { temp } : {})
        })
      }
      if (name) row.name = name
      row.version++
      const after = creatureCard(row)
      return { creature: after.card, state: after.view }
    },
    rollForCreature: ({ creatureId, action, roll, visibility = 'hidden' }) => {
      const row = creatureById(creatureId)
      const { view } = creatureCard(row)
      const chosen = action ? view.actions.find((a) => a.item === action.item && a.key === action.key) : undefined
      const formula =
        action?.part === 'attack'
          ? chosen?.attack
          : action?.part === 'damage'
            ? chosen?.damage.map((d) => d.formula).join(' + ')
            : roll
              ? '1d20'
              : null
      if (!formula) throw new ApiError('BAD_ROLL', 400)
      const out = handlers.rollDice({ campaignId: row.campaignId, formula, visibility })
      const stored = rolls.find((r) => r.id === out.roll.id)
      const label = `${row.name} · ${chosen?.label ?? roll?.key ?? ''}${action?.part === 'damage' ? ' · daño' : ''}`
      // Lo que se aplica de un daño: en la falsa, todo en una parte con el tipo de la primera
      const apply =
        action?.part === 'damage'
          ? { kind: 'damage' as const, parts: [{ amount: out.roll.total, type: chosen?.damage[0]?.type ?? null }] }
          : undefined
      for (const each of stored ? [out.roll, stored] : [out.roll]) {
        each.label = label
        if (apply) each.apply = apply
      }
      return { roll: out.roll }
    },
    // Lo que se enlaza desde una página con [[@…]]: en la falsa, lo de los sistemas de sus campañas y de su mundo
    searchLinkableContent: ({ worldId, query, limit }) => ({
      items: linkablesOf(worldId)
        .filter((each) => each.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit ?? 20)
        .map(({ campaignId: _, ...each }) => each)
    }),
    getLinkedContent: ({ worldId, name }) => {
      const all = linkablesOf(worldId)
      const found = all.find((e) => e.world && e.name === name) ?? all.find((e) => e.name === name)
      if (!found) return { entry: null }
      const { campaignId, ...entry } = found
      return { entry: { ...entry, lines: [], campaignId } }
    },
    applyRoll: ({ campaignId, rollId, targets }) => {
      const roll = rolls.find((r) => r.id === rollId && r.campaignId === campaignId)
      if (!roll || !leadsWorlds()) throw new ApiError('NOT_FOUND', 404)
      const apply = roll.apply
      if (!apply) throw new ApiError('NOTHING_TO_APPLY', 400)
      return {
        applied: targets.map((target) => {
          if (!target.creatureId) throw new ApiError('BAD_TARGET', 400)
          const row = creatureById(target.creatureId)
          const { card, view } = creatureCard(row)
          const found = compendiumOf(row.campaignId)
          if (!card.life || !found) throw new ApiError('BAD_TARGET', 400)
          const amount =
            apply.kind === 'heal'
              ? apply.parts.reduce((n, p) => n + Math.floor(p.amount * target.multiplier), 0)
              : damageTaken(
                  apply.parts.map((p) => ({ amount: p.amount, type: p.type ?? undefined })),
                  target.multiplier,
                  defensesOf(found.document, card.type, view.sheet)
                )
          row.play = changeResource(row.play, card.life.path, card.life.max, {
            [apply.kind === 'heal' ? 'heal' : 'damage']: amount
          })
          row.version++
          const life = creatureCard(row).card.life
          return {
            id: row.id,
            kind: 'creature' as const,
            name: row.name,
            amount,
            life: life ? { value: life.value, max: life.max } : null
          }
        })
      }
    },
    removeFromPlay: ({ campaignId, creatureIds, copiesOf }) => {
      const removed = creatures
        .filter(
          (c) => c.campaignId === campaignId && (creatureIds?.includes(c.id) || (copiesOf === c.key && !c.unique))
        )
        .map((c) => c.id)
      for (const id of removed)
        creatures.splice(
          creatures.findIndex((c) => c.id === id),
          1
        )
      return { removed }
    },
    playCharacter: ({ characterId, version, rest: kind, condition }) => {
      const character = visibleCharacter(characterId)
      const state = stateOf(character)
      let play = structuredClone(character.play) as Play
      if (condition?.add) play = addCondition(play, condition.add, crypto.randomUUID())
      if (condition?.remove) play = removeCondition(play, condition.remove)
      const fields = Object.values(systemById(character.system)?.types ?? {}).find(
        (t) => t.document === 'actor'
      )?.fields
      if (kind) play = rest(play, state.resources, kind, resourcePaths(fields ?? {}))
      return handlers.updateCharacter({ characterId, version, play: play as Record<string, unknown> })
    },
    deleteCharacter: ({ characterId }) => {
      visibleCharacter(characterId)
      characters.splice(
        characters.findIndex((c) => c.id === characterId),
        1
      )
      return { ok: true as const }
    },
    listCharacterVersions: ({ characterId }) => {
      visibleCharacter(characterId)
      return {
        versions: characterVersions
          .filter((v) => v.characterId === characterId)
          .map((v) => ({
            id: v.id,
            kind: v.kind,
            level: v.level,
            name: v.snapshot.name,
            summary: structuredClone(v.snapshot.summary),
            createdAt: v.createdAt
          }))
      }
    },
    restoreCharacterVersion: ({ characterId, versionId, version }) => {
      const character = visibleCharacter(characterId)
      const chosen = characterVersions.find((v) => v.id === versionId && v.characterId === characterId)
      if (!chosen) throw new ApiError('NOT_FOUND', 404)
      if (character.version !== version) throw new ApiError('CHARACTER_CHANGED', 400)
      Object.assign(character, structuredClone(chosen.snapshot))
      touch(character)
      return { character: structuredClone(character), state: stateOf(character) }
    },
    // Las tablas aleatorias: la de cada pestaña «Tabla», y lo sacado por campaña
    getRandomTable: ({ tabId, campaignId }) => {
      const table = tableOf(tabId)
      return { table: structuredClone(table), drawn: [...(draws.get(`${campaignId}:${tabId}`) ?? [])] }
    },
    updateRandomTable: ({ tabId, version, ...patch }) => {
      const table = tableOf(tabId)
      if (table.version !== version) throw new ApiError('TABLE_CHANGED', 400)
      const rows = patch.rows ?? table.rows
      const formula = patch.formula === undefined ? table.formula : patch.formula
      if (tableProblems(formula, rows).length > 0) throw new ApiError('BAD_TABLE', 400)
      Object.assign(table, {
        formula: formula || null,
        ...(patch.replacement !== undefined ? { replacement: patch.replacement } : {}),
        rows: structuredClone(rows).map((r) => ({ ...r, page: r.page ?? null, table: r.table ?? null })),
        version: table.version + 1
      })
      return { table: structuredClone(table) }
    },
    rollOnTable: ({ tabId, campaignId, visibility = 'all' }) => {
      const table = tableOf(tabId)
      const key = `${campaignId}:${tabId}`
      const drawn = table.replacement ? [] : (draws.get(key) ?? [])
      const left = table.rows.filter((r) => !drawn.includes(r.id))
      if (left.length === 0) throw new ApiError('TABLE_EMPTY', 400)
      const formula = tableFormula(table.formula, table.rows)
      const result = rollFormula(formula)
      const row = rowFor(left, result.total) ?? left[0]
      if (!row) throw new ApiError('TABLE_EMPTY', 400)
      if (!table.replacement) draws.set(key, [...drawn, row.id])
      const { roll } = handlers.rollDice({ campaignId, formula, visibility })
      // La guardada, también con su tabla
      const stored = rolls.find((r) => r.id === roll.id)
      for (const each of stored ? [roll, stored] : [roll]) {
        each.label = table.name
        each.table = { name: table.name, results: [{ text: row.text, page: row.page ?? null }] }
      }
      return { roll, drawn: [...(draws.get(key) ?? [])] }
    },
    resetTableDraws: ({ tabId, campaignId }) => {
      tableOf(tabId)
      draws.delete(`${campaignId}:${tabId}`)
      return { ok: true as const }
    },
    // El compendio de una campaña: el contenido de su sistema (en la falsa, solo el de los de la cuenta)
    getCampaignCompendium: ({ campaignId }) => {
      const found = compendiumOf(campaignId)
      if (!found)
        return {
          system: null,
          language: 'es' as const,
          sources: [],
          types: [],
          sections: [],
          editable: null,
          world: null
        }
      const { document, choices, content } = found
      const say = (text: Text | undefined) => textOf(text, choices.language)
      const types = compendiumTypes(document, content, choices)
      const typeView = (type: (typeof types)[number]) => ({
        ...type,
        label: say(type.label),
        fields: type.fields.map(({ options: given, ...field }) => ({
          ...field,
          label: say(field.label),
          ...(given ? { options: given.map((o) => ({ value: o.value, label: say(o.label) })) } : {})
        }))
      })
      const own = ownSystems.find((each) => each.id === document.id && !each.deleted)
      return {
        system: { id: document.id, name: say(document.name) },
        editable:
          own && organizations.some((o) => o.role === 'owner')
            ? {
                systemId: own.id,
                version: own.version,
                types: compendiumTypes(document, content, choices, true).map(typeView)
              }
            : null,
        world: found.world
          ? {
              ...found.world,
              writable: true,
              count: found.worldKeys.size,
              byType: content
                .filter((c) => found.worldKeys.has(c.key))
                .reduce<Record<string, number>>((n, c) => {
                  n[c.type] = (n[c.type] ?? 0) + 1
                  return n
                }, {}),
              types: compendiumTypes(document, content, choices, true).map(typeView)
            }
          : null,
        language: choices.language,
        sources: (document.sources ?? [])
          .filter((each) => choices.sources.includes(each.key))
          .map((each) => ({
            key: each.key,
            name: say(each.name),
            edition: each.edition ?? null,
            license: each.license,
            attribution: say(each.attribution)
          })),
        sections: compendiumSections(document, types).map((section) => ({
          key: section.key,
          label: say(section.label),
          types: section.types.map((type) => ({ key: type.key, label: say(type.label) }))
        })),
        types: types.map(typeView)
      }
    },
    rollContentTable: ({ campaignId, key, table, visibility = 'all' }) => {
      const found = compendiumOf(campaignId)
      const item = found?.content.find((each) => each.key === key)
      if (!found || !item) throw new ApiError('NOT_FOUND', 404)
      const name = textOf(item.data.name as Text, found.choices.language) || item.key
      if (table === undefined) {
        // Una entrada «Tabla»: sus filas (aquí, sin apuntar lo sacado)
        if (!item.table) throw new ApiError('NOT_A_TABLE', 400)
        const rows = item.table.rows
        const out = handlers.rollDice({ campaignId, formula: tableFormula(item.table.formula, rows), visibility })
        const hits = rows.filter((r) => r.from <= out.roll.total && out.roll.total <= r.to)
        const stored = rolls.find((r) => r.id === out.roll.id)
        for (const each of stored ? [out.roll, stored] : [out.roll]) {
          each.label = name
          each.table = { name, results: hits.map((r) => ({ text: r.text, page: null })) }
        }
        return { roll: out.roll, row: hits[0] ? rows.indexOf(hits[0]) : null, drawn: [] }
      }
      const field = textFieldOf(found.document, item.type)
      const text = field ? textOf(item.data[field] as Text, found.choices.language) : ''
      const chosen = contentTables(text)[table]
      if (!chosen) throw new ApiError('BAD_TABLE', 400)
      const out = handlers.rollDice({ campaignId, formula: chosen.formula, visibility })
      const hit = tableRowOf(chosen, out.roll.total)
      const stored = rolls.find((r) => r.id === out.roll.id)
      for (const each of stored ? [out.roll, stored] : [out.roll]) {
        each.label = name
        each.table = { name, results: hit ? [{ text: hit.cells.slice(1).join(' · '), page: null }] : [] }
      }
      return { roll: out.roll, row: hit ? chosen.rows.indexOf(hit) : null, drawn: [] }
    },
    resetContentTable: () => ({ ok: true as const }),
    browseCampaignContent: ({ campaignId, type }) => {
      const found = compendiumOf(campaignId)
      if (!found) return { items: [], folders: [], filters: [] }
      const { document, choices, content, worldKeys } = found
      const result = browseContent(document, content, {
        type,
        sources: choices.sources,
        duplicates: choices.duplicates,
        language: choices.language
      })
      return { ...result, items: result.items.map((i) => (worldKeys.has(i.key) ? { ...i, world: true } : i)) }
    },
    searchCampaignContent: ({ campaignId, layer, ...options }) => {
      const found = compendiumOf(campaignId)
      if (!found) return { items: [], total: 0 }
      const { document, choices, content, worldKeys } = found
      const entries = content
        .filter((item) => !layer || worldKeys.has(item.key) === (layer === 'world'))
        .map((item) => ({ ...item, concept: item.concept ?? null, name: item.data.name }))
      const result = searchContent(document, entries, {
        sources: choices.sources,
        duplicates: choices.duplicates,
        language: choices.language,
        ...options
      })
      return { ...result, items: result.items.map((h) => (worldKeys.has(h.key) ? { ...h, world: true } : h)) }
    },
    getCampaignContent: ({ campaignId, keys }) => {
      const wanted = [...new Set(keys)]
      const found = compendiumOf(campaignId)
      if (!found) return { items: [], missing: wanted }
      const { document, choices, content, world } = found
      const entries = content.map((item) => ({ ...item, name: item.data.name }))
      const seen = visibleContent(document, entries, choices)
      const worldView = (key: string) => {
        const own = world ? entriesOf(world.worldId, world.systemId).find((e) => e.item.key === key) : undefined
        if (!own) return {}
        const original = own.origin ? originalNow(own.origin) : null
        return {
          world: {
            id: own.id,
            version: own.version,
            origin: own.origin
              ? {
                  layer: 'system' as const,
                  systemId: own.origin.systemId,
                  key: own.origin.key,
                  name: original ? textOf(original.data.name as Text, choices.language) : null,
                  changed: original ? contentFingerprint(original) !== own.origin.fingerprint : false,
                  missing: !original
                }
              : null
          }
        }
      }
      const items = wanted.flatMap((k) => {
        const item = seen.find((each) => each.item.key === k)?.item
        if (!item) return []
        const entry = compendiumEntry(document, seen, item)
        const { name: _, ...plain } = structuredClone(item)
        return [
          {
            ...plain,
            ...entry,
            play: mechanicsText(document, item.type, item.mechanics as Mechanics | undefined, choices.language),
            granted: entry.granted.map((g) =>
              'choose' in g
                ? { level: g.level, choose: textOf(g.choose, choices.language), count: g.count }
                : { level: g.level, key: g.key, type: g.type, name: textOf(g.name as Text, choices.language) }
            ),
            ...worldView(k)
          }
        ]
      })
      return { items, missing: wanted.filter((k) => !items.some((item) => item.key === k)) }
    },
    putWorldContent: ({ worldId, systemId, items }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own || !leadsWorlds()) throw new ApiError('NOT_FOUND', 404)
      const given = items.map(({ version: _, ...item }) => ({ ...item, source: null })) as unknown as ContentItem[]
      if (validateContent(own.document, given).some((p) => p.severity === 'error'))
        throw new ApiError('SYSTEM_INVALID', 400)
      for (const item of items)
        if (item.version !== undefined && worldEntry(worldId, systemId, item.key).version !== item.version)
          throw new ApiError('CONTENT_CHANGED', 400)
      let created = 0
      const saved = given.map((item) => {
        const found = entriesOf(worldId, systemId).find((e) => e.item.key === item.key)
        if (found) {
          found.item = structuredClone(item)
          found.version++
          return { key: item.key, version: found.version }
        }
        created++
        worldEntries.push({
          id: crypto.randomUUID(),
          worldId,
          systemId,
          item: structuredClone(item),
          version: 1,
          origin: null
        })
        return { key: item.key, version: 1 }
      })
      return { saved, created, warnings: [] }
    },
    deleteWorldContent: ({ worldId, systemId, keys }) => {
      const deleted = keys.filter((k) => entriesOf(worldId, systemId).some((e) => e.item.key === k))
      for (const key of deleted) worldEntries.splice(worldEntries.indexOf(worldEntry(worldId, systemId, key)), 1)
      return { deleted, missing: keys.filter((k) => !deleted.includes(k)) }
    },
    copyContent: ({ worldId, systemId, key, to, name, newKey, version }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own || !leadsWorlds()) throw new ApiError('NOT_FOUND', 404)
      const rename = (value: unknown) =>
        value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value as Record<string, string>).map(([l, v]) => [
                l,
                name ?? `${v} (${l === 'en' ? 'copy' : 'copia'})`
              ])
            )
          : (name ?? `${String(value ?? '')} (copia)`)
      if (to === 'world') {
        const original = own.content.find((c) => c.key === key)
        if (!original) throw new ApiError('NOT_FOUND', 404)
        const copyKey = newKey ?? newContentKey(name ?? textOf(original.data.name as Text))
        const { concept: _, ...rest } = structuredClone(original)
        worldEntries.push({
          id: crypto.randomUUID(),
          worldId,
          systemId,
          item: { ...rest, key: copyKey, source: null, data: { ...rest.data, name: rename(original.data.name) } },
          version: 1,
          origin: originOf(systemId, original)
        })
        return { key: copyKey, to, version: 1 }
      }
      if (own.version !== version) throw new ApiError('SYSTEM_CHANGED', 400)
      const entry = worldEntry(worldId, systemId, key)
      const systemKey = newKey ?? entry.item.key
      if (own.content.some((c) => c.key === systemKey)) throw new ApiError('KEY_TAKEN', 400)
      own.content.push({ ...structuredClone(entry.item), key: systemKey })
      own.version++
      return { key: systemKey, to, version: own.version }
    },
    getContentOrigin: ({ worldId, systemId, key }) => {
      const entry = worldEntry(worldId, systemId, key)
      if (!entry.origin) return { origin: null, changes: [] }
      const original = originalNow(entry.origin)
      const fingerprint = original ? contentFingerprint(original) : null
      const origin = {
        layer: 'system' as const,
        systemId: entry.origin.systemId,
        key: entry.origin.key,
        name: original ? textOf(original.data.name as Text) : null,
        missing: !original,
        changed: fingerprint !== null && fingerprint !== entry.origin.fingerprint,
        fingerprint
      }
      if (!original) return { origin, changes: [] }
      const fields = systemById(systemId)?.types[entry.item.type]?.fields ?? {}
      const changes = contentDiff({ data: entry.origin.data, mechanics: entry.origin.mechanics }, original).map(
        (c) => ({
          key: c.key,
          label:
            c.key === 'name'
              ? 'Nombre'
              : c.key === 'mechanics'
                ? 'Mecánica'
                : textOf(fields[c.key]?.label as Text) || c.key,
          before: c.before ?? null,
          after: c.after ?? null,
          copy: (c.key === 'mechanics' ? entry.item.mechanics : entry.item.data[c.key]) ?? null
        })
      )
      return { origin, changes }
    },
    pullContentOrigin: ({ worldId, systemId, key, version, fingerprint, fields }) => {
      const entry = worldEntry(worldId, systemId, key)
      if (entry.version !== version) throw new ApiError('CONTENT_CHANGED', 400)
      const original = entry.origin ? originalNow(entry.origin) : null
      if (!entry.origin || !original) throw new ApiError('ORIGIN_MISSING', 400)
      if (contentFingerprint(original) !== fingerprint) throw new ApiError('ORIGIN_CHANGED', 400)
      const pulled = pullFields(entry.item, original, fields)
      entry.item = { ...pulled, mechanics: (pulled.mechanics ?? undefined) as Mechanics | undefined }
      entry.origin = originOf(entry.origin.systemId, original)
      entry.version++
      return { version: entry.version }
    },
    getSystemParts: ({ systemId, parts }) => {
      const document = systemById(systemId)
      if (!document) throw new ApiError('NOT_FOUND', 404)
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      try {
        return {
          id: systemId,
          name: textOf(document.name),
          version: own?.version ?? 1,
          builtIn: !own,
          parts: pickPaths(document as unknown as Record<string, unknown>, parts)
        }
      } catch (error) {
        if (error instanceof ChangeError) throw new ApiError('BAD_SYSTEM_PATH', 400)
        throw error
      }
    },
    getSystemFormat: () => ({ format: 1, docs: '# El formato de los sistemas de Crisol' }),
    checkSystem: ({ document }) => {
      const { problems } = document.kind === SYSTEM_FILE ? validateFile(document) : validateSystem(document)
      return {
        valid: !problems.some((p) => p.severity === 'error'),
        problems: problems.map(({ path, where, message, severity }) => ({ path, where, message, severity }))
      }
    },
    tryFormula: ({ systemId, type, formula, document }) => {
      const system = systemById(systemId)
      if (!system) throw new ApiError('NOT_FOUND', 404)
      return tryFormulaIn(system, type, formula, testDocument(systemId, document))
    },
    trySystemAction: (input) => {
      const system = systemById(input.systemId)
      if (!system) throw new ApiError('NOT_FOUND', 404)
      const typeKey = input.type ?? Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0]
      if (!typeKey) throw new ApiError('BAD_SYSTEM_TYPE', 400)
      try {
        const rolled = tryAction(
          system,
          typeKey,
          testDocument(input.systemId, input.document),
          input.item,
          input.action,
          {
            ...(input.level !== undefined ? { level: input.level } : {}),
            ...(input.mode ? { mode: input.mode } : {}),
            ...(input.critical ? { critical: true } : {})
          }
        )
        return {
          label: rolled.label,
          attack: rolled.attack
            ? {
                formula: rolled.attack.formula,
                total: rolled.attack.total,
                detail: rolled.attack.detail,
                critical: rolled.attack.critical
              }
            : null,
          save: rolled.save,
          damage: rolled.damage.map((d) => ({
            formula: d.formula,
            average: d.average,
            total: d.result.total,
            detail: d.result.detail
          })),
          heal: rolled.heal
            ? {
                formula: rolled.heal.formula,
                average: rolled.heal.average,
                total: rolled.heal.result.total,
                detail: rolled.heal.result.detail
              }
            : null
        }
      } catch (error) {
        if (error instanceof RollError) throw new ApiError('BAD_ROLL', 400)
        throw error
      }
    },
    putSystemContent: ({ systemId, version, items }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own) throw new ApiError('NOT_FOUND', 404)
      if (own.version !== version) throw new ApiError('SYSTEM_CHANGED', 400)
      const given = items as unknown as ContentItem[]
      const problems = validateContent(own.document, given)
      if (problems.some((p) => p.severity === 'error')) throw new ApiError('SYSTEM_INVALID', 400)
      let created = 0
      for (const item of given) {
        const at = own.content.findIndex((c) => c.key === item.key)
        if (at >= 0) own.content[at] = structuredClone(item)
        else {
          own.content.push(structuredClone(item))
          created++
        }
      }
      own.version++
      return { version: own.version, saved: given.map((i) => i.key), created, warnings: problems }
    },
    deleteSystemContent: ({ systemId, version, keys }) => {
      const own = ownSystems.find((s) => s.id === systemId && !s.deleted)
      if (!own) throw new ApiError('NOT_FOUND', 404)
      if (own.version !== version) throw new ApiError('SYSTEM_CHANGED', 400)
      const deleted = keys.filter((k) => own.content.some((c) => c.key === k))
      own.content = own.content.filter((c) => !keys.includes(c.key))
      own.version++
      return { version: own.version, deleted, missing: keys.filter((k) => !deleted.includes(k)) }
    },
    trySystemRoll: (input) => {
      const system = input.draft ? (input.draft as unknown as System) : systemById(input.systemId ?? '')
      if (!system) throw new ApiError('NOT_FOUND', 404)
      const typeKey = input.type ?? Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0]
      if (!typeKey) throw new ApiError('BAD_SYSTEM_TYPE', 400)
      try {
        const rolled = tryRoll(system, typeKey, testDocument(input.systemId ?? '', input.document), input.roll, {
          ...(input.element ? { element: input.element } : {}),
          ...(input.mode ? { mode: input.mode } : {}),
          target: input.target ?? null
        })
        const { label, formula, total, detail, critical, band, modeApplied } = rolled
        return { label, formula, total, detail, critical, band, modeApplied }
      } catch (error) {
        if (error instanceof RollError) throw new ApiError('BAD_ROLL', 400)
        throw error
      }
    },
    // Leer un zip de Foundry (LevelDB) solo se puede en el servidor
    inspectFoundry: () => {
      throw new ApiError('NOT_AVAILABLE', 400)
    },
    // En la falsa, un sistema «En blanco» con el nombre del manifiesto: la conversión es cosa del servidor
    importFoundry: ({ zip }) => {
      const read = readFoundryZip(Uint8Array.from(atob(zip), (c) => c.charCodeAt(0)))
      const blank = catalogSystem('blank')
      if (!read || !blank) throw new ApiError('FOUNDRY_INVALID', 400)
      const id = crypto.randomUUID()
      const document = { ...structuredClone(blank), id, name: { es: read.title, en: read.title } }
      ownSystems.push({ id, version: 1, basedOn: null, document, content: [], deleted: false })
      return { system: systemView(id), warnings: [], images: options.foundryImages ?? [] }
    },
    // Las imágenes subidas de un sistema, en la falsa: solo se apuntan
    putSystemImages: ({ systemId, images }) => {
      if (!ownSystems.some((s) => s.id === systemId && !s.deleted)) throw new ApiError('NOT_FOUND', 404)
      for (const image of images) systemImages.push({ systemId, path: image.path, license: image.license })
      return { saved: images.length, skipped: [] }
    },
    importSystem: ({ file, into }) => {
      const { file: valid, problems } = validateFile(file)
      if (!valid) throw new ApiError('SYSTEM_INVALID', 400)
      const warnings = problems.filter((p) => p.severity === 'warning')
      if (into) {
        const own = ownSystems.find((s) => s.id === into.systemId && !s.deleted)
        if (!own) throw new ApiError('NOT_FOUND', 404)
        if (own.version !== into.version) throw new ApiError('SYSTEM_CHANGED', 400)
        own.document = { ...valid.system, id: own.id }
        own.content = valid.content
        own.version++
        return { system: systemView(own.id), warnings }
      }
      const id = crypto.randomUUID()
      ownSystems.push({
        id,
        version: 1,
        basedOn: null,
        document: { ...valid.system, id },
        content: valid.content,
        deleted: false
      })
      return { system: systemView(id), warnings }
    },
    deleteTemplate: ({ templateId }) => {
      const found = ownTemplates.find((t) => t.id === templateId && !t.deleted)
      if (!found) throw new ApiError('NOT_FOUND', 404)
      found.deleted = true
      return { id: found.id, name: found.name }
    },
    searchWiki: ({ worldId, query, page = 1 }) => {
      const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const found = pages.filter((p) => p.worldId === worldId && fold(p.title).includes(fold(query ?? '')))
      return {
        total: found.length,
        page,
        pageSize: 20,
        results: found.slice((page - 1) * 20, page * 20).map((p) => ({
          id: p.id,
          title: p.title,
          icon: p.icon,
          path: pageView(p).path,
          sections: [{ heading: null, headingId: null, secret: false, excerpt: `Sobre **${p.title}**.` }]
        }))
      }
    },
    // Los del mundo y los comunes de su organización, como el servidor
    listLibrary: ({ worldId }) => {
      const usable = (f: FileView) =>
        f.kind === 'pdf' &&
        (f.worldId === worldId || (f.worldId === null && f.organizationId === organizationOf(worldId)))
      return {
        books: files
          .filter(usable)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((f) => {
            const pages = options.bookPages?.[f.id]
            return {
              fileId: f.id,
              name: f.name,
              url: f.url,
              common: f.worldId === null,
              size: f.size,
              status: pages ? (pages.length > 0 ? ('done' as const) : ('empty' as const)) : ('pending' as const),
              pages: pages?.length ?? 0,
              read: pages?.length ?? 0,
              error: null
            }
          })
      }
    },
    searchLibrary: ({ worldId, query, fileId }) => {
      const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const words = fold(query)
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
      const books = handlers.listLibrary({ worldId }).books.filter((b) => !fileId || b.fileId === fileId)
      return {
        books: books.flatMap((book) => {
          const pages = (options.bookPages?.[book.fileId] ?? []).flatMap((text, i) =>
            words.every((w) => fold(text).includes(w))
              ? [{ page: i + 1, excerpt: text.slice(0, 160), semantic: false }]
              : []
          )
          return pages.length > 0
            ? [{ fileId: book.fileId, name: book.name, common: book.common, pages: pages.slice(0, 3) }]
            : []
        }),
        // También en las páginas: las del mundo cuyo título lleva lo buscado
        pages: fileId
          ? []
          : pages
              .filter((p) => p.worldId === worldId && words.every((w) => fold(p.title).includes(w)))
              .slice(0, 5)
              .map((p) => ({ pageId: p.id, title: p.title })),
        semantic: false
      }
    },
    getBookPages: ({ fileId, from, to }) => {
      const file = files.find((f) => f.id === fileId && f.kind === 'pdf')
      if (!file) throw new ApiError('NOT_FOUND', 404)
      const pages = options.bookPages?.[fileId] ?? []
      return {
        name: file.name,
        status: pages.length > 0 ? 'done' : 'pending',
        pages: pages.length,
        text: pages.slice(from - 1, to).map((text, i) => ({ page: from + i, text }))
      }
    },
    readBookAgain: () => ({ status: 'pending' as const }),
    listFiles: ({ worldId }) => {
      const usable = (f: { worldId: string | null; organizationId: string }) =>
        f.worldId === worldId || (f.worldId === null && f.organizationId === organizationOf(worldId))
      return {
        files: files
          .filter(usable)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((f) => ({ ...f, usedBy: fileUses.get(f.id) ?? 0 })),
        folders: folders.filter(usable).map((f) => ({ ...f }))
      }
    },
    listCommonFiles: ({ organizationId }) => {
      const common = (f: { worldId: string | null; organizationId: string }) =>
        f.worldId === null && f.organizationId === (organizationId ?? organizationOf(null))
      return {
        files: files
          .filter(common)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((f) => ({ ...f, usedBy: fileUses.get(f.id) ?? 0 })),
        folders: folders.filter(common).map((f) => ({ ...f }))
      }
    },
    createFolder: ({ worldId, organizationId, parentId, name }) => {
      const scope = { worldId: worldId ?? null, organizationId: organizationId ?? organizationOf(worldId ?? null) }
      const sibling = folders.find(
        (f) =>
          f.worldId === scope.worldId &&
          f.organizationId === scope.organizationId &&
          f.parentId === (parentId ?? null) &&
          f.name.toLowerCase() === name.trim().toLowerCase()
      )
      if (sibling) throw new ApiError('NAME_TAKEN', 400)
      const folder: FolderView = { id: crypto.randomUUID(), ...scope, parentId: parentId ?? null, name: name.trim() }
      folders.push(folder)
      return { ...folder }
    },
    updateFolder: ({ folderId, name, parentId }) => {
      const folder = folderById(folderId)
      if (name !== undefined) folder.name = name.trim()
      if (parentId !== undefined) folder.parentId = parentId
      return { ...folder }
    },
    deleteFolder: ({ folderId }) => {
      const folder = folderById(folderId)
      trashItems([], [folderId])
      return { id: folder.id, name: folder.name }
    },
    deleteFiles: ({ fileIds = [], folderIds = [] }) => ({ files: trashItems(fileIds, folderIds) }),
    moveFile: ({ fileId, folderId }) => {
      const file = fileById(fileId)
      if (folderId) folderById(folderId)
      file.folderId = folderId
      file.version++
      return { ...file }
    },
    getWorldHome: ({ worldId }) => {
      const home = homes.get(worldId) ?? null
      return { pageId: home, chosen: home !== null }
    },
    ensureWorldHome: ({ worldId }) => {
      const existing = homes.get(worldId)
      if (existing) return { pageId: existing }
      const world = worlds.find((w) => w.id === worldId)
      const page = handlers.createPage({ worldId, title: world?.name ?? '', parentId: null })
      // Delante de las demás de lo más alto
      const index = pages.findIndex((p) => p.id === page.id)
      const [stored] = pages.splice(index, 1)
      if (stored)
        pages.splice(
          pages.findIndex((p) => p.worldId === worldId && !p.parentId),
          0,
          stored
        )
      homes.set(worldId, page.id)
      return { pageId: page.id }
    },
    listPageTabs: ({ pageId }) => ({ tabs: pageTabs.filter((t) => t.pageId === pageId).map((t) => ({ ...t })) }),
    createPageTab: ({ pageId, kind, name }) => {
      pageById(pageId)
      const tab: PageTabView = {
        id: crypto.randomUUID(),
        pageId,
        kind,
        name: name ?? (kind === 'text' ? 'Texto 2' : kind === 'scene' ? 'Escena' : 'Mapa'),
        hidden: false,
        documentId: kind === 'text' ? crypto.randomUUID() : null,
        color: null
      }
      pageTabs.push(tab)
      maps.push({ id: crypto.randomUUID(), tabId: tab.id, pageId, image: null, scale: null, pins: [] })
      if (kind === 'scene')
        scenes.push({
          id: crypto.randomUUID(),
          worldId: pageById(pageId).worldId,
          tabId: tab.id,
          pageId,
          name: null,
          image: null,
          grid: {
            type: 'square',
            size: 100,
            offsetX: 0,
            offsetY: 0,
            distance: 5,
            units: 'pies',
            diagonals: 'equal',
            visible: true,
            color: '#000000',
            opacity: 0.25
          },
          initialView: null,
          imported: null
        })
      return { ...tab }
    },
    updatePageTab: ({ tabId, name, hidden, after, color }) => {
      const tab = tabById(tabId)
      if (name !== undefined) tab.name = name
      if (hidden !== undefined) tab.hidden = hidden
      if (color !== undefined) tab.color = color
      if (after !== undefined) {
        pageTabs.splice(pageTabs.indexOf(tab), 1)
        const index =
          after === null
            ? pageTabs.findIndex((t) => t.pageId === tab.pageId)
            : pageTabs.findIndex((t) => t.id === after) + 1
        pageTabs.splice(index < 0 ? pageTabs.length : index, 0, tab)
      }
      return { ...tab }
    },
    deletePageTab: ({ tabId }) => {
      const tab = tabById(tabId)
      pageTabs.splice(pageTabs.indexOf(tab), 1)
      maps.splice(
        maps.findIndex((m) => m.tabId === tabId),
        1
      )
      const scene = scenes.findIndex((s) => s.tabId === tabId)
      if (scene >= 0) scenes.splice(scene, 1)
      return { id: tabId }
    },
    listScenes: ({ worldId }) => ({
      scenes: scenes.filter((s) => s.worldId === worldId).map(sceneView)
    }),
    createScene: ({ worldId, name }) => {
      const scene: StoredScene = {
        id: crypto.randomUUID(),
        worldId,
        tabId: null,
        pageId: null,
        name,
        image: null,
        grid: {
          type: 'square',
          size: 100,
          offsetX: 0,
          offsetY: 0,
          distance: 5,
          units: 'pies',
          diagonals: 'equal',
          visible: true,
          color: '#000000',
          opacity: 0.3
        },
        initialView: null,
        imported: null
      }
      scenes.push(scene)
      return sceneView(scene)
    },
    renameScene: ({ sceneId, name }) => {
      const scene = sceneById(sceneId)
      if (scene.tabId) tabById(scene.tabId).name = name
      else scene.name = name
      return sceneView(scene)
    },
    deleteScene: ({ sceneId }) => {
      const scene = sceneById(sceneId)
      if (scene.tabId) {
        const tab = tabById(scene.tabId)
        pageTabs.splice(pageTabs.indexOf(tab), 1)
      }
      scenes.splice(scenes.indexOf(scene), 1)
      return { ok: true as const }
    },
    getScene: ({ sceneId, tabId }) => {
      const scene = sceneId ? scenes.find((s) => s.id === sceneId) : scenes.find((s) => s.tabId === tabId)
      if (!scene) throw new ApiError('NOT_FOUND', 404)
      return sceneView(scene)
    },
    updateScene: ({ sceneId, grid, initialView }) => {
      const scene = sceneById(sceneId)
      if (grid) scene.grid = { ...scene.grid, ...grid }
      if (initialView !== undefined) scene.initialView = initialView
      return sceneView(scene)
    },
    setSceneImage: ({ sceneId, width, height, fileId, tiles, imported }) => {
      const scene = sceneById(sceneId)
      if (fileId && files.find((f) => f.id === fileId)?.kind !== 'image') throw new ApiError('BAD_SCENE_FILE', 400)
      // Sin medidas, las de un mapa cualquiera (el servidor las lee de la cabecera del archivo)
      scene.image = {
        width: width ?? 1600,
        height: height ?? 1000,
        tiles: tiles ?? null,
        fileId: fileId !== undefined ? fileId : (scene.image?.fileId ?? null)
      }
      if (imported !== undefined) scene.imported = imported
      return sceneView(scene)
    },
    // Como el servidor: el SVG pasa a ser un archivo del mundo y la escena queda sin trocear
    drawScene: ({ sceneId, svg, name, walls, portals, lights }) => {
      const scene = sceneById(sceneId)
      const worldId = scene.worldId
      const file = fileOf({ worldId, name: `${name ?? 'Mapa'}.svg`, mime: 'image/svg+xml', size: svg.length })
      files.push(file)
      const size = /width="(\d+)"[^>]*height="(\d+)"/.exec(svg)
      scene.image = {
        width: Number(size?.[1] ?? 1600),
        height: Number(size?.[2] ?? 1000),
        tiles: null,
        fileId: file.id
      }
      if (walls || portals || lights)
        scene.imported = {
          source: 'uvtt',
          walls: walls ?? [],
          objects: [],
          portals: portals ?? [],
          lights: lights ?? [],
          ambientLight: null,
          bakedLighting: false
        }
      return sceneView(scene)
    },
    getCampaignTable: ({ campaignId }) => tableView(campaignId),
    openScene: ({ campaignId, sceneId }) => {
      sceneOfCampaign(campaignId, sceneId)
      campaignTableOf(campaignId).table.open = sceneId
      return tableView(campaignId)
    },
    presentScene: ({ campaignId, sceneId }) => {
      const { table } = campaignTableOf(campaignId)
      const target = sceneId ?? table.open
      if (!target) throw new ApiError('NO_OPEN_SCENE', 400)
      sceneOfCampaign(campaignId, target)
      Object.assign(table, { presented: target, hidden: false })
      return tableView(campaignId)
    },
    hideScreen: ({ campaignId, hidden }) => {
      campaignTableOf(campaignId).table.hidden = hidden
      return tableView(campaignId)
    },
    placeTokens: ({ campaignId, sceneId, tokens: wanted, hidden }) => {
      sceneOfCampaign(campaignId, sceneId)
      const cell = sceneById(sceneId).grid.size
      const placeOne = (actor: TokenRow['actor'], name: string, at: { x: number; y: number }, label: string) => {
        const existing = tokens.find((t) => t.sceneId === sceneId && t.actor.id === actor.id)
        if (existing) return Object.assign(existing, at)
        const token: TokenRow = {
          id: crypto.randomUUID(),
          campaignId,
          sceneId,
          ...at,
          size: 1,
          label: label.slice(0, 16) || name.slice(0, 16),
          faction: actor.kind === 'character' ? 'group' : 'hostile',
          hidden: hidden ?? false,
          image: null,
          actor
        }
        tokens.push(token)
        return token
      }
      // El rótulo de una criatura: su inicial y su número de copia («G2»)
      const creatureLabel = (id: string) => {
        const row = creatureById(id)
        return row.number === null ? row.name : `${row.name[0]?.toUpperCase() ?? ''}${row.number}`
      }
      const placed = wanted.flatMap((want) => {
        const at = pointOf(sceneId, want)
        if ('characterId' in want) {
          const found = characters.find((c) => c.id === want.characterId && c.campaignId === campaignId)
          if (!found) throw new ApiError('NOT_FOUND', 404)
          return [placeOne({ kind: 'character', id: found.id }, found.name, at, found.name.split(' ')[0] ?? '')]
        }
        if ('creatureId' in want) {
          const row = creatureById(want.creatureId)
          return [placeOne({ kind: 'creature', id: row.id }, row.name, at, creatureLabel(row.id))]
        }
        // Del compendio: se ponen en juego y van en fila desde el punto
        const made = handlers.putInPlay({
          campaignId,
          key: want.content.key,
          count: want.content.count,
          unique: want.content.unique
        }).creatures
        return made.map((creature, i) =>
          placeOne(
            { kind: 'creature', id: creature.id },
            creature.name,
            { x: at.x + i * cell, y: at.y },
            creatureLabel(creature.id)
          )
        )
      })
      return { tokens: placed.map(tokenOf) }
    },
    moveTokens: ({ moves }) => ({
      tokens: moves.map((move) => {
        const token = tokenById(move.tokenId)
        return tokenOf(Object.assign(token, pointOf(token.sceneId, move)))
      })
    }),
    updateToken: ({ tokenId, ...patch }) => tokenOf(Object.assign(tokenById(tokenId), patch)),
    removeTokens: ({ tokenIds }) => {
      for (const id of tokenIds) tokens.splice(tokens.indexOf(tokenById(id)), 1)
      return { removed: tokenIds }
    },
    listEncounters: ({ worldId }) => ({
      encounters: encounters.filter((e) => e.worldId === worldId).map((e) => structuredClone(e))
    }),
    saveEncounter: ({ worldId, encounterId, systemId, name, members }) => {
      const existing = encounterId ? encounters.find((e) => e.id === encounterId) : undefined
      if (encounterId && !existing) throw new ApiError('NOT_FOUND', 404)
      const encounter = existing ?? { id: crypto.randomUUID(), worldId, systemId, name, members }
      Object.assign(encounter, { systemId, name, members })
      if (!existing) encounters.push(encounter)
      return structuredClone(encounter)
    },
    deleteEncounter: ({ encounterId }) => {
      const index = encounters.findIndex((e) => e.id === encounterId)
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      encounters.splice(index, 1)
      return { id: encounterId }
    },
    // Sus criaturas, en juego y en su formación desde el punto; lo que no está en el compendio se salta
    placeEncounter: ({ campaignId, sceneId, encounterId, ...where }) => {
      sceneOfCampaign(campaignId, sceneId)
      const encounter = encounters.find((e) => e.id === encounterId)
      if (!encounter) throw new ApiError('NOT_FOUND', 404)
      const origin = pointOf(sceneId, where)
      const cell = sceneById(sceneId).grid.size
      const placed: TokenView[] = []
      const skipped: string[] = []
      for (const member of encounter.members) {
        try {
          for (const spot of member.at)
            placed.push(
              ...handlers.placeTokens({
                campaignId,
                sceneId,
                tokens: [
                  {
                    content: { key: member.key, unique: member.unique },
                    x: origin.x + spot.dx * cell,
                    y: origin.y + spot.dy * cell
                  }
                ]
              }).tokens
            )
        } catch {
          skipped.push(member.key)
        }
      }
      return { tokens: placed, skipped }
    },
    getSceneVision: ({ sceneId, campaignId }) => visionView(sceneId, campaignId),
    changeWalls: ({ sceneId, walls, lights }) => {
      const vision = visionOf(sceneId)
      const removeWalls = new Set(walls?.remove ?? [])
      vision.walls = vision.walls
        .filter((w) => !removeWalls.has(w.id))
        .map((w) => {
          const patch = walls?.update?.find((u) => u.id === w.id)
          return patch ? { ...w, ...patch } : w
        })
      vision.walls.push(...(walls?.add ?? []).map((w) => wallOf(w)))
      const removeLights = new Set(lights?.remove ?? [])
      vision.lights = vision.lights
        .filter((l) => !removeLights.has(l.id))
        .map((l) => {
          const patch = lights?.update?.find((u) => u.id === l.id)
          return patch ? { ...l, ...patch } : l
        })
      vision.lights.push(...(lights?.add ?? []).map((l) => lightOf(l)))
      vision.version++
      return visionView(sceneId)
    },
    // Lo que trajo el mapa: cada tramo de sus muros, un muro; sus puertas y sus luces
    placeImportedWalls: ({ sceneId, replace }) => {
      const vision = visionOf(sceneId)
      const imported = sceneById(sceneId).imported
      if (replace) {
        vision.walls = []
        vision.lights = []
      }
      for (const line of imported?.walls ?? [])
        for (let i = 1; i < line.length; i++)
          vision.walls.push(wallOf({ a: line[i - 1] as WallView['a'], b: line[i] as WallView['b'] }))
      for (const portal of imported?.portals ?? [])
        vision.walls.push(
          wallOf({
            a: portal.a,
            b: portal.b,
            ...(portal.window
              ? { kind: 'window' as const, sight: 'none' as const, light: 'none' as const }
              : { door: 'door' as const })
          })
        )
      for (const light of imported?.lights ?? [])
        vision.lights.push(lightOf({ x: light.x, y: light.y, color: light.color }))
      vision.version++
      return visionView(sceneId)
    },
    updateSceneVision: ({ sceneId, darkness, automaticVision }) => {
      const vision = visionOf(sceneId)
      if (darkness !== undefined) vision.darkness = darkness
      if (automaticVision !== undefined) vision.automaticVision = automaticVision
      vision.version++
      return visionView(sceneId)
    },
    setDoor: ({ campaignId, wallId, open }) => {
      campaignTableOf(campaignId)
      doors.set(`${campaignId}|${wallId}`, open)
      return { wallId, open }
    },
    changeFog: (input) => {
      const target = input.sceneId ?? campaignTableOf(input.campaignId).table.open
      if (!target) throw new ApiError('NO_OPEN_SCENE', 400)
      const key = `${input.campaignId}|${target}`
      fogOps.set(key, [...(fogOps.get(key) ?? []), structuredClone(input)])
      return { sceneId: target, operations: 1 }
    },
    resetFog: ({ campaignId, sceneId }) => {
      const target = sceneId ?? campaignTableOf(campaignId).table.open
      if (!target) throw new ApiError('NO_OPEN_SCENE', 400)
      const removed = fogOps.get(`${campaignId}|${target}`)?.length ?? 0
      fogOps.delete(`${campaignId}|${target}`)
      return { sceneId: target, removed }
    },
    setTileFit: ({ campaignId, tileFit }) => {
      campaignTableOf(campaignId)
      tileFits.set(campaignId, tileFit)
      return tableView(campaignId)
    },
    // Sin niebla en la API falsa: el grupo ve todas las fichas no ocultas
    viewAsParty: ({ campaignId, sceneId }) => {
      const { campaign, table } = campaignTableOf(campaignId)
      const target = sceneId ?? table.open
      if (!target) throw new ApiError('NO_OPEN_SCENE', 400)
      const scene = sceneView(sceneById(target))
      const onScene = tokens.filter((t) => t.campaignId === campaignId && t.sceneId === target).map(tokenOf)
      const seen = onScene.filter((t) => !t.hidden)
      return {
        sceneId: target,
        automaticVision: visionOf(target).automaticVision,
        screen: {
          campaignId,
          campaignName: campaign.name,
          scene: {
            id: scene.id,
            image: scene.image
              ? { width: scene.image.width, height: scene.image.height, tiles: scene.image.tiles }
              : null,
            grid: scene.grid,
            initialView: scene.initialView
          },
          hidden: false,
          camera: structuredClone(table.camera),
          tokens: seen.map((t) => ({
            id: t.id,
            x: t.x,
            y: t.y,
            size: t.size,
            label: t.label,
            name: t.actor.name,
            faction: t.faction,
            img: t.actor.img,
            image: t.image,
            state: null,
            conditions: t.actor.conditions.map((c) => ({ name: c.name }))
          })),
          combat: null
        },
        visibleCells: [],
        visibleCount: 0,
        tokensSeen: seen.map((t) => ({ id: t.id, label: t.label, name: t.actor.name })),
        notSeen: onScene
          .filter((t) => t.hidden)
          .map((t) => ({ id: t.id, label: t.label, name: t.actor.name, hidden: true })),
        secretDoors: visionOf(target)
          .walls.filter((w) => w.door === 'secret')
          .map((w) => ({ id: w.id, open: doors.get(`${campaignId}|${w.id}`) ?? w.open }))
      }
    },
    listMarks: ({ campaignId, sceneId }) => {
      const target = sceneFor(campaignId, sceneId)
      return {
        sceneId: target,
        marks: tableMarks.filter((m) => m.campaignId === campaignId && m.sceneId === target).map(markOf)
      }
    },
    changeMarks: ({ campaignId, sceneId, add, update, remove }) => {
      const target = sceneFor(campaignId, sceneId)
      const changed: MarkView[] = []
      for (const input of add ?? []) {
        const mark = {
          ...input,
          id: crypto.randomUUID(),
          sceneId: target,
          hidden: input.hidden ?? false,
          version: 1,
          campaignId
        }
        tableMarks.push(mark as MarkView & { campaignId: string })
        changed.push(withTargets(markOf(mark as MarkView & { campaignId: string })))
      }
      for (const patch of update ?? []) {
        const index = tableMarks.findIndex((m) => m.id === patch.id)
        const found = tableMarks[index]
        if (!found) throw new ApiError('NOT_FOUND', 404)
        let next = { ...found, ...(patch.set ?? {}), ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}) }
        if (patch.move) next = { ...(shifted(next, patch.move.dx, patch.move.dy) as typeof found), campaignId }
        next.version = found.version + 1
        tableMarks[index] = next as MarkView & { campaignId: string }
        changed.push(withTargets(markOf(tableMarks[index] as MarkView & { campaignId: string })))
      }
      const removed = (remove ?? []).filter((id) => tableMarks.some((m) => m.id === id))
      for (const id of removed)
        tableMarks.splice(
          tableMarks.findIndex((m) => m.id === id),
          1
        )
      return { sceneId: target, marks: changed, removed }
    },
    // Hacia el este, con la casilla de la escena
    placeTemplate: ({ campaignId, sceneId, shape, from, size, color, hidden }) => {
      const target = sceneFor(campaignId, sceneId)
      const a = pointOf(target, from)
      const { grid } = sceneById(target)
      const template = {
        kind: 'template' as const,
        shape,
        a,
        b: { x: a.x + (size / grid.distance) * grid.size, y: a.y },
        color: color ?? '#c9302c',
        id: crypto.randomUUID(),
        sceneId: target,
        hidden: hidden ?? false,
        version: 1,
        tokenIds: [],
        campaignId
      }
      tableMarks.push(template)
      const inside = insideOf(template)
      return { template: { ...markOf(template), tokenIds: inside.map((t) => t.id) }, tokens: inside.map(targetOf) }
    },
    getTemplateTokens: ({ templateId }) => {
      const template = tableMarks.find((m) => m.id === templateId)
      if (template?.kind !== 'template') throw new ApiError('NOT_FOUND', 404)
      return { tokens: insideOf(template).map(targetOf) }
    },
    // En casillas, con todas las diagonales iguales
    measureDistance: ({ campaignId, sceneId, points }) => {
      const target = sceneFor(campaignId, sceneId)
      const { grid } = sceneById(target)
      const at = points.map((p) => pointOf(target, p))
      const segments = at.slice(1).map((p, i) => {
        const q = at[i] as { x: number; y: number }
        return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) / grid.size
      })
      const cells = segments.reduce((sum, n) => sum + n, 0)
      const distance = cells * grid.distance
      return { sceneId: target, cells, distance, units: grid.units, text: `${distance} ${grid.units}`, segments }
    },
    listWidgets: ({ campaignId }) => {
      campaignTableOf(campaignId)
      return { widgets: widgets.filter((w) => w.campaignId === campaignId).map(widgetOf) }
    },
    createWidget: ({ campaignId, kind, ...fields }) => {
      campaignTableOf(campaignId)
      const widget = {
        id: crypto.randomUUID(),
        campaignId,
        kind,
        label: fields.label,
        icon: fields.icon ?? null,
        color: fields.color ?? '#c9302c',
        shown: fields.shown ?? true,
        sort: widgets.filter((w) => w.campaignId === campaignId).length,
        value: fields.value ?? (kind === 'timer' ? (fields.duration ?? 300) : 0),
        min: fields.min ?? null,
        max: fields.max ?? null,
        segments: kind === 'clock' ? (fields.segments ?? 4) : null,
        showCount: fields.showCount ?? false,
        duration: kind === 'timer' ? (fields.duration ?? 300) : null,
        running: null,
        version: 1
      }
      widgets.push(widget)
      return widgetOf(widget)
    },
    updateWidget: ({ widgetId, step, timer, ...patch }) => {
      const widget = widgets.find((w) => w.id === widgetId)
      if (!widget) throw new ApiError('NOT_FOUND', 404)
      for (const [key, value] of Object.entries(patch)) if (value !== undefined) Object.assign(widget, { [key]: value })
      if (step !== undefined) widget.value += step
      if (timer === 'start') widget.running = { since: Date.now(), remaining: widget.value }
      if (timer === 'pause') widget.running = null
      if (timer === 'reset') Object.assign(widget, { running: null, value: widget.duration ?? widget.value })
      widget.version++
      return widgetOf(widget)
    },
    deleteWidget: ({ widgetId }) => {
      const index = widgets.findIndex((w) => w.id === widgetId)
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      widgets.splice(index, 1)
      return { id: widgetId }
    },
    listSnapshots: ({ campaignId, sceneId }) => {
      const target = sceneFor(campaignId, sceneId)
      return {
        sceneId: target,
        snapshots: snapshots
          .filter((s) => s.campaignId === campaignId && s.sceneId === target)
          .map(({ campaignId: _, ...snapshot }) => ({ ...snapshot }))
          .reverse()
      }
    },
    saveSnapshot: ({ campaignId, sceneId, name, thumbnail }) => {
      const target = sceneFor(campaignId, sceneId)
      const snapshot = {
        id: crypto.randomUUID(),
        campaignId,
        sceneId: target,
        name,
        thumbnail: thumbnail ?? null,
        createdAt: new Date().toISOString(),
        tokens: tokens.filter((t) => t.campaignId === campaignId && t.sceneId === target).length,
        marks: tableMarks.filter((m) => m.campaignId === campaignId && m.sceneId === target).length
      }
      snapshots.push(snapshot)
      snapshotData.set(snapshot.id, {
        tokens: tokens
          .filter((t) => t.campaignId === campaignId && t.sceneId === target)
          .map((t) => ({ id: t.id, x: t.x, y: t.y })),
        marks: tableMarks.filter((m) => m.campaignId === campaignId && m.sceneId === target).map(markOf)
      })
      const { campaignId: _, ...view } = snapshot
      return view
    },
    // Las fichas que siguen, a su sitio; lo dejado en el mapa, como estaba (sin la niebla: no la guarda)
    restoreSnapshot: ({ campaignId, snapshotId }) => {
      const snapshot = snapshots.find((s) => s.id === snapshotId && s.campaignId === campaignId)
      const data = snapshotData.get(snapshotId)
      if (!snapshot || !data) throw new ApiError('NOT_FOUND', 404)
      let moved = 0
      for (const saved of data.tokens) {
        const token = tokens.find((t) => t.id === saved.id)
        if (!token) continue
        Object.assign(token, { x: saved.x, y: saved.y })
        moved++
      }
      for (let i = tableMarks.length - 1; i >= 0; i--) {
        const mark = tableMarks[i]
        if (mark?.campaignId === campaignId && mark.sceneId === snapshot.sceneId) tableMarks.splice(i, 1)
      }
      for (const mark of data.marks) tableMarks.push({ ...structuredClone(mark), campaignId })
      return { sceneId: snapshot.sceneId, tokens: moved, marks: data.marks.length, fog: 0, skipped: [] }
    },
    deleteSnapshot: ({ snapshotId }) => {
      const index = snapshots.findIndex((s) => s.id === snapshotId)
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      snapshots.splice(index, 1)
      return { id: snapshotId }
    },
    setMeasureOnScreen: ({ campaignId, on }) => {
      campaignTableOf(campaignId)
      if (on) measureOnScreen.add(campaignId)
      else measureOnScreen.delete(campaignId)
      return { measureOnScreen: on }
    },
    // La API falsa no lee los zips de escenas de Foundry (lo prueba el servidor): dice que no trae ninguna
    inspectFoundryScenes: ({ worldId }) => {
      if (!worlds.some((w) => w.id === worldId)) throw new ApiError('NOT_FOUND', 404)
      throw new ApiError('NO_FOUNDRY_SCENES', 400)
    },
    importFoundryScenes: ({ worldId }) => {
      if (!worlds.some((w) => w.id === worldId)) throw new ApiError('NOT_FOUND', 404)
      throw new ApiError('NO_FOUNDRY_SCENES', 400)
    },
    getCombat: ({ campaignId }) => {
      campaignTableOf(campaignId)
      const combat = combats.get(campaignId)
      return { combat: combat ? sortCombat(combat) : null }
    },
    startCombat: ({ campaignId, tokenIds, skipDefeated }) => {
      const { table } = campaignTableOf(campaignId)
      if (!table.open) throw new ApiError('NO_OPEN_SCENE', 400)
      if (combats.has(campaignId)) throw new ApiError('COMBAT_RUNNING', 400)
      const chosen = tokens.filter(
        (t) => t.campaignId === campaignId && t.sceneId === table.open && (!tokenIds || tokenIds.includes(t.id))
      )
      const combat: CombatView = {
        id: crypto.randomUUID(),
        campaignId,
        sceneId: table.open,
        round: 0,
        turnId: null,
        skipDefeated: skipDefeated ?? true,
        initiativeRoll: null,
        combatants: chosen.map((row) => combatantOf(tokenOf(row)))
      }
      combats.set(campaignId, combat)
      return sortCombat(combat)
    },
    addCombatants: ({ campaignId, tokenIds }) => {
      const combat = combatOf(campaignId)
      for (const id of tokenIds ?? []) {
        if (combat.combatants.some((c) => c.tokenId === id)) continue
        combat.combatants.push(combatantOf(tokenOf(tokenById(id))))
      }
      return sortCombat(combat)
    },
    removeCombatants: ({ campaignId, combatantIds }) => {
      const combat = combatOf(campaignId)
      if (combat.turnId && combatantIds.includes(combat.turnId)) moveTurn(combat, 1)
      combat.combatants = combat.combatants.filter((c) => !combatantIds.includes(c.id))
      return sortCombat(combat)
    },
    // Sin sistema con tirada de iniciativa en la API falsa: se escribe
    rollInitiative: () => {
      throw new ApiError('NO_INITIATIVE_ROLL', 400)
    },
    setInitiative: ({ campaignId, values }) => {
      const combat = combatOf(campaignId)
      for (const value of values) {
        const found = combat.combatants.find((c) => c.id === value.combatantId)
        if (!found) throw new ApiError('NOT_FOUND', 404)
        found.initiative = value.initiative
        if (value.modifier !== undefined) found.modifier = value.modifier
      }
      return sortCombat(combat)
    },
    orderCombatants: ({ campaignId, combatantIds }) => {
      const combat = combatOf(campaignId)
      combatantIds.forEach((id, index) => {
        const found = combat.combatants.find((c) => c.id === id)
        if (found) found.sort = index
      })
      return sortCombat(combat)
    },
    groupCombatants: ({ campaignId, combatantIds, together }) => {
      const combat = combatOf(campaignId)
      const group = together ? crypto.randomUUID() : null
      for (const c of combat.combatants) if (combatantIds.includes(c.id)) c.group = group
      return sortCombat(combat)
    },
    updateCombat: ({ campaignId, skipDefeated }) => {
      const combat = combatOf(campaignId)
      combat.skipDefeated = skipDefeated
      return sortCombat(combat)
    },
    nextTurn: ({ campaignId }) => {
      const combat = combatOf(campaignId)
      sortCombat(combat)
      moveTurn(combat, 1)
      const current = combat.combatants.find((c) => c.id === combat.turnId)
      return {
        combat: sortCombat(combat),
        started: current ? { names: [current.name], expired: [], recharged: [], restored: [] } : null
      }
    },
    previousTurn: ({ campaignId }) => {
      const combat = combatOf(campaignId)
      sortCombat(combat)
      moveTurn(combat, -1)
      return sortCombat(combat)
    },
    // Como el servidor: quita de juego (con sus fichas) las copias a 0, todas o ninguna
    endCombat: ({ campaignId, remove }) => {
      const combat = sortCombat(combatOf(campaignId))
      const mode = remove ?? 'defeated'
      const removed = combat.combatants
        .filter((c) => c.generic && (mode === 'generic' || (mode === 'defeated' && c.defeated)))
        .map((c) => c.actorId)
      combats.delete(campaignId)
      if (removed.length > 0) {
        for (const row of tokens.filter((t) => removed.includes(t.actor.id))) tokens.splice(tokens.indexOf(row), 1)
        handlers.removeFromPlay({ campaignId, creatureIds: removed })
      }
      return { removed }
    },
    setScreenCamera: ({ campaignId, camera }) => {
      campaignTableOf(campaignId).table.camera = structuredClone(camera)
      return tableView(campaignId)
    },
    getMap: ({ tabId }) => {
      tabById(tabId)
      const map = maps.find((m) => m.tabId === tabId)
      if (!map) throw new ApiError('NOT_FOUND', 404)
      return copyMap(map)
    },
    updateMap: ({ mapId, image, scale }) => {
      const map = mapById(mapId)
      if (image) {
        const file = files.find((f) => f.id === image.fileId)
        if (file?.kind !== 'image') throw new ApiError('BAD_MAP_IMAGE', 400)
        map.image = { fileId: file.id, name: file.name, url: file.url, width: image.width, height: image.height }
      }
      if (scale !== undefined) map.scale = scale
      return copyMap(map)
    },
    createMapPin: ({ mapId, x, y, ...rest }) => {
      const map = mapById(mapId)
      const pin: MapPinView = {
        id: crypto.randomUUID(),
        x,
        y,
        label: null,
        pageId: null,
        icon: null,
        color: 'wine',
        shape: 0,
        variant: 0,
        display: 0,
        hidden: false,
        locked: false,
        ...rest,
        pageTitle: null
      }
      if (pin.pageId) pin.pageTitle = pageById(pin.pageId).title
      map.pins.push(pin)
      return { ...pin }
    },
    updateMapPin: ({ pinId, ...patch }) => {
      const { pin } = pinById(pinId)
      Object.assign(pin, patch)
      pin.pageTitle = pin.pageId ? pageById(pin.pageId).title : null
      return { ...pin }
    },
    deleteMapPin: ({ pinId }) => {
      const { map, pin } = pinById(pinId)
      map.pins.splice(map.pins.indexOf(pin), 1)
      return { id: pinId }
    },
    listAccountTags: ({ organizationId }) => {
      const target = ownOrganization(organizationId)
      return { organizationId: target, tags: catalogOf(target) }
    },
    createTag: ({ organizationId, name, color }) => {
      const target = ownOrganization(organizationId)
      const existing = catalogOf(target).find((tag) => tagKey(tag.name) === tagKey(name))
      if (existing?.id) throw new ApiError('TAG_TAKEN', 400)
      tagRows.push({
        id: crypto.randomUUID(),
        organizationId: target,
        name: existing?.name ?? name,
        color: color ?? null
      })
      return tagIn(target, name)
    },
    updateTag: ({ organizationId, tag, name, color }) => {
      const target = ownOrganization(organizationId)
      const current = tagIn(target, tag)
      let now = current.name
      if (name !== undefined && name !== current.name) {
        retag(target, current.name, name)
        now = name
      }
      if (color !== undefined) {
        const row = tagRows.find((r) => r.organizationId === target && tagKey(r.name) === tagKey(now))
        if (row) row.color = color
        else tagRows.push({ id: crypto.randomUUID(), organizationId: target, name: now, color })
      }
      return tagIn(target, now)
    },
    deleteTag: ({ organizationId, tag }) => {
      const target = ownOrganization(organizationId)
      const current = tagIn(target, tag)
      return { name: current.name, ...retag(target, current.name, null) }
    },
    setFileTags: ({ fileId, tags }) => {
      const file = fileById(fileId)
      file.tags = uniqueTags(tags)
      file.version++
      return { id: file.id, tags: file.tags }
    },
    renameFile: ({ fileId, name }) => {
      const file = fileById(fileId)
      if (files.some((f) => f !== file && f.worldId === file.worldId && f.name.toLowerCase() === name.toLowerCase())) {
        throw new ApiError('NAME_TAKEN', 400)
      }
      file.name = name
      file.version++
      return { ...file }
    },
    deleteFile: ({ fileId }) => {
      const file = fileById(fileId)
      files.splice(files.indexOf(file), 1)
      trashedFiles.unshift(file)
      return { id: file.id, name: file.name }
    },
    restoreFile: ({ fileId }) => {
      const index = trashedFiles.findIndex((f) => f.id === fileId)
      const file = trashedFiles[index]
      if (!file) throw new ApiError('NOT_FOUND', 404)
      trashedFiles.splice(index, 1)
      files.push(file)
      return { id: file.id, name: file.name }
    },
    getPageContent: ({ pageId }) => {
      const page = pageById(pageId)
      const { path } = pageView(page)
      return {
        page: { id: page.id, title: page.title, icon: page.icon, path, summary: null, cover: page.cover ?? null },
        blocks: [],
        truncated: false
      }
    },
    linkMention: () => ({ linked: false }),
    listPageNames: ({ worldId }) => {
      const inWorld = pages.filter((page) => page.worldId === worldId)
      const pathOf = (page: StoredPage): string[] => {
        const parent = inWorld.find((p) => p.id === page.parentId)
        return [...(parent ? pathOf(parent) : []), page.title]
      }
      return {
        pages: inWorld.map((page) => {
          const alias = page.properties.find((p) => p.name === 'alias')
          const tags = page.properties.find((p) => p.name === 'etiquetas')
          return {
            id: page.id,
            title: page.title,
            aliases: alias?.type === 'list' ? alias.value : [],
            path: pathOf(page),
            tags: tags?.type === 'list' ? tags.value : []
          }
        })
      }
    },
    listPageTree: ({ worldId, parentId, levels }) => {
      const tree: Array<ReturnType<typeof summary> & { level: number }> = []
      const visit = (from: string | null, level: number) => {
        if (level > (levels ?? 2)) return
        for (const page of childrenOf(worldId, from)) {
          tree.push({ ...summary(page), level })
          visit(page.id, level + 1)
        }
      }
      visit(parentId ?? null, 1)
      return { pages: tree.map(({ worldId: _, version: __, ...rest }) => rest) }
    },
    // Sin fechas: las últimas creadas, primero
    listRecentPages: ({ worldId, limit }) => {
      const pathOf = (page: StoredPage): { id: string; title: string }[] => {
        const parent = pages.find((p) => p.id === page.parentId)
        return parent ? [...pathOf(parent), { id: parent.id, title: parent.title }] : []
      }
      return {
        pages: pages
          .filter((page) => page.worldId === worldId && !trashedPages.some((t) => [t.root, ...t.below].includes(page)))
          .reverse()
          .slice(0, limit ?? 6)
          .map((page) => ({
            id: page.id,
            title: page.title,
            icon: page.icon,
            cover: page.cover ?? null,
            path: pathOf(page),
            editedAt: new Date().toISOString()
          }))
      }
    }
  }

  const client: ApiClient = {
    async call(name, input) {
      calls.push(name)
      return handlers[name](input as never) as never
    },
    async exportWiki(input) {
      calls.push('exportWiki')
      const page = input.pageId ? pageById(input.pageId) : null
      return { name: `${page?.title ?? 'Eana'}.zip`, data: new Blob(['zip']) }
    },
    async downloadPdf(pageId) {
      calls.push('downloadPdf')
      return { name: `${pageById(pageId).title}.pdf`, data: new Blob(['%PDF']) }
    },
    // Sube al momento, en dos pasos de progreso; el tipo, por el que dice el Blob
    async uploadFile(target, blob, onProgress, signal) {
      calls.push('uploadFile')
      if (signal?.aborted) throw new ApiError('CANCELLED', 0)
      onProgress?.(0.5)
      onProgress?.(1)
      const kind = blob.type.startsWith('image/') ? 'image' : blob.type === 'application/pdf' ? 'pdf' : 'other'
      const content = { kind, mime: blob.type || 'application/octet-stream', size: blob.size } as const
      if ('fileId' in target) {
        const file = fileById(target.fileId)
        Object.assign(file, content, { version: file.version + 1 })
        return { ...file }
      }
      const worldId = 'worldId' in target ? target.worldId : null
      const organizationId = 'organizationId' in target ? target.organizationId : organizationOf(worldId)
      const taken = (name: string) =>
        files.some(
          (f) =>
            f.worldId === worldId && f.organizationId === organizationId && f.name.toLowerCase() === name.toLowerCase()
        )
      let name = target.name
      for (let n = 2; taken(name); n++) name = target.name.replace(/(\.[^.]*)?$/, ` (${n})$1`)
      const file = fileOf({ worldId, organizationId, name, folderId: target.folderId ?? null, ...content })
      files.push(file)
      return { ...file }
    }
  }
  return { client, calls, worlds, campaigns, history, approvals, pages, files, shownPages }
}
