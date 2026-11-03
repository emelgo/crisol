/** API en memoria para las pruebas de componentes: mundos, campañas y sus miembros de una organización */
import type {
  AiMode,
  Approval,
  Campaign,
  FileView,
  FolderView,
  HistoryEntry,
  Invitation,
  MapPinView,
  MapView,
  Member,
  Organization,
  Page,
  PageProperty,
  PageTables,
  PageTabView,
  PageTemplate,
  TagView,
  TrashItem,
  World
} from '@crisol/contracts'
import {
  BUILT_IN_TEMPLATES,
  builtInTemplate,
  instantiate,
  removeTagIn,
  renameTagIn,
  tagKey,
  tagTree,
  uniqueTags
} from '@crisol/domain'
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
  } = {}
) {
  const organizations = options.organizations ?? []
  const worlds = [...(options.worlds ?? [])]
  const campaigns = [...(options.campaigns ?? [])]
  const history = [...(options.history ?? [])]
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
  // Las tablas que se llenan solas, como el servidor: las de su plantilla (o sus copias) con el campo hacia esta página
  const lineOf = (page: StoredPage) => (page.template ? (builtInTemplate(page.template)?.line ?? [page.template]) : [])
  const tablesOf = (page: StoredPage): PageTables => {
    const blocks = (page.panel ?? []).filter((block) => block.type === 'related')
    const linked = new Map<string, string>()
    const tables = blocks.map((block) => {
      const template = builtInTemplate(block.template)
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
    createCampaign: ({ worldId, name }) => {
      const campaign: Campaign = {
        id: crypto.randomUUID(),
        worldId,
        name: name.trim(),
        description: '',
        color: null,
        cover: null,
        role: 'master',
        version: 1
      }
      campaigns.push(campaign)
      return campaign
    },
    updateCampaign: ({ campaignId, ...patch }) => {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) throw new ApiError('NOT_FOUND', 404)
      if (patch.name !== undefined) campaign.name = patch.name.trim()
      if (patch.description !== undefined) campaign.description = patch.description.trim()
      if (patch.color !== undefined) campaign.color = patch.color
      if (patch.cover !== undefined) campaign.cover = patch.cover
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
      const from = template ? builtInTemplate(template) : undefined
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
    createPages: () => {
      throw new ApiError('UNSUPPORTED', 400)
    },
    editPage: ({ pageId }) => ({ page: pageView(pageById(pageId)), changedBlocks: [], changedSinceRequest: false }),
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
      return { incoming: [], outgoing: [], mentions: [] }
    },
    listUnresolvedLinks: () => ({ links: [] }),
    listPageVersions: () => ({ versions: [] }),
    getPageVersion: () => {
      throw new ApiError('NOT_FOUND', 404)
    },
    restorePageVersion: () => ({ restored: false }),
    // Por el título, sin tildes ni mayúsculas (la de verdad la prueban las del servidor)
    // Las plantillas de serie, como el servidor (las de la cuenta, con la tarea 9)
    listTemplates: () => ({ templates: structuredClone([...BUILT_IN_TEMPLATES]) as PageTemplate[] }),
    getTemplate: ({ templateId }) => {
      const found = builtInTemplate(templateId)
      if (!found) throw new ApiError('NOT_FOUND', 404)
      return structuredClone(found) as PageTemplate
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
        name: name ?? (kind === 'text' ? 'Texto 2' : 'Mapa'),
        hidden: false,
        documentId: kind === 'text' ? crypto.randomUUID() : null,
        color: null
      }
      pageTabs.push(tab)
      maps.push({ id: crypto.randomUUID(), tabId: tab.id, pageId, image: null, scale: null, pins: [] })
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
      return { id: tabId }
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
  return { client, calls, worlds, campaigns, history, approvals, pages, files }
}
