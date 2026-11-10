/**
 * El sonido de Foundry VTT a Crisol (docs/specs/sonido-foundry.md): sus listas (del mundo, de un compendio de listas o
 * dentro de una aventura) con sus pistas, y de dónde sale cada audio: del zip (sus rutas, modules/…), una dirección
 * (YouTube o un audio) o de fuera (los de serie de Foundry, sounds/…, o carpetas que no vienen en el zip).
 *
 * Formato de las listas de Foundry VTT (Playlist y PlaylistSound, de la v9 a la 14.369; sus modos, de CONST.PLAYLIST_MODES),
 * leído de sus archivos (Foundry Gaming LLC; uso privado, ADR-0014; docs/terceros.md)
 */
import type { FoundryDocument } from './manifest.ts'

type Doc = Record<string, unknown>

const isObject = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export interface ConvertedTrack {
  id: string
  name: string
  /** La ruta o la dirección de Foundry, tal cual */
  path: string
  volume: number
  loop: boolean
}

export interface ConvertedPlaylist {
  id: string
  name: string
  kind: 'ambient' | 'effects'
  mode: 'sequential' | 'random' | 'simultaneous' | 'soundboard'
  /** En segundos */
  fade: number
  tracks: ConvertedTrack[]
}

/** Los modos de Foundry: -1 sin reproducir sola (botonera), 0 secuencial, 1 aleatoria, 2 simultánea */
const MODES = { '-1': 'soundboard', '0': 'sequential', '1': 'random', '2': 'simultaneous' } as const

/** Una ruta con %20 y demás, como se guarda en el zip (si no se entiende, tal cual) */
const decoded = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** El nombre de un archivo, sin carpeta ni extensión */
const baseName = (path: string) =>
  decoded(path.split(/[?#]/)[0]?.split('/').at(-1) ?? '').replace(/\.[^.]+$/, '') || path

/** Una lista de Foundry, con sus pistas en su orden (a mano o alfabético) */
export function convertFoundryPlaylist(doc: FoundryDocument): ConvertedPlaylist {
  const mode = MODES[String(num(doc.mode, 0)) as keyof typeof MODES] ?? 'sequential'
  // Música y ambiente, a ambiente; la interfaz y la botonera, a efectos
  const kind = mode === 'soundboard' || doc.channel === 'interface' ? 'effects' : 'ambient'
  const sounds = (Array.isArray(doc.sounds) ? doc.sounds : []).filter(isObject).flatMap((s) => {
    const id = str(s._id)
    const path = str(s.path) ?? ''
    if (!id) return []
    return [
      {
        id,
        name: (str(s.name) ?? baseName(path)).slice(0, 200),
        path,
        volume: clamp(num(s.volume, 0.5), 0, 1),
        loop: s.repeat === true,
        sort: num(s.sort, 0)
      }
    ]
  })
  const sorted =
    doc.sorting === 'a'
      ? sounds.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      : sounds.sort((a, b) => a.sort - b.sort)
  return {
    id: doc._id,
    name: (str(doc.name) ?? doc._id).slice(0, 200),
    kind,
    mode,
    fade: clamp(num(doc.fade, 0) / 1000, 0, 60),
    tracks: sorted.map(({ sort: _sort, ...track }) => track)
  }
}

/** De dónde sale un audio de Foundry */
export type AudioSource =
  | { kind: 'zip'; path: string; zipPath: string }
  | { kind: 'youtube'; videoId: string }
  | { kind: 'url'; url: string }
  | { kind: 'missing'; reason: 'core' | 'outside' | 'empty' }

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** El id de un vídeo de YouTube de una dirección, o null */
function youtubeIdOf(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = url.pathname.split('/').filter(Boolean)
    if (first === 'watch') id = url.searchParams.get('v')
    else if (first && ['embed', 'shorts', 'live', 'v'].includes(first)) id = second ?? null
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

/**
 * De dónde sale un audio: del zip (una ruta del paquete), una dirección (YouTube o un audio) o de fuera (los de serie
 * de Foundry o una carpeta que no es del paquete)
 */
export function audioSourceOf(
  path: string,
  pack: { id: string; kind: 'system' | 'module' | 'world'; root: string }
): AudioSource {
  const clean = path.trim().replace(/\\/g, '/')
  if (!clean) return { kind: 'missing', reason: 'empty' }
  if (/^https?:\/\//i.test(clean)) {
    let url: URL
    try {
      url = new URL(clean)
    } catch {
      return { kind: 'missing', reason: 'outside' }
    }
    const videoId = youtubeIdOf(url)
    return videoId ? { kind: 'youtube', videoId } : { kind: 'url', url: clean }
  }
  const inside = clean.replace(/^\/+/, '')
  const top = pack.kind === 'module' ? 'modules' : pack.kind === 'system' ? 'systems' : 'worlds'
  const prefix = `${top}/${pack.id}/`
  if (inside.startsWith(prefix))
    return { kind: 'zip', path: inside, zipPath: `${pack.root}${decoded(inside.slice(prefix.length))}` }
  if (/^sounds\//.test(inside)) return { kind: 'missing', reason: 'core' }
  return { kind: 'missing', reason: 'outside' }
}
