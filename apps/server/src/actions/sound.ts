/**
 * El sonido (docs/specs/sonido.md, ADR-0022 § 7): las listas del mundo las prepara quien lleva su wiki (como las
 * escenas); lo que suena en una campaña solo lo cambia su máster (table.manage), y el servidor lo pasa de pista
 */
import {
  createSoundPlaylist,
  deleteSoundPlaylist,
  getSound,
  listSoundPlaylists,
  nextTrack,
  pauseSound,
  playSound,
  type SoundPlaylistView,
  type SoundTrackInput,
  type SoundView,
  setSoundVolume,
  stopSound,
  updateSoundPlaylist,
  youtubeVideoId
} from '@crisol/contracts'
import { filesRepo, soundRepo } from '@crisol/db'
import {
  advanceSound,
  EMPTY_SOUND,
  NotFoundError,
  nextTrack as nextTrackOf,
  pauseSound as pauseOf,
  resumeSound,
  type SoundState,
  startEffect,
  startList,
  stopSound as stopOf,
  setSoundVolume as volumeOf
} from '@crisol/domain'
import { listsOf, soundView } from '../table/sound.ts'
import { authorizedCampaign, authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type Playlist = soundRepo.PlaylistWithTracks

export function playlistView(p: Playlist): SoundPlaylistView {
  return {
    id: p.id,
    worldId: p.worldId,
    name: p.name,
    kind: p.kind,
    mode: p.mode,
    fade: p.fade,
    version: p.version,
    updatedAt: p.updatedAt.toISOString(),
    tracks: p.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      source: t.fileId
        ? { type: 'file' as const, fileId: t.fileId, url: `/api/files/${t.fileId}` }
        : t.youtubeId
          ? { type: 'youtube' as const, videoId: t.youtubeId }
          : { type: 'none' as const },
      duration: t.duration,
      volume: t.volume,
      loop: t.loop
    }))
  }
}

/** Las pistas pedidas, comprobadas: un audio del mundo (o común de su cuenta) o un enlace de YouTube que lo sea */
async function tracksOf(
  ctx: ActionContext,
  wiki: { worldId: string; organizationId: string },
  tracks: Array<SoundTrackInput & { volume: number; loop: boolean }>,
  before: Playlist | null
): Promise<soundRepo.TrackInput[]> {
  const known = new Set(before?.tracks.map((t) => t.id) ?? [])
  const out: soundRepo.TrackInput[] = []
  for (const track of tracks) {
    // Un id que no es de esta lista, como una nueva
    const id = track.id && known.has(track.id) ? track.id : undefined
    const base = { name: track.name, duration: track.duration, volume: track.volume, loop: track.loop }
    if (track.source.type === 'youtube') {
      const videoId = youtubeVideoId(track.source.url)
      if (!videoId)
        throw new InvalidRequestError('BAD_YOUTUBE', `«${track.name}»: no es un enlace de un vídeo de YouTube`)
      out.push({ ...(id ? { id } : {}), ...base, fileId: null, youtubeId: videoId })
      continue
    }
    const file = await filesRepo.findFile(ctx.db, track.source.fileId)
    const mine =
      file && (file.worldId === wiki.worldId || (file.worldId === null && file.organizationId === wiki.organizationId))
    if (!file || !mine) throw new NotFoundError('file')
    if (!file.mime.startsWith('audio/'))
      throw new InvalidRequestError('NOT_AUDIO', `«${file.name}» no es un archivo de audio`)
    out.push({ ...(id ? { id } : {}), ...base, fileId: file.id, youtubeId: null })
  }
  return out
}

/** Una lista que la cuenta puede preparar (quien lleva la wiki de su mundo) */
async function writablePlaylist(ctx: ActionContext, id: string) {
  const playlist = await soundRepo.findPlaylist(ctx.db, id)
  const wiki = await authorizedWiki(ctx, 'page.write', playlist?.worldId ?? '')
  if (!playlist) throw new NotFoundError('playlist')
  return { playlist, wiki }
}

/** Las campañas del mundo con algo sonando se ponen al día (se cambió o se borró una lista) */
async function refreshWorld(ctx: ActionContext, worldId: string) {
  for (const row of await soundRepo.campaignsWithSound(ctx.db))
    if (row.worldId === worldId) await ctx.sound?.refresh(row.campaignId)
}

/**
 * Cambia lo que suena en una campaña de su máster: lo de ahora puesto al día (con las listas que se nombran) y luego
 * el cambio. Lo manda a la sala y reprograma su reloj
 */
async function changeSound(
  ctx: ActionContext,
  campaignId: string,
  extra: readonly string[],
  fn: (state: SoundState, loaded: Awaited<ReturnType<typeof listsOf>>, now: number) => SoundState
): Promise<SoundView> {
  await authorizedCampaign(ctx, 'table.manage', campaignId)
  let loaded: Awaited<ReturnType<typeof listsOf>> = { playlists: [], lists: new Map() }
  const state = await soundRepo.changeSound(ctx.db, campaignId, async (current) => {
    loaded = await listsOf(ctx.db, current, extra)
    const now = Date.now()
    return fn(advanceSound(current ?? EMPTY_SOUND, loaded.lists, { now }), loaded, now)
  })
  if (ctx.sound) return ctx.sound.changed(campaignId, state)
  return soundView(campaignId, state, loaded.playlists)
}

export const soundActions = [
  implement(listSoundPlaylists, async (ctx, { worldId, campaignId }) => {
    let world = worldId
    if (campaignId) {
      const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
      if (world && world !== campaign.worldId) throw new NotFoundError('world')
      world = campaign.worldId
    } else if (world) await authorizedWiki(ctx, 'page.read', world)
    if (!world) throw new InvalidRequestError('BAD_INPUT', 'worldId o campaignId')
    return { playlists: (await soundRepo.listPlaylists(ctx.db, world)).map(playlistView) }
  }),

  implement(createSoundPlaylist, async (ctx, { worldId, tracks, ...input }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const checked = await tracksOf(ctx, wiki, tracks, null)
    const created = await soundRepo.createPlaylist(
      ctx.db,
      historyContext(ctx, 'createSoundPlaylist', { name: input.name }, wiki),
      { ...input, worldId, tracks: checked }
    )
    const playlist = await soundRepo.findPlaylist(ctx.db, created.id)
    if (!playlist) throw new NotFoundError('playlist')
    return { playlist: playlistView(playlist) }
  }),

  implement(updateSoundPlaylist, async (ctx, { id, tracks, ...patch }) => {
    const { playlist, wiki } = await writablePlaylist(ctx, id)
    const checked = tracks ? await tracksOf(ctx, wiki, tracks, playlist) : undefined
    const values = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    await soundRepo.updatePlaylist(
      ctx.db,
      historyContext(ctx, 'updateSoundPlaylist', { name: patch.name ?? playlist.name }, wiki),
      playlist,
      { ...values, ...(checked ? { tracks: checked } : {}) }
    )
    await refreshWorld(ctx, playlist.worldId)
    const updated = await soundRepo.findPlaylist(ctx.db, id)
    if (!updated) throw new NotFoundError('playlist')
    return { playlist: playlistView(updated) }
  }),

  implement(deleteSoundPlaylist, async (ctx, { id }) => {
    const { playlist, wiki } = await writablePlaylist(ctx, id)
    await soundRepo.deletePlaylist(
      ctx.db,
      historyContext(ctx, 'deleteSoundPlaylist', { name: playlist.name }, wiki),
      playlist
    )
    await refreshWorld(ctx, playlist.worldId)
    return { ok: true as const }
  }),

  implement(getSound, async (ctx, { campaignId, withPlaylists }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const playlists = withPlaylists
      ? { playlists: (await soundRepo.listPlaylists(ctx.db, campaign.worldId)).map(playlistView) }
      : {}
    if (ctx.sound) return { ...(await ctx.sound.view(campaignId)), ...playlists }
    const state = await soundRepo.soundOf(ctx.db, campaignId)
    return { ...soundView(campaignId, state, (await listsOf(ctx.db, state)).playlists), ...playlists }
  }),

  implement(playSound, async (ctx, { campaignId, playlistId, trackId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    // Una pista sola: su lista sale de ella
    let target = playlistId
    if (trackId) {
      const owner = (await soundRepo.listPlaylists(ctx.db, campaign.worldId)).find((p) =>
        p.tracks.some((t) => t.id === trackId)
      )
      if (!owner || (playlistId && owner.id !== playlistId)) throw new NotFoundError('track')
      target = owner.id
    }
    if (!target) throw new InvalidRequestError('BAD_INPUT', 'playlistId o trackId')
    const list = await soundRepo.findPlaylist(ctx.db, target)
    if (!list || list.worldId !== campaign.worldId) throw new NotFoundError('playlist')
    if (list.tracks.length === 0) throw new InvalidRequestError('EMPTY_PLAYLIST', 'la lista no tiene pistas')
    if (!trackId && list.mode === 'soundboard')
      throw new InvalidRequestError('SOUNDBOARD_NEEDS_TRACK', 'en una botonera se lanza cada pista (trackId)')
    return changeSound(ctx, campaignId, [list.id], (state, { lists }, now) => {
      const info = lists.get(list.id)
      if (!info) throw new NotFoundError('playlist')
      const env = { now, id: () => crypto.randomUUID() }
      // Una pista de efectos suena sola por encima; una de ambiente lanza su lista desde ella
      if (trackId && info.kind === 'effects') return startEffect(state, info, trackId, env)
      return startList(state, info, env, trackId)
    })
  }),

  implement(stopSound, async (ctx, { campaignId, playlistId, effectId, fade }) =>
    changeSound(ctx, campaignId, [], (state, _loaded, now) =>
      stopOf(
        state,
        { now },
        { ...(playlistId ? { playlistId } : {}), ...(effectId ? { effectId } : {}), fade: fade ?? 0 }
      )
    )
  ),

  implement(pauseSound, async (ctx, { campaignId, paused }) =>
    changeSound(ctx, campaignId, [], (state, _loaded, now) => (paused ? pauseOf : resumeSound)(state, { now }))
  ),

  implement(setSoundVolume, async (ctx, { campaignId, volume }) =>
    changeSound(ctx, campaignId, [], (state) => volumeOf(state, volume))
  ),

  implement(nextTrack, async (ctx, { campaignId, playlistId }) =>
    changeSound(ctx, campaignId, [], (state, { lists }, now) => nextTrackOf(state, lists, { now }, playlistId))
  )
]
