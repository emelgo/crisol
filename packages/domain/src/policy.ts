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

/**
 * Sobre qué: una organización, un mundo, una campaña (con su mundo) o la wiki de un mundo. La wiki lleva la
 * organización del mundo (la de su fila, nunca la que diga quien pide), porque también la ve su propietario
 */
export type Target =
  | { organizationId: string }
  | { worldId: string }
  | { campaignId: string; worldId: string }
  | { worldId: string; organizationId: string }

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
const isCampaignPlayer: Predicate = (actor, target) =>
  'campaignId' in target && actor.campaigns.get(target.campaignId)?.role === 'player'

const any =
  (...predicates: Predicate[]): Predicate =>
  (actor, target) =>
    predicates.some((p) => p(actor, target))

/** Ve el mundo: lo administra o juega en alguna de sus campañas */
const seesWorld = any(isWorldMaster, playsInWorld)
/** Ve la campaña: administra su mundo o está en ella */
const seesCampaign = any(isWorldMaster, isCampaignMember)
/** La wiki, hasta el módulo 5: el máster del mundo y el propietario de su organización */
const managesWiki = any(isWorldMaster, isOrganizationOwner)
/** Administra algún mundo de la organización */
const mastersInOrganization: Predicate = (actor, target) =>
  'organizationId' in target &&
  [...actor.worlds.values()].some((w) => w.organizationId === target.organizationId && w.role === 'master')
/** Los archivos comunes de la organización (ADR-0005): los ve quien administra la organización o alguno de sus mundos */
const seesCommonFiles = any(isOrganizationOwner, mastersInOrganization)

const RULES = {
  'world.create': { sees: isOrganizationMember, allows: isOrganizationOwner },
  'world.read': { sees: seesWorld, allows: seesWorld },
  'world.rename': { sees: seesWorld, allows: isWorldMaster },
  'campaign.create': { sees: seesWorld, allows: isWorldMaster },
  'campaign.read': { sees: seesCampaign, allows: seesCampaign },
  // Los personajes de una campaña: cada uno ve y cambia los suyos (lo mira la acción); el máster, todos
  'characters.manage': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  'campaign.rename': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  // El enlace de invitación: verlo, regenerarlo, abrir o cerrar las invitaciones
  'campaign.invite': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  'campaign.removeMember': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  // Solo sale quien juega: el máster no deja la campaña sin máster
  'campaign.leave': { sees: seesCampaign, allows: isCampaignPlayer },
  // El historial: el de un mundo, para su máster; el de toda la organización, para el propietario
  'world.history': { sees: seesWorld, allows: isWorldMaster },
  'organization.history': { sees: isOrganizationMember, allows: isOrganizationOwner },
  // Deshacer: quien ve el historial, con sus permisos de ahora
  'world.undo': { sees: seesWorld, allows: isWorldMaster },
  'organization.undo': { sees: isOrganizationMember, allows: isOrganizationOwner },
  // Borrar manda a la papelera; desde ella se restaura: la de un mundo (sus campañas), para su máster; la de la
  // organización (también los mundos), para el propietario
  'world.delete': { sees: seesWorld, allows: isWorldMaster },
  'campaign.delete': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  'world.trash': { sees: seesWorld, allows: isWorldMaster },
  'organization.trash': { sees: isOrganizationMember, allows: isOrganizationOwner },
  // La wiki de un mundo entera, sin filtrar: quien la lleva
  'page.read': { sees: managesWiki, allows: managesWiki },
  // Leerla con lo que sabe cada uno (ADR-0017): también quien juega en el mundo, y lo que ve lo decide la proyección.
  // Solo la usan las vías de lectura que la aplican; las demás siguen con page.read
  'page.view': { sees: any(managesWiki, playsInWorld), allows: any(managesWiki, playsInWorld) },
  'page.write': { sees: managesWiki, allows: managesWiki },
  // El compendio del mundo (docs/specs/compendio-mundo.md), como la wiki: hasta el módulo 5, solo quien la lleva
  'worldContent.read': { sees: managesWiki, allows: managesWiki },
  'worldContent.write': { sees: managesWiki, allows: managesWiki },
  // Los archivos comunes de la organización, que comparten sus mundos: verlos y usarlos; subirlos y cambiarlos
  'commonFiles.read': { sees: seesCommonFiles, allows: seesCommonFiles },
  'commonFiles.write': { sees: seesCommonFiles, allows: isOrganizationOwner },
  // Las etiquetas de la cuenta (ADR-0006): verlas (para ponerlas); crearlas, renombrarlas, darles color y borrarlas
  'tags.read': { sees: seesCommonFiles, allows: seesCommonFiles },
  'tags.write': { sees: seesCommonFiles, allows: isOrganizationOwner },
  // Las plantillas de página de la cuenta (ADR-0009): verlas (para crear con ellas); crearlas, cambiarlas y borrarlas
  'templates.read': { sees: seesCommonFiles, allows: seesCommonFiles },
  'templates.write': { sees: seesCommonFiles, allows: isOrganizationOwner },
  // Los sistemas de reglas de la cuenta (ADR-0011), como las plantillas: los ven quienes ven los comunes; los cambia el
  // propietario. Los jugadores los leerán con sus personajes
  'systems.read': { sees: seesCommonFiles, allows: seesCommonFiles },
  'systems.write': { sees: seesCommonFiles, allows: isOrganizationOwner },
  // Las tiradas de una campaña (ADR-0010): tiran y leen sus miembros y el máster del mundo; las privadas le llegan
  // al máster del mundo o de la campaña
  'dice.roll': { sees: seesCampaign, allows: seesCampaign },
  'dice.read': { sees: seesCampaign, allows: seesCampaign },
  'dice.private': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) },
  // Las criaturas en juego de una campaña (docs/specs/criaturas.md): hasta el módulo 5, solo el máster
  'creatures.manage': { sees: seesCampaign, allows: any(isWorldMaster, isCampaignMaster) }
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

/** Si la cuenta puede hacer eso, sin lanzar: para decidir a quién le llega un evento en tiempo real */
export function can(actor: Actor, capability: Capability, target: Target): boolean {
  const rule = RULES[capability]
  return rule.sees(actor, target) && rule.allows(actor, target)
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
