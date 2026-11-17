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
  soundEdges,
  toWorld,
  type Viewport,
  wheelZoomFactor,
  widthToCorner,
  zoomAt,
  zoomLimits
} from '@crisol/tabletop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { ChevronDown, ExternalLink, Eye, EyeOff, Frame, Maximize, Minus, Play, Plus, Tv, Users, X } from 'lucide-react'
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
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { CurrentCampaignContext } from '../campaign/current-campaign.ts'
import { InteriorPill, TodayChip } from '../campaign-time/today-chip.tsx'
import { Backdrop } from '../components/backdrop.tsx'
import { Loading } from '../components/brand.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { useWindows, WindowLayer, WindowsProvider } from '../components/windows.tsx'
import { useDice } from '../dice/context.tsx'
import { LogStrip } from '../log/strip.tsx'
import { SoundBars, UnlockSound } from '../sound/controls.tsx'
import { masterMapSounds, useMapHearing } from '../sound/map-sounds.ts'
import soundStyles from '../sound/sound.module.css'
import { SoundContext, useSound, useTableSound } from '../sound/use-table-sound.tsx'
import { YoutubeDock } from '../sound/youtube.tsx'
import { SourcePicker } from '../wiki/scene/source-picker.tsx'
import { canvasViewOf, framingOf, REFERENCE_ASPECT, sceneViewportOf, sceneViewportOfCanvas } from './camera.ts'
import { connectTable, type DragMove, type TableChannel, type TableStatus } from './channel.ts'
import { masterDraw } from './draw.ts'
import { decodeMask, fogImage, fogLayerOf } from './fog-paint.ts'
import { GmScreen, useGmSettings } from './gm-screen.tsx'
import { GroupDamage } from './group-damage.tsx'
import { ImageViewer, type ShownImage } from './image-viewer.tsx'
import { MarksLayer, placeMarks } from './marks-layer.tsx'
import { MasterSidebar, useMasterSidebar } from './master-sidebar.tsx'
import styles from './mesa.module.css'
import { openPageLinks, PageWindowsSocket, pageWindow } from './page-window.tsx'
import { PLACING_TYPE, type Placing } from './panel.tsx'
import { PlayerMesa } from './player-mesa.tsx'
import { Preparing } from './preparing.tsx'
import { masterTileUrl, sceneListKey } from './queries.ts'
import type { RendererScene } from './renderer.ts'
import roomStyles from './room.module.css'
import { PauseBanner, RoomBar } from './room.tsx'
import { sceneWindow } from './scene-window.tsx'
import { ShowImage } from './show-menu.tsx'
import { SnapshotsPanel, THUMBNAIL_BYTES, THUMBNAIL_SIDE } from './snapshots.tsx'
import { TokenCard } from './token-card.tsx'
import { TokenImageEditor } from './token-image.tsx'
import { sheetWindow } from './token-sheet.tsx'
import { arrowMoves, cellSide, dragMoves, dropAt, tokenAt, tokenRadius, tokensIn } from './tokens.ts'
import { TextInput, ToolBar, ToolsPanel } from './tools-panel.tsx'
import { type SceneChoice, useScenePreparation } from './use-preparation.ts'
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
import { WeatherLayer } from './weather-layer.tsx'
import { useWidgets, WidgetCards, WidgetsPanel } from './widgets.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/mesa')

/** /mesa (ADR-0021: una sección de la campaña): la del máster, su Mesa; la de quien juega, lo que ve el grupo */
export function MesaScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const { worldId, campaignId } = route.useParams()
  const { account, pending } = useAccounts().useAccount()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId }),
    enabled: Boolean(account)
  })
  const campaign = campaigns.data?.campaigns.find((c) => c.id === campaignId)
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account) && campaign?.role === 'master'
  })
  const worldName = worlds.data?.worlds.find((w) => w.id === worldId)?.name
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!campaigns.data)
    return failed(campaigns) ? <LoadError error={campaigns.error} onRetry={() => campaigns.refetch()} /> : <Loading />
  if (!campaign)
    return (
      <section className={styles.missing}>
        <PageTitle>{t('campaign.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  if (campaign.role === 'master')
    return worldName === undefined ? <Loading /> : <Mesa key={campaign.id} worldId={worldId} campaign={campaign} />
  return <PlayerMesa key={campaign.id} worldId={worldId} campaign={campaign} />
}

/** Lo que flota sobre la Mesa o va a su lado (las ventanas y la barra de pestañas): sus teclas no son las del mapa */
/** Cuánto se ve un fallo de la Mesa antes de irse solo */
const ERROR_MS = 6000

/**
 * El marco de la tele al ponerla «Fija»: centrado en lo que se ve y dentro de ello (un 16:9 con algo de margen), para
 * que se vea entero y se pueda mover y estirar desde sus esquinas
 */
function fixedFraming(view: Viewport, room: Size): SceneViewport {
  const width = (Math.min(room.width, room.height / REFERENCE_ASPECT) * 0.86) / view.scale
  const center = { x: (room.width / 2 - view.x) / view.scale, y: (room.height / 2 - view.y) / view.scale }
  return sceneViewportOf({ center, width })
}

/**
 * Lo que se ve del mapa: sin lo que tapa la barra de la derecha, que flota encima mientras está abierta (al encuadrar,
 * centrar una ficha o decirle a la tele qué se ve, que no cuente lo de debajo de ella)
 */
function freeArea(room: Size, stageEl: HTMLElement | null): Size {
  const side = document.querySelector<HTMLElement>('[data-mesa-side="open"]')
  const stage = stageEl?.getBoundingClientRect()
  if (!side || !stage) return room
  const covered = stage.right - side.getBoundingClientRect().left + 12
  return covered > 0 && covered < room.width - 240 ? { width: room.width - covered, height: room.height } : room
}

const CHROME = '[role="dialog"], [data-window], [data-mesa-side]'

type Gesture = {
  startX: number
  startY: number
  view: Viewport
  pinch: number | null
}

type FrameDrag = { kind: 'move' | 'resize'; start: Point; center: Point; width: number }

/** La mesa del máster: es lo que se ve al abrir su campaña (la ruta de la campaña comprueba quién es) */
export function Mesa({ worldId, campaign: current }: { worldId: string; campaign: Campaign }) {
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
  // La caja del mapa: dentro de ella flotan las ventanas
  const stageBox = useRef<HTMLDivElement>(null)
  // La barra de la derecha: su pestaña y si está plegada viven aquí (una herramienta la tapa sin olvidarla)
  const sidebar = useMasterSidebar(table)
  // El sonido: suena también en la Mesa del máster (docs/specs/sonido.md)
  const sound = useTableSound()
  const handleSound = sound.handle
  const bindSound = sound.bind
  const dice = useDice()
  // Los dados tiran en esta campaña (antes lo decía la barra de la izquierda, que aquí no está)
  const { setCampaign } = dice
  useEffect(() => setCampaign(worldId, campaignId), [setCampaign, worldId, campaignId])
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
          } else if (message.type === 'sound' || message.type === 'time') handleSound(message)
        },
        onStatus: setStatus
      }
    )
    channel.current = connection
    bindSound(() => connection.sendTime?.())
    return () => {
      bindSound(null)
      connection.close()
      channel.current = null
    }
  }, [campaignId, handleSound, bindSound])

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
  // Lo que falla se dice un momento y se va solo (si no, se quedaba hasta la siguiente acción que saliera bien)
  const { reset: resetAct } = act
  const { reset: resetPlace } = place
  useEffect(() => {
    if (!act.error && !place.error) return
    const timer = window.setTimeout(() => {
      resetAct()
      resetPlace()
    }, ERROR_MS)
    return () => window.clearTimeout(timer)
  }, [act.error, place.error, resetAct, resetPlace])
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
  const { host, renderer, ready, failed: noCanvas, size } = useTableRenderer(scene, { transparent: true })

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
  // Cerrar el panel de una herramienta: se deja la herramienta y vuelve la barra de pestañas
  const backToBar = useCallback(() => {
    setAsGroup(false)
    setSide(null)
    setTool('select')
  }, [])
  const markers = useRef<HTMLDivElement | null>(null)
  const marksLayer = useRef<HTMLDivElement | null>(null)
  const vision = useVision({ campaignId, worldId, table, tool, asGroup, view, renderer, ready, onTable: setTable })
  // Los sonidos del mapa, desde el centro de la vista del máster (o callados, a su elección: docs/specs/sonido-mapa.md)
  const soundWalls = useMemo(
    () =>
      soundEdges(
        vision.walls,
        Object.fromEntries(Object.entries(vision.doors).map(([id, isOpen]) => [id, { open: isOpen }]))
      ),
    [vision.walls, vision.doors]
  )
  useMapHearing(sound.setMap, () => {
    if (!vision.grid || !sound.device.map || size.width === 0) return null
    const sounds = masterMapSounds(vision.sounds, { cell: cellSide(vision.grid), darkness: vision.darkness })
    if (sounds.length === 0) return null
    return { sounds, walls: soundWalls, listeners: [toWorld(view.current, { x: size.width / 2, y: size.height / 2 })] }
  })
  const tools = useTableTools({ campaignId, table, tool, view, renderer, ready, channel, tokens })
  const widgets = useWidgets(campaignId, table)
  const gm = useGmSettings(campaignId, open, table?.gmScreen ?? null)
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
    // Lo último que se pulsó: en una ventana o en la barra, las teclas son de ellas (aunque el foco caiga en el body)
    let inChrome = false
    const onPointer = (event: globalThis.PointerEvent) => {
      inChrome = Boolean((event.target as HTMLElement | null)?.closest(CHROME))
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (target?.closest(`input, textarea, select, dialog, [contenteditable], ${CHROME}`)) return
      if (target === document.body && inChrome) return
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
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [visionKey, toolsKey, pickTool, toggleSide])
  // La niebla en la mesa: atenuada (lo que no ve la tele) o, viendo como el grupo, como la tele; editando muros o
  // luces, sin ella
  const tableVision = table?.vision && table.vision.sceneId === open?.id ? table.vision : null
  useEffect(() => {
    if (!ready) return
    if (!tableVision || tool === 'walls' || tool === 'lights' || tool === 'sounds') {
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
    <SoundContext.Provider value={sound}>
      <CurrentCampaignContext.Provider value={campaignId}>
        <WindowsProvider area={stageBox} onLink={openPageLinks}>
          <div className={styles.mesa} data-mesa="">
            <div ref={stageBox} className={styles.stageBox}>
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
              {scene && open && side === 'gm' && (
                <GmScreen
                  worldId={worldId}
                  campaignId={campaignId}
                  systemId={systemId}
                  scene={open}
                  tokens={tokens}
                  settings={gm.settings}
                  onChange={gm.change}
                  error={gm.error}
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
                <SheetOpener
                  token={byId(sheetFor) as TokenView}
                  campaignId={campaignId}
                  systemId={systemId}
                  onDone={() => setSheetFor(null)}
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
                <>
                  {/* Sin escena, el fondo de entrar: la Mesa no se queda en negro y su cristal se ve */}
                  <Backdrop contained />
                  <p className={styles.notice}>{table ? t('tabletop.empty') : ''}</p>
                </>
              ) : !open.image ? (
                <NoMap worldId={worldId} scene={open} onChoose={(choice) => void start(open, choice)} />
              ) : null}
              <TopBar
                worldId={worldId}
                campaignId={campaignId}
                table={table}
                onOpen={openScene}
                onAct={(run) => act.mutate(run)}
                busy={act.isPending}
                framing={() => (size.width > 0 ? fixedFraming(view.current, freeArea(size, host.current)) : null)}
                onOpenSound={() => {
                  sidebar.pick('sound')
                  sidebar.setFolded(false)
                  setSide(null)
                }}
              />
              <YoutubeDock
                view={sound.view}
                clock={sound.clock}
                device={sound.device}
                onBlocked={sound.setYoutubeBlocked}
                registerUnlock={sound.registerUnlock}
                className={soundStyles.dockMaster}
              />
              <MasterLog worldId={worldId} campaign={current} edge={!scene} />
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
              <PageWindowsSocket>
                <WindowLayer />
              </PageWindowsSocket>
            </div>
            {/* La pantalla del máster es su cajón (8 · campaña): sin panel a la derecha */}
            {side && side !== 'gm' && open ? (
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
                mode={asGroup ? 'group' : (tool as 'walls' | 'lights' | 'sounds' | 'fog')}
                vision={vision}
                tokens={tokens}
                notSeen={notSeen}
                onAsGroup={() => {
                  returnTool.current = tool
                  setTool('select')
                  setAsGroup(true)
                }}
              />
            ) : null}
            {/* Un panel de herramienta tapa la barra: su ×, para volver a ella (como Escape) */}
            {!asGroup &&
              ((open && ((side && side !== 'gm') || (isMarkTool(tool) && tool !== 'laser'))) || isVisionTool(tool)) && (
                <button
                  type="button"
                  className={styles.panelBack}
                  aria-label={t('tabletop.backToBar')}
                  title={t('tabletop.backToBar')}
                  onClick={backToBar}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            {(side && side !== 'gm' && open) ||
            (isMarkTool(tool) && tool !== 'laser' && open) ||
            isVisionTool(tool) ||
            asGroup ? null : (
              <MasterSidebar
                worldId={worldId}
                campaign={current}
                systemId={systemId}
                table={table}
                tokens={tokens}
                selected={selected}
                busy={act.isPending}
                onAct={(run) => act.mutate(run)}
                onOpen={openScene}
                onCreateScene={(scene, choice) => {
                  openScene(scene.id)
                  if (choice) void start(scene, choice)
                }}
                onPlace={(placing) => place.mutate({ placing, at: null })}
                onImage={(fileId) => selected[0] && setImageFor({ tokenId: selected[0], fileId })}
                onPickCombatant={(tokenId) => {
                  setSelected([tokenId])
                  center.current?.(tokenId, true)
                }}
                sidebar={sidebar}
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
                { target: '[data-tour="mesa-barra"]', text: t('tour.tabletop.sidebar'), placement: 'left' },
                { target: '[data-tour="mesa-presentar"]', text: t('tour.tabletop.present'), placement: 'bottom' },
                { target: '[data-tour="mesa-pantalla"]', text: t('tour.tabletop.screen'), placement: 'bottom' },
                { target: '[data-tour="mesa-camara"]', text: t('tour.tabletop.camera'), placement: 'bottom' },
                { target: '[data-tour="mesa-zoom"]', text: t('tour.tabletop.zoom'), placement: 'top' }
              ]}
            />
            {/* El historial de tiradas, en una ventana de la Mesa */}
            <PageTitle className={styles.hidden}>{campaignName}</PageTitle>
          </div>
        </WindowsProvider>
      </CurrentCampaignContext.Provider>
    </SoundContext.Provider>
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
  // Lo que se ve del mapa: sin lo que tapa la barra de la derecha, que flota encima mientras está abierta (al encuadrar
  // o centrar una ficha, que no quede debajo de ella)
  const free = useCallback((room: Size): Size => freeArea(room, host.current), [host])
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
    const room = free(sizeRef.current)
    const left = sx + r + 14 + width > room.width - 8 ? sx - r - 14 - width : sx + r + 14
    card.style.left = `${Math.max(8, left)}px`
    card.style.top = `${Math.max(64, Math.min(sy - 60, room.height - height - 12))}px`
  }, [renderer, remote, cardRef, view, free])

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

  const rememberTimer = useRef(0)
  const apply = useCallback(() => {
    renderer.current?.setView(view.current)
    placeFrame()
    placeMarkers(markers.current, view.current)
    placeMarks(marksLayer.current, view.current)
    if (zoomText.current) zoomText.current.textContent = `${Math.round(view.current.scale * 100)} %`
    drawTokens()
    // Para las pruebas del navegador: dónde cae el mapa en el lienzo, sin leer sus píxeles
    if (host.current) host.current.dataset.view = JSON.stringify({ ...view.current, ...sizeRef.current })
    // La tele sigue el centro de lo que se ve (sin lo que tapa la barra de la derecha: si no, le salía desplazado)
    if (followingRef.current && sizeRef.current.width > 0)
      channel.current?.sendViewport(sceneViewportOfCanvas(view.current, free(sizeRef.current)))
    // Lo que se ve de cada escena se recuerda (al volver a ella, igual): un poco después de dejar de moverse
    const sceneId = placed.current?.split('/')[0]
    if (sceneId && sizeRef.current.width > 0) {
      window.clearTimeout(rememberTimer.current)
      const seen = sceneViewportOfCanvas(view.current, free(sizeRef.current))
      rememberTimer.current = window.setTimeout(() => rememberView(campaignId, sceneId, seen), 400)
    }
  }, [renderer, placeFrame, channel, host, view, drawTokens, markers, marksLayer, free, campaignId])

  // Llega la mesa (o cambia lo elegido): las fichas, otra vez; lo que se movía ya está en su sitio
  useEffect(() => {
    if (!tokenDrag.current) moving.current.clear()
    drawTokens()
  }, [tokens, selected, cardFor, remoteTick, turnTokens, targets, drawTokens])

  // Centrar la mesa en una ficha: siempre (al elegirla en el combate) o solo si no se ve (al cambiar el turno)
  useEffect(() => {
    center.current = (tokenId, always) => {
      const token = latest.current.tokens.find((each) => each.id === tokenId)
      const room = free(sizeRef.current)
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
  }, [center, apply, view, free])

  const fit = useCallback(() => {
    if (!scene || sizeRef.current.width === 0) return
    view.current = fitCanvas(scene, free(sizeRef.current))
    apply()
  }, [scene, apply, view, free])

  // La primera vez que hay sitio: la vista inicial de la escena o encuadrada
  useEffect(() => {
    if (!ready || !scene || size.width === 0) return
    const key = `${scene.id}/${scene.tiles.version}`
    if (placed.current !== key) {
      placed.current = key
      const room = free(size)
      // Como se dejó la última vez; si no, la vista inicial de la escena o encuadrada
      const remembered = rememberedView(campaignId, scene.id)
      view.current = remembered
        ? canvasViewOf(remembered, room)
        : open?.initialView
          ? canvasViewOf(open.initialView, room)
          : fitCanvas(scene, room)
    }
    apply()
  }, [ready, scene, size, open?.initialView, apply, view, free, campaignId])

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
      if (event.code !== 'Space' || target?.closest(`input, textarea, select, button, [contenteditable], ${CHROME}`))
        return
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
      {/* La capa de clima (8 · campaña): la que manda el servidor (nada en una escena interior) */}
      {scene && <WeatherLayer layer={table?.weather?.effective ?? null} />}
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
  framing,
  onOpenSound
}: {
  worldId: string
  campaignId: string
  table: CampaignTableView | null
  onOpen: (sceneId: string) => void
  onAct: (run: () => Promise<CampaignTableView>) => void
  busy: boolean
  /** Lo que se ve ahora en la mesa, como encuadre (para «Fija») */
  framing: () => SceneViewport | null
  /** Las barras de lo que suena: abren la pestaña Sonido */
  onOpenSound: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const sound = useSound()
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
    // Sin escena no hay columna de herramientas: lo de arriba se pega al borde; al abrir una, su recuadro entra y
    // desplaza a los demás (Enrique, 2026-11-10)
    <div className={open ? styles.topBar : `${styles.topBar} ${styles.noTools}`} data-mesa-top="">
      {/* La escena y, debajo, el «hoy» de la campaña con su menú (8 · campaña) */}
      <div className={open ? styles.sceneColumn : `${styles.sceneColumn} ${styles.sceneColumnGone}`}>
        <div className={open ? `${styles.bar} ${styles.sceneBar}` : `${styles.bar} ${styles.sceneBar} ${styles.gone}`}>
          {open && (
            <>
              <SceneMenu worldId={worldId} open={open} onOpen={onOpen} />
              {live && <span className={`${styles.chip} ${styles.live}`}>{t('tabletop.live')}</span>}
              {presented && table?.screenHidden && <span className={styles.chip}>{t('tabletop.dark')}</span>}
              {showing && !live && <span className={styles.chip}>{t('tabletop.elsewhere')}</span>}
              {table?.show && (
                <span className={`${styles.chip} ${styles.live}`}>
                  {t('show.shownOnScreen', { title: table.show.title })}
                  <button
                    type="button"
                    className={styles.chipClose}
                    aria-label={t('show.clearScreen')}
                    title={t('show.clearScreen')}
                    onClick={() =>
                      onAct(() =>
                        api
                          .call('clearScreenShow', { campaignId })
                          .then(() => api.call('getCampaignTable', { campaignId }))
                      )
                    }
                  >
                    <X aria-hidden="true" size={12} />
                  </button>
                </span>
              )}
            </>
          )}
        </div>
        {open && <TodayChip worldId={worldId} campaignId={campaignId} table={table} />}
      </div>
      <RoomBar
        campaignId={campaignId}
        extra={
          sound && (
            <>
              <SoundBars sound={sound} onOpen={onOpenSound} />
              <UnlockSound sound={sound} />
            </>
          )
        }
      />
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
        <ShowImage worldId={worldId} campaignId={campaignId} />
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
      {/* La franja de la pausa, en su propia línea debajo de las barras (aunque se partan en dos): no tapa nada */}
      <div className={styles.pauseRow}>
        <PauseBanner campaignId={campaignId} className={roomStyles.inRow} />
        {open?.interior && <InteriorPill />}
      </div>
    </div>
  )
}

/**
 * Qué enseña la tele: un botón («Tele: Sigue tu vista») con su menú, cada opción con lo que hace. «Fija» se queda en
 * lo que se ve ahora y lo dice: su marco dorado se mueve y se estira en el mapa. «Sigue al grupo» encuadra sus fichas
 */
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
  const [open, setOpen] = useState(false)
  const [tip, setTip] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, menu, button)
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [open])
  useEffect(() => {
    if (!tip) return
    const timer = window.setTimeout(() => setTip(false), 7000)
    return () => window.clearTimeout(timer)
  }, [tip])
  const options = [
    { mode: 'follow', label: t('tabletop.follow'), hint: t('tabletop.followHint'), Icon: Eye },
    { mode: 'fixed', label: t('tabletop.fixed'), hint: t('tabletop.fixedHint'), Icon: Frame },
    { mode: 'group', label: t('tabletop.group'), hint: t('tabletop.groupHint'), Icon: Users }
  ] as const
  const current = options.find((o) => o.mode === camera.mode) ?? options[0]
  const choose = (mode: (typeof options)[number]['mode']) => {
    setOpen(false)
    button.current?.focus()
    if (mode === 'fixed') {
      const view = framing()
      if (!view) return
      onAct(() => api.call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view } }))
      setTip(true)
      return
    }
    setTip(false)
    onAct(() => api.call('setScreenCamera', { campaignId, camera: { mode } }))
  }
  return (
    <span className={styles.cameraWrap}>
      <button
        ref={button}
        type="button"
        className={styles.cameraButton}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        data-tour="mesa-camara"
        onClick={() => setOpen(!open)}
      >
        <Tv aria-hidden="true" size={15} />
        <span className={styles.cameraLabel}>{t('tabletop.tv')}</span>
        <b>{current.label}</b>
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={t('tabletop.camera')}
          className={styles.cameraMenu}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
              button.current?.focus()
              return
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
            const at = items.indexOf(document.activeElement as HTMLElement)
            items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
          }}
        >
          {options.map(({ mode, label, hint, Icon }) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={camera.mode === mode}
              tabIndex={camera.mode === mode ? 0 : -1}
              onClick={() => choose(mode)}
            >
              <Icon aria-hidden="true" size={16} />
              <span>
                <b>{label}</b>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {tip && camera.mode === 'fixed' && (
        <p className={styles.cameraTip} role="status">
          {t('tabletop.fixedTip')}
        </p>
      )}
    </span>
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
                  {scene.pageTitle && <span>{scene.pageTitle}</span>}
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

/**
 * Su página (la de una página) o su editor (la suelta, ADR-0020), en una ventana de la Mesa: sin irse de la campaña
 */
function PageLink({ worldId, scene }: { worldId: string; scene: SceneView }) {
  const { t } = useTranslation()
  const windows = useWindows()
  const label = t(scene.pageId ? 'tabletop.goToPage' : 'tabletop.sceneSettings')
  if (!windows)
    return scene.pageId ? (
      <Link
        to="/mundos/$worldId/wiki/$pageId"
        params={{ worldId, pageId: scene.pageId }}
        search={scene.tabId ? { pestana: scene.tabId } : {}}
        className={styles.pageLink}
      >
        {label}
      </Link>
    ) : null
  return (
    <button type="button" className={styles.pageLink} onClick={() => windows.open(sceneWindow(worldId, scene))}>
      {label}
    </button>
  )
}

/**
 * Una escena sin mapa, en la Mesa: se sube o se elige aquí mismo (sin irse a la página) y sus ajustes (la rejilla), en
 * una ventana
 */
function NoMap({
  worldId,
  scene,
  onChoose
}: {
  worldId: string
  scene: SceneView
  onChoose: (choice: SceneChoice) => void
}) {
  const { t } = useTranslation()
  const windows = useWindows()
  return (
    <div className={`${styles.notice} ${styles.noMap}`}>
      <p>{t('tabletop.noMap')}</p>
      <SourcePicker worldId={worldId} value={null} onChange={onChoose} />
      {windows && (
        <button type="button" className={styles.pageLink} onClick={() => windows.open(sceneWindow(worldId, scene))}>
          {t('tabletop.sceneSettings')}
        </button>
      )}
    </div>
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

/** Pedir la hoja de una ficha (doble clic, «Abrir hoja»): se abre en su ventana */
function SheetOpener({
  token,
  campaignId,
  systemId,
  onDone
}: {
  token: TokenView
  campaignId: string
  systemId: string | null
  onDone: () => void
}) {
  const windows = useWindows()
  useEffect(() => {
    windows?.open(
      sheetWindow({ kind: token.actor.kind, id: token.actor.id, name: token.actor.name }, campaignId, systemId)
    )
    onDone()
  }, [windows, token, campaignId, systemId, onDone])
  return null
}

/** Lo que se veía de una escena en esta campaña, guardado en este aparato (Enrique, 2026-11-10) */
const viewKey = (campaignId: string, sceneId: string) => `crisol.mesa.vista.${campaignId}.${sceneId}`

function rememberView(campaignId: string, sceneId: string, seen: SceneViewport) {
  try {
    localStorage.setItem(viewKey(campaignId, sceneId), JSON.stringify(seen))
  } catch {
    // Sin almacenamiento, no se recuerda
  }
}

function rememberedView(campaignId: string, sceneId: string): SceneViewport | null {
  try {
    const raw = localStorage.getItem(viewKey(campaignId, sceneId))
    if (!raw) return null
    const seen = JSON.parse(raw) as SceneViewport
    return typeof seen?.x === 'number' && typeof seen.y === 'number' ? seen : null
  } catch {
    return null
  }
}

/** Tu registro en la Mesa: lo enseñado se vuelve a abrir desde él (la página en su ventana, la imagen en grande) */
function MasterLog({ worldId, campaign, edge }: { worldId: string; campaign: Campaign; edge: boolean }) {
  const windows = useWindows()
  const [image, setImage] = useState<ShownImage | null>(null)
  return (
    <>
      <LogStrip
        campaign={campaign}
        edge={edge}
        onOpenShown={(shown) =>
          shown.kind === 'image'
            ? setImage({ fileId: shown.id, title: shown.title })
            : windows?.open(pageWindow(worldId, shown.id, shown.title))
        }
      />
      {image && <ImageViewer image={image} onClose={() => setImage(null)} />}
    </>
  )
}
