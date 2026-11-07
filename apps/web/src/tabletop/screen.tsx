/**
 * La pantalla de la tele (docs/specs/escenas.md, ADR-0018 § 8): solo el mapa, sobre negro, sin nada de la interfaz.
 * Se conecta a la mesa de la campaña como «la pantalla» y enseña lo que ve el grupo: la escena presentada, con la
 * cámara del máster (sigue su vista, suave) o fija, ajustada a su tamaño; a oscuras, con el nombre de la campaña, si
 * está oculta. Si se corta, vuelve sola a lo que enseñaba
 */
import type { SceneViewport, ScreenView } from '@crisol/contracts'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { Maximize, Minimize } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { CrisolMark } from '../components/brand.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { canvasViewOf, smoothToward } from './camera.ts'
import { connectTable } from './channel.ts'
import { screenTileUrl } from './queries.ts'
import type { RendererScene } from './renderer.ts'
import styles from './screen.module.css'
import { useTableRenderer } from './use-renderer.ts'
import { fitCanvas } from './view.ts'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/pantalla')

export function ScreenRoute() {
  const { campaignId } = route.useParams()
  const { account, pending } = useAccounts().useAccount()
  if (pending) return <div className={styles.screen} />
  if (!account) return <Navigate to="/entrar" replace />
  return <TableScreen campaignId={campaignId} />
}

/** Lo que debe enseñar la cámara: el encuadre fijo, el último del máster o la vista inicial de la escena */
export function cameraTarget(screen: ScreenView, followed: SceneViewport | null): SceneViewport | null {
  if (!screen.scene) return null
  if (screen.camera.mode === 'fixed') return screen.camera.view
  return followed ?? screen.scene.initialView
}

export function TableScreen({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<ScreenView | null>(null)
  const [followed, setFollowed] = useState<SceneViewport | null>(null)
  const [full, setFull] = useState(false)
  // El fundido al presentar otra escena: una capa negra que se desvanece
  const [fade, setFade] = useState(0)
  const shownScene = useRef<string | null>(null)

  useEffect(() => {
    const connection = connectTable(
      { campaignId, view: 'screen' },
      {
        onMessage: (message) => {
          if (message.type === 'screen') setScreen(message.screen)
          else if (message.type === 'viewport') setFollowed(message.view)
        }
      }
    )
    return () => connection.close()
  }, [campaignId])

  const presented = screen?.scene ?? null
  const scene: RendererScene | null = useMemo(
    () =>
      presented?.image?.tiles
        ? {
            id: presented.id,
            width: presented.image.width,
            height: presented.image.height,
            tiles: presented.image.tiles,
            grid: presented.grid,
            tileUrl: screenTileUrl(campaignId, presented.image.tiles.version)
          }
        : null,
    [presented, campaignId]
  )
  const { host, renderer, ready, size } = useTableRenderer(scene)

  // Otra escena: fundido desde negro y la cámara salta (sin animar el viaje)
  const current = useRef<SceneViewport | null>(null)
  if ((presented?.id ?? null) !== shownScene.current) {
    shownScene.current = presented?.id ?? null
    current.current = null
    if (presented) setFade((n) => n + 1)
  }

  // La cámara: hacia su objetivo, suave, a cada fotograma mientras no ha llegado
  const target = screen ? cameraTarget(screen, followed) : null
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
