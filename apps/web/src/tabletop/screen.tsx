/**
 * La pantalla de la tele (docs/specs/escenas.md, ADR-0018 § 8): solo el mapa, sobre negro, sin nada de la interfaz.
 * Se conecta a la mesa de la campaña como «la pantalla» y enseña lo que ve el grupo: la escena presentada, con la
 * cámara del máster (sigue su vista, suave) o fija, ajustada a su tamaño; a oscuras, con el nombre de la campaña, si
 * está oculta. Con su niebla (docs/specs/vision.md): lo no explorado negro, lo explorado en gris y lo visible con su
 * luz, de bordes blandos; solo pide las teselas que tocan lo que ve o vio. Si se corta, vuelve sola a lo que enseñaba
 */
import type { SceneViewport, ScreenToken, ScreenView } from '@crisol/contracts'
import { frameGroup, type Point, type Size } from '@crisol/tabletop'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { Maximize, Minimize } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { CrisolMark } from '../components/brand.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { canvasViewOf, sceneViewportOf, smoothToward } from './camera.ts'
import { connectTable } from './channel.ts'
import { cssDisc, screenDraw } from './draw.ts'
import { decodeMask, type FogLight, fogImage, fogLayerOf, maskTileUrl } from './fog-paint.ts'
import { screenTileUrl } from './queries.ts'
import type { RendererScene } from './renderer.ts'
import styles from './screen.module.css'
import { cellSide, initialOf } from './tokens.ts'
import { useTableRenderer } from './use-renderer.ts'
import { fitCanvas, pyramidOf } from './view.ts'

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
    if (framing) return sceneViewportOf(framing)
  }
  return followed ?? scene.initialView
}

export function TableScreen({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<ScreenView | null>(null)
  const [followed, setFollowed] = useState<SceneViewport | null>(null)
  const [full, setFull] = useState(false)
  // El fundido al presentar otra escena: una capa negra que se desvanece
  const [fade, setFade] = useState(0)
  const shownScene = useRef<string | null>(null)
  // Las fichas que el máster arrastra, en vivo (se olvidan al llegar la mesa)
  const [dragged, setDragged] = useState<Map<string, Point>>(new Map())

  useEffect(() => {
    const connection = connectTable(
      { campaignId, view: 'screen' },
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
        }
      }
    )
    return () => connection.close()
  }, [campaignId])

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
        if (host.current) host.current.dataset.view = JSON.stringify({ ...fitted, ...size })
        return
      }
      const next = current.current ? smoothToward(current.current, view, now - last) : view
      last = now
      current.current = next
      const shown = canvasViewOf(next, size)
      renderer.current?.setView(shown)
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

  const dark = !screen || screen.hidden || !presented
  return (
    <div className={styles.screen}>
      {screen && <PageTitle className={styles.hidden}>{screen.campaignName}</PageTitle>}
      <div ref={host} className={styles.canvas} role="img" aria-label={t('screen.label')} data-screen="" />
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
        </div>
      )}
      <button
        type="button"
        className={styles.full}
        aria-label={t(full ? 'screen.exitFullscreen' : 'screen.fullscreen')}
        title={t(full ? 'screen.exitFullscreen' : 'screen.fullscreen')}
        onClick={toggleFull}
      >
        {full ? <Minimize aria-hidden="true" size={18} /> : <Maximize aria-hidden="true" size={18} />}
      </button>
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
