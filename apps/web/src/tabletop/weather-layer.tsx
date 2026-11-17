/**
 * La capa de clima encima del mapa (decisión 16): un lienzo de PixiJS propio, transparente y sin ratón, que pinta las
 * partículas de `weather-particles.ts` mientras haya capa (a 30 fotogramas; sin capa, no gasta nada). La usan la Mesa
 * del máster, la de la jugadora y la Vista de jugadores; en una escena interior el servidor ya la manda vacía
 */
import type { WeatherLayerView } from '@crisol/contracts'
import type { Application, Graphics, Sprite, Texture } from 'pixi.js'
import { useEffect, useRef } from 'react'
import styles from './weather-layer.module.css'
import { particlesAt } from './weather-particles.ts'

/** La misma semilla en todos los aparatos: lo que se ve no depende de quién lo pinte */
const SEED = 7

/** Un punto blanco difuminado, para la nieve, la ceniza y la niebla */
function softDot(pixi: typeof import('pixi.js')): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  return pixi.Texture.from(canvas)
}

const TINT: Record<WeatherLayerView['kind'], number> = { rain: 0xbcd3ef, snow: 0xffffff, fog: 0xd8dde4, ash: 0x9a948c }

export function WeatherLayer({ layer }: { layer: WeatherLayerView | null }) {
  const host = useRef<HTMLDivElement>(null)
  const current = useRef(layer)
  current.current = layer
  const active = layer !== null && layer.intensity > 0
  useEffect(() => {
    const element = host.current
    if (!active || !element) return
    let alive = true
    let app: Application | null = null
    let observer: ResizeObserver | null = null
    void (async () => {
      try {
        const pixi = await import('pixi.js')
        const made = new pixi.Application()
        await made.init({
          width: Math.max(1, element.clientWidth),
          height: Math.max(1, element.clientHeight),
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          preference: ['webgl', 'canvas']
        })
        if (!alive) {
          made.destroy({ removeView: true }, { children: true })
          return
        }
        app = made
        made.canvas.setAttribute('aria-hidden', 'true')
        element.appendChild(made.canvas)
        made.stage.eventMode = 'none'
        made.ticker.maxFPS = 30
        const streaks: Graphics = new pixi.Graphics()
        const dots = new pixi.Container()
        made.stage.addChild(dots, streaks)
        const texture = softDot(pixi)
        const pool: Sprite[] = []
        observer = new ResizeObserver(() => made.renderer.resize(element.clientWidth, element.clientHeight))
        observer.observe(element)
        const started = performance.now()
        made.ticker.add(() => {
          const shown = current.current
          streaks.clear()
          if (!shown) {
            for (const sprite of pool) sprite.visible = false
            return
          }
          const size = {
            width: made.renderer.width / made.renderer.resolution,
            height: made.renderer.height / made.renderer.resolution
          }
          const particles = particlesAt(shown, size, (performance.now() - started) / 1000, SEED)
          if (shown.kind === 'rain') {
            for (const sprite of pool) sprite.visible = false
            for (const p of particles)
              streaks
                .moveTo(p.x, p.y)
                .lineTo(p.x + p.dx, p.y + p.dy)
                .stroke({ width: p.size, color: TINT.rain, alpha: p.alpha })
            return
          }
          while (pool.length < particles.length) {
            const sprite = new pixi.Sprite(texture)
            sprite.anchor.set(0.5)
            dots.addChild(sprite)
            pool.push(sprite)
          }
          pool.forEach((sprite, index) => {
            const p = particles[index]
            sprite.visible = Boolean(p)
            if (!p) return
            sprite.position.set(p.x, p.y)
            // La textura mide 64: su radio útil, la mitad
            sprite.scale.set((p.size * 2) / 32)
            sprite.alpha = p.alpha
            sprite.tint = TINT[shown.kind]
          })
        })
      } catch {
        // Sin WebGL ni lienzo (o en las pruebas): la Mesa sigue, sin clima
      }
    })()
    return () => {
      alive = false
      observer?.disconnect()
      app?.destroy({ removeView: true }, { children: true })
    }
  }, [active])
  return (
    <div
      ref={host}
      className={styles.layer}
      aria-hidden="true"
      data-weather={active ? layer.kind : undefined}
      data-intensity={active ? layer.intensity.toFixed(2) : undefined}
    />
  )
}
