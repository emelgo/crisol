import { describe, expect, it } from 'vitest'
import {
  type Actor,
  actorFrom,
  authorize,
  type Capability,
  ForbiddenError,
  NotFoundError,
  ownedOrganizations
} from './policy.ts'

const ORG = 'org-1'
const OTHER_ORG = 'org-2'
const WORLD = 'world-1'
const OTHER_WORLD = 'world-2'
const CAMPAIGN = 'campaign-1'
const OTHER_CAMPAIGN = 'campaign-2'

const actor = (overrides: Partial<Actor>): Actor => ({
  userId: 'u1',
  organizations: new Map(),
  worlds: new Map(),
  campaigns: new Map(),
  ...overrides
})

// Quiénes hay en el módulo 0
const owner = actor({
  organizations: new Map([[ORG, 'owner']]),
  worlds: new Map([[WORLD, { organizationId: ORG, role: 'master' }]])
})
const member = actor({ organizations: new Map([[ORG, 'member']]) })
const outsider = actor({ organizations: new Map([[OTHER_ORG, 'owner']]) })
const player = actor({
  organizations: new Map([[ORG, 'member']]),
  campaigns: new Map([[CAMPAIGN, { worldId: WORLD, role: 'player' }]])
})
const campaign = { campaignId: CAMPAIGN, worldId: WORLD }
const otherCampaign = { campaignId: OTHER_CAMPAIGN, worldId: WORLD }

type Outcome = 'permite' | 'prohíbe' | 'no lo ve'

const outcome = (who: Actor, capability: Capability, target: Parameters<typeof authorize>[2]): Outcome => {
  try {
    authorize(who, capability, target)
    return 'permite'
  } catch (error) {
    if (error instanceof ForbiddenError) return 'prohíbe'
    if (error instanceof NotFoundError) return 'no lo ve'
    throw error
  }
}

describe('authorize', () => {
  const cases: Array<[string, Actor, Capability, Parameters<typeof authorize>[2], Outcome]> = [
    ['el propietario crea mundos en su organización', owner, 'world.create', { organizationId: ORG }, 'permite'],
    ['un miembro no crea mundos', member, 'world.create', { organizationId: ORG }, 'prohíbe'],
    ['nadie crea mundos en una organización ajena', outsider, 'world.create', { organizationId: ORG }, 'no lo ve'],
    ['el máster ve su mundo', owner, 'world.read', { worldId: WORLD }, 'permite'],
    ['el máster renombra su mundo', owner, 'world.rename', { worldId: WORLD }, 'permite'],
    ['un miembro sin campaña no ve el mundo', member, 'world.read', { worldId: WORLD }, 'no lo ve'],
    ['un miembro sin campaña no renombra el mundo', member, 'world.rename', { worldId: WORLD }, 'no lo ve'],
    ['nadie ve un mundo ajeno', outsider, 'world.read', { worldId: WORLD }, 'no lo ve'],
    ['ni el máster ve un mundo que no es suyo', owner, 'world.rename', { worldId: OTHER_WORLD }, 'no lo ve'],
    ['el máster crea campañas en su mundo', owner, 'campaign.create', { worldId: WORLD }, 'permite'],
    ['el máster del mundo ve y renombra sus campañas', owner, 'campaign.rename', campaign, 'permite'],
    ['un jugador ve el mundo en el que juega', player, 'world.read', { worldId: WORLD }, 'permite'],
    ['un jugador no renombra el mundo en el que juega', player, 'world.rename', { worldId: WORLD }, 'prohíbe'],
    ['un jugador no crea campañas', player, 'campaign.create', { worldId: WORLD }, 'prohíbe'],
    ['un jugador ve su campaña', player, 'campaign.read', campaign, 'permite'],
    ['un jugador no renombra su campaña', player, 'campaign.rename', campaign, 'prohíbe'],
    ['un jugador no ve otra campaña del mismo mundo', player, 'campaign.read', otherCampaign, 'no lo ve'],
    ['nadie ve campañas de un mundo ajeno', outsider, 'campaign.read', campaign, 'no lo ve'],
    ['un miembro sin campaña no ve las campañas', member, 'campaign.read', campaign, 'no lo ve'],
    ['el máster gestiona el enlace de invitación', owner, 'campaign.invite', campaign, 'permite'],
    ['un jugador no ve el enlace de su campaña', player, 'campaign.invite', campaign, 'prohíbe'],
    ['nadie gestiona el enlace de una campaña ajena', outsider, 'campaign.invite', campaign, 'no lo ve']
  ]

  it.each(cases)('%s', (_, who, capability, target, expected) => {
    expect(outcome(who, capability, target)).toBe(expected)
  })
})

describe('actorFrom', () => {
  it('reúne las pertenencias por organización y por mundo', () => {
    const built = actorFrom('u1', {
      organizations: [
        { organizationId: ORG, role: 'owner' },
        { organizationId: OTHER_ORG, role: 'member' }
      ],
      worlds: [{ worldId: WORLD, organizationId: ORG, role: 'master' }],
      campaigns: [{ campaignId: CAMPAIGN, worldId: WORLD, role: 'master' }]
    })
    expect(built.userId).toBe('u1')
    expect(built.campaigns.get(CAMPAIGN)).toEqual({ worldId: WORLD, role: 'master' })
    expect(built.organizations.get(OTHER_ORG)).toBe('member')
    expect(built.worlds.get(WORLD)).toEqual({ organizationId: ORG, role: 'master' })
  })

  it('ownedOrganizations da solo las de propietario', () => {
    const built = actorFrom('u1', {
      organizations: [
        { organizationId: ORG, role: 'owner' },
        { organizationId: OTHER_ORG, role: 'member' }
      ],
      worlds: [],
      campaigns: []
    })
    expect(ownedOrganizations(built)).toEqual([ORG])
  })
})
