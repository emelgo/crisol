/**
 * El sonido (docs/specs/sonido.md): las listas del mundo con sus pistas (con historial) y lo que suena en cada campaña
 * (estado de la sesión, en su mesa). Lo que suena se cambia siempre con la fila bloqueada: la API y el reloj del
 * servidor que pasa de pista pueden tocarlo a la vez
 */
import type { SoundState } from '@crisol/domain'
import { asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { campaignTables } from '../schema/scenes.ts'
import { soundPlaylists, soundTracks } from '../schema/sound.ts'

export type PlaylistRow = typeof soundPlaylists.$inferSelect
export type TrackRow = typeof soundTracks.$inferSelect
export type PlaylistWithTracks = PlaylistRow & { tracks: TrackRow[] }

/** Una pista como se pide: con su id si ya existía (se cambia), sin él si es nueva */
export interface TrackInput {
  id?: string
  name: string
  fileId: string | null
  youtubeId: string | null
  duration: number
  volume: number
  loop: boolean
}

export interface PlaylistInput {
  name: string
  kind: 'ambient' | 'effects'
  mode: 'sequential' | 'random' | 'simultaneous' | 'soundboard'
  fade: number
}

/** Las listas de un mundo, por nombre, cada una con sus pistas en orden */
export async function listPlaylists(db: Database, worldId: string): Promise<PlaylistWithTracks[]> {
  const playlists = await db
    .select()
    .from(soundPlaylists)
    .where(eq(soundPlaylists.worldId, worldId))
    .orderBy(asc(soundPlaylists.name), asc(soundPlaylists.id))
  return withTracks(db, playlists)
}

/** Unas listas por su id (las que suenan), con sus pistas */
export async function playlistsByIds(db: Database, ids: readonly string[]): Promise<PlaylistWithTracks[]> {
  if (ids.length === 0) return []
  const playlists = await db
    .select()
    .from(soundPlaylists)
    .where(inArray(soundPlaylists.id, [...ids]))
  return withTracks(db, playlists)
}

async function withTracks(db: Database, playlists: PlaylistRow[]): Promise<PlaylistWithTracks[]> {
  if (playlists.length === 0) return []
  const tracks = await db
    .select()
    .from(soundTracks)
    .where(
      inArray(
        soundTracks.playlistId,
        playlists.map((p) => p.id)
      )
    )
    .orderBy(asc(soundTracks.position))
  return playlists.map((p) => ({ ...p, tracks: tracks.filter((t) => t.playlistId === p.id) }))
}

/** Unas pistas por su id (las de los sonidos del mapa) */
export function tracksByIds(db: Database, ids: readonly string[]): Promise<TrackRow[]> {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select()
    .from(soundTracks)
    .where(inArray(soundTracks.id, [...ids]))
}

export async function findPlaylist(db: Database, id: string): Promise<PlaylistWithTracks | null> {
  const [found] = await playlistsByIds(db, [id])
  return found ?? null
}

export function createPlaylist(
  db: Database,
  context: OperationContext,
  input: PlaylistInput & { worldId: string; tracks: TrackInput[] }
) {
  return operation(db, context, async (w) => {
    const { tracks, ...values } = input
    const playlist = await w.insert(soundPlaylists, values)
    await writeTracks(w, playlist, [], tracks)
    return playlist
  })
}

/** Cambia una lista; con tracks, sus pistas quedan esas, en ese orden (las de antes que no estén se quitan) */
export function updatePlaylist(
  db: Database,
  context: OperationContext,
  current: PlaylistWithTracks,
  patch: Partial<PlaylistInput> & { tracks?: TrackInput[] }
) {
  return operation(db, context, async (w) => {
    const { tracks, ...values } = patch
    const playlist = Object.keys(values).length > 0 ? await w.update(soundPlaylists, current.id, values) : current
    if (tracks) await writeTracks(w, playlist, current.tracks, tracks)
    return playlist
  })
}

async function writeTracks(w: Writer, playlist: PlaylistRow, before: TrackRow[], tracks: TrackInput[]) {
  const kept = new Set(tracks.flatMap((t) => (t.id ? [t.id] : [])))
  const gone = before.filter((t) => !kept.has(t.id)).map((t) => t.id)
  if (gone.length > 0) await w.removeMany(soundTracks, gone)
  const existing = new Map(before.map((t) => [t.id, t]))
  for (const [position, { id, ...track }] of tracks.entries()) {
    const old = id ? existing.get(id) : undefined
    if (old) {
      const changed =
        old.position !== position ||
        old.name !== track.name ||
        old.fileId !== track.fileId ||
        old.youtubeId !== track.youtubeId ||
        old.duration !== track.duration ||
        old.volume !== track.volume ||
        old.loop !== track.loop
      if (changed) await w.update(soundTracks, old.id, { ...track, position })
    } else await w.insert(soundTracks, { ...track, position, worldId: playlist.worldId, playlistId: playlist.id })
  }
}

export function deletePlaylist(db: Database, context: OperationContext, playlist: PlaylistWithTracks) {
  return operation(db, context, async (w) => {
    if (playlist.tracks.length > 0)
      await w.removeMany(
        soundTracks,
        playlist.tracks.map((t) => t.id)
      )
    await w.remove(soundPlaylists, playlist.id)
  })
}

/** Lo que suena en una campaña (null: nada) */
export async function soundOf(db: Database, campaignId: string): Promise<SoundState | null> {
  const [row] = await db
    .select({ sound: campaignTables.sound })
    .from(campaignTables)
    .where(eq(campaignTables.campaignId, campaignId))
  return row?.sound ?? null
}

/**
 * Cambia lo que suena con la fila bloqueada: fn recibe lo de ahora y da lo nuevo (null: nada). Devuelve lo que quedó
 * guardado
 */
export function changeSound(
  db: Database,
  campaignId: string,
  fn: (current: SoundState | null) => Promise<SoundState | null> | SoundState | null
): Promise<SoundState | null> {
  return db.transaction(async (tx) => {
    await tx.insert(campaignTables).values({ campaignId }).onConflictDoNothing()
    const [row] = await tx
      .select({ sound: campaignTables.sound })
      .from(campaignTables)
      .where(eq(campaignTables.campaignId, campaignId))
      .for('update')
    const next = await fn(row?.sound ?? null)
    await tx
      .update(campaignTables)
      .set({ sound: next, updatedAt: new Date() })
      .where(eq(campaignTables.campaignId, campaignId))
    return next
  })
}

/** Las campañas que tienen algo sonando (para retomar sus relojes al arrancar), sin las de la papelera */
export async function campaignsWithSound(db: Database): Promise<Array<{ campaignId: string; worldId: string }>> {
  return db
    .select({ campaignId: campaignTables.campaignId, worldId: campaigns.worldId })
    .from(campaignTables)
    .innerJoin(campaigns, eq(campaigns.id, campaignTables.campaignId))
    .where(isNotNull(campaignTables.sound))
}

/** Si una cuenta puede oír un archivo: es de una lista que suena en alguna de esas campañas */
export async function fileIsPlaying(db: Database, campaignIds: readonly string[], fileId: string): Promise<boolean> {
  if (campaignIds.length === 0) return false
  const rows = await db.execute<{ found: number }>(sql`
    select 1 as found from campaign_tables ct
    cross join lateral jsonb_array_elements(coalesce(ct.sound->'lists', '[]'::jsonb) || coalesce(ct.sound->'effects', '[]'::jsonb)) as p
    join sound_tracks t on t.playlist_id = (p->>'playlistId')::uuid
    where ct.campaign_id in (${sql.join(
      campaignIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )}) and t.file_id = ${fileId}
    limit 1`)
  return [...rows].length > 0
}
