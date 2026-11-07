/**
 * Las herramientas de la mesa (docs/specs/herramientas-mesa.md): lo dejado en el mapa de una escena de la campaña
 * (plantillas, dibujos, textos, sellos, pines e imágenes), medir, las fichas de dentro de una plantilla, los widgets
 * de la campaña, las instantáneas y «la tele ve lo que mides». Todo de la mesa de la campaña: lo lleva su máster. Lo
 * que cambia se avisa a la sala abierta (y, sin nadie, se guarda igual: la IA trabaja sola)
 */
import {
  changeMarks,
  createWidget,
  deleteSnapshot,
  deleteWidget,
  getTemplateTokens,
  listMarks,
  listSnapshots,
  listWidgets,
  MARK_SCHEMAS,
  type MarkKind,
  measureDistance,
  placeTemplate,
  restoreSnapshot,
  type SnapshotView,
  saveSnapshot,
  setMeasureOnScreen,
  type TokenView,
  updateWidget,
  type WidgetView
} from '@crisol/contracts'
import { filesRepo, pagesRepo, scenesRepo, tableToolsRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import {
  clampCounter,
  clockStep,
  counterStep,
  DEFAULT_CONE_ANGLE,
  DEFAULT_DURATION,
  DEFAULT_SEGMENTS,
  DEFAULT_WIDGET_COLOR,
  distanceText,
  distanceToPixels,
  measurePath,
  nextWidgetSort,
  type Point,
  pauseTimer,
  resetTimer,
  secondsLeft,
  startTimer
} from '@crisol/tabletop'
import { gridOf, markViewOf, tokensInside, widgetViewOf } from '../table/marks.ts'
import { tokenViews } from '../table/projection.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { sceneOfCampaign } from './scenes.ts'
import { pointIn } from './tokens.ts'

type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>
type SceneRow = scenesRepo.SceneWithPage

/** El color de una plantilla que no dice el suyo */
const TEMPLATE_COLOR = '#e0b04a'

/** La escena de la que se habla: la que se pide o, si no, la abierta en la mesa (o la que enseña la pantalla) */
async function sceneFor(ctx: ActionContext, campaign: Campaign, sceneId: string | undefined): Promise<SceneRow> {
  let target = sceneId
  if (!target) {
    const table = await scenesRepo.campaignTable(ctx.db, campaign.id)
    target = table.openSceneId ?? table.presentedSceneId ?? undefined
  }
  if (!target) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre una escena antes o di cuál')
  return sceneOfCampaign(ctx, campaign.worldId, target)
}

/** Con su estado en ella (la primera vez que la campaña hace algo en una escena) */
async function sceneWithState(ctx: ActionContext, campaign: Campaign, sceneId: string | undefined) {
  const scene = await sceneFor(ctx, campaign, sceneId)
  await scenesRepo.ensureSceneState(
    ctx.db,
    historyContext(ctx, 'openScene', { campaign: campaign.name, name: scene.name, title: scene.pageTitle }, campaign),
    { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id }
  )
  return scene
}

/** Lo propio de una marca, sin su clase ni si es del máster, ya validado con su esquema */
function markData(kind: MarkKind, data: Record<string, unknown>): Record<string, unknown> {
  const parsed = MARK_SCHEMAS[kind].safeParse(data)
  if (!parsed.success) throw new InvalidRequestError('BAD_MARK', parsed.error.issues[0]?.message ?? 'marca no válida')
  return parsed.data as Record<string, unknown>
}

/** Una imagen del mundo o común de su organización */
async function checkImage(ctx: ActionContext, campaign: Campaign, fileId: string) {
  const file = await filesRepo.findFile(ctx.db, fileId)
  if (
    file?.kind !== 'image' ||
    (file.worldId !== campaign.worldId && (file.worldId !== null || file.organizationId !== campaign.organizationId))
  )
    throw new InvalidRequestError('BAD_MARK_IMAGE', 'esa imagen no es del mundo')
}

/** Lo que una marca nombra fuera de ella (la imagen, la página del pin) es del mundo de la campaña */
async function checkRefs(ctx: ActionContext, campaign: Campaign, kind: MarkKind, data: Record<string, unknown>) {
  if (kind === 'stamp') {
    if (!data.icon && !data.fileId) throw new InvalidRequestError('BAD_MARK', 'un sello lleva icon o fileId')
    if (typeof data.fileId === 'string') await checkImage(ctx, campaign, data.fileId)
  }
  if (kind === 'image') await checkImage(ctx, campaign, data.fileId as string)
  if (kind === 'pin' && typeof data.pageId === 'string') {
    const page = await pagesRepo.findPage(ctx.db, data.pageId)
    if (page?.worldId !== campaign.worldId) throw new InvalidRequestError('BAD_MARK_PAGE', 'esa página no es del mundo')
  }
}

/** Una marca movida: todos sus puntos */
function moved(data: Record<string, unknown>, dx: number, dy: number): Record<string, unknown> {
  const shift = (p: Point) => ({ x: p.x + dx, y: p.y + dy })
  const out = { ...data }
  if (typeof out.x === 'number' && typeof out.y === 'number') Object.assign(out, shift(out as unknown as Point))
  if (out.a) out.a = shift(out.a as Point)
  if (out.b) out.b = shift(out.b as Point)
  if (Array.isArray(out.points)) out.points = (out.points as Point[]).map(shift)
  return out
}

/** Las marcas de la escena, como las ve el máster (las plantillas, con sus fichas de dentro) */
async function markViews(ctx: ActionContext, campaign: Campaign, scene: SceneRow, ids?: ReadonlySet<string>) {
  const [rows, tokens] = await Promise.all([
    tableToolsRepo.listMarks(ctx.db, campaign.id, scene.id),
    tokenViews(ctx, campaign, scene.id)
  ])
  return rows.filter((r) => !ids || ids.has(r.id)).map((r) => markViewOf(r, tokens, scene.grid))
}

/** Las fichas de dentro de una plantilla, para elegirlas y dañarlas */
const targetsOf = (data: Record<string, unknown>, tokens: readonly TokenView[], grid: SceneRow['grid']) =>
  tokensInside(data, tokens, grid).map((t) => ({
    tokenId: t.id,
    label: t.label,
    name: t.actor.name,
    kind: t.actor.kind,
    actorId: t.actor.id,
    hidden: t.hidden
  }))

/** Un ángulo en grados, hacia `toward` desde `from` o el dado (0 al este, 90 al sur) */
const angleOf = (from: Point, toward: Point | null, direction: number | undefined) =>
  toward ? Math.atan2(toward.y - from.y, toward.x - from.x) : ((direction ?? 0) * Math.PI) / 180

/** El valor de un widget dentro de lo que admite su clase */
function fitValue(kind: WidgetView['kind'], value: number, s: tableToolsRepo.WidgetRow['settings']) {
  if (kind === 'counter') return clampCounter(s, value)
  if (kind === 'clock') return clockStep(s.segments ?? DEFAULT_SEGMENTS, Math.round(value), 0)
  return Math.max(0, Math.min(value, s.duration ?? DEFAULT_DURATION))
}

/** Un widget de una campaña que la cuenta lleva (404 si no) */
async function ownWidget(ctx: ActionContext, widgetId: string) {
  const widget = await tableToolsRepo.findWidget(ctx.db, widgetId)
  const campaign = await authorizedCampaign(ctx, 'table.manage', widget?.campaignId ?? '')
  if (!widget) throw new NotFoundError('widget')
  return { widget, campaign }
}

const snapshotViewOf = (row: tableToolsRepo.SnapshotRow): SnapshotView => ({
  id: row.id,
  sceneId: row.sceneId,
  name: row.name,
  thumbnail: row.thumbnail,
  createdAt: row.createdAt.toISOString(),
  tokens: row.data.tokens.length,
  marks: row.data.marks.length
})

/** Una instantánea de una campaña que la cuenta lleva (404 si no) */
async function ownSnapshot(ctx: ActionContext, snapshotId: string) {
  const snapshot = await tableToolsRepo.findSnapshot(ctx.db, snapshotId)
  const campaign = await authorizedCampaign(ctx, 'table.manage', snapshot?.campaignId ?? '')
  if (!snapshot) throw new NotFoundError('snapshot')
  return { snapshot, campaign }
}

export const tableToolActions = [
  implement(listMarks, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneFor(ctx, campaign, sceneId)
    return { sceneId: scene.id, marks: await markViews(ctx, campaign, scene) }
  }),

  implement(changeMarks, async (ctx, { campaignId, sceneId, add, update, remove }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneWithState(ctx, campaign, sceneId)
    const current = new Map(
      (await tableToolsRepo.listMarks(ctx.db, campaign.id, scene.id)).map((row) => [row.id, row] as const)
    )
    const added = []
    for (const { kind, hidden, ...rest } of add ?? []) {
      const data = markData(kind, rest)
      await checkRefs(ctx, campaign, kind, data)
      // Los pines son del máster salvo que se diga
      added.push({ kind, hidden: hidden ?? kind === 'pin', data })
    }
    const updates = []
    for (const change of update ?? []) {
      const row = current.get(change.id)
      if (!row) throw new InvalidRequestError('NOT_IN_SCENE', `${change.id} no es de esta escena`)
      let data: Record<string, unknown> | undefined
      if (change.set || change.move) {
        const merged = { ...row.data, ...(change.set ?? {}) }
        data = markData(row.kind, change.move ? moved(merged, change.move.dx, change.move.dy) : merged)
        if (change.set) await checkRefs(ctx, campaign, row.kind, data)
      }
      updates.push({
        id: change.id,
        ...(change.hidden !== undefined ? { hidden: change.hidden } : {}),
        ...(data ? { data } : {})
      })
    }
    const strangers = (remove ?? []).filter((id) => !current.has(id))
    if (strangers.length > 0) throw new InvalidRequestError('NOT_IN_SCENE', `${strangers[0]} no es de esta escena`)
    const count = added.length + updates.length + (remove?.length ?? 0)
    const result = await tableToolsRepo.changeMarks(
      ctx.db,
      historyContext(ctx, 'changeMarks', { campaign: campaign.name, name: scene.name, count }, campaign),
      { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id },
      { add: added, update: updates, remove: remove ?? [] }
    )
    ctx.table?.changed(campaign.id)
    const ids = new Set([...result.added, ...result.updated].map((r) => r.id))
    return { sceneId: scene.id, marks: await markViews(ctx, campaign, scene, ids), removed: result.removed }
  }),

  implement(placeTemplate, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', input.campaignId)
    const scene = await sceneWithState(ctx, campaign, input.sceneId)
    const { cell } = gridOf(scene.grid)
    const px = (units: number) => distanceToPixels(units, scene.grid.distance, cell)
    const origin = pointIn(scene.grid, input.from)
    const toward = input.toward ? pointIn(scene.grid, input.toward) : null
    const size = px(input.size)
    let a = origin
    let b: Point
    if (input.shape === 'square') {
      // Desde la esquina de arriba a la izquierda de la casilla
      a = { x: origin.x - cell / 2, y: origin.y - cell / 2 }
      b = { x: a.x + size, y: a.y + size }
    } else {
      const angle = angleOf(origin, toward, input.direction)
      b = { x: origin.x + Math.cos(angle) * size, y: origin.y + Math.sin(angle) * size }
    }
    const data = markData('template', {
      shape: input.shape,
      a,
      b,
      ...(input.shape === 'cone' ? { angle: input.angle ?? DEFAULT_CONE_ANGLE } : {}),
      ...(input.shape === 'line' ? { width: input.width ? px(input.width) : cell } : {}),
      color: input.color ?? TEMPLATE_COLOR,
      ...(input.damageType ? { damageType: input.damageType } : {})
    })
    const result = await tableToolsRepo.changeMarks(
      ctx.db,
      historyContext(ctx, 'placeTemplate', { campaign: campaign.name, name: scene.name, shape: input.shape }, campaign),
      { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id },
      { add: [{ kind: 'template', hidden: input.hidden ?? false, data }] }
    )
    ctx.table?.changed(campaign.id)
    const row = result.added[0]
    if (!row) throw new Error('placeTemplate: sin plantilla tras guardar')
    const tokens = await tokenViews(ctx, campaign, scene.id)
    return { template: markViewOf(row, tokens, scene.grid), tokens: targetsOf(row.data, tokens, scene.grid) }
  }),

  implement(getTemplateTokens, async (ctx, { campaignId, templateId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const mark = await tableToolsRepo.findMark(ctx.db, templateId)
    if (!mark || mark.campaignId !== campaign.id || mark.kind !== 'template') throw new NotFoundError('template')
    const scene = await sceneOfCampaign(ctx, campaign.worldId, mark.sceneId)
    return { tokens: targetsOf(mark.data, await tokenViews(ctx, campaign, scene.id), scene.grid) }
  }),

  implement(measureDistance, async (ctx, { campaignId, sceneId, points }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneFor(ctx, campaign, sceneId)
    const { grid, cell } = gridOf(scene.grid)
    const measured = measurePath(
      grid,
      points.map((p) => pointIn(scene.grid, p)),
      scene.grid.diagonals,
      cell
    )
    const cells = Math.round(measured.cells * 100) / 100
    const scale = { distance: scene.grid.distance, units: scene.grid.units }
    return {
      sceneId: scene.id,
      cells,
      distance: Math.round(cells * scale.distance * 100) / 100,
      units: scale.units,
      text: distanceText(cells, scale),
      segments: measured.segments.map((n) => Math.round(n * 100) / 100)
    }
  }),

  implement(setMeasureOnScreen, async (ctx, { campaignId, on }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    const row = await scenesRepo.setCampaignTable(ctx.db, campaignId, { measureOnScreen: on })
    ctx.table?.changed(campaignId)
    return { measureOnScreen: row.measureOnScreen }
  }),

  implement(listWidgets, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    return { widgets: (await tableToolsRepo.listWidgets(ctx.db, campaignId)).map(widgetViewOf) }
  }),

  implement(createWidget, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', input.campaignId)
    const { kind } = input
    const settings: tableToolsRepo.WidgetRow['settings'] =
      kind === 'counter'
        ? { min: input.min ?? null, max: input.max ?? null }
        : kind === 'clock'
          ? { segments: input.segments ?? DEFAULT_SEGMENTS, showCount: input.showCount ?? false }
          : { duration: input.duration ?? DEFAULT_DURATION, running: null }
    if (kind === 'counter' && settings.min != null && settings.max != null && settings.min > settings.max)
      throw new InvalidRequestError('BAD_LIMITS', 'el mínimo pasa del máximo')
    const value = fitValue(
      kind,
      input.value ?? (kind === 'timer' ? (settings.duration ?? DEFAULT_DURATION) : 0),
      settings
    )
    const others = await tableToolsRepo.listWidgets(ctx.db, campaign.id)
    const row = await tableToolsRepo.insertWidget(
      ctx.db,
      historyContext(ctx, 'createWidget', { campaign: campaign.name, label: input.label }, campaign),
      {
        worldId: campaign.worldId,
        campaignId: campaign.id,
        kind,
        label: input.label,
        icon: input.icon ?? null,
        color: input.color ?? DEFAULT_WIDGET_COLOR[kind],
        shown: input.shown ?? true,
        sort: nextWidgetSort(others),
        value,
        settings
      }
    )
    ctx.table?.changed(campaign.id)
    return widgetViewOf(row)
  }),

  implement(updateWidget, async (ctx, input) => {
    const { widget, campaign } = await ownWidget(ctx, input.widgetId)
    const settings = { ...widget.settings }
    let value = widget.value
    if (widget.kind === 'counter') {
      if (input.min !== undefined) settings.min = input.min
      if (input.max !== undefined) settings.max = input.max
      if (settings.min != null && settings.max != null && settings.min > settings.max)
        throw new InvalidRequestError('BAD_LIMITS', 'el mínimo pasa del máximo')
      if (input.value !== undefined) value = input.value
      if (input.step !== undefined) value = counterStep(settings, value, input.step)
    } else if (widget.kind === 'clock') {
      if (input.segments !== undefined) settings.segments = input.segments
      if (input.showCount !== undefined) settings.showCount = input.showCount
      if (input.value !== undefined) value = input.value
      if (input.step !== undefined) value = clockStep(settings.segments ?? DEFAULT_SEGMENTS, value, input.step)
    } else {
      const now = Date.now()
      const timer = { value, duration: settings.duration ?? DEFAULT_DURATION, running: settings.running ?? null }
      // Cambiar la duración lo reinicia
      if (input.duration !== undefined && input.duration !== timer.duration) {
        settings.duration = input.duration
        Object.assign(timer, { duration: input.duration }, resetTimer({ ...timer, duration: input.duration }))
      }
      if (input.value !== undefined) Object.assign(timer, { value: input.value, running: null })
      if (input.step !== undefined) {
        const left = Math.max(0, secondsLeft(timer, now) + input.step)
        Object.assign(timer, { value: left, running: timer.running ? { since: now, remaining: left } : null })
      }
      if (input.timer === 'start') Object.assign(timer, startTimer(timer, now))
      if (input.timer === 'pause') Object.assign(timer, pauseTimer(timer, now))
      if (input.timer === 'reset') Object.assign(timer, resetTimer(timer))
      value = timer.value
      settings.running = timer.running
    }
    const row = await tableToolsRepo.updateWidget(
      ctx.db,
      historyContext(ctx, 'updateWidget', { campaign: campaign.name, label: widget.label }, campaign),
      widget.id,
      {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.shown !== undefined ? { shown: input.shown } : {}),
        ...(input.sort !== undefined ? { sort: input.sort } : {}),
        value: fitValue(widget.kind, value, settings),
        settings
      }
    )
    ctx.table?.changed(campaign.id)
    return widgetViewOf(row)
  }),

  implement(deleteWidget, async (ctx, { widgetId }) => {
    const { widget, campaign } = await ownWidget(ctx, widgetId)
    await tableToolsRepo.removeWidget(
      ctx.db,
      historyContext(ctx, 'deleteWidget', { campaign: campaign.name, label: widget.label }, campaign),
      widget.id
    )
    ctx.table?.changed(campaign.id)
    return { id: widget.id }
  }),

  implement(listSnapshots, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneFor(ctx, campaign, sceneId)
    const rows = await tableToolsRepo.listSnapshots(ctx.db, campaign.id, scene.id)
    return { sceneId: scene.id, snapshots: rows.map(snapshotViewOf) }
  }),

  implement(saveSnapshot, async (ctx, { campaignId, sceneId, name, thumbnail }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneWithState(ctx, campaign, sceneId)
    const data = await tableToolsRepo.captureSnapshot(ctx.db, campaign.id, scene.id)
    const row = await tableToolsRepo.insertSnapshot(
      ctx.db,
      historyContext(ctx, 'saveSnapshot', { campaign: campaign.name, name, scene: scene.name }, campaign),
      {
        worldId: campaign.worldId,
        campaignId: campaign.id,
        sceneId: scene.id,
        name,
        thumbnail: thumbnail ?? null,
        data
      }
    )
    return snapshotViewOf(row)
  }),

  implement(restoreSnapshot, async (ctx, { campaignId, snapshotId }) => {
    const { snapshot, campaign } = await ownSnapshot(ctx, snapshotId)
    if (snapshot.campaignId !== campaignId) throw new NotFoundError('snapshot')
    const scene = await sceneWithState(ctx, campaign, snapshot.sceneId)
    const result = await tableToolsRepo.restoreSnapshot(
      ctx.db,
      historyContext(
        ctx,
        'restoreSnapshot',
        { campaign: campaign.name, name: snapshot.name, scene: scene.name },
        campaign
      ),
      { worldId: campaign.worldId, campaignId: campaign.id, sceneId: scene.id },
      snapshot.data
    )
    ctx.table?.changed(campaign.id)
    return { sceneId: scene.id, ...result }
  }),

  implement(deleteSnapshot, async (ctx, { snapshotId }) => {
    const { snapshot, campaign } = await ownSnapshot(ctx, snapshotId)
    await tableToolsRepo.removeSnapshot(
      ctx.db,
      historyContext(ctx, 'deleteSnapshot', { campaign: campaign.name, name: snapshot.name }, campaign),
      snapshot.id
    )
    return { id: snapshot.id }
  })
]
