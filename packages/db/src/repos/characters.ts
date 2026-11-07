/**
 * Los personajes de una campaña y sus versiones (ADR-0013). Toda escritura pasa por operation(): queda en el historial
 * y se deshace. Cambiar pide la versión que se tenía
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { campaigns } from '../schema/campaigns.ts'
import { type CharacterSummary, characters, characterVersions } from '../schema/characters.ts'
import { combatants } from '../schema/combat.ts'
import { sceneTokens } from '../schema/scenes.ts'
import { worlds } from '../schema/worlds.ts'

export class CharacterChangedError extends Error {
  constructor() {
    super('El personaje cambió mientras tanto')
    this.name = 'CharacterChangedError'
  }
}

const columns = {
  id: characters.id,
  campaignId: characters.campaignId,
  ownerId: characters.ownerId,
  ownerName: user.name,
  name: characters.name,
  system: characters.system,
  status: characters.status,
  build: characters.build,
  play: characters.play,
  summary: characters.summary,
  version: characters.version,
  updatedAt: characters.updatedAt
}

export type CharacterRow = NonNullable<Awaited<ReturnType<typeof findCharacter>>>

/** Los de una campaña (de un dueño, si se dice), en el orden en que se crearon */
export function listCharacters(db: Database, campaignId: string, ownerId?: string) {
  return db
    .select(columns)
    .from(characters)
    .leftJoin(user, eq(user.id, characters.ownerId))
    .where(and(eq(characters.campaignId, campaignId), ownerId ? eq(characters.ownerId, ownerId) : undefined))
    .orderBy(asc(characters.createdAt), asc(characters.id))
}

/** Uno, con su campaña, su mundo y su organización (de una campaña y un mundo que no están en la papelera) */
export async function findCharacter(db: Database, id: string) {
  const [found] = await db
    .select({ ...columns, worldId: campaigns.worldId, organizationId: worlds.organizationId })
    .from(characters)
    .innerJoin(campaigns, eq(campaigns.id, characters.campaignId))
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .leftJoin(user, eq(user.id, characters.ownerId))
    .where(and(eq(characters.id, id), isNull(campaigns.deletedAt), isNull(worlds.deletedAt)))
  return found ?? null
}

export interface CharacterValues {
  campaignId: string
  ownerId: string | null
  name: string
  system: string
  status?: 'creating' | 'ready'
  build?: Record<string, unknown>
  play?: Record<string, unknown>
  summary?: CharacterSummary
}

export function createCharacter(db: Database, context: OperationContext, values: CharacterValues) {
  return operation(db, context, (w) => w.insert(characters, values))
}

export type CharacterPatch = Partial<
  Pick<CharacterValues, 'ownerId' | 'name' | 'status' | 'build' | 'play' | 'summary'>
>

/**
 * Cambia un personaje con la versión que se tenía; con `snapshot`, deja además una versión suya tal como queda (al
 * terminar de crearlo o al confirmar un nivel)
 */
export function updateCharacter(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  patch: CharacterPatch,
  snapshot?: { kind: 'created' | 'level'; level: number }
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: characters.version })
      .from(characters)
      .where(eq(characters.id, id))
      .for('update')
    if (!current || current.version !== version) throw new CharacterChangedError()
    const row = await w.update(characters, id, patch)
    if (snapshot) {
      await w.insert(characterVersions, {
        characterId: id,
        kind: snapshot.kind,
        level: snapshot.level,
        snapshot: { name: row.name, status: row.status, build: row.build, play: row.play, summary: row.summary }
      })
    }
    return row
  })
}

export function deleteCharacter(db: Database, context: OperationContext, id: string) {
  return operation(db, context, async (w) => {
    // Sus versiones, también al historial: deshacer lo devuelve entero
    const versions = await w.read
      .select({ id: characterVersions.id })
      .from(characterVersions)
      .where(eq(characterVersions.characterId, id))
    await w.removeMany(
      characterVersions,
      versions.map((v) => v.id)
    )
    // Sus fichas y su sitio en el combate, igual
    const tokens = await w.read.select({ id: sceneTokens.id }).from(sceneTokens).where(eq(sceneTokens.characterId, id))
    for (const token of tokens) await w.remove(sceneTokens, token.id)
    const members = await w.read.select({ id: combatants.id }).from(combatants).where(eq(combatants.characterId, id))
    for (const member of members) await w.remove(combatants, member.id)
    await w.remove(characters, id)
  })
}

/** Sus versiones, de la más nueva a la más vieja */
export function listCharacterVersions(db: Database, characterId: string) {
  return db
    .select({
      id: characterVersions.id,
      kind: characterVersions.kind,
      level: characterVersions.level,
      snapshot: characterVersions.snapshot,
      createdAt: characterVersions.createdAt
    })
    .from(characterVersions)
    .where(eq(characterVersions.characterId, characterId))
    .orderBy(desc(characterVersions.createdAt), desc(characterVersions.id))
}
