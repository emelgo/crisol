import { describe, expect, it } from 'vitest'
import {
  type Actor,
  actorFrom,
  authorize,
  type Capability,
  can,
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
// Dirige la campaña sin administrar el mundo (más adelante, con los comásteres)
const master = actor({
  organizations: new Map([[ORG, 'member']]),
  campaigns: new Map([[CAMPAIGN, { worldId: WORLD, role: 'master' }]])
})
const campaign = { campaignId: CAMPAIGN, worldId: WORLD }
// Propietario de la organización sin administrar el mundo
const ownerOnly = actor({ organizations: new Map([[ORG, 'owner']]) })
// Administra un mundo de la organización sin ser su propietario
const worldMaster = actor({
  organizations: new Map([[ORG, 'member']]),
  worlds: new Map([[OTHER_WORLD, { organizationId: ORG, role: 'master' }]])
})
// La wiki: el mundo con su organización (la del mundo, nunca la que diga quien pide)
const wiki = { worldId: WORLD, organizationId: ORG }
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
    ['nadie gestiona el enlace de una campaña ajena', outsider, 'campaign.invite', campaign, 'no lo ve'],
    ['el máster expulsa en sus campañas', owner, 'campaign.removeMember', campaign, 'permite'],
    [
      'el máster de la campaña expulsa aunque no administre el mundo',
      master,
      'campaign.removeMember',
      campaign,
      'permite'
    ],
    ['un jugador no expulsa', player, 'campaign.removeMember', campaign, 'prohíbe'],
    ['nadie expulsa en una campaña ajena', outsider, 'campaign.removeMember', campaign, 'no lo ve'],
    ['un jugador sale de su campaña', player, 'campaign.leave', campaign, 'permite'],
    ['el máster de la campaña no sale de ella', master, 'campaign.leave', campaign, 'prohíbe'],
    [
      'quien administra el mundo no sale de una campaña en la que no está',
      owner,
      'campaign.leave',
      campaign,
      'prohíbe'
    ],
    ['nadie sale de una campaña que no ve', player, 'campaign.leave', otherCampaign, 'no lo ve'],
    ['el máster ve el historial de su mundo', owner, 'world.history', { worldId: WORLD }, 'permite'],
    ['un jugador no ve el historial del mundo en el que juega', player, 'world.history', { worldId: WORLD }, 'prohíbe'],
    ['nadie ve el historial de un mundo ajeno', outsider, 'world.history', { worldId: WORLD }, 'no lo ve'],
    [
      'el propietario ve el historial de la organización',
      owner,
      'organization.history',
      { organizationId: ORG },
      'permite'
    ],
    [
      'un miembro no ve el historial de la organización',
      member,
      'organization.history',
      { organizationId: ORG },
      'prohíbe'
    ],
    ['nadie ve el de otra organización', outsider, 'organization.history', { organizationId: ORG }, 'no lo ve'],
    ['el máster deshace en su mundo', owner, 'world.undo', { worldId: WORLD }, 'permite'],
    ['un jugador no deshace en el mundo en el que juega', player, 'world.undo', { worldId: WORLD }, 'prohíbe'],
    ['nadie deshace en un mundo ajeno', outsider, 'world.undo', { worldId: WORLD }, 'no lo ve'],
    ['el propietario deshace en la organización', owner, 'organization.undo', { organizationId: ORG }, 'permite'],
    ['un miembro no deshace en la organización', member, 'organization.undo', { organizationId: ORG }, 'prohíbe'],
    ['el máster borra su mundo', owner, 'world.delete', { worldId: WORLD }, 'permite'],
    ['un jugador no borra el mundo en el que juega', player, 'world.delete', { worldId: WORLD }, 'prohíbe'],
    ['el máster borra las campañas de su mundo', owner, 'campaign.delete', campaign, 'permite'],
    ['el máster de la campaña la borra', master, 'campaign.delete', campaign, 'permite'],
    ['un jugador no borra su campaña', player, 'campaign.delete', campaign, 'prohíbe'],
    ['nadie borra lo de otra organización', outsider, 'campaign.delete', campaign, 'no lo ve'],
    ['el máster ve y vacía la papelera de su mundo', owner, 'world.trash', { worldId: WORLD }, 'permite'],
    ['un jugador no ve la papelera del mundo', player, 'world.trash', { worldId: WORLD }, 'prohíbe'],
    [
      'el propietario ve la papelera de la organización',
      owner,
      'organization.trash',
      { organizationId: ORG },
      'permite'
    ],
    ['un miembro no la ve', member, 'organization.trash', { organizationId: ORG }, 'prohíbe'],
    ['el máster lee la wiki de su mundo', owner, 'page.read', wiki, 'permite'],
    ['el máster escribe en la wiki de su mundo', owner, 'page.write', wiki, 'permite'],
    ['el propietario lee la wiki aunque no administre el mundo', ownerOnly, 'page.read', wiki, 'permite'],
    ['el propietario escribe en ella', ownerOnly, 'page.write', wiki, 'permite'],
    ['un jugador no ve la wiki del mundo en el que juega (hasta el módulo 5)', player, 'page.read', wiki, 'no lo ve'],
    ['el máster de una campaña tampoco', master, 'page.read', wiki, 'no lo ve'],
    ['un miembro sin campaña, tampoco', member, 'page.write', wiki, 'no lo ve'],
    ['nadie de otra organización', outsider, 'page.read', wiki, 'no lo ve'],
    ['el máster cambia el compendio de su mundo', owner, 'worldContent.write', wiki, 'permite'],
    ['el propietario lo lee aunque no administre el mundo', ownerOnly, 'worldContent.read', wiki, 'permite'],
    ['un jugador no ve el compendio del mundo (hasta el módulo 5)', player, 'worldContent.read', wiki, 'no lo ve'],
    ['el máster de una campaña tampoco lo cambia', master, 'worldContent.write', wiki, 'no lo ve'],
    ['nadie de otra organización lo lee', outsider, 'worldContent.read', wiki, 'no lo ve'],
    // Los archivos comunes de la organización (ADR-0005)
    ['el propietario ve los comunes', ownerOnly, 'commonFiles.read', { organizationId: ORG }, 'permite'],
    ['y los cambia', ownerOnly, 'commonFiles.write', { organizationId: ORG }, 'permite'],
    [
      'el máster de un mundo de la organización los ve',
      worldMaster,
      'commonFiles.read',
      { organizationId: ORG },
      'permite'
    ],
    ['pero no los cambia', worldMaster, 'commonFiles.write', { organizationId: ORG }, 'prohíbe'],
    [
      'las etiquetas de la cuenta: el propietario las gestiona',
      ownerOnly,
      'tags.write',
      { organizationId: ORG },
      'permite'
    ],
    ['un máster las ve (para ponerlas)', worldMaster, 'tags.read', { organizationId: ORG }, 'permite'],
    ['pero no las gestiona', worldMaster, 'tags.write', { organizationId: ORG }, 'prohíbe'],
    ['un jugador no los ve', player, 'commonFiles.read', { organizationId: ORG }, 'no lo ve'],
    ['nadie de otra organización', outsider, 'commonFiles.read', { organizationId: ORG }, 'no lo ve'],
    // Las tiradas de una campaña (ADR-0010)
    ['un jugador tira en su campaña', player, 'dice.roll', campaign, 'permite'],
    ['y lee su registro', player, 'dice.read', campaign, 'permite'],
    ['pero no recibe las privadas de los demás', player, 'dice.private', campaign, 'prohíbe'],
    ['el máster de la campaña las recibe', master, 'dice.private', campaign, 'permite'],
    ['el máster del mundo tira en cualquiera de sus campañas', owner, 'dice.roll', campaign, 'permite'],
    ['y recibe sus privadas', owner, 'dice.private', campaign, 'permite'],
    ['un jugador no tira en otra campaña', player, 'dice.roll', otherCampaign, 'no lo ve'],
    ['nadie de otra organización', outsider, 'dice.read', campaign, 'no lo ve']
  ]

  it.each(cases)('%s', (_, who, capability, target, expected) => {
    expect(outcome(who, capability, target)).toBe(expected)
  })
})

describe('can', () => {
  it('dice sí o no sin lanzar: para elegir a quién le llega un evento', () => {
    expect(can(player, 'campaign.read', campaign)).toBe(true)
    expect(can(player, 'campaign.read', otherCampaign)).toBe(false)
    expect(can(player, 'campaign.invite', campaign)).toBe(false)
    expect(can(owner, 'campaign.invite', campaign)).toBe(true)
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
