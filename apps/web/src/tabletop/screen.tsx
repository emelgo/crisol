/**
 * La pantalla de la tele (docs/specs/escenas.md, ADR-0018 § 8): solo el mapa, sobre negro, sin nada de la interfaz.
 * Se conecta a la mesa de la campaña como «la pantalla» y enseña lo que ve el grupo: la escena presentada, con la
 * cámara del máster (sigue su vista, suave) o fija, ajustada a su tamaño; a oscuras, con el nombre de la campaña, si
 * está oculta. Con su niebla (docs/specs/vision.md): lo no explorado negro, lo explorado en gris y lo visible con su
 * luz, de bordes blandos; solo pide las teselas que tocan lo que ve o vio. Con lo dejado en el mapa que el grupo puede
 * ver, los widgets de ojo abierto y, en vivo, la medida del máster (con «La tele ve lo que mides») y su láser
 * (docs/specs/herramientas-mesa.md). Si se corta, vuelve sola a lo que enseñaba
 */
import type { LiveMeasure, SceneViewport, ScreenMark, ScreenToken, ScreenView } from '@crisol/contracts'
import { frameGroup, liveTrail, type Point, type Size, type Viewport } from '@crisol/tabletop'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { Maximize, Minimize } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { PlayerPage } from '../campaign/world-pages.tsx'
import { CrisolMark } from '../components/brand.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import { Bubbles, useBubbles } from './bubbles.tsx'
import { canvasViewOf, sceneViewportOf, smoothToward } from './camera.ts'
import { connectTable, type TableStatus } from './channel.ts'
import { cssDisc, screenDraw } from './draw.ts'
import { decodeMask, type FogLight, fogImage, fogLayerOf, maskTileUrl } from './fog-paint.ts'
import { MarksLayer, placeMarks } from './marks-layer.tsx'
import { screenTileUrl } from './queries.ts'
import type { MapImageDraw, OverlayShape, RendererScene } from './renderer.ts'
import styles from './screen.module.css'
import { cellSide, initialOf } from './tokens.ts'
import toolStyles from './tools.module.css'
import { markShapes, measureLabels, measureShapes } from './tools.ts'
import { useTableRenderer } from './use-renderer.ts'
import { fitCanvas, pyramidOf } from './view.ts'
import { WidgetCards } from './widgets.tsx'

const LASER_COLOR = 0xff3b3b

/** Las imágenes sueltas que llegan, para el lienzo: las de debajo de las fichas primero */
export function screenImages(marks: readonly ScreenMark[]): MapImageDraw[] {
  const images = marks.filter((m): m is Extract<ScreenMark, { kind: 'image' }> => m.kind === 'image')
  return [...images.filter((m) => !m.above), ...images.filter((m) => m.above)].map((m) => ({
    id: m.id,
    url: `/api/files/${m.fileId}`,
    x: m.x,
    y: m.y,
    width: m.width,
    height: m.height,
    rotation: m.rotation,
    above: m.above ?? false,
    alpha: 1
  }))
}

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/pantalla')

export function ScreenRoute() {
  const { campaignId } = route.useParams()
  const { account, pending } = useAccounts().useAccount()
  if (pending) return <div className={styles.screen} />
  if (!account) return <Navigate to="/entrar" replace />
  return <TableScreen campaignId={campaignId} />
}

/**
 * Lo que debe enseñar la cámara: el encuadre fijo, las fichas del grupo (con «Encuadrar al grupo»), el último del
 * máster o la vista inicial de la escena
 */
export function cameraTarget(
  screen: ScreenView,
  followed: SceneViewport | null,
  size: Size = { width: 16, height: 9 }
): SceneViewport | null {
  const scene = screen.scene
  if (!scene) return null
  if (screen.camera.mode === 'fixed') return screen.camera.view
  if (screen.camera.mode === 'group') {
    const group = screen.tokens.filter((token) => token.faction === 'group').map((t) => ({ x: t.x, y: t.y }))
    const framing = frameGroup(group, cellSide(scene.grid), size.height / Math.max(1, size.width))
    // Sin nadie del grupo en la escena, el mapa entero (no la vista del máster)
    return framing ? sceneViewportOf(framing) : null
  }
  return followed ?? scene.initialView
}

/**
 * Lo que ve el grupo: la tele (a pantalla completa) o, con viewer «player», la Mesa de un jugador (en su caja, con la
 * barra al lado: sin título propio, sin pantalla completa y con el tema de la app). onScreen: lo que llega, para la barra
 */
export function TableScreen({
  campaignId,
  viewer = 'screen',
  onScreen
}: {
  campaignId: string
  viewer?: 'screen' | 'player'
  onScreen?: (screen: ScreenView | null) => void
}) {
  const inMesa = viewer === 'player'
  const { t } = useTranslation()
  const [screen, setScreen] = useState<ScreenView | null>(null)
  const [followed, setFollowed] = useState<SceneViewport | null>(null)
  const [full, setFull] = useState(false)
  // El fundido al presentar otra escena: una capa negra que se desvanece
  const [fade, setFade] = useState(0)
  const shownScene = useRef<string | null>(null)
  // Las fichas que el máster arrastra, en vivo (se olvidan al llegar la mesa)
  const [dragged, setDragged] = useState<Map<string, Point>>(new Map())
  // La medida del máster y la estela de su láser, en vivo
  const [measure, setMeasure] = useState<LiveMeasure | null>(null)
  const laser = useRef<Array<Point & { t: number }>>([])
  const [laserTick, setLaserTick] = useState(0)
  // Si se corta o no deja entrar, se dice en vez de quedarse en negro sin más
  const [status, setStatus] = useState<TableStatus>('connecting')
  // La tele, siempre oscura (con el tema claro, los relojes y los nombres no se leían sobre el mapa)
  useEffect(() => {
    if (inMesa) return
    const root = document.documentElement
    const before = root.dataset.theme
    root.dataset.theme = 'dark'
    return () => {
      if (before) root.dataset.theme = before
      else delete root.dataset.theme
    }
  }, [])
  // La vista de ahora (para colocar los textos, sellos y pines) y su capa
  const shownView = useRef<Viewport>({ x: 0, y: 0, scale: 1 })
  const marksLayer = useRef<HTMLDivElement | null>(null)
  // Las burbujas de lo dicho en personaje, sobre las fichas
  const bubblesLayer = useRef<HTMLDivElement | null>(null)
  const bubbles = useBubbles(campaignId, screen)
  useEffect(() => {
    if (bubbles.length > 0) placeMarks(bubblesLayer.current, shownView.current)
  }, [bubbles])

  useEffect(() => {
    const connection = connectTable(
      { campaignId, view: viewer },
      {
        onMessage: (message) => {
          if (message.type === 'screen') {
            setScreen(message.screen)
            setDragged(new Map())
          } else if (message.type === 'viewport') setFollowed(message.view)
          else if (message.type === 'drag')
            setDragged((current) => {
              const next = new Map(current)
              for (const move of message.moves) next.set(move.tokenId, { x: move.x, y: move.y })
              return next
            })
          else if (message.type === 'measure') setMeasure(message.measure)
          else if (message.type === 'laser') {
            const now = performance.now()
            laser.current = [
              ...liveTrail(laser.current, now).map((p) => ({ x: p.x, y: p.y, t: now - (1 - p.life) * 700 })),
              ...message.points.map((p) => ({ ...p, t: now }))
            ].slice(-80)
            setLaserTick((n) => n + 1)
          }
        },
        onStatus: setStatus
      }
    )
    return () => connection.close()
  }, [campaignId, viewer])

  const presented = screen?.scene ?? null
  // La niebla: lo explorado y lo que ve el grupo (sin ella, la API de prueba, se ve todo)
  const fog = screen?.fog ?? null
  const masks = useMemo(() => {
    if (!fog) return null
    const explored = decodeMask(fog.explored)
    const visible = decodeMask(fog.visible)
    return { explored, visible, seen: explored.clone().union(visible) }
  }, [fog])
  const scene: RendererScene | null = useMemo(() => {
    if (!presented?.image?.tiles) return null
    const base = screenTileUrl(campaignId, presented.image.tiles.version)
    const pyramid = pyramidOf(presented.image)
    const fits = masks && pyramid && masks.seen.width === presented.image.width
    return {
      id: presented.id,
      width: presented.image.width,
      height: presented.image.height,
      tiles: presented.image.tiles,
      grid: presented.grid,
      tileUrl: fits ? maskTileUrl(base, masks.seen, pyramid) : base
    }
  }, [presented, campaignId, masks])
  const { host, renderer, ready, size } = useTableRenderer(scene, { big: true })
  const lights = screen?.lights
  useEffect(() => {
    if (!ready) return
    if (!masks || !fog) {
      renderer.current?.setFog(null)
      renderer.current?.setGlow(null)
      return
    }
    const glowing: FogLight[] = (lights ?? []).map((light) => ({ ...light, cells: decodeMask(light.cells) }))
    const image = fogImage(masks.explored, masks.visible, 'screen', { darkness: fog.darkness, lights: glowing })
    renderer.current?.setFog(fogLayerOf(image.pixels, masks.explored))
    renderer.current?.setGlow(image.glow ? fogLayerOf(image.glow, masks.explored) : null)
  }, [ready, masks, fog, lights, renderer])
  const words = (state: NonNullable<ScreenToken['state']>) => t(`inPlay.state.${state}`)
  const visible = presented && screen ? screen.tokens : []
  // Las fichas: con su nombre, su estado en palabras y lo que se arrastra
  useEffect(() => {
    if (!ready) return
    const grid = presented?.grid
    const turns = new Set((screen?.combat?.combatants ?? []).filter((c) => c.active).map((c) => c.tokenId))
    renderer.current?.setTokens(
      grid ? visible.map((token) => screenDraw(token, grid, words, dragged.get(token.id), turns.has(token.id))) : []
    )
  })

  // Lo dejado en el mapa (plantillas y dibujos; las imágenes, en su capa) y lo que va en vivo (la medida, el láser)
  const marks = screen && !screen.hidden && presented ? (screen.marks ?? []) : []
  useEffect(() => {
    if (!ready) return
    const grid = presented?.grid
    renderer.current?.setShapes(grid ? markShapes(marks, grid) : [], 'marks')
    renderer.current?.setImages(screenImages(marks))
  }, [ready, marks, presented?.grid, renderer])
  useEffect(() => {
    if (!ready) return
    const grid = presented?.grid
    let frame = 0
    const paint = () => {
      frame = 0
      const live: OverlayShape[] = []
      const current = grid && measure ? { shape: measure.shape, points: measure.points } : null
      if (current && grid) live.push(...measureShapes(current, grid))
      const trail = liveTrail(laser.current, performance.now())
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1] as Point & { life: number }
        const b = trail[i] as Point & { life: number }
        live.push({ kind: 'line', a, b, color: LASER_COLOR, width: 3 + 6 * b.life, alpha: b.life })
      }
      const head = trail.at(-1)
      if (head) live.push({ kind: 'dot', at: head, color: LASER_COLOR, radius: 9, alpha: head.life })
      renderer.current?.setShapes(live, 'live')
      const labels = current && grid ? measureLabels(current, grid) : []
      renderer.current?.setLabels(labels)
      // Para las pruebas del navegador: lo que llega en vivo, sin leer los píxeles
      if (host.current) {
        host.current.dataset.laser = String(trail.length)
        host.current.dataset.measure = labels.map((label) => label.text).join(' · ')
      }
      // La estela se apaga sola, a unos 25 repintados por segundo
      if (trail.length > 0) frame = requestAnimationFrame(wait)
      else laser.current = []
    }
    let painted = performance.now()
    const wait = (now: number) => {
      frame = 0
      if (now - painted < 40) frame = requestAnimationFrame(wait)
      else {
        painted = now
        paint()
      }
    }
    paint()
    return () => cancelAnimationFrame(frame)
  }, [ready, measure, laserTick, presented?.grid, renderer, host])

  // Otra escena: fundido desde negro y la cámara salta (sin animar el viaje)
  const current = useRef<SceneViewport | null>(null)
  if ((presented?.id ?? null) !== shownScene.current) {
    shownScene.current = presented?.id ?? null
    current.current = null
    if (presented) setFade((n) => n + 1)
  }

  // La cámara: hacia su objetivo, suave, a cada fotograma mientras no ha llegado
  const target = screen ? cameraTarget(screen, followed, size) : null
  const targetRef = useRef(target)
  targetRef.current = target
  useEffect(() => {
    if (!ready || !scene || size.width === 0) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const goal = targetRef.current
      const view = goal ? goal : null
      if (!view) {
        const fitted = fitCanvas(scene, size)
        renderer.current?.setView(fitted)
        shownView.current = fitted
        placeMarks(marksLayer.current, fitted)
        placeMarks(bubblesLayer.current, fitted)
        if (host.current) host.current.dataset.view = JSON.stringify({ ...fitted, ...size })
        return
      }
      const next = current.current ? smoothToward(current.current, view, now - last) : view
      last = now
      current.current = next
      const shown = canvasViewOf(next, size)
      renderer.current?.setView(shown)
      shownView.current = shown
      placeMarks(marksLayer.current, shown)
      placeMarks(bubblesLayer.current, shown)
      // Para las pruebas del navegador: dónde cae el mapa en la tele, sin leer sus píxeles
      if (host.current) host.current.dataset.view = JSON.stringify({ ...shown, ...size })
      if (next !== view) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [ready, scene, size, target, renderer, host])

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const report = useRef(onScreen)
  report.current = onScreen
  useEffect(() => report.current?.(screen), [screen])
  const dark = !screen || screen.hidden || !presented
  return (
    <div className={inMesa ? `${styles.screen} ${styles.inMesa}` : styles.screen}>
      {screen && !inMesa && <PageTitle className={styles.hidden}>{screen.campaignName}</PageTitle>}
      <div ref={host} className={styles.canvas} role="img" aria-label={t('screen.label')} data-screen="" />
      {!dark && <MarksLayer layer={marksLayer} view={shownView} marks={marks} big />}
      {!dark && <Bubbles layer={bubblesLayer} bubbles={bubbles} />}
      {!dark && screen?.widgets && <WidgetCards widgets={screen.widgets} className={toolStyles.screenWidgets} />}
      {visible.length > 0 && !screen?.hidden && (
        <ul className={styles.hidden} aria-label={t('screen.tokens')}>
          {visible.map((token) => (
            <li key={token.id}>
              {[token.name, token.state ? words(token.state) : null, ...token.conditions.map((c) => c.name)]
                .filter(Boolean)
                .join(', ')}
            </li>
          ))}
        </ul>
      )}
      {screen?.combat && !dark && <TurnStrip combat={screen.combat} />}
      {fade > 0 && !dark && <div key={fade} className={styles.fade} aria-hidden="true" />}
      {dark && (
        <div className={styles.dark} data-dark="">
          <CrisolMark size={44} className={styles.flame} />
          {screen && <b aria-hidden="true">{screen.campaignName}</b>}
          {(status === 'reconnecting' || status === 'forbidden') && (
            <p className={styles.status} role="status">
              {t(status === 'forbidden' ? 'screen.forbidden' : 'tabletop.reconnecting')}
            </p>
          )}
        </div>
      )}
      {/* Lo que enseña el máster, encima de la escena (en la vista de jugadores; en la Mesa de cada uno le llega aparte) */}
      {screen?.show && !inMesa && (
        <div key={`${screen.show.kind}:${screen.show.id}`} className={styles.shown}>
          {screen.show.kind === 'image' ? (
            <img src={`/api/files/${screen.show.id}`} alt={screen.show.title} />
          ) : (
            <div className={styles.shownPage}>
              <ReadAsProvider value={{ campaignId }}>
                <PlayerPage worldId={screen.show.worldId} pageId={screen.show.id} />
              </ReadAsProvider>
            </div>
          )}
        </div>
      )}
      {status === 'kicked' && (
        <div className={styles.kicked} role="alert">
          <CrisolMark size={40} className={styles.flame} />
          <p>{t('screen.kicked')}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {t('screen.tryAgain')}
          </button>
        </div>
      )}
      {!inMesa && (
        <button
          type="button"
          className={styles.full}
          aria-label={t(full ? 'screen.exitFullscreen' : 'screen.fullscreen')}
          title={t(full ? 'screen.exitFullscreen' : 'screen.fullscreen')}
          onClick={toggleFull}
        >
          {full ? <Minimize aria-hidden="true" size={18} /> : <Maximize aria-hidden="true" size={18} />}
        </button>
      )}
    </div>
  )
}

/** La franja de turnos, abajo: la ronda, el orden (sin las ocultas) y de quién es el turno */
function TurnStrip({ combat }: { combat: NonNullable<ScreenView['combat']> }) {
  const { t } = useTranslation()
  const active = combat.combatants.filter((c) => c.active).map((c) => c.name)
  const turn = active.length > 0 ? new Intl.ListFormat('es', { type: 'conjunction' }).format(active) : null
  return (
    <section className={styles.turns} aria-label={t('combat.strip')} data-turns="">
      <span className={styles.roundLabel}>
        {combat.round === 0 ? t('combat.notStarted') : t('combat.round', { round: combat.round })}
      </span>
      <ol className={styles.discs}>
        {combat.combatants.map((c) => (
          <li
            key={c.id}
            className={styles.disc}
            data-kind={c.kind}
            data-active={c.active || undefined}
            data-defeated={c.defeated || undefined}
            aria-current={c.active ? 'step' : undefined}
            style={{ background: cssDisc(c.name, c.kind === 'character' ? 'group' : 'hostile') }}
          >
            <span aria-hidden="true">{initialOf(c.name)}</span>
            <span className={styles.hidden}>{c.name}</span>
          </li>
        ))}
      </ol>
      {turn && <b className={styles.turnOf}>{t('combat.stripTurn', { name: turn })}</b>}
    </section>
  )
}
