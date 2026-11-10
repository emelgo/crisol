import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { files } from './files.ts'
import { pages } from './pages.ts'
import { scenes } from './scenes.ts'
import { soundPlaylists } from './sound.ts'
import { worlds } from './worlds.ts'

/**
 * De dónde salió lo traído de un zip de Foundry a un mundo (docs/specs/escenas-foundry.md): una escena, la página de
 * una aventura o la de un diario, una lista de sonido o un audio subido, por su paquete («módulo/paquete») y su id. Reimportar el mismo zip lo encuentra y lo
 * cambia en lugar de duplicarlo. No va al historial: si se deshace lo traído, su fila se va con ello (en cascada)
 */
export const foundryOrigins = pgTable(
  'foundry_origins',
  {
    id: uuid().primaryKey().defaultRandom(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['scene', 'adventure', 'journal', 'playlist', 'audio'] }).notNull(),
    package: text().notNull(),
    documentId: text().notNull(),
    sceneId: uuid().references(() => scenes.id, { onDelete: 'cascade' }),
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    /** Una lista de sonido traída (docs/specs/sonido-foundry.md) */
    playlistId: uuid().references(() => soundPlaylists.id, { onDelete: 'cascade' }),
    /** Un audio del zip ya subido al mundo, por su ruta: no se vuelve a subir */
    fileId: uuid().references(() => files.id, { onDelete: 'cascade' }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [unique().on(t.worldId, t.kind, t.package, t.documentId), index().on(t.worldId)]
)
