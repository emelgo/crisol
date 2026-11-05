import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'
import { trackedColumns } from './tracked.ts'

/** Lo que se ve de un personaje en su tarjeta y en las listas: lo calcula el servidor al guardarlo */
export interface CharacterSummary {
  /** «Enano de las colinas · Guerrero 4 · Mago 1» */
  line?: string
  level?: number
  /** Unos valores de su hoja (PG, CA): su nombre y su valor */
  stats?: { key: string; label: string; value: string }[]
}

/**
 * Los personajes de una campaña (ADR-0013): su dueño (un jugador o el máster), el sistema con el que se hizo, sus
 * elecciones (la verdad: la hoja se calcula de ellas) y lo de la partida, aparte. «En creación» hasta tener lo que su
 * sistema pide
 */
export const characters = pgTable(
  'characters',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    ownerId: text().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    system: text().notNull(),
    status: text().$type<'creating' | 'ready'>().notNull().default('creating'),
    build: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    play: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    summary: jsonb().$type<CharacterSummary>().notNull().default({})
  },
  (t) => [index().on(t.campaignId), index().on(t.ownerId)]
)

/** Las versiones de un personaje: el personaje entero al terminar de crearlo y al confirmar cada subida de nivel */
export const characterVersions = pgTable(
  'character_versions',
  {
    ...trackedColumns(),
    characterId: uuid()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    /** «created» (al terminar de crearlo) o «level» (al confirmar un nivel) */
    kind: text().$type<'created' | 'level'>().notNull(),
    level: integer().notNull(),
    /** El personaje de ese momento: su nombre, su estado, sus elecciones, lo de la partida y su resumen */
    snapshot: jsonb()
      .$type<{
        name: string
        status: 'creating' | 'ready'
        build: Record<string, unknown>
        play: Record<string, unknown>
        summary: CharacterSummary
      }>()
      .notNull()
  },
  (t) => [index().on(t.characterId)]
)
