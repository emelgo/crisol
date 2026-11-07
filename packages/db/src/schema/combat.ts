import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { characters } from './characters.ts'
import { campaignCreatures } from './creatures.ts'
import { scenes } from './scenes.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * El combate de una campaña (docs/specs/combate.md): uno a la vez, en una escena. La ronda 0 es antes de empezar; el
 * turno es el combatiente que lo tiene (el primero de su grupo). Lo lleva el servidor, con su historial
 */
export const combats = pgTable('combats', {
  ...trackedColumns(),
  worldId: uuid()
    .notNull()
    .references(() => worlds.id, { onDelete: 'cascade' }),
  campaignId: uuid()
    .notNull()
    .unique()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  sceneId: uuid().references(() => scenes.id, { onDelete: 'set null' }),
  round: integer().notNull().default(0),
  turnId: uuid(),
  skipDefeated: boolean().notNull().default(true)
})

/**
 * Quien está en el combate: un personaje o una criatura en juego (su ficha es la suya en la escena del combate), su
 * iniciativa y lo que suma a ella (los empates), su grupo (un turno para todos) y su orden a mano entre empatados
 */
export const combatants = pgTable(
  'combatants',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    combatId: uuid()
      .notNull()
      .references(() => combats.id, { onDelete: 'cascade' }),
    characterId: uuid().references(() => characters.id, { onDelete: 'cascade' }),
    creatureId: uuid().references(() => campaignCreatures.id, { onDelete: 'cascade' }),
    initiative: doublePrecision(),
    modifier: doublePrecision(),
    group: text(),
    sort: integer()
  },
  (t) => [
    index().on(t.combatId),
    unique().on(t.combatId, t.characterId),
    unique().on(t.combatId, t.creatureId),
    check('combatants_one_actor', sql`(${t.characterId} is null) <> (${t.creatureId} is null)`)
  ]
)
