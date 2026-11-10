/**
 * La visión de la mesa (docs/specs/vision.md): los muros, las puertas y las luces de una escena y su oscuridad (lo del
 * mundo: quien lleva la wiki), y lo de cada campaña (su máster): las puertas, la niebla a mano, reiniciarla, el ajuste
 * de las teselas y «ver como el grupo». Lo que cambia se avisa a las salas abiertas
 */
import {
  changeFog,
  changeWalls,
  getSceneVision,
  type LightView,
  type lightInput,
  placeImportedWalls,
  resetFog,
  type SceneVisionView,
  setDoor,
  setTileFit,
  updateSceneVision,
  viewAsParty,
  WALL_PRESETS,
  type WallView,
  type wallInput,
  wallKindOf
} from '@crisol/contracts'
import { type OperationContext, scenesRepo as scenes, type scenesRepo, tableToolsRepo, visionRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { cellCenter, joinCollinear, type Point, type Wall } from '@crisol/tabletop'
import type { z } from 'zod'
import { pagesChanged } from '../realtime/events.ts'
import { campaignTableView, sceneView, screenViewOf, tokensWithSenses, visionOf } from '../table/projection.ts'
import { authorizedCampaign, authorizedPage, authorizedScene, sceneOfCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type SceneRow = scenesRepo.SceneWithPage
type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>
type WallInput = z.infer<typeof wallInput>
type LightInput = z.infer<typeof lightInput>
type Unit = 'px' | 'cell' | undefined

/** Pasa un punto a píxeles: en casillas, con la rejilla cuadrada de la escena (sin rejilla, de 100 px desde 0) */
function toPixels(grid: SceneRow['grid'], unit: Unit) {
  if (unit !== 'cell') return (p: Point): Point => p
  if (grid.type !== 'square' && grid.type !== 'none')
    throw new InvalidRequestError('CELLS_NEED_SQUARE_GRID', 'en casillas solo con rejilla cuadrada: usa píxeles')
  const size = grid.type === 'none' ? 100 : grid.size
  const offset = grid.type === 'none' ? { x: 0, y: 0 } : { x: grid.offsetX, y: grid.offsetY }
  return (p: Point): Point => ({ x: offset.x + p.x * size, y: offset.y + p.y * size })
}

const wallViewOf = (row: visionRepo.WallRow): WallView => ({
  id: row.id,
  a: { x: row.ax, y: row.ay },
  b: { x: row.bx, y: row.by },
  kind: wallKindOf(row),
  sight: row.sight,
  light: row.light,
  move: row.move,
  sound: row.sound,
  direction: row.direction,
  door: row.door,
  locked: row.locked,
  open: row.open
})

const lightViewOf = (row: visionRepo.LightRow): LightView => ({
  id: row.id,
  x: row.x,
  y: row.y,
  bright: row.bright,
  dim: row.dim,
  color: row.color,
  intensity: row.intensity,
  angle: row.angle,
  rotation: row.rotation,
  walls: row.walls,
  darkness: row.darkness,
  enabled: row.enabled,
  activeBelowAmbient: row.activeBelowAmbient
})

/** Los muros, puertas y luces de una escena; con las puertas de una campaña, si se da su estado */
async function sceneVisionOf(
  ctx: ActionContext,
  scene: Pick<scenesRepo.SceneRow, 'id' | 'version' | 'darkness' | 'automaticVision'>,
  campaignId?: string
): Promise<SceneVisionView> {
  const [walls, lights, state] = await Promise.all([
    visionRepo.listWalls(ctx.db, scene.id),
    visionRepo.listLights(ctx.db, scene.id),
    campaignId ? visionRepo.findSceneState(ctx.db, campaignId, scene.id) : Promise.resolve(null)
  ])
  return {
    sceneId: scene.id,
    version: scene.version,
    darkness: scene.darkness,
    automaticVision: scene.automaticVision,
    walls: walls.map(wallViewOf),
    lights: lights.map(lightViewOf),
    ...(campaignId
      ? {
          doors: Object.fromEntries(
            walls.filter((w) => w.door).map((w) => [w.id, state?.doors[w.id]?.open ?? w.open] as const)
          )
        }
      : {})
  }
}

/** Lo que para un muro: su tipo ya hecho (muro, por defecto), cambiado por lo que se diga aparte */
function blocksOf(input: Partial<WallInput>, base?: visionRepo.WallRow) {
  const preset = input.kind ? WALL_PRESETS[input.kind] : base ? null : WALL_PRESETS.wall
  const out: Partial<Pick<visionRepo.WallRow, 'sight' | 'light' | 'move' | 'sound'>> = { ...(preset ?? {}) }
  for (const key of ['sight', 'light', 'move', 'sound'] as const) {
    const value = input[key]
    if (value) out[key] = value
  }
  return out
}

function wallValues(input: WallInput, px: (p: Point) => Point): visionRepo.WallValues {
  const a = px(input.a)
  const b = px(input.b)
  return {
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    ...blocksOf(input),
    direction: input.direction ?? 'both',
    door: input.door ?? null,
    locked: input.locked ?? false,
    open: input.open ?? false
  }
}

function wallPatch(input: Partial<WallInput>, px: (p: Point) => Point, base: visionRepo.WallRow) {
  const a = input.a ? px(input.a) : null
  const b = input.b ? px(input.b) : null
  return {
    ...(a ? { ax: a.x, ay: a.y } : {}),
    ...(b ? { bx: b.x, by: b.y } : {}),
    ...blocksOf(input, base),
    ...(input.direction !== undefined ? { direction: input.direction } : {}),
    ...(input.door !== undefined ? { door: input.door } : {}),
    ...(input.locked !== undefined ? { locked: input.locked } : {}),
    ...(input.open !== undefined ? { open: input.open } : {})
  }
}

function lightValues(input: Partial<LightInput>, px: (p: Point) => Point): Partial<visionRepo.LightValues> {
  const at = input.x !== undefined && input.y !== undefined ? px({ x: input.x, y: input.y }) : null
  const { x: _x, y: _y, ...rest } = input
  return Object.fromEntries(
    Object.entries({ ...rest, ...(at ? { x: at.x, y: at.y } : {}) }).filter(([, v]) => v !== undefined)
  )
}

/**
 * Lo que trae el mapa de una escena (un UVTT o el de la IA), listo para poner en juego: los muros unidos donde siguen
 * rectos, los objetos que tapan, las puertas y ventanas, y las luces (las horneadas, apagadas, con la escena de día)
 */
export function importedVision(
  imported: NonNullable<scenesRepo.SceneRow['imported']>,
  grid: SceneRow['grid']
): Required<Pick<visionRepo.VisionChange, 'walls' | 'lights' | 'scene'>> {
  const segments = (lines: Point[][], kind: 'wall' | 'object'): Wall[] =>
    lines.flatMap((line) =>
      line.slice(1).map((b, i) => ({
        id: `${kind}${i}`,
        a: line[i] as Point,
        b,
        ...(({ sight, light, move }) => ({ sight, light, move }))(WALL_PRESETS[kind]),
        direction: 'both' as const,
        door: null,
        locked: false
      }))
    )
  const joined = (lines: Point[][], kind: 'wall' | 'object') =>
    joinCollinear(segments(lines, kind)).map(
      (w): visionRepo.WallValues => ({
        ax: w.a.x,
        ay: w.a.y,
        bx: w.b.x,
        by: w.b.y,
        ...WALL_PRESETS[kind],
        direction: 'both',
        door: null,
        locked: false,
        open: false
      })
    )
  const portals = imported.portals.map(
    (p): visionRepo.WallValues => ({
      ax: p.a.x,
      ay: p.a.y,
      bx: p.b.x,
      by: p.b.y,
      ...(p.window ? WALL_PRESETS.window : WALL_PRESETS.wall),
      direction: 'both',
      door: p.window ? null : 'door',
      locked: false,
      open: p.window ? false : !p.closed
    })
  )
  // El alcance viene en píxeles; las luces se guardan en la unidad de la rejilla
  const units = (px: number) => (grid.size > 0 ? (px / grid.size) * grid.distance : px)
  const lights = imported.lights.map(
    (l): visionRepo.LightValues => ({
      x: l.x,
      y: l.y,
      dim: units(l.range),
      bright: units(l.range) / 2,
      color: /^#[0-9a-fA-F]{6}$/.test(l.color) ? l.color : '#ffffff',
      intensity: Math.min(1, Math.max(0, l.intensity)),
      walls: l.shadows,
      enabled: !imported.bakedLighting
    })
  )
  const walls = [...joined(imported.walls, 'wall'), ...joined(imported.objects, 'object'), ...portals]
  const darkness = imported.bakedLighting ? 0 : ambientDarkness(imported.ambientLight)
  return {
    walls: { add: walls },
    lights: { add: lights },
    scene: { automaticVision: walls.length > 0, ...(darkness !== null ? { darkness } : {}) }
  }
}

/** La oscuridad que dice la luz ambiental de un UVTT (#rrggbb): de día si es blanca, de noche si es negra */
function ambientDarkness(color: string | null): number | null {
  const match = color ? /^#?([0-9a-fA-F]{6})$/.exec(color) : null
  if (!match?.[1]) return null
  const n = Number.parseInt(match[1], 16)
  const luminance = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return Math.round((1 - luminance) * 100) / 100
}

/** Pone en juego lo que trae el mapa de una escena (con `replace`, en lugar de lo que tuviera) */
export async function placeImported(
  ctx: ActionContext,
  scene: scenesRepo.SceneRow,
  context: OperationContext,
  replace: boolean
) {
  if (!scene.imported) throw new InvalidRequestError('NO_IMPORTED', 'el mapa de la escena no trae muros ni luces')
  const change = importedVision(scene.imported, scene.grid)
  await visionRepo.changeVision(ctx.db, context, scene.id, { ...change, replace })
  ctx.table?.sceneChanged(scene.id)
}

/** Si la escena aún no tiene muros ni luces (lo del mapa se pone solo la primera vez) */
export async function hasNoVision(ctx: ActionContext, sceneId: string) {
  const [walls, lights] = await Promise.all([
    visionRepo.listWalls(ctx.db, sceneId),
    visionRepo.listLights(ctx.db, sceneId)
  ])
  return walls.length === 0 && lights.length === 0
}

/** La escena de la que se habla: la que se pide o, si no, la abierta en la mesa (o la que enseña la pantalla) */
async function targetScene(ctx: ActionContext, campaignId: string, sceneId: string | undefined) {
  if (sceneId) return sceneId
  const table = await scenes.campaignTable(ctx.db, campaignId)
  const target = table.openSceneId ?? table.presentedSceneId
  if (!target) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre una escena antes o di cuál')
  return target
}

/** La escena en la que actúa la campaña (la que se pide o la abierta), con su estado en ella */
async function campaignScene(ctx: ActionContext, campaign: Campaign, sceneId: string | undefined) {
  const target = await targetScene(ctx, campaign.id, sceneId)
  const scene = await sceneOfCampaign(ctx, campaign.worldId, target)
  const { state } = await scenes.ensureSceneState(
    ctx.db,
    historyContext(
      ctx,
      'openScene',
      { campaign: campaign.name, name: scene.name, title: scene.pageTitle ?? scene.name },
      campaign
    ),
    { worldId: campaign.worldId, campaignId: campaign.id, sceneId: target }
  )
  return { scene, state }
}

/** Las operaciones de niebla de lo pedido, en píxeles (las casillas, como rectángulos por filas o círculos en hexágonos) */
function fogOperations(input: z.infer<typeof changeFog.input>, grid: SceneRow['grid']) {
  const base = { mode: input.mode }
  const square = grid.type === 'square' || grid.type === 'none'
  const size = grid.type === 'none' ? 100 : grid.size
  const offset = grid.type === 'none' ? { x: 0, y: 0 } : { x: grid.offsetX, y: grid.offsetY }
  const out: Array<Record<string, unknown> & { mode: 'reveal' | 'cover'; shape: string }> = []
  if (input.shape === 'rectangle')
    out.push({ ...base, shape: 'rectangle', x: input.x, y: input.y, width: input.width, height: input.height })
  else if (input.shape === 'brush') out.push({ ...base, shape: 'brush', points: input.points, radius: input.radius })
  else if (input.shape === 'lasso') out.push({ ...base, shape: 'lasso', points: input.points })
  else if (input.shape === 'area' && square)
    out.push({
      ...base,
      shape: 'rectangle',
      x: offset.x + (input.column ?? 0) * size,
      y: offset.y + (input.row ?? 0) * size,
      width: (input.columns ?? 1) * size,
      height: (input.rows ?? 1) * size
    })
  else {
    const cells =
      input.shape === 'cells'
        ? (input.cells ?? [])
        : Array.from({ length: (input.rows ?? 0) * (input.columns ?? 0) }, (_, i) => ({
            column: (input.column ?? 0) + (i % (input.columns ?? 1)),
            row: (input.row ?? 0) + Math.floor(i / (input.columns ?? 1))
          }))
    if (!square) {
      // En hexágonos, un círculo por casilla
      const type = grid.type as 'hex-rows' | 'hex-columns'
      for (const c of cells) {
        const center = cellCenter({ type, size, offsetX: offset.x, offsetY: offset.y }, { q: c.column, r: c.row })
        out.push({ ...base, shape: 'brush', points: [center], radius: size * 0.55 })
      }
    } else {
      // Por filas: las casillas seguidas de una fila, un rectángulo
      const rows = new Map<number, number[]>()
      for (const c of cells) rows.set(c.row, [...(rows.get(c.row) ?? []), c.column])
      for (const [row, columns] of [...rows].sort((p, q) => p[0] - q[0])) {
        const sorted = [...new Set(columns)].sort((p, q) => p - q)
        let start = sorted[0] as number
        for (let i = 1; i <= sorted.length; i++) {
          const here = sorted[i]
          const prev = sorted[i - 1] as number
          if (here !== undefined && here === prev + 1) continue
          out.push({
            ...base,
            shape: 'rectangle',
            x: offset.x + start * size,
            y: offset.y + row * size,
            width: (prev - start + 1) * size,
            height: size
          })
          if (here !== undefined) start = here
        }
      }
    }
  }
  // En el orden en que se piden (gana la última)
  const now = Date.now()
  return out.map((op, i) => ({ ...op, timestamp: now + i }))
}

/** Las casillas (cuadradas; sin rejilla, de 100 px) cuyo centro se ve, por filas */
function visibleCellsOf(
  grid: SceneRow['grid'],
  visible: { hasPoint(p: Point): boolean },
  size: { width: number; height: number }
) {
  if (grid.type !== 'square' && grid.type !== 'none') return { runs: [], count: 0 }
  const side = grid.type === 'none' ? 100 : grid.size
  const offset = grid.type === 'none' ? { x: 0, y: 0 } : { x: grid.offsetX, y: grid.offsetY }
  const runs: Array<{ row: number; from: number; to: number }> = []
  let count = 0
  const r0 = Math.floor(-offset.y / side)
  const c0 = Math.floor(-offset.x / side)
  const r1 = Math.ceil((size.height - offset.y) / side)
  const c1 = Math.ceil((size.width - offset.x) / side)
  for (let r = r0; r < r1; r++) {
    let start: number | null = null
    for (let c = c0; c <= c1; c++) {
      const seen = c < c1 && visible.hasPoint({ x: offset.x + (c + 0.5) * side, y: offset.y + (r + 0.5) * side })
      if (seen) count += 1
      if (seen && start === null) start = c
      if (!seen && start !== null) {
        if (runs.length < 2000) runs.push({ row: r, from: start, to: c - 1 })
        start = null
      }
    }
  }
  return { runs, count }
}

export const visionActions = [
  implement(getSceneVision, async (ctx, { sceneId, campaignId }) => {
    if (campaignId) {
      const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
      return sceneVisionOf(ctx, await sceneOfCampaign(ctx, campaign.worldId, sceneId), campaignId)
    }
    // Sin campaña, quien prepara el mundo: las puertas secretas son lo suyo
    const { scene } = await authorizedScene(ctx, 'page.write', sceneId)
    return sceneVisionOf(ctx, scene)
  }),

  implement(changeWalls, async (ctx, { sceneId, unit, walls, lights }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    const px = toPixels(scene.grid, unit)
    const current = new Map((await visionRepo.listWalls(ctx.db, sceneId)).map((w) => [w.id, w]))
    const count = (walls?.add?.length ?? 0) + (walls?.update?.length ?? 0) + (walls?.remove?.length ?? 0)
    const details = { title: page.title, name: scene.name, walls: count, lights: lights ? true : undefined }
    try {
      await visionRepo.changeVision(ctx.db, historyContext(ctx, 'changeWalls', details, wiki), sceneId, {
        walls: {
          add: (walls?.add ?? []).map((w) => wallValues(w, px)),
          update: (walls?.update ?? []).map(({ id, ...patch }) => {
            const base = current.get(id)
            if (!base) throw new visionRepo.NotInSceneError(id)
            return { id, patch: wallPatch(patch, px, base) }
          }),
          remove: walls?.remove ?? []
        },
        lights: {
          add: (lights?.add ?? []).map((l) => lightValues(l, px) as visionRepo.LightValues),
          update: (lights?.update ?? []).map(({ id, ...patch }) => ({ id, patch: lightValues(patch, px) })),
          remove: lights?.remove ?? []
        }
      })
    } catch (error) {
      if (error instanceof visionRepo.NotInSceneError)
        throw new InvalidRequestError('NOT_IN_SCENE', `${error.id} no es de esta escena`)
      throw error
    }
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneVisionOf(ctx, (await scenes.findScene(ctx.db, sceneId)) as SceneRow)
  }),

  implement(placeImportedWalls, async (ctx, { sceneId, replace }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    if (!scene.imported) throw new InvalidRequestError('NO_IMPORTED', 'el mapa de la escena no trae muros ni luces')
    if (!replace && !(await hasNoVision(ctx, sceneId)))
      throw new InvalidRequestError('WALLS_EXIST', 'la escena ya tiene muros o luces: replace para cambiarlos')
    const context = historyContext(ctx, 'placeImportedWalls', { title: page.title, name: scene.name }, wiki)
    await placeImported(ctx, scene, context, replace === true)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneVisionOf(ctx, (await scenes.findScene(ctx.db, sceneId)) as SceneRow)
  }),

  implement(updateSceneVision, async (ctx, { sceneId, darkness, automaticVision }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    const details = { title: page.title, name: scene.name, darkness, automaticVision }
    await visionRepo.changeVision(ctx.db, historyContext(ctx, 'updateSceneVision', details, wiki), sceneId, {
      scene: {
        ...(darkness !== undefined ? { darkness } : {}),
        ...(automaticVision !== undefined ? { automaticVision } : {})
      }
    })
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneVisionOf(ctx, (await scenes.findScene(ctx.db, sceneId)) as SceneRow)
  }),

  implement(setDoor, async (ctx, { campaignId, wallId, open }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const wall = await visionRepo.findWall(ctx.db, wallId)
    if (!wall || wall.worldId !== campaign.worldId) throw new NotFoundError('wall')
    if (!wall.door) throw new InvalidRequestError('NOT_A_DOOR', 'ese muro no es una puerta')
    // El máster abre y cierra todas (también las secretas y las que tienen llave)
    const { scene, state } = await campaignScene(ctx, campaign, wall.sceneId)
    await visionRepo.setDoors(
      ctx.db,
      historyContext(ctx, open ? 'openDoor' : 'closeDoor', { campaign: campaign.name, name: scene.name }, campaign),
      state.id,
      { [wallId]: { open } }
    )
    ctx.table?.changed(campaignId)
    return { wallId, open }
  }),

  implement(changeFog, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', input.campaignId)
    const { scene } = await campaignScene(ctx, campaign, input.sceneId)
    const operations = fogOperations(input, scene.grid)
    await visionRepo.addFog(
      ctx.db,
      historyContext(ctx, input.mode === 'reveal' ? 'revealFog' : 'coverFog', { campaign: campaign.name }, campaign),
      { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id },
      operations
    )
    ctx.table?.changed(campaign.id)
    return { sceneId: scene.id, operations: operations.length }
  }),

  implement(resetFog, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const { scene } = await campaignScene(ctx, campaign, sceneId)
    const place = { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id }
    const context = historyContext(ctx, 'resetFog', { campaign: campaign.name, name: scene.name }, campaign)
    const work = () => visionRepo.resetFog(ctx.db, context, place)
    const removed = ctx.vision ? await ctx.vision.reset(campaign.id, scene.id, work) : await work()
    ctx.table?.changed(campaign.id)
    return { sceneId: scene.id, removed }
  }),

  implement(setTileFit, async (ctx, { campaignId, tileFit }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    await scenes.setCampaignTable(ctx.db, campaignId, { tileFit })
    ctx.table?.changed(campaignId)
    return campaignTableView(ctx, campaignId)
  }),

  implement(viewAsParty, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneOfCampaign(ctx, campaign.worldId, await targetScene(ctx, campaignId, sceneId))
    const loaded = await tokensWithSenses(ctx, campaign, scene.id)
    const vision = await visionOf(ctx, campaign, scene, loaded)
    if (!vision) throw new Error('sin el servicio de la visión')
    const table = await scenes.campaignTable(ctx.db, campaignId)
    const master = await campaignTableView(ctx, campaignId)
    const screen = screenViewOf({
      campaignId,
      campaignName: campaign.name,
      scene: sceneView(scene),
      hidden: false,
      camera: table.camera,
      tokens: loaded.views,
      combat: master.combat ?? null,
      vision,
      marks: await tableToolsRepo.listMarks(ctx.db, campaignId, scene.id),
      widgets: master.widgets ?? []
    })
    const cells = visibleCellsOf(scene.grid, vision.visible, vision)
    const seen = loaded.views.filter((t) => !t.hidden && vision.seen.has(t.id))
    const notSeen = loaded.views.filter((t) => t.hidden || !vision.seen.has(t.id))
    return {
      sceneId: scene.id,
      automaticVision: scene.automaticVision,
      screen,
      visibleCells: cells.runs,
      visibleCount: cells.count,
      tokensSeen: seen.map((t) => ({ id: t.id, label: t.label, name: t.actor.name })),
      notSeen: notSeen.map((t) => ({ id: t.id, label: t.label, name: t.actor.name, hidden: t.hidden })),
      secretDoors: [...vision.secretDoors]
    }
  })
]
