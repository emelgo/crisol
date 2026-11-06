/**
 * Desde ADR-0015 el 5e ya no viene de serie. Las campañas (y sus personajes) que lo usaban pasan a una copia en su
 * cuenta, importada de su archivo de ejemplo: una por cuenta, y solo en las que lo usan
 */
import { randomUUID } from 'node:crypto'
import { type Database, systemsRepo } from '@crisol/db'
import { exampleFile } from '@crisol/systems/examples'

const OLD = '5e'

/** Devuelve cuántas cuentas, campañas y personajes pasó */
export async function moveBuiltIn5e(db: Database) {
  const users = await systemsRepo.systemUsers(db, OLD)
  const organizations = [...new Set([...users.campaigns, ...users.characters].map((r) => r.organizationId))]
  if (organizations.length === 0) return { organizations: 0, campaigns: 0, characters: 0 }
  const file = exampleFile('5e')
  const content = file.content.map((item) => ({
    type: item.type,
    key: item.key,
    source: item.source,
    data: item.data,
    concept: item.concept ?? null,
    mechanics: (item.mechanics as Record<string, unknown> | undefined) ?? null,
    ref: (item.ref as Record<string, unknown> | undefined) ?? null
  }))
  for (const organizationId of organizations) {
    const id = randomUUID()
    await systemsRepo.createSystem(
      db,
      { actorId: null, via: 'system', action: 'importSystem', details: { name: '5e' }, organizationId },
      { id, organizationId, basedOn: null, document: { ...file.system, id } as unknown as Record<string, unknown> },
      content
    )
    const theirs = (rows: { id: string; organizationId: string }[]) =>
      rows.filter((r) => r.organizationId === organizationId).map((r) => r.id)
    await systemsRepo.repointSystem(
      db,
      { campaigns: theirs(users.campaigns), characters: theirs(users.characters) },
      id
    )
  }
  return { organizations: organizations.length, campaigns: users.campaigns.length, characters: users.characters.length }
}
