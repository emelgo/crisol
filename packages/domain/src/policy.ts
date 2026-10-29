/**
 * La capa de políticas: decide si una cuenta puede hacer algo sobre un recurso. Todo (API, MCP, trabajos) pasa por
 * aquí. Si la cuenta ni siquiera puede ver el recurso, se responde como si no existiera.
 */
export type OrganizationRole = 'owner' | 'member'
export type WorldRole = 'master'

/** Lo que el servidor sabe de quién pide algo: sus pertenencias, leídas en cada petición */
export interface Actor {
  userId: string
  organizations: ReadonlyMap<string, OrganizationRole>
  worlds: ReadonlyMap<string, { organizationId: string; role: WorldRole }>
}

export type Target = { organizationId: string } | { worldId: string }

type Decision = 'allow' | 'forbidden' | 'hidden'
type Rule = (actor: Actor, target: Target) => Decision

/** Se decide por el rol en la organización */
const organizationRoles =
  (...roles: OrganizationRole[]): Rule =>
  (actor, target) => {
    if (!('organizationId' in target)) return 'hidden'
    const role = actor.organizations.get(target.organizationId)
    if (!role) return 'hidden'
    return roles.includes(role) ? 'allow' : 'forbidden'
  }

/** Se decide por el rol en el mundo */
const worldRoles =
  (...roles: WorldRole[]): Rule =>
  (actor, target) => {
    if (!('worldId' in target)) return 'hidden'
    const membership = actor.worlds.get(target.worldId)
    if (!membership) return 'hidden'
    return roles.includes(membership.role) ? 'allow' : 'forbidden'
  }

const RULES = {
  'world.create': organizationRoles('owner'),
  'world.read': worldRoles('master'),
  'world.rename': worldRoles('master')
} satisfies Record<string, Rule>

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
  const decision = RULES[capability](actor, target)
  if (decision === 'hidden') throw new NotFoundError(capability)
  if (decision === 'forbidden') throw new ForbiddenError(capability)
}

/** Construye el actor a partir de sus pertenencias (tal como las lee la base de datos) */
export function actorFrom(
  userId: string,
  memberships: {
    organizations: ReadonlyArray<{ organizationId: string; role: OrganizationRole }>
    worlds: ReadonlyArray<{ worldId: string; organizationId: string; role: WorldRole }>
  }
): Actor {
  return {
    userId,
    organizations: new Map(memberships.organizations.map((m) => [m.organizationId, m.role])),
    worlds: new Map(memberships.worlds.map((m) => [m.worldId, { organizationId: m.organizationId, role: m.role }]))
  }
}

/** Las organizaciones de las que la cuenta es propietaria */
export function ownedOrganizations(actor: Actor): string[] {
  return [...actor.organizations].filter(([, role]) => role === 'owner').map(([id]) => id)
}
