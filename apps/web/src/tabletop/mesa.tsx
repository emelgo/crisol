/**
 * La mesa del máster (docs/specs/escenas.md, ADR-0018): la escena abierta a toda la pantalla (PixiJS), el panel con las
 * escenas del mundo y, arriba, lo que ve el grupo: presentar u ocultar, la pantalla de la tele en otra ventana y su
 * cámara (seguir la vista del máster o quedarse fija en un marco que se arrastra). A la izquierda, la columna de
 * herramientas (docs/specs/vision.md): la niebla a mano, los muros y puertas y las luces, cada una con su panel; la
 * niebla se ve atenuada y las puertas se abren con un clic. Con las herramientas (docs/specs/herramientas-mesa.md):
 * medir y dejar plantillas (y elegir las fichas de dentro para dañarlas), dibujar, textos, sellos, pines, imágenes y el
 * láser; abajo en la columna, los widgets, la pantalla del máster y las instantáneas. Lo de la campaña llega por el
 * canal de la mesa; lo que se cambia, por la API
 */
import type { Campaign, CampaignTableView, SceneView, SceneViewport, TokenView } from '@crisol/contracts'
import {
  framingRect,
  isTrackpadWheel,
  type Point,
  type Size,
  toWorld,
  type Viewport,
  wheelZoomFactor,
  widthToCorner,
  zoomAt,
  zoomLimits
} from '@crisol/tabletop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { ChevronDown, ExternalLink, EyeOff, Maximize, Minus, Play, Plus, Tv } from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { canvasViewOf, framingOf, REFERENCE_ASPECT, sceneViewportOf, sceneViewportOfCanvas } from './camera.ts'
import { connectTable, type DragMove, type TableChannel, type TableStatus } from './channel.ts'
import { masterDraw } from './draw.ts'
import { decodeMask, fogImage, fogLayerOf } from './fog-paint.ts'
import { GmPanel, GmScreen, useGmSettings } from './gm-screen.tsx'
import { GroupDamage } from './group-damage.tsx'
import { MarksLayer, placeMarks } from './marks-layer.tsx'
import { MasterSidebar } from './master-sidebar.tsx'
import styles from './mesa.module.css'
import { PLACING_TYPE, type Placing } from './panel.tsx'
import { Preparing } from './preparing.tsx'
import { masterTileUrl, sceneListKey } from './queries.ts'
import type { RendererScene } from './renderer.ts'
import { SnapshotsPanel, THUMBNAIL_BYTES, THUMBNAIL_SIDE } from './snapshots.tsx'
import { TokenCard } from './token-card.tsx'
import { TokenImageEditor } from './token-image.tsx'
import { TokenSheet } from './token-sheet.tsx'
import { arrowMoves, cellSide, dragMoves, dropAt, tokenAt, tokenRadius, tokensIn } from './tokens.ts'
import { TextInput, ToolBar, ToolsPanel } from './tools-panel.tsx'
import { useScenePreparation } from './use-preparation.ts'
import { useTableRenderer } from './use-renderer.ts'
import { isMarkTool, useTableTools } from './use-table-tools.ts'
import { fitCanvas } from './view.ts'
import visionStyles from './vision.module.css'
import {
  isVisionTool,
  placeMarkers,
  SIDE_PANELS,
  type SidePanel,
  type TableTool,
  TOOLS,
  ToolColumn,
  type ToolHandlers,
  useVision,
  VisionMarkers
} from './vision.tsx'
import { AsGroupBanner, FogTools, VisionPanel } from './vision-panel.tsx'
import { useWidgets, WidgetCards, WidgetsPanel } from './widgets.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/mesa')

/** La dirección vieja de la mesa: la campaña ya se abre en ella */
export function MesaScreen() {
  const { worldId, campaignId } = route.useParams()
  return <Navigate to="/mundos/$worldId/campanas/$campaignId" params={{ worldId, campaignId }} replace />
}

type Gesture = {
  startX: number
  startY: number
  view: Viewport
  pinch: number | null
}

type FrameDrag = { kind: 'move' | 'resize'; start: Point; center: Point; width: number }

/** La mesa del máster: es lo que se ve al abrir su campaña (la ruta de la campaña comprueba quién es) */
export function Mesa({
  worldId,
  worldName,
  campaign: current
}: {
  worldId: string
  worldName: string
  campaign: Campaign
}) {
  const campaignId = current.id
  const campaignName = current.name
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const [table, setTable] = useState<CampaignTableView | null>(null)
  const [status, setStatus] = useState<TableStatus>('connecting')
  const channel = useRef<TableChannel | null>(null)
  const open = table?.open ?? null
  const preparation = useScenePreparation(worldId)
  // La vista del máster (dónde cae el mapa y a qué escala): es de su navegador
  const view = useRef<Viewport>({ x: 0, y: 0, scale: 1 })
  // Las fichas: las elegidas, la de la tarjeta, la de la hoja abierta y la de su imagen
  const [selected, setSelected] = useState<string[]>([])
  const [cardFor, setCardFor] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const [imageFor, setImageFor] = useState<{ tokenId: string; fileId: string | null } | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  // Lo que arrastra otra pestaña del máster, en vivo (se olvida al llegar la mesa)
  const remote = useRef(new Map<string, Point>())
  const [remoteTick, setRemoteTick] = useState(0)
  const client = useQueryClient()
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId })
  })
  const systemId = campaign.data?.campaign.system?.id ?? null

  // El canal de la mesa: la del máster, al entrar y cada vez que cambia
  useEffect(() => {
    const connection = connectTable(
      { campaignId, view: 'master' },
      {
        onMessage: (message) => {
          if (message.type === 'master') {
            remote.current.clear()
            setTable(message.table)
          } else if (message.type === 'drag') {
            for (const move of message.moves) remote.current.set(move.tokenId, { x: move.x, y: move.y })
            setRemoteTick((n) => n + 1)
          }
        },
        onStatus: setStatus
      }
    )
    channel.current = connection
    return () => {
      connection.close()
      channel.current = null
    }
  }, [campaignId])

  // Lo que devuelven las acciones también es la mesa: se ve al momento, sin esperar al canal
  const act = useMutation({
    mutationFn: (run: () => Promise<CampaignTableView>) => run(),
    onSuccess: setTable
  })
  const openScene = (sceneId: string) => {
    setSelected([])
    setCardFor(null)
    act.mutate(() => api.call('openScene', { campaignId, sceneId }))
  }
  const tokens = useMemo(() => (table?.tokens ?? []).filter((token) => token.sceneId === table?.open?.id), [table])
  // El combate (su panel, en la pestaña Combate de la barra)
  const combat = table?.combat ?? null
  // Quien tiene el turno: su ficha lleva el aro y la mesa se centra en ella (si no se ve)
  const turnTokens = useMemo(
    () => new Set((combat?.combatants ?? []).filter((c) => c.active && c.tokenId).map((c) => c.tokenId as string)),
    [combat]
  )
  const center = useRef<((tokenId: string, always: boolean) => void) | null>(null)
  const turnId = combat?.turnId ?? null
  const combatRef = useRef(combat)
  combatRef.current = combat
  useEffect(() => {
    const first = combatRef.current?.combatants.find((c) => c.active && c.tokenId)?.tokenId
    if (turnId && first) center.current?.(first, false)
  }, [turnId])
  const byId = (id: string | null) => tokens.find((token) => token.id === id) ?? null
  // Lo que se suelta en el mapa (o, con su «+», en medio de lo que se ve)
  const [skipped, setSkipped] = useState<string[]>([])
  const place = useMutation({
    mutationFn: async ({ placing, at }: { placing: Placing; at: Point | null }) => {
      const sceneId = open?.id
      if (!sceneId) return
      const point =
        at ?? (size.width > 0 ? toWorld(view.current, { x: size.width / 2, y: size.height / 2 }) : { x: 0, y: 0 })
      const where = { x: Math.round(point.x), y: Math.round(point.y) }
      setSkipped([])
      if (placing.kind === 'encounter') {
        const out = await api.call('placeEncounter', { campaignId, sceneId, encounterId: placing.id, ...where })
        setSkipped(out.skipped)
        return
      }
      const token =
        placing.kind === 'character'
          ? { characterId: placing.id, ...where }
          : placing.kind === 'creature'
            ? { creatureId: placing.id, ...where }
            : { content: { key: placing.key, count: placing.count }, ...where }
      await api.call('placeTokens', { campaignId, sceneId, tokens: [token] })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  })
  // Ctrl+Z: deshace el último movimiento de fichas hecho desde la mesa (el del historial del mundo)
  const undo = useMutation({
    mutationFn: async () => {
      const history = await api.call('listHistory', { worldId, limit: 30 })
      const last = history.entries.find(
        (entry) => entry.action === 'moveTokens' && entry.via === 'ui' && !entry.undoneBy && !entry.undoes
      )
      if (last) await api.call('undoOperation', { operationId: last.id })
    }
  })

  const scene: RendererScene | null = useMemo(
    () =>
      open?.image?.tiles
        ? {
            id: open.id,
            width: open.image.width,
            height: open.image.height,
            tiles: open.image.tiles,
            grid: open.grid,
            tileUrl: masterTileUrl(open.id, open.image.tiles.version)
          }
        : null,
    [open]
  )
  const { host, renderer, ready, failed: noCanvas, size } = useTableRenderer(scene)

  // La visión: la herramienta de la columna, «Ver como el grupo» y los muros, puertas y luces de la escena
  const [tool, setTool] = useState<TableTool>('select')
  const [asGroup, setAsGroup] = useState(false)
  // Los paneles de abajo de la columna (widgets, pantalla del máster, instantáneas): con la herramienta de elegir
  const [side, setSide] = useState<SidePanel | null>(null)
  const returnTool = useRef<TableTool>('select')
  const pickTool = useCallback((next: TableTool) => {
    setAsGroup(false)
    setSide(null)
    setTool(next)
  }, [])
  const toggleSide = useCallback((next: SidePanel) => {
    setAsGroup(false)
    setTool('select')
    setSide((current) => (current === next ? null : next))
  }, [])
  const markers = useRef<HTMLDivElement | null>(null)
  const marksLayer = useRef<HTMLDivElement | null>(null)
  const vision = useVision({ campaignId, table, tool, asGroup, view, renderer, ready, onTable: setTable })
  const tools = useTableTools({ campaignId, table, tool, view, renderer, ready, channel, tokens })
  const widgets = useWidgets(campaignId, table)
  const gm = useGmSettings(campaignId, open)
  // Las fichas de dentro de una plantilla, elegidas para el daño a varias
  const [fromTemplate, setFromTemplate] = useState(false)
  const notSeen = useMemo(
    () => (table?.vision && table.vision.sceneId === open?.id ? table.vision.notSeen : []),
    [table?.vision, open?.id]
  )
  // Viendo como el grupo, sin las fichas que no ve
  const shownTokens = useMemo(
    () => (asGroup ? tokens.filter((token) => !notSeen.includes(token.id)) : tokens),
    [asGroup, tokens, notSeen]
  )
  // Las teclas de la columna (V, R, A, X, D, T, S, P, I, N, M, L; W, G, F) y las de la herramienta (Escape, Supr,
  // Intro), fuera de los campos y solo con el foco en la mesa (WCAG 2.1.4: el control por voz no las dispara desde
  // la barra ni desde otra ventana)
  const visionKey = vision.key
  const toolsKey = tools.key
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (target?.closest('input, textarea, select, dialog, [contenteditable]')) return
      if (target !== document.body && !target?.closest('[data-mesa]')) return
      if (visionKey(event) || toolsKey(event)) {
        event.preventDefault()
        return
      }
      const key = event.key.toLowerCase()
      const picked = TOOLS.find((each) => each.shortcut.toLowerCase() === key)
      if (picked) return pickTool(picked.key)
      const panel = SIDE_PANELS.find((each) => each.shortcut.toLowerCase() === key)
      if (panel) toggleSide(panel.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visionKey, toolsKey, pickTool, toggleSide])
  // La niebla en la mesa: atenuada (lo que no ve la tele) o, viendo como el grupo, como la tele; editando muros o
  // luces, sin ella
  const tableVision = table?.vision && table.vision.sceneId === open?.id ? table.vision : null
  useEffect(() => {
    if (!ready) return
    if (!tableVision || tool === 'walls' || tool === 'lights') {
      renderer.current?.setFog(null)
      return
    }
    const explored = decodeMask(tableVision.explored)
    const visible = decodeMask(tableVision.visible)
    const image = fogImage(explored, visible, asGroup ? 'screen' : 'master', { soften: asGroup ? 2 : 1 })
    renderer.current?.setFog(fogLayerOf(image.pixels, explored))
  }, [ready, tableVision, tool, asGroup, renderer])

  // Una escena que creó la IA con un archivo del mundo: se trocea al abrirla
  const { start } = preparation
  useEffect(() => {
    if (open?.image && !open.image.tiles && open.image.fileId)
      void start(open, { kind: 'own', fileId: open.image.fileId })
  }, [open, start])

  return (
    <div className={styles.mesa} data-mesa="">
      <div className={styles.stageBox}>
        <Stage
          table={table}
          scene={scene}
          host={host}
          ready={ready}
          size={size}
          renderer={renderer}
          channel={channel}
          campaignId={campaignId}
          onTable={setTable}
          view={view}
          tokens={shownTokens}
          tool={vision.handlers ?? tools.handlers}
          toolName={tool}
          markers={markers}
          marksLayer={marksLayer}
          targets={tools.targets}
          onDragPath={tools.showDrag}
          remote={remote}
          remoteTick={remoteTick}
          selected={selected}
          onSelect={(ids) => {
            setSelected(ids)
            setFromTemplate(false)
            // Con varias elegidas, en lugar de la tarjeta, el daño a varias
            if (ids.length > 1 || !ids.includes(cardFor ?? '')) setCardFor(null)
          }}
          cardFor={cardFor}
          cardRef={cardRef}
          onCard={setCardFor}
          onSheet={setSheetFor}
          onPlace={(placing, at) => place.mutate({ placing, at })}
          onUndo={() => undo.mutate()}
          turnTokens={turnTokens}
          center={center}
        />
        {scene && <MarksLayer layer={marksLayer} view={view} marks={tools.marks} />}
        {scene && <VisionMarkers layer={markers} view={view} vision={vision} tool={tool} />}
        {scene && <ToolColumn tool={tool} onTool={pickTool} side={side} onSide={toggleSide} />}
        {scene && tool === 'fog' && <FogTools vision={vision} />}
        {scene && isMarkTool(tool) && <ToolBar tool={tool} tools={tools} />}
        {scene && open && tools.writing && <TextInput tools={tools} view={view.current} scene={open} />}
        {scene && <WidgetCards widgets={widgets.widgets} control={widgets} />}
        {scene && side === 'gm' && (
          <GmScreen
            worldId={worldId}
            campaignId={campaignId}
            systemId={systemId}
            tokens={tokens}
            settings={gm.settings}
            onClose={() => setSide(null)}
          />
        )}
        {asGroup && (
          <AsGroupBanner
            onBack={() => {
              setAsGroup(false)
              setTool(returnTool.current)
            }}
          />
        )}
        {byId(cardFor) && (
          <TokenCard
            key={`card-${cardFor}`}
            token={byId(cardFor) as TokenView}
            campaignId={campaignId}
            cardRef={cardRef}
            onClose={() => setCardFor(null)}
            onSheet={() => setSheetFor(cardFor)}
            onImage={() => setImageFor({ tokenId: cardFor as string, fileId: null })}
          />
        )}
        {byId(sheetFor) && (
          <TokenSheet
            key={`sheet-${sheetFor}`}
            token={byId(sheetFor) as TokenView}
            campaignId={campaignId}
            systemId={systemId}
            onClose={() => setSheetFor(null)}
          />
        )}
        {imageFor && byId(imageFor.tokenId) && (
          <TokenImageEditor
            token={byId(imageFor.tokenId) as TokenView}
            worldId={worldId}
            fileId={imageFor.fileId}
            onClose={() => setImageFor(null)}
          />
        )}
        <TokenList
          tokens={shownTokens}
          selected={selected}
          onPick={(id) => {
            setSelected([id])
            setCardFor(id)
          }}
        />
        {preparation.state.status === 'preparing' ? (
          <div className={styles.overlay}>
            <Preparing state={preparation.state} onCancel={preparation.cancel} />
          </div>
        ) : noCanvas ? (
          <p className={styles.notice}>{t('tabletop.noCanvas')}</p>
        ) : !open ? (
          <p className={styles.notice}>{table ? t('tabletop.empty') : ''}</p>
        ) : !open.image ? (
          <div className={styles.notice}>
            <p>{t('tabletop.noMap')}</p>
            <PageLink worldId={worldId} scene={open} />
          </div>
        ) : null}
        <TopBar
          worldId={worldId}
          campaignId={campaignId}
          table={table}
          onOpen={openScene}
          onAct={(run) => act.mutate(run)}
          busy={act.isPending}
          framing={() => (size.width > 0 ? sceneViewportOfCanvas(view.current, size) : null)}
        />
        {(selected.length > 1 || (fromTemplate && selected.length > 0)) && (
          <GroupDamage
            key={selected.join()}
            campaignId={campaignId}
            tokens={tokens.filter((token) => selected.includes(token.id))}
            title={fromTemplate ? t('tools.insideTemplate', { count: selected.length }) : undefined}
            onClose={() => {
              setSelected([])
              setFromTemplate(false)
            }}
          />
        )}
        {status === 'reconnecting' && (
          <p className={styles.reconnecting} role="status">
            {t('tabletop.reconnecting')}
          </p>
        )}
        <div className={styles.errors}>
          <FormError
            message={
              act.error
                ? errorText(act.error)
                : place.error
                  ? errorText(place.error)
                  : preparation.state.status === 'failed'
                    ? errorText(preparation.state.error)
                    : null
            }
          />
          {skipped.length > 0 && (
            <p className={styles.skipped} role="status">
              {t('tabletop.skipped', { list: skipped.join(', ') })}
            </p>
          )}
        </div>
      </div>
      {side && open ? (
        <aside className={styles.panel} aria-label={t(`vision.${side}`)}>
          <div className={visionStyles.body}>
            <h2 className={visionStyles.title}>{t(`vision.${side}`)}</h2>
            {side === 'widgets' && <WidgetsPanel control={widgets} />}
            {side === 'snapshots' && (
              <SnapshotsPanel
                key={open.id}
                campaignId={campaignId}
                sceneId={open.id}
                capture={async () => (await renderer.current?.snapshot(THUMBNAIL_SIDE, THUMBNAIL_BYTES)) ?? null}
              />
            )}
            {side === 'gm' && <GmPanel worldId={worldId} scene={open} settings={gm.settings} onChange={gm.change} />}
          </div>
        </aside>
      ) : isMarkTool(tool) && tool !== 'laser' && open ? (
        <ToolsPanel
          tool={tool}
          tools={tools}
          scene={open}
          worldId={worldId}
          tokens={tokens}
          onChoose={(ids) => {
            setSelected(ids)
            setCardFor(null)
            setFromTemplate(true)
          }}
        />
      ) : isVisionTool(tool) || asGroup ? (
        <VisionPanel
          mode={asGroup ? 'group' : (tool as 'walls' | 'lights' | 'fog')}
          vision={vision}
          tokens={tokens}
          notSeen={notSeen}
          onAsGroup={() => {
            returnTool.current = tool
            setTool('select')
            setAsGroup(true)
          }}
        />
      ) : (
        <MasterSidebar
          worldId={worldId}
          worldName={worldName}
          campaign={current}
          systemId={systemId}
          table={table}
          tokens={tokens}
          selected={selected}
          busy={act.isPending}
          onAct={(run) => act.mutate(run)}
          onOpen={openScene}
          onPlace={(placing) => place.mutate({ placing, at: null })}
          onImage={(fileId) => selected[0] && setImageFor({ tokenId: selected[0], fileId })}
          onPickCombatant={(tokenId) => {
            setSelected([tokenId])
            center.current?.(tokenId, true)
          }}
          onPickToken={(tokenId) => {
            setSelected([tokenId])
            setCardFor(tokenId)
            center.current?.(tokenId, true)
          }}
        />
      )}
      <Tour
        id="mesa"
        steps={[
          { target: '[data-tour="mesa-mapa"]', text: t('tour.tabletop.map') },
          { target: '[data-tour="mesa-herramientas"]', text: t('tour.tabletop.tools'), placement: 'right' },
          { target: '[data-tour="mesa-paneles"]', text: t('tour.tabletop.panels'), placement: 'right' },
          { target: '[data-tour="mesa-escenas"]', text: t('tour.tabletop.scenes'), placement: 'left' },
          { target: '[data-tour="mesa-presentar"]', text: t('tour.tabletop.present'), placement: 'bottom' },
          { target: '[data-tour="mesa-pantalla"]', text: t('tour.tabletop.screen'), placement: 'bottom' },
          { target: '[data-tour="mesa-camara"]', text: t('tour.tabletop.camera'), placement: 'bottom' },
          { target: '[data-tour="mesa-combate"]', text: t('tour.tabletop.combat'), placement: 'bottom' },
          { target: '[data-tour="mesa-zoom"]', text: t('tour.tabletop.zoom'), placement: 'top' }
        ]}
      />
      <PageTitle className={styles.hidden}>{campaignName}</PageTitle>
    </div>
  )
}

/** El lienzo y lo que va encima de él: moverse, acercar, el marco de la tele y el zoom */
function Stage({
  table,
  scene,
  host,
  ready,
  size,
  renderer,
  channel,
  campaignId,
  onTable,
  view,
  tokens,
  remote,
  remoteTick,
  selected,
  onSelect,
  cardFor,
  cardRef,
  onCard,
  onSheet,
  onPlace,
  onUndo,
  turnTokens,
  center,
  tool,
  toolName,
  markers,
  marksLayer,
  targets,
  onDragPath
}: {
  /** Lo que hace la herramienta de la columna con el botón izquierdo (null: elegir y mover fichas) */
  tool: ToolHandlers | null
  toolName: TableTool
  /** Las marcas de puertas y luces, que se colocan con la vista */
  markers: RefObject<HTMLDivElement | null>
  /** Los textos, sellos y pines dejados en el mapa, que también se colocan con la vista */
  marksLayer: RefObject<HTMLDivElement | null>
  /** Las fichas que caen en una plantilla: llevan su aro a trazos */
  targets: readonly string[]
  /** Lo que recorre la ficha que se arrastra (null: se soltó) */
  onDragPath: (from: Point | null, to?: Point) => void
  turnTokens: Set<string>
  center: RefObject<((tokenId: string, always: boolean) => void) | null>
  view: RefObject<Viewport>
  tokens: TokenView[]
  remote: RefObject<Map<string, Point>>
  remoteTick: number
  selected: string[]
  onSelect: (ids: string[]) => void
  cardFor: string | null
  cardRef: RefObject<HTMLElement | null>
  onCard: (id: string | null) => void
  onSheet: (id: string) => void
  onPlace: (placing: Placing, at: Point) => void
  onUndo: () => void
  table: CampaignTableView | null
  scene: RendererScene | null
  host: RefObject<HTMLDivElement | null>
  ready: boolean
  size: Size
  renderer: ReturnType<typeof useTableRenderer>['renderer']
  channel: RefObject<TableChannel | null>
  campaignId: string
  onTable: (table: CampaignTableView) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const open = table?.open ?? null
  const camera = table?.camera ?? { mode: 'follow' as const }
  // La tele enseña la escena abierta (presentada y sin ocultar): solo entonces puede ir con el máster
  const onScreen = Boolean(open && table?.presented?.id === open.id && !table?.screenHidden)
  // Con «Seguir» (o encuadrando al grupo, que llega con las fichas) la tele va con el máster
  const following = camera.mode !== 'fixed' && onScreen
  const sizeRef = useRef(size)
  sizeRef.current = size
  // La escena (y su versión del mapa) que ya se colocó: otra vuelve a su vista inicial
  const placed = useRef<string | null>(null)
  const zoomText = useRef<HTMLSpanElement>(null)
  const frame = useRef<HTMLElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const space = useRef(false)
  const [panning, setPanning] = useState(false)
  // El marco de la tele mientras se arrastra (al soltarlo se guarda)
  const dragging = useRef<FrameDrag | null>(null)
  const framing = useRef(camera.mode === 'fixed' ? framingOf(camera.view) : null)
  if (!dragging.current) framing.current = camera.mode === 'fixed' ? framingOf(camera.view) : null
  const followingRef = useRef(following)
  followingRef.current = following
  // Las fichas que se mueven (arrastrándolas o hasta que llega la mesa con su sitio nuevo)
  const moving = useRef(new Map<string, Point>())
  const tokenDrag = useRef<{
    lead: TokenView
    group: TokenView[]
    grab: Point
    moved: boolean
    moves: DragMove[]
  } | null>(null)
  const [box, setBox] = useState<{ from: Point; to: Point } | null>(null)
  const latest = useRef({ tokens, selected, cardFor, grid: open?.grid, turnTokens, targets })
  latest.current = { tokens, selected, cardFor, grid: open?.grid, turnTokens, targets }

  /** Las fichas en el lienzo, y la tarjeta de la elegida junto a la suya */
  const drawTokens = useCallback(() => {
    const { tokens: all, selected: chosen, cardFor: carded, grid, turnTokens: turns, targets: inside } = latest.current
    if (!grid) return renderer.current?.setTokens([])
    const at = (token: TokenView) => moving.current.get(token.id) ?? remote.current.get(token.id)
    renderer.current?.setTokens(
      all.map((token) => ({
        ...masterDraw(token, grid, chosen.includes(token.id), at(token), turns.has(token.id)),
        target: inside.includes(token.id)
      }))
    )
    const card = cardRef.current
    const token = all.find((each) => each.id === carded)
    if (!card || !token) return
    const p = at(token) ?? token
    const { x, y, scale } = view.current
    const sx = p.x * scale + x
    const sy = p.y * scale + y
    const r = tokenRadius(token, grid) * scale
    const width = card.offsetWidth || 300
    const height = card.offsetHeight || 240
    const room = sizeRef.current
    const left = sx + r + 14 + width > room.width - 8 ? sx - r - 14 - width : sx + r + 14
    card.style.left = `${Math.max(8, left)}px`
    card.style.top = `${Math.max(64, Math.min(sy - 60, room.height - height - 12))}px`
  }, [renderer, remote, cardRef, view])

  /** Coloca el marco «Tele» sobre el mapa con la vista de ahora */
  const placeFrame = useCallback(() => {
    const element = frame.current
    const current = framing.current
    if (!element || !current) return
    const rect = framingRect(current, REFERENCE_ASPECT)
    const { x, y, scale } = view.current
    Object.assign(element.style, {
      left: `${rect.x * scale + x}px`,
      top: `${rect.y * scale + y}px`,
      width: `${rect.width * scale}px`,
      height: `${rect.height * scale}px`
    })
  }, [])

  const apply = useCallback(() => {
    renderer.current?.setView(view.current)
    placeFrame()
    placeMarkers(markers.current, view.current)
    placeMarks(marksLayer.current, view.current)
    if (zoomText.current) zoomText.current.textContent = `${Math.round(view.current.scale * 100)} %`
    drawTokens()
    // Para las pruebas del navegador: dónde cae el mapa en el lienzo, sin leer sus píxeles
    if (host.current) host.current.dataset.view = JSON.stringify({ ...view.current, ...sizeRef.current })
    if (followingRef.current && sizeRef.current.width > 0)
      channel.current?.sendViewport(sceneViewportOfCanvas(view.current, sizeRef.current))
  }, [renderer, placeFrame, channel, host, view, drawTokens, markers, marksLayer])

  // Llega la mesa (o cambia lo elegido): las fichas, otra vez; lo que se movía ya está en su sitio
  useEffect(() => {
    if (!tokenDrag.current) moving.current.clear()
    drawTokens()
  }, [tokens, selected, cardFor, remoteTick, turnTokens, targets, drawTokens])

  // Centrar la mesa en una ficha: siempre (al elegirla en el combate) o solo si no se ve (al cambiar el turno)
  useEffect(() => {
    center.current = (tokenId, always) => {
      const token = latest.current.tokens.find((each) => each.id === tokenId)
      const room = sizeRef.current
      if (!token || room.width === 0) return
      const { x, y, scale } = view.current
      const sx = token.x * scale + x
      const sy = token.y * scale + y
      const inside = sx > 60 && sy > 80 && sx < room.width - 60 && sy < room.height - 60
      if (inside && !always) return
      view.current = { scale, x: room.width / 2 - token.x * scale, y: room.height / 2 - token.y * scale }
      apply()
    }
    return () => {
      center.current = null
    }
  }, [center, apply, view])

  const fit = useCallback(() => {
    if (!scene || sizeRef.current.width === 0) return
    view.current = fitCanvas(scene, sizeRef.current)
    apply()
  }, [scene, apply, view])

  // La primera vez que hay sitio: la vista inicial de la escena o encuadrada
  useEffect(() => {
    if (!ready || !scene || size.width === 0) return
    const key = `${scene.id}/${scene.tiles.version}`
    if (placed.current !== key) {
      placed.current = key
      view.current = open?.initialView ? canvasViewOf(open.initialView, size) : fitCanvas(scene, size)
    }
    apply()
  }, [ready, scene, size, open?.initialView, apply, view])

  // Al pasar a «Seguir», la tele recibe ya dónde mira el máster; el marco, al cambiar la cámara
  useEffect(() => {
    if (following) apply()
    else placeFrame()
  }, [following, apply, placeFrame])

  const zoomBy = (factor: number, point?: Point) => {
    if (!scene) return
    const center = point ?? { x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 }
    view.current = zoomAt(view.current, factor, center, zoomLimits(scene, sizeRef.current))
    apply()
  }

  // La rueda acerca hacia el cursor; dos dedos en un trackpad mueven (y pellizcar acerca)
  useEffect(() => {
    const element = host.current
    if (!element || !scene) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      if (!event.ctrlKey && isTrackpadWheel(event.deltaX, event.deltaY, event.deltaMode)) {
        view.current = { ...view.current, x: view.current.x - event.deltaX, y: view.current.y - event.deltaY }
      } else {
        view.current = zoomAt(
          view.current,
          wheelZoomFactor(event.deltaY, event.deltaMode, event.ctrlKey),
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          zoomLimits(scene, sizeRef.current)
        )
      }
      apply()
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [host, scene, apply])

  // Espacio + arrastrar mueve (como en los programas de dibujo)
  useEffect(() => {
    const down = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.code !== 'Space' || target?.closest('input, textarea, select, button, [contenteditable]')) return
      space.current = true
      setPanning(true)
      event.preventDefault()
    }
    const up = (event: globalThis.KeyboardEvent) => {
      if (event.code !== 'Space') return
      space.current = false
      setPanning(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = host.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  const moveTokens = useMutation({
    mutationFn: (moves: DragMove[]) => api.call('moveTokens', { campaignId, moves })
  })
  const grid = open?.grid
  const worldAt = (event: { clientX: number; clientY: number }) => toWorld(view.current, local(event))

  /** Con el botón izquierdo (o un dedo): una ficha se elige y se arrastra; fuera de ellas, un recuadro elige varias */
  const tokenDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!grid || !scene) return false
    const world = worldAt(event)
    const hit = tokenAt(tokens, world, grid)
    if (!hit) {
      if (event.pointerType !== 'mouse') return false
      setBox({ from: local(event), to: local(event) })
      event.currentTarget.setPointerCapture(event.pointerId)
      return true
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    // Lo elegido de ahora (dos clics seguidos pueden llegar antes de volver a pintar)
    const selected = latest.current.selected
    let chosen = selected
    if (event.shiftKey) {
      chosen = selected.includes(hit.id) ? selected.filter((id) => id !== hit.id) : [...selected, hit.id]
      onSelect(chosen)
    } else if (!selected.includes(hit.id)) {
      chosen = [hit.id]
      onSelect(chosen)
    }
    const group = tokens.filter((token) => chosen.includes(token.id) || token.id === hit.id)
    tokenDrag.current = { lead: hit, group, grab: { x: world.x - hit.x, y: world.y - hit.y }, moved: false, moves: [] }
    return true
  }

  // Moverse: botón central, espacio + botón izquierdo o un dedo; dos dedos acercan
  // El gesto de la herramienta en curso (su puntero)
  const toolPointer = useRef<number | null>(null)
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const pans = event.pointerType !== 'mouse' || event.button === 1 || (event.button === 0 && space.current)
    if (!space.current && event.button === 0 && pointers.current.size === 0) {
      // Con una herramienta, el botón izquierdo es suyo (las fichas no se mueven)
      if (tool) {
        if (tool.down(worldAt(event), event)) {
          event.currentTarget.setPointerCapture(event.pointerId)
          toolPointer.current = event.pointerId
          event.preventDefault()
          return
        }
      } else if (tokenDown(event)) {
        event.preventDefault()
        return
      }
    }
    if (!pans) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1)
      gesture.current = { startX: event.clientX, startY: event.clientY, view: view.current, pinch: null }
    else if (gesture.current) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
    }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (tool && !gesture.current) {
      tool.move(worldAt(event), event)
      if (toolPointer.current === event.pointerId) return
    }
    const drag = tokenDrag.current
    if (drag && grid) {
      const world = worldAt(event)
      const to = { x: world.x - drag.grab.x, y: world.y - drag.grab.y }
      if (!drag.moved && Math.hypot(to.x - drag.lead.x, to.y - drag.lead.y) * view.current.scale < 4) return
      drag.moved = true
      drag.moves = dragMoves(drag.group, drag.lead, to, grid, event.shiftKey)
      for (const move of drag.moves) moving.current.set(move.tokenId, { x: move.x, y: move.y })
      channel.current?.sendDrag(drag.moves)
      // Lo que recorre la que se lleva
      const lead = drag.moves.find((move) => move.tokenId === drag.lead.id)
      if (lead) onDragPath({ x: drag.lead.x, y: drag.lead.y }, { x: lead.x, y: lead.y })
      drawTokens()
      return
    }
    if (box) {
      setBox({ ...box, to: local(event) })
      return
    }
    const current = gesture.current
    if (!current || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b || current.pinch === null) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      zoomBy(distance / current.pinch, local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }))
      current.pinch = distance
      return
    }
    view.current = {
      ...current.view,
      x: current.view.x + event.clientX - current.startX,
      y: current.view.y + event.clientY - current.startY
    }
    apply()
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (toolPointer.current === event.pointerId) {
      toolPointer.current = null
      tool?.up(worldAt(event), event)
      return
    }
    const drag = tokenDrag.current
    if (drag) {
      tokenDrag.current = null
      if (drag.moved) onDragPath(null)
      if (drag.moved && event.type !== 'pointercancel') moveTokens.mutate(drag.moves)
      else if (!drag.moved) {
        moving.current.clear()
        if (!event.shiftKey) onCard(drag.lead.id)
      }
      if (event.type === 'pointercancel') moving.current.clear()
      drawTokens()
      return
    }
    if (box) {
      setBox(null)
      const travel = Math.hypot(box.to.x - box.from.x, box.to.y - box.from.y)
      if (travel < 4) {
        if (!event.shiftKey) onSelect([])
        return
      }
      const inside = tokensIn(tokens, toWorld(view.current, box.from), toWorld(view.current, box.to)).map((t) => t.id)
      onSelect(event.shiftKey ? [...new Set([...selected, ...inside])] : inside)
      return
    }
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) gesture.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      return onUndo()
    }
    if (event.key === 'Escape') return onSelect([])
    // Con fichas elegidas, las flechas las mueven una casilla
    const chosen = tokens.filter((token) => selected.includes(token.id))
    const arrows = grid ? arrowMoves(chosen, event.key, grid) : null
    if (arrows) {
      event.preventDefault()
      for (const move of arrows) moving.current.set(move.tokenId, { x: move.x, y: move.y })
      drawTokens()
      return moveTokens.mutate(arrows)
    }
    const step = 80
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      view.current = { ...view.current, x: view.current.x + move[0], y: view.current.y + move[1] }
      apply()
    } else if (event.key === '+' || event.key === '=') zoomBy(1.25)
    else if (event.key === '-') zoomBy(0.8)
    else if (event.key === '0') fit()
  }

  // El marco de la tele: se arrastra entero o por su esquina; al soltarlo, se guarda la cámara fija
  const saveFraming = useMutation({
    mutationFn: (view: SceneViewport) => api.call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view } }),
    onSuccess: onTable
  })
  const cell = open ? cellSide(open.grid) : 50
  const onFrameDown = (event: PointerEvent<HTMLElement>, kind: FrameDrag['kind']) => {
    const current = framing.current
    if (!current || event.button !== 0 || space.current) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = { kind, start: local(event), center: current.center, width: current.width }
  }
  const onFrameMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragging.current
    if (!drag) return
    const point = local(event)
    const { scale, x, y } = view.current
    if (drag.kind === 'move') {
      framing.current = {
        width: drag.width,
        center: {
          x: drag.center.x + (point.x - drag.start.x) / scale,
          y: drag.center.y + (point.y - drag.start.y) / scale
        }
      }
    } else {
      const rect = framingRect({ center: drag.center, width: drag.width }, REFERENCE_ASPECT)
      const world = { x: (point.x - x) / scale, y: (point.y - y) / scale }
      const width = widthToCorner(rect, world, REFERENCE_ASPECT, cell)
      framing.current = {
        width,
        center: { x: rect.x + width / 2, y: rect.y + (width * REFERENCE_ASPECT) / 2 }
      }
    }
    placeFrame()
  }
  const onFrameUp = () => {
    if (!dragging.current) return
    dragging.current = null
    if (framing.current) saveFraming.mutate(sceneViewportOf(framing.current))
  }
  // Con el teclado: las flechas lo mueven una casilla; + y - lo agrandan o lo achican
  const onFrameKey = (event: KeyboardEvent<HTMLElement>) => {
    const current = framing.current
    if (!current) return
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-cell, 0],
      ArrowRight: [cell, 0],
      ArrowUp: [0, -cell],
      ArrowDown: [0, cell]
    }
    const move = moves[event.key]
    const grow = event.key === '+' || event.key === '=' ? 1.1 : event.key === '-' ? 1 / 1.1 : null
    if (!move && !grow) return
    event.preventDefault()
    event.stopPropagation()
    framing.current = move
      ? { width: current.width, center: { x: current.center.x + move[0], y: current.center.y + move[1] } }
      : { center: current.center, width: Math.max(2 * cell, current.width * (grow ?? 1)) }
    placeFrame()
    saveFraming.mutate(sceneViewportOf(framing.current))
  }

  return (
    <>
      {/* Un control propio: se mueve con las flechas y se acerca con + y - */}
      <div
        ref={host}
        className={styles.stage}
        data-panning={panning || undefined}
        role="application"
        aria-roledescription={t('tabletop.roleDescription')}
        aria-label={t('tabletop.label', { name: open?.name ?? t('tabletop.title') })}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: es un control propio (role application), no un contenedor
        tabIndex={0}
        data-tour="mesa-mapa"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onAuxClick={(event) => event.preventDefault()}
        onPointerLeave={() => tool?.leave()}
        data-tool={toolName === 'select' ? undefined : toolName}
        onDoubleClick={(event) => {
          if (tool) return
          const hit = grid ? tokenAt(tokens, worldAt(event), grid) : null
          if (hit) onSheet(hit.id)
        }}
        onDragOver={(event) => {
          if (scene && event.dataTransfer.types.includes(PLACING_TYPE)) event.preventDefault()
        }}
        onDrop={(event) => {
          const data = event.dataTransfer.getData(PLACING_TYPE)
          if (!data || !grid) return
          event.preventDefault()
          const placing = JSON.parse(data) as Placing
          onPlace(placing, dropAt(worldAt(event), 1, grid, event.shiftKey))
        }}
      />
      {box && (
        <div
          className={styles.box}
          style={{
            left: Math.min(box.from.x, box.to.x),
            top: Math.min(box.from.y, box.to.y),
            width: Math.abs(box.to.x - box.from.x),
            height: Math.abs(box.to.y - box.from.y)
          }}
        />
      )}
      {scene && camera.mode === 'fixed' && (
        <section
          ref={frame}
          className={styles.teleFrame}
          aria-label={t('tabletop.frameLabel')}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: el marco se mueve con las flechas
          tabIndex={0}
          data-frame=""
          onKeyDown={onFrameKey}
        >
          {/* Se arrastra por su etiqueta (y por su esquina se agranda): por dentro, las fichas siguen a mano */}
          <span
            className={styles.teleTag}
            onPointerDown={(event) => onFrameDown(event, 'move')}
            onPointerMove={onFrameMove}
            onPointerUp={onFrameUp}
            onPointerCancel={onFrameUp}
          >
            <Tv aria-hidden="true" size={12} />
            {t('tabletop.frame')}
          </span>
          <span
            className={styles.teleHandle}
            title={t('tabletop.resizeFrame')}
            aria-hidden="true"
            onPointerDown={(event) => onFrameDown(event, 'resize')}
            onPointerMove={onFrameMove}
            onPointerUp={onFrameUp}
            onPointerCancel={onFrameUp}
          />
        </section>
      )}
      {scene && following && camera.mode === 'follow' && (
        <div className={styles.followLine}>
          <span>{t('tabletop.following')}</span>
        </div>
      )}
      {scene && (
        <div className={styles.zoom} role="toolbar" aria-label={t('tabletop.zoom')} data-tour="mesa-zoom">
          <button
            type="button"
            aria-label={t('tabletop.zoomOut')}
            title={t('tabletop.zoomOut')}
            onClick={() => zoomBy(0.8)}
          >
            <Minus aria-hidden="true" size={16} />
          </button>
          <span ref={zoomText} className={styles.zoomText} />
          <button
            type="button"
            aria-label={t('tabletop.zoomIn')}
            title={t('tabletop.zoomIn')}
            onClick={() => zoomBy(1.25)}
          >
            <Plus aria-hidden="true" size={16} />
          </button>
          <button type="button" aria-label={t('tabletop.fit')} title={t('tabletop.fit')} onClick={fit}>
            <Maximize aria-hidden="true" size={16} />
          </button>
        </div>
      )}
    </>
  )
}

/** Arriba: el nombre de la escena con su menú y si está en la tele; lo que ve el grupo y su cámara */
function TopBar({
  worldId,
  campaignId,
  table,
  onOpen,
  onAct,
  busy,
  framing
}: {
  worldId: string
  campaignId: string
  table: CampaignTableView | null
  onOpen: (sceneId: string) => void
  onAct: (run: () => Promise<CampaignTableView>) => void
  busy: boolean
  /** Lo que se ve ahora en la mesa, como encuadre (para «Fija») */
  framing: () => SceneViewport | null
}) {
  const { t } = useTranslation()
  const api = useApi()
  const open = table?.open ?? null
  const presented = table?.presented ?? null
  const showing = Boolean(presented && !table?.screenHidden)
  const live = Boolean(open && showing && presented?.id === open.id)
  const camera = table?.camera ?? { mode: 'follow' as const }
  const openScreen = () =>
    window.open(
      `/mundos/${worldId}/campanas/${campaignId}/pantalla`,
      `crisol-pantalla-${campaignId}`,
      'popup=yes,width=1280,height=720'
    )
  return (
    <div className={styles.topBar}>
      {open && (
        <div className={`${styles.bar} ${styles.sceneBar}`}>
          <SceneMenu worldId={worldId} open={open} onOpen={onOpen} />
          {live && <span className={`${styles.chip} ${styles.live}`}>{t('tabletop.live')}</span>}
          {presented && table?.screenHidden && <span className={styles.chip}>{t('tabletop.dark')}</span>}
          {showing && !live && <span className={styles.chip}>{t('tabletop.elsewhere')}</span>}
        </div>
      )}
      <span className={styles.grow} />
      <div className={styles.bar}>
        <span className={styles.barGroup} data-tour="mesa-presentar">
          {open && !live && (
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => onAct(() => api.call('presentScene', { campaignId }))}
            >
              <Play aria-hidden="true" size={15} />
              {t('tabletop.present')}
            </button>
          )}
          {showing && (
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => onAct(() => api.call('hideScreen', { campaignId, hidden: true }))}
            >
              <EyeOff aria-hidden="true" size={15} />
              {t('tabletop.hide')}
            </button>
          )}
        </span>
        <button type="button" className={styles.ghost} onClick={openScreen} data-tour="mesa-pantalla">
          <Tv aria-hidden="true" size={15} />
          {t('tabletop.screen')}
          <ExternalLink aria-hidden="true" size={13} />
        </button>
        <CameraChoice
          campaignId={campaignId}
          camera={camera}
          framing={framing}
          disabled={busy || !open?.image?.tiles}
          onAct={onAct}
        />
      </div>
    </div>
  )
}

/** «Seguir | Fija | Grupo»: Fija se queda en lo que se ve ahora (su marco se mueve); Grupo encuadra sus fichas */
function CameraChoice({
  campaignId,
  camera,
  disabled,
  onAct,
  framing
}: {
  campaignId: string
  framing: () => SceneViewport | null
  camera: CampaignTableView['camera']
  disabled: boolean
  onAct: (run: () => Promise<CampaignTableView>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const name = useId()
  const mode = camera.mode
  const fixed = mode === 'fixed'
  const fixHere = () => {
    const view = framing()
    if (!view) return
    onAct(() => api.call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view } }))
  }
  return (
    <fieldset className={styles.segments} disabled={disabled} data-tour="mesa-camara">
      <legend className={styles.hidden}>{t('tabletop.camera')}</legend>
      <label className={styles.segment}>
        <input
          type="radio"
          name={name}
          checked={mode === 'follow'}
          onChange={() => onAct(() => api.call('setScreenCamera', { campaignId, camera: { mode: 'follow' } }))}
        />
        {t('tabletop.follow')}
      </label>
      <label className={styles.segment}>
        <input type="radio" name={name} checked={fixed} onChange={fixHere} />
        {t('tabletop.fixed')}
      </label>
      <label className={styles.segment}>
        <input
          type="radio"
          name={name}
          checked={mode === 'group'}
          onChange={() => onAct(() => api.call('setScreenCamera', { campaignId, camera: { mode: 'group' } }))}
        />
        {t('tabletop.group')}
      </label>
    </fieldset>
  )
}

/** El nombre de la escena abierta: su menú cambia de escena o lleva a su página */
function SceneMenu({ worldId, open, onOpen }: { worldId: string; open: SceneView; onOpen: (sceneId: string) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const [shown, setShown] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useDismiss(shown, () => setShown(false), root, trigger)
  const scenes = useQuery({
    queryKey: sceneListKey(worldId),
    queryFn: () => api.call('listScenes', { worldId }),
    enabled: shown
  })
  return (
    <div ref={root} className={styles.menuRoot}>
      <button
        ref={trigger}
        type="button"
        className={styles.sceneButton}
        aria-label={`${open.name}, ${t('tabletop.changeScene')}`}
        aria-expanded={shown}
        aria-controls={menuId}
        onClick={() => setShown(!shown)}
      >
        <b>{open.name}</b>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {shown && (
        <nav id={menuId} className={styles.menu} aria-label={t('tabletop.changeScene')}>
          <ul>
            {(scenes.data?.scenes ?? []).map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  aria-current={scene.id === open.id || undefined}
                  onClick={() => {
                    setShown(false)
                    if (scene.id !== open.id) onOpen(scene.id)
                  }}
                >
                  {scene.name}
                  <span>{scene.pageTitle}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.menuSep} />
          <PageLink worldId={worldId} scene={open} />
        </nav>
      )}
    </div>
  )
}

function PageLink({ worldId, scene }: { worldId: string; scene: SceneView }) {
  const { t } = useTranslation()
  return (
    <Link
      to="/mundos/$worldId/wiki/$pageId"
      params={{ worldId, pageId: scene.pageId }}
      search={{ pestana: scene.tabId }}
      className={styles.pageLink}
    >
      {t('tabletop.goToPage')}
    </Link>
  )
}

/**
 * Las fichas, en una lista para el teclado y los lectores de pantalla (el lienzo no se lee): elegir una abre su
 * tarjeta. No se ve; se llega a ella con el tabulador
 */
function TokenList({
  tokens,
  selected,
  onPick
}: {
  tokens: TokenView[]
  selected: string[]
  onPick: (id: string) => void
}) {
  const { t } = useTranslation()
  if (tokens.length === 0) return null
  return (
    <ul className={styles.tokenList} aria-label={t('tokens.list')}>
      {tokens.map((token) => (
        <li key={token.id}>
          <button type="button" aria-pressed={selected.includes(token.id)} onClick={() => onPick(token.id)}>
            {[
              token.label,
              token.actor.name,
              token.actor.life
                ? t('tokens.lifeValue', { value: token.actor.life.value, max: token.actor.life.max })
                : null,
              token.hidden ? t('tokens.hidden') : null
            ]
              .filter(Boolean)
              .join(', ')}
          </button>
        </li>
      ))}
    </ul>
  )
}
