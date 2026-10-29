/**
 * La capa de políticas: decide si una cuenta puede hacer algo sobre un recurso. Todo (API, MCP, trabajos) pasa por
 * aquí. Para cada capacidad hay dos preguntas: si la cuenta ve el recurso (si no, para ella no existe) y si puede
 * hacer eso.
 */
export type OrganizationRole = 'owner' | 'member'
export type WorldRole = 'master'
export type CampaignRole = 'master' | 'player'

/** Lo que el servidor sabe de quién pide algo: sus pertenencias, leídas en cada petición */
export interface Actor {
  userId: string
  organizations: ReadonlyMap<string, OrganizationRole>
  worlds: ReadonlyMap<string, { organizationId: string; role: WorldRole }>
  campaigns: ReadonlyMap<string, { worldId: string; role: CampaignRole }>
}

/** Sobre qué: una organización, un mundo o una campaña (con su mundo) */
export type Target = { organizationId: string } | { worldId: string } | { campaignId: string; worldId: string }

type Predicate = (actor: Actor, target: Target) => boolean

const isOrganizationMember: Predicate = (actor, target) =>
  'organizationId' in target && actor.organizations.has(target.organizationId)
const isOrganizationOwner: Predicate = (actor, target) =>
  'organizationId' in target && actor.organizations.get(target.organizationId) === 'owner'
const isWorldMaster: Predicate = (actor, target) =>
  'worldId' in target && actor.worlds.get(target.worldId)?.role === 'master'
const playsInWorld: Predicate = (actor, target) =>
  'worldId' in target && [...actor.campaigns.values()].some((c) => c.worldId === target.worldId)
const isCampaignMember: Predicate = (actor, target) => 'campaignId' in target && actor.campaigns.has(target.campaignId)
const isCampaignMaster: Predicate = (actor, target) =>
  'campaignId' in target && actor.campaigns.get(target.campaignId)?.role === 'master'

const any =
  (...predicates: Predicate[]): Predicate =>
  (actor, target) =>
    predicates.some((p) => p(actor, target))

/** Ve el mundo: lo administra o juega en alguna de sus campañas */
const seesWorld = any(isWorldMaster, playsInWorld)
/** Ve la campaña: administra su mundo o está en ella */
const seesCampaign = any(isWorldMaster, isCampaignMember)

const RULES = {
  'world.create': { sees: isOrganizationMember, allows: isOrganizationOwner },
  'world.read': { sees: seesWorld, allows: seesWorld },
  'world.rename': { sees: seesWorld, allows: isWorldMaster },
  'campaign.create': { sees: seesWorld, allows: isWorldMaster },
  'campaign.read': { sees: seesCampaign, allows: seesCampaign },
  'campaign.rename': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) }
} satisfies Record<string, { sees: Predicate; allows: Predicate }>

export type Capability = keyof typeof RULES

/** La cuenta no puede ver el recurso: para ella no existe */
export class NotFoundError extends Error {
  override name = 'NotFoundError'
}

/** La cuenta ve el recurso, pero no puede hacer eso */
export class ForbiddenError extends Error {
  override name = 'ForbiddenError'
}

export function authorize(actor: Actor, capability: Capability, target: Target): void {
  const rule = RULES[capability]
  if (!rule.sees(actor, target)) throw new NotFoundError(capability)
  if (!rule.allows(actor, target)) throw new ForbiddenError(capability)
}

/** Construye el actor a partir de sus pertenencias (tal como las lee la base de datos) */
export function actorFrom(
  userId: string,
  memberships: {
    organizations: ReadonlyArray<{ organizationId: string; role: OrganizationRole }>
    worlds: ReadonlyArray<{ worldId: string; organizationId: string; role: WorldRole }>
    campaigns: ReadonlyArray<{ campaignId: string; worldId: string; role: CampaignRole }>
  }
): Actor {
  return {
    userId,
    organizations: new Map(memberships.organizations.map((m) => [m.organizationId, m.role])),
    worlds: new Map(memberships.worlds.map((m) => [m.worldId, { organizationId: m.organizationId, role: m.role }])),
    campaigns: new Map(memberships.campaigns.map((m) => [m.campaignId, { worldId: m.worldId, role: m.role }]))
  }
}

/** Las organizaciones de las que la cuenta es propietaria */
export function ownedOrganizations(actor: Actor): string[] {
  return [...actor.organizations].filter(([, role]) => role === 'owner').map(([id]) => id)
}
