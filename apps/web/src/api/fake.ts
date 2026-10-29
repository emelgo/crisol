/** API en memoria para las pruebas de componentes: mundos, campañas y sus miembros de una organización */
import type { Campaign, HistoryEntry, Invitation, Member, Organization, World } from '@crisol/contracts'
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
  } = {}
) {
  const organizations = options.organizations ?? []
  const worlds = [...(options.worlds ?? [])]
  const campaigns = [...(options.campaigns ?? [])]
  const history = [...(options.history ?? [])]
  const members = new Map(Object.entries(options.members ?? {}).map(([id, list]) => [id, [...list]]))
  const membersOf = (campaignId: string) => ({ members: (members.get(campaignId) ?? []).map((m) => ({ ...m })) })
  const calls: string[] = []
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
    // Quien sale deja de ver la campaña
    leaveCampaign: ({ campaignId }) => {
      const index = campaigns.findIndex((c) => c.id === campaignId)
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      campaigns.splice(index, 1)
      return {}
    }
  }

  const client: ApiClient = {
    async call(name, input) {
      calls.push(name)
      return handlers[name](input as never) as never
    }
  }
  return { client, calls, worlds, campaigns, history }
}
