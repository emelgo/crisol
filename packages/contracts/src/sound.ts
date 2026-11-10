/**
 * El sonido (docs/specs/sonido.md, ADR-0022 § 7): las listas del mundo (ambiente y efectos) y lo que suena en cada
 * campaña. Solo el máster lanza sonido; suena a la vez en cada Mesa y en la vista de jugadores, por el reloj del
 * servidor (llega por el canal de la mesa)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

export const SOUND_KINDS = ['ambient', 'effects'] as const
export const SOUND_MODES = ['sequential', 'random', 'simultaneous', 'soundboard'] as const
/** Las pistas de una lista, como mucho */
export const MAX_SOUND_TRACKS = 200

/**
 * El id de un vídeo de YouTube de un enlace (watch?v=, youtu.be/, embed/, shorts/, live/, music.) o el id solo; null
 * si no lo es
 */
export function youtubeVideoId(text: string): string | null {
  const value = text.trim()
  const ID = /^[A-Za-z0-9_-]{11}$/
  if (ID.test(value)) return value
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = url.pathname.split('/').filter(Boolean)
    if (first === 'watch') id = url.searchParams.get('v')
    else if (first && ['embed', 'shorts', 'live', 'v'].includes(first)) id = second ?? null
  }
  return id && ID.test(id) ? id : null
}

const name = z.string().trim().min(1).max(200)

/** De dónde sale una pista: un archivo de audio del mundo o un enlace de YouTube */
export const soundSourceInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), fileId: z.uuid() }),
  z.object({
    type: z.literal('youtube'),
    url: z.string().trim().min(1).max(500).describe('El enlace del vídeo (o su id): solo los que dejan insertarse')
  })
])

export const soundTrackInput = z.object({
  id: z.uuid().optional().describe('El de una pista que ya estaba (se cambia); sin él, una nueva'),
  name,
  source: soundSourceInput,
  duration: z
    .number()
    .positive()
    .max(24 * 3600)
    .describe('En segundos: la mide el navegador al añadirla (o el reproductor de YouTube)'),
  volume: z.number().min(0).max(1).default(1),
  loop: z.boolean().default(false).describe('Se repite sin fin (en una lista, no pasa a la siguiente)')
})

export type SoundTrackInput = z.input<typeof soundTrackInput>

export const soundSource = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), fileId: z.uuid(), url: z.string() }),
  z.object({ type: z.literal('youtube'), videoId: z.string() }),
  /** Su archivo se borró */
  z.object({ type: z.literal('none') })
])

export type SoundSource = z.infer<typeof soundSource>

export const soundTrackView = z.object({
  id: z.uuid(),
  name: z.string(),
  source: soundSource,
  duration: z.number(),
  volume: z.number(),
  loop: z.boolean()
})

export type SoundTrackView = z.infer<typeof soundTrackView>

export const soundPlaylistView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
  kind: z.enum(SOUND_KINDS).describe('ambient: música de fondo (una a la vez); effects: efectos por encima'),
  mode: z
    .enum(SOUND_MODES)
    .describe(
      'sequential: una tras otra; random: en orden barajado; simultaneous: todas a la vez; soundboard: botonera (cada pista, un botón)'
    ),
  fade: z.number().describe('Fundido al entrar, al salir y al cambiar de ambiente, en segundos'),
  tracks: z.array(soundTrackView),
  version: z.int(),
  updatedAt: z.iso.datetime()
})

export type SoundPlaylistView = z.infer<typeof soundPlaylistView>

/** Una pista sonando, con lo que necesita cada aparato para ir a la vez (horas en ms del servidor) */
export const soundVoice = z.object({
  key: z.string(),
  playlistId: z.uuid(),
  trackId: z.uuid(),
  name: z.string(),
  kind: z.enum(SOUND_KINDS),
  source: soundSource,
  startedAt: z.number(),
  offset: z.number(),
  duration: z.number(),
  loop: z.boolean(),
  volume: z.number(),
  fade: z.number(),
  stopAt: z.number().nullable(),
  /** Si es un efecto suelto (para pararlo solo a él) */
  effectId: z.string().nullable()
})

export type SoundVoice = z.infer<typeof soundVoice>

/** Lo que suena en una campaña */
export const soundView = z.object({
  campaignId: z.uuid(),
  volume: z.number(),
  paused: z.boolean(),
  pausedAt: z.number().nullable(),
  voices: z.array(soundVoice),
  /** Las listas sonando: por qué pista van */
  lists: z.array(
    z.object({
      playlistId: z.uuid(),
      name: z.string(),
      kind: z.enum(SOUND_KINDS),
      mode: z.enum(SOUND_MODES),
      index: z.int(),
      count: z.int(),
      stopAt: z.number().nullable()
    })
  ),
  /** Los archivos de lo siguiente de cada lista: para tenerlos cargados */
  preload: z.array(z.string())
})

export type SoundView = z.infer<typeof soundView>

export const listSoundPlaylists = defineAction({
  name: 'listSoundPlaylists',
  kind: 'read',
  description:
    'Las listas de sonido de un mundo (worldId) o del mundo de una campaña (campaignId, su máster), con sus pistas',
  input: z.object({ worldId: z.uuid().optional(), campaignId: z.uuid().optional() }),
  output: z.object({ playlists: z.array(soundPlaylistView) })
})

export const createSoundPlaylist = defineAction({
  name: 'createSoundPlaylist',
  kind: 'write',
  description:
    'Crea una lista de sonido del mundo con sus pistas: archivos de audio del mundo (listar_archivos) o enlaces de YouTube (solo los que dejan insertarse). Cada pista lleva su duración en segundos',
  input: z.object({
    worldId: z.uuid(),
    name,
    kind: z.enum(SOUND_KINDS),
    mode: z.enum(SOUND_MODES).default('sequential'),
    fade: z.number().min(0).max(30).default(0),
    tracks: z.array(soundTrackInput).max(MAX_SOUND_TRACKS).default([])
  }),
  output: z.object({ playlist: soundPlaylistView })
})

export const updateSoundPlaylist = defineAction({
  name: 'updateSoundPlaylist',
  kind: 'write',
  description:
    'Cambia una lista de sonido: lo que se dé (nombre, clase, modo, fundido) y, con tracks, sus pistas quedan esas en ese orden (las que ya estaban, con su id; las que falten se quitan)',
  input: z.object({
    id: z.uuid(),
    name: name.optional(),
    kind: z.enum(SOUND_KINDS).optional(),
    mode: z.enum(SOUND_MODES).optional(),
    fade: z.number().min(0).max(30).optional(),
    tracks: z.array(soundTrackInput).max(MAX_SOUND_TRACKS).optional()
  }),
  output: z.object({ playlist: soundPlaylistView })
})

export const deleteSoundPlaylist = defineAction({
  name: 'deleteSoundPlaylist',
  kind: 'delete',
  description: 'Borra una lista de sonido del mundo con sus pistas (se puede deshacer); si sonaba, se para',
  input: z.object({ id: z.uuid() }),
  output: z.object({ ok: z.literal(true) })
})

export const getSound = defineAction({
  name: 'getSound',
  kind: 'read',
  description:
    'Lo que suena en una campaña: las listas y los efectos, por qué pista van, el volumen y si está en pausa. Con withPlaylists, también las listas de su mundo para lanzar',
  input: z.object({ campaignId: z.uuid(), withPlaylists: z.boolean().default(false) }),
  output: soundView.extend({ playlists: z.array(soundPlaylistView).optional() })
})

export const playSound = defineAction({
  name: 'playSound',
  kind: 'players',
  description:
    'Pone sonido en la Mesa de una campaña (solo su máster): una lista entera (playlistId) o una pista (trackId). Un ambiente nuevo se funde con el que sonaba; una pista de una lista de efectos suena una vez por encima (o en bucle si se repite); una de ambiente lanza su lista desde ella. Si estaba en pausa, sigue',
  input: z.object({ campaignId: z.uuid(), playlistId: z.uuid().optional(), trackId: z.uuid().optional() }),
  output: soundView
})

export const stopSound = defineAction({
  name: 'stopSound',
  kind: 'players',
  description:
    'Para el sonido de una campaña: todo, una lista (playlistId) o un efecto suelto (effectId). Con fade (segundos), se funde hasta callar',
  input: z.object({
    campaignId: z.uuid(),
    playlistId: z.uuid().optional(),
    effectId: z.string().max(100).optional(),
    fade: z.number().min(0).max(30).optional()
  }),
  output: soundView
})

export const pauseSound = defineAction({
  name: 'pauseSound',
  kind: 'players',
  description: 'Pausa (paused: true) o sigue (false) todo lo que suena en una campaña, por donde iba',
  input: z.object({ campaignId: z.uuid(), paused: z.boolean() }),
  output: soundView
})

export const setSoundVolume = defineAction({
  name: 'setSoundVolume',
  kind: 'players',
  description:
    'El volumen general del sonido de una campaña, de 0 a 1 (cada aparato tiene además el suyo de ambiente y de efectos)',
  input: z.object({ campaignId: z.uuid(), volume: z.number().min(0).max(1) }),
  output: soundView
})

export const nextTrack = defineAction({
  name: 'nextTrack',
  kind: 'players',
  description: 'Pasa a la pista siguiente de una lista que suena (sin playlistId, la del ambiente)',
  input: z.object({ campaignId: z.uuid(), playlistId: z.uuid().optional() }),
  output: soundView
})
