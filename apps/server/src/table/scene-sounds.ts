/**
 * Los sonidos del mapa de una escena (docs/specs/sonido-mapa.md): cómo los ve quien prepara (con su pista y, con
 * campaña, si suenan en ella) y lo que llega a la vista de jugadores y a la Mesa de cada jugador: los que suenan ahora
 * (encendidos en la campaña, con pista que suene y con la oscuridad que piden), con su radio en píxeles, y los muros
 * que paran el sonido cerca de ellos. Cuánto se oye lo calcula cada aparato (@crisol/tabletop)
 */
import { type SceneSoundView, type ScreenSound, SOUND_DARK_FROM } from '@crisol/contracts'
import { type scenesRepo, soundRepo, visionRepo } from '@crisol/db'
import { type DoorStates, type Edge, soundEdges } from '@crisol/tabletop'
import type { ActionContext } from '../actions/context.ts'
import { wallOf } from './vision.ts'

type Grid = scenesRepo.SceneRow['grid']
type Row = visionRepo.SceneSoundRow
type Track = soundRepo.TrackRow

/** Los píxeles de una casilla de la rejilla (sin rejilla, de 100 px) */
export const cellPixels = (grid: Grid) => (grid.type === 'none' || grid.size <= 0 ? 100 : grid.size)

/** La dirección de una pista para sonar: su archivo o su dirección; null si no suena (YouTube o sin archivo) */
export const trackUrl = (track: Pick<Track, 'fileId'> & { url?: string | null }): string | null =>
  track.fileId ? `/api/files/${track.fileId}` : (track.url ?? null)

/** Los sonidos de una escena con las pistas que nombran */
export async function loadSceneSounds(ctx: Pick<ActionContext, 'db'>, sceneId: string) {
  const rows = await visionRepo.listSceneSounds(ctx.db, sceneId)
  const trackIds = [...new Set(rows.flatMap((r) => (r.trackId ? [r.trackId] : [])))]
  const tracks = new Map((await soundRepo.tracksByIds(ctx.db, trackIds)).map((t) => [t.id, t]))
  return { rows, tracks }
}

export type LoadedSceneSounds = Awaited<ReturnType<typeof loadSceneSounds>>

function sourceOf(row: Row, tracks: ReadonlyMap<string, Track>): SceneSoundView['source'] {
  if (row.fileId) return { type: 'file', fileId: row.fileId, url: `/api/files/${row.fileId}` }
  if (row.url) return { type: 'url', url: row.url }
  const track = row.trackId ? tracks.get(row.trackId) : undefined
  if (track)
    return { type: 'track', trackId: track.id, playlistId: track.playlistId, name: track.name, url: trackUrl(track) }
  return { type: 'none' }
}

/** Un sonido como lo ve quien prepara; con el estado de una campaña, si suena en ella */
export function sceneSoundViewOf(
  row: Row,
  tracks: ReadonlyMap<string, Track>,
  campaign?: Readonly<Record<string, boolean>>
): SceneSoundView {
  return {
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    source: sourceOf(row, tracks),
    radius: row.radius,
    volume: row.volume,
    easing: row.easing,
    walls: row.walls,
    darkOnly: row.darkOnly,
    ...(campaign ? { enabled: campaign[row.id] ?? true } : {})
  }
}

/** Si un tramo cae cerca de algún sonido (su caja toca la del círculo) */
const nearAny = (edge: Edge, sounds: readonly ScreenSound[]) =>
  sounds.some(
    (s) =>
      Math.max(edge.a.x, edge.b.x) >= s.x - s.radius &&
      Math.min(edge.a.x, edge.b.x) <= s.x + s.radius &&
      Math.max(edge.a.y, edge.b.y) >= s.y - s.radius &&
      Math.min(edge.a.y, edge.b.y) <= s.y + s.radius
  )

/** Lo que suena ahora en una escena para una campaña, con los muros que paran el sonido cerca */
export function audibleOf(input: {
  loaded: LoadedSceneSounds
  enabled: Readonly<Record<string, boolean>>
  darkness: number
  grid: Grid
  walls: readonly visionRepo.WallRow[]
  doors: DoorStates
}): { sounds: ScreenSound[]; soundWalls: Edge[] } {
  const cell = cellPixels(input.grid)
  const sounds = input.loaded.rows.flatMap((row): ScreenSound[] => {
    if (input.enabled[row.id] === false) return []
    if (row.darkOnly && input.darkness < SOUND_DARK_FROM) return []
    const source = sourceOf(row, input.loaded.tracks)
    const url = source.type === 'none' ? null : source.url
    if (!url || row.volume <= 0) return []
    return [
      {
        id: row.id,
        x: row.x,
        y: row.y,
        radius: row.radius * cell,
        volume: row.volume,
        easing: row.easing,
        walls: row.walls,
        url
      }
    ]
  })
  if (sounds.length === 0) return { sounds, soundWalls: [] }
  const soundWalls = soundEdges(input.walls.map(wallOf), input.doors).filter((edge) => nearAny(edge, sounds))
  return { sounds, soundWalls }
}

/** Lo que suena en el mapa de una escena para una campaña (una consulta si no tiene sonidos) */
export async function campaignSceneSounds(
  ctx: Pick<ActionContext, 'db'>,
  campaignId: string,
  scene: Pick<scenesRepo.SceneRow, 'id' | 'grid' | 'darkness'>
): Promise<{ sounds: ScreenSound[]; soundWalls: Edge[] }> {
  const loaded = await loadSceneSounds(ctx, scene.id)
  if (loaded.rows.length === 0) return { sounds: [], soundWalls: [] }
  const [walls, state] = await Promise.all([
    visionRepo.listWalls(ctx.db, scene.id),
    visionRepo.findSceneState(ctx.db, campaignId, scene.id)
  ])
  const doors = Object.fromEntries(
    walls.filter((w) => w.door).map((w) => [w.id, { open: state?.doors[w.id]?.open ?? w.open }] as const)
  )
  return audibleOf({
    loaded,
    enabled: state?.sounds ?? {},
    darkness: scene.darkness,
    grid: scene.grid,
    walls,
    doors
  })
}
