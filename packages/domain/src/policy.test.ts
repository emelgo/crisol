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

const actor = (overrides: Partial<Actor>): Actor => ({
  userId: 'u1',
  organizations: new Map(),
  worlds: new Map(),
  ...overrides
})

// Quiénes hay en el módulo 0
const owner = actor({
  organizations: new Map([[ORG, 'owner']]),
  worlds: new Map([[WORLD, { organizationId: ORG, role: 'master' }]])
})
const member = actor({ organizations: new Map([[ORG, 'member']]) })
const outsider = actor({ organizations: new Map([[OTHER_ORG, 'owner']]) })

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
    ['ni el máster ve un mundo que no es suyo', owner, 'world.rename', { worldId: OTHER_WORLD }, 'no lo ve']
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
      worlds: [{ worldId: WORLD, organizationId: ORG, role: 'master' }]
    })
    expect(built.userId).toBe('u1')
    expect(built.organizations.get(OTHER_ORG)).toBe('member')
    expect(built.worlds.get(WORLD)).toEqual({ organizationId: ORG, role: 'master' })
  })

  it('ownedOrganizations da solo las de propietario', () => {
    const built = actorFrom('u1', {
      organizations: [
        { organizationId: ORG, role: 'owner' },
        { organizationId: OTHER_ORG, role: 'member' }
      ],
      worlds: []
    })
    expect(ownedOrganizations(built)).toEqual([ORG])
  })
})
