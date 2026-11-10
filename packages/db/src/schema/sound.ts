import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { files } from './files.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Una lista de sonido del mundo (docs/specs/sonido.md): se prepara una vez y se lanza en la Mesa de cualquiera de sus
 * campañas. Ambiente o efectos; secuencial, aleatoria, simultánea o botonera; el fundido, en segundos
 */
export const soundPlaylists = pgTable(
  'sound_playlists',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    kind: text({ enum: ['ambient', 'effects'] }).notNull(),
    mode: text({ enum: ['sequential', 'random', 'simultaneous', 'soundboard'] }).notNull(),
    fade: doublePrecision().notNull().default(0)
  },
  (t) => [index().on(t.worldId)]
)

/**
 * Una pista de una lista: un archivo de audio del mundo o un vídeo de YouTube (por su id), con su duración en segundos
 * (la mide el navegador de quien la añade). Si se purga su archivo, se queda sin fuente y no suena
 */
export const soundTracks = pgTable(
  'sound_tracks',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    playlistId: uuid()
      .notNull()
      .references(() => soundPlaylists.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    name: text().notNull(),
    fileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    youtubeId: text(),
    duration: doublePrecision().notNull(),
    volume: doublePrecision().notNull().default(1),
    loop: boolean().notNull().default(false)
  },
  (t) => [
    index().on(t.playlistId),
    index().on(t.fileId),
    check('sound_tracks_one_source', sql`num_nonnulls(${t.fileId}, ${t.youtubeId}) <= 1`)
  ]
)
