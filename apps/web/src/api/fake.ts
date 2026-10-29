/** API en memoria para las pruebas de componentes: mundos, campañas y sus miembros de una organización */
import type {
  AiMode,
  Approval,
  Campaign,
  HistoryEntry,
  Invitation,
  Member,
  Organization,
  Page,
  TrashItem,
  World
} from '@crisol/contracts'
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
    pages?: Array<{ id?: string; worldId: string; parentId?: string | null; title: string }>
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
  type StoredPage = { id: string; worldId: string; parentId: string | null; title: string; version: number }
  const pages: StoredPage[] = (options.pages ?? []).map((page) => ({
    id: page.id ?? crypto.randomUUID(),
    worldId: page.worldId,
    parentId: page.parentId ?? null,
    title: page.title,
    version: 1
  }))
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
    icon: null,
    hasChildren: childrenOf(page.worldId, page.id).length > 0,
    version: page.version
  })
  const pageView = (page: StoredPage): Page => {
    const path: { id: string; title: string }[] = []
    for (let at: StoredPage | undefined = page; at; at = pages.find((p) => p.id === at?.parentId)) {
      path.unshift({ id: at.id, title: at.title })
    }
    return { ...summary(page), locked: false, path, updatedAt: new Date().toISOString() }
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

  const handlers: { [N in ActionName]: (input: ActionInput<N>) => ActionOutput<N> } = {
    listOrganizations: () => ({ organizations }),
    // Copias, como las de la API real (JSON nuevo en cada respuesta)
    listWorlds: () => ({ worlds: worlds.map((w) => ({ ...w })).sort((a, b) => a.name.localeCompare(b.name)) }),
    createWorld: ({ name }) => {
      const owned = organizations.find((o) => o.role === 'owner')
      if (!owned) throw new ApiError('ORGANIZATION_REQUIRED', 400)
      const world: World = {
        id: crypto.randomUUID(),
        organizationId: owned.id,
        name: name.trim(),
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
    listCampaigns: ({ worldId }) => ({
      campaigns: campaigns
        .filter((c) => c.worldId === worldId)
        .map((c) => ({ ...c }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }),
    createCampaign: ({ worldId, name }) => {
      const campaign: Campaign = { id: crypto.randomUUID(), worldId, name: name.trim(), role: 'master', version: 1 }
      campaigns.push(campaign)
      return campaign
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
      items: trash
        .map((t) => ({ ...t.item }))
        .filter((item) =>
          worldId
            ? item.kind === 'campaign' && item.worldId === worldId
            : item.kind === 'world' || worlds.some((w) => w.id === item.worldId)
        )
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
    createPage: ({ worldId, title, parentId, before, after }) => {
      if (parentId) pageById(parentId)
      const page = { id: crypto.randomUUID(), worldId, parentId: parentId ?? null, title, version: 1 }
      place(page, before, after)
      return pageView(page)
    },
    updatePage: ({ pageId, title }) => {
      const page = pageById(pageId)
      Object.assign(page, { title, version: page.version + 1 })
      return pageView(page)
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
    listPageChildren: ({ worldId, parentId }) => ({ pages: childrenOf(worldId, parentId ?? null).map(summary) }),
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
    }
  }

  const client: ApiClient = {
    async call(name, input) {
      calls.push(name)
      return handlers[name](input as never) as never
    }
  }
  return { client, calls, worlds, campaigns, history, approvals, pages }
}
