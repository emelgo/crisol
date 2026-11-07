/**
 * El lienzo de la mesa con PixiJS (ADR-0018 § 9), para la mesa del máster y la tele: el mapa por teselas (las del
 * nivel que toca según el zoom, con las del siguiente debajo mientras llegan y el nivel más pequeño entero al fondo) y
 * la rejilla encima, en píxeles de la pantalla. PixiJS se carga aparte (import()), solo en la mesa y en la tele
 */
import type { SceneGrid, SceneTiles } from '@crisol/contracts'
import { type Size, type TilePyramid, type TileRef, tileWorldRect, type Viewport } from '@crisol/tabletop'
import type { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { pyramidOf, screenGridLines, tilesToDraw } from './view.ts'

type Pixi = typeof import('pixi.js')

export interface RendererScene {
  id: string
  width: number
  height: number
  tiles: SceneTiles
  grid: SceneGrid
  tileUrl: (level: number, x: number, y: number) => string
}

/** Cuántas teselas se guardan cargadas (las que no se ven se sueltan antes) */
const CACHE_LIMIT = 320

type Cached = { texture: Texture | null; loading: Promise<void> | null; used: number; failed: boolean }

export class TableRenderer {
  private readonly pixi: Pixi
  private readonly app: Application
  private readonly layers: { base: Container; under: Container; top: Container }
  private readonly world: Container
  private readonly grid: Graphics
  private readonly sprites = new Map<string, Sprite>()
  private readonly cache = new Map<string, Cached>()
  private scene: RendererScene | null = null
  private pyramid: TilePyramid | null = null
  private view: Viewport = { x: 0, y: 0, scale: 1 }
  private size: Size = { width: 0, height: 0 }
  private frame = 0
  private tick = 0
  private destroyed = false

  /** Crea el lienzo dentro de `host` (lo llena) */
  static async create(host: HTMLElement): Promise<TableRenderer> {
    const pixi = await import('pixi.js')
    const app = new pixi.Application()
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      background: '#0b0b0c',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: ['webgl', 'canvas']
    })
    app.canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(app.canvas)
    return new TableRenderer(pixi, app)
  }

  private constructor(pixi: Pixi, app: Application) {
    this.pixi = pixi
    this.app = app
    this.world = new pixi.Container()
    this.layers = { base: new pixi.Container(), under: new pixi.Container(), top: new pixi.Container() }
    this.world.addChild(this.layers.base, this.layers.under, this.layers.top)
    this.grid = new pixi.Graphics()
    app.stage.addChild(this.world, this.grid)
    // Sin ratón en PixiJS: los gestos los lleva la página
    app.stage.eventMode = 'none'
    // Se pinta solo cuando algo cambia (no a cada fotograma): la mesa y la tele pasan horas abiertas
    app.ticker.stop()
  }

  resize(size: Size) {
    if (this.destroyed || size.width <= 0 || size.height <= 0) return
    this.size = size
    this.app.renderer.resize(size.width, size.height)
    this.schedule()
  }

  setScene(scene: RendererScene | null) {
    const same = scene && this.scene && scene.id === this.scene.id && scene.tiles.version === this.scene.tiles.version
    this.scene = scene
    if (!same) {
      for (const sprite of this.sprites.values()) sprite.destroy()
      this.sprites.clear()
      this.pyramid = scene ? pyramidOf({ width: scene.width, height: scene.height, tiles: scene.tiles }) : null
    }
    this.schedule()
  }

  setView(view: Viewport) {
    this.view = view
    this.schedule()
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    for (const cached of this.cache.values()) cached.texture?.destroy(true)
    this.cache.clear()
    this.app.destroy({ removeView: true }, { children: true })
  }

  /** Un repintado por fotograma, como mucho */
  private schedule() {
    if (this.destroyed || this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.paint()
    })
  }

  private paint() {
    if (this.destroyed) return
    this.layout()
    this.app.render()
  }

  private layout() {
    const { view, scene, pyramid } = this
    this.world.position.set(view.x, view.y)
    this.world.scale.set(view.scale)
    this.grid.clear()
    if (!scene || !pyramid || this.size.width === 0) {
      for (const sprite of this.sprites.values()) sprite.destroy()
      this.sprites.clear()
      return
    }
    this.tick++
    const draw = tilesToDraw(pyramid, view, this.size, window.devicePixelRatio || 1)
    const wanted = new Map<string, { ref: TileRef; layer: Container }>()
    for (const ref of draw.base) wanted.set(`${ref.level}/${ref.x}/${ref.y}`, { ref, layer: this.layers.base })
    for (const ref of draw.under) wanted.set(`${ref.level}/${ref.x}/${ref.y}`, { ref, layer: this.layers.under })
    for (const ref of draw.tiles) wanted.set(`${ref.level}/${ref.x}/${ref.y}`, { ref, layer: this.layers.top })
    // Las que ya no hacen falta se quitan (su textura se queda en la caché)
    for (const [key, sprite] of this.sprites) {
      if (wanted.has(key)) continue
      sprite.destroy()
      this.sprites.delete(key)
    }
    for (const [key, { ref, layer }] of wanted) {
      if (this.sprites.has(key)) continue
      const texture = this.texture(scene.tileUrl(ref.level, ref.x, ref.y))
      if (!texture) continue
      const rect = tileWorldRect(pyramid, ref)
      const sprite = new this.pixi.Sprite(texture)
      sprite.position.set(rect.x, rect.y)
      // Un píxel de más (salvo en el borde) tapa las rendijas entre teselas
      sprite.width = Math.min(rect.width + 1, pyramid.width - rect.x)
      sprite.height = Math.min(rect.height + 1, pyramid.height - rect.y)
      layer.addChild(sprite)
      this.sprites.set(key, sprite)
    }
    this.evict(new Set([...wanted.values()].map(({ ref }) => scene.tileUrl(ref.level, ref.x, ref.y))))
    this.drawGrid(scene)
  }

  private drawGrid(scene: RendererScene) {
    const { grid } = scene
    if (!grid.visible) return
    const lines = screenGridLines(grid, this.view, this.size, { width: scene.width, height: scene.height })
    if (lines.length === 0) return
    for (const [x1, y1, x2, y2] of lines) this.grid.moveTo(x1, y1).lineTo(x2, y2)
    this.grid.stroke({ width: 1, color: grid.color, alpha: grid.opacity })
  }

  /** La textura de una tesela si ya está; si no, la pide y repinta al llegar */
  private texture(url: string): Texture | null {
    const cached = this.cache.get(url)
    if (cached) {
      cached.used = this.tick
      return cached.texture
    }
    const entry: Cached = { texture: null, loading: null, used: this.tick, failed: false }
    this.cache.set(url, entry)
    entry.loading = (async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(String(response.status))
        const bitmap = await createImageBitmap(await response.blob())
        if (this.destroyed) return bitmap.close()
        entry.texture = new this.pixi.Texture({ source: new this.pixi.ImageSource({ resource: bitmap }) })
        this.schedule()
      } catch {
        // Se vuelve a pedir la próxima vez que haga falta
        entry.failed = true
        this.cache.delete(url)
      } finally {
        entry.loading = null
      }
    })()
    return null
  }

  /** Suelta las texturas más viejas que no se ven, si hay demasiadas */
  private evict(inUse: Set<string>) {
    if (this.cache.size <= CACHE_LIMIT) return
    const old = [...this.cache.entries()]
      .filter(([url, cached]) => !inUse.has(url) && cached.texture)
      .sort((a, b) => a[1].used - b[1].used)
    for (const [url, cached] of old.slice(0, this.cache.size - CACHE_LIMIT)) {
      cached.texture?.destroy(true)
      this.cache.delete(url)
    }
  }
}
