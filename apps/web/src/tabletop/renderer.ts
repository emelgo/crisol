/**
 * El lienzo de la mesa con PixiJS (ADR-0018 § 9), para la mesa del máster y la tele: el mapa por teselas (las del
 * nivel que toca según el zoom, con las del siguiente debajo mientras llegan y el nivel más pequeño entero al fondo) y
 * la rejilla encima, en píxeles de la pantalla. PixiJS se carga aparte (import()), solo en la mesa y en la tele
 */
import type { SceneGrid, SceneTiles } from '@crisol/contracts'
import { type Size, type TilePyramid, type TileRef, tileWorldRect, type Viewport } from '@crisol/tabletop'
import type { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
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

/** Una ficha tal como se pinta (la mesa y la tele la preparan con lo suyo) */
export interface DrawToken {
  id: string
  /** Su centro y su radio, en píxeles del mapa */
  x: number
  y: number
  radius: number
  label: string
  initial: string
  faction: 'group' | 'hostile' | 'neutral'
  /** El color de su disco: claro y oscuro */
  colors: readonly [number, number]
  /** Su imagen y su encuadre redondo (el centro, de 0 a 1, y cuánto se acerca); sin ella, un disco con la inicial */
  image: { url: string; x: number; y: number; zoom: number } | null
  hidden: boolean
  selected: boolean
  /** Es su turno en el combate: un aro dorado */
  turn: boolean
  /** La parte de su vida que le queda (la mesa); null sin vida o en la tele */
  life: number | null
  /** Su estado en palabras (la tele) */
  state: { text: string; tone: 'ok' | 'hurt' | 'bad' | 'crit' | 'down' } | null
  conditions: string[]
}

/** El borde de cada bando: azul, naranja y amarillo, que se distinguen también por la luz */
export const FACTION_COLORS = { group: 0x6fa8ff, hostile: 0xff8a4c, neutral: 0xd8c27a } as const
const STATE_COLORS = { ok: 0x9fd8bd, hurt: 0xf2c260, bad: 0xff9a6b, crit: 0xff7b7b, down: 0xb0b0b8 } as const

type TokenNode = {
  root: Container
  disc: Graphics
  mask: Graphics
  sprite: Sprite | null
  spriteUrl: string | null
  initial: Text
  plate: Graphics
  label: Text
  extra: Text
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
  private readonly tokenLayer: Container
  private readonly nodes = new Map<string, TokenNode>()
  private tokens: DrawToken[] = []
  /** La tele: rótulos más grandes y su estado en palabras */
  private readonly big: boolean
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
  static async create(host: HTMLElement, options: { big?: boolean } = {}): Promise<TableRenderer> {
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
    return new TableRenderer(pixi, app, options.big ?? false)
  }

  private constructor(pixi: Pixi, app: Application, big: boolean) {
    this.pixi = pixi
    this.app = app
    this.big = big
    this.world = new pixi.Container()
    this.layers = { base: new pixi.Container(), under: new pixi.Container(), top: new pixi.Container() }
    this.world.addChild(this.layers.base, this.layers.under, this.layers.top)
    this.grid = new pixi.Graphics()
    this.tokenLayer = new pixi.Container()
    app.stage.addChild(this.world, this.grid, this.tokenLayer)
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

  /** Las fichas, encima del mapa y de la rejilla, en el orden en que se pintan */
  setTokens(tokens: DrawToken[]) {
    this.tokens = tokens
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
      this.drawTokens([])
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
    // Las imágenes de las fichas también están en uso
    const inUse = new Set([...wanted.values()].map(({ ref }) => scene.tileUrl(ref.level, ref.x, ref.y)))
    for (const token of this.tokens) if (token.image) inUse.add(token.image.url)
    this.evict(inUse)
    this.drawGrid(scene)
    this.drawTokens(this.tokens)
  }

  /** Las fichas, en píxeles de la pantalla: el disco crece con el mapa y los rótulos no */
  private drawTokens(tokens: DrawToken[]) {
    const { view } = this
    const seen = new Set<string>()
    tokens.forEach((token, index) => {
      seen.add(token.id)
      const node = this.nodes.get(token.id) ?? this.makeNode(token.id)
      const r = Math.max(6, token.radius * view.scale)
      const ring = this.big ? 4 : 3
      node.root.position.set(token.x * view.scale + view.x, token.y * view.scale + view.y)
      node.root.alpha = token.hidden ? 0.5 : 1
      node.root.zIndex = index
      const color = FACTION_COLORS[token.faction]
      node.disc.clear()
      if (token.turn)
        node.disc
          .circle(0, 0, r + ring + 9)
          .fill({ color: 0xf2c260, alpha: 0.25 })
          .circle(0, 0, r + ring + 4)
          .fill({ color: 0xf2c260, alpha: 0.95 })
      if (token.selected) node.disc.circle(0, 0, r + ring + 3).fill({ color: 0xffffff, alpha: 0.9 })
      node.disc.circle(0, 0, r + ring / 2).fill(color)
      // El disco, con su luz arriba a la izquierda (como un degradado radial)
      const [light, dark] = token.colors
      node.disc.circle(0, 0, r - ring / 2).fill(dark)
      for (const [k, alpha] of [
        [0.85, 0.35],
        [0.62, 0.45],
        [0.4, 0.55]
      ] as const)
        node.disc.circle(-r * 0.22, -r * 0.27, (r - ring / 2) * k).fill({ color: light, alpha })
      if (token.life !== null) {
        const width = r * 1.3
        const tone = token.life > 0.6 ? 0x5fae8a : token.life > 0.3 ? 0xd9a441 : 0xd0574f
        node.disc
          .roundRect(-width / 2, r - 2, width, 5, 2)
          .fill({ color: 0x000000, alpha: 0.7 })
          .roundRect(-width / 2, r - 2, width * Math.max(0, Math.min(1, token.life)), 5, 2)
          .fill(tone)
      }
      if (token.conditions.length > 0) {
        node.disc
          .circle(-r * 0.75, -r * 0.75, Math.max(5, r * 0.22))
          .fill(0x2a1f3a)
          .stroke({ color: 0x8e7bb0, width: 1 })
      }
      // La imagen, recortada en redondo
      const inner = r - ring / 2
      this.placeImage(node, token, inner)
      // La máscara solo se dibuja con imagen: sin ella se vería como un disco blanco
      node.mask.clear()
      if (node.sprite?.visible) node.mask.circle(0, 0, inner).fill(0xffffff)
      node.initial.visible = !node.sprite?.visible
      node.initial.text = token.initial
      node.initial.style.fontSize = Math.max(8, inner * 0.9)
      // El rótulo debajo, en su placa; en la tele, con su estado en palabras y sus estados
      node.label.text = token.label
      node.label.position.set(0, r + ring + 3)
      const extra = [token.state?.text, ...(this.big ? token.conditions : [])].filter(Boolean).join(' · ')
      node.extra.text = extra
      node.extra.visible = extra.length > 0
      node.extra.style.fill = token.state ? STATE_COLORS[token.state.tone] : 0xd9c8ff
      node.extra.position.set(0, node.label.y + node.label.height + 2)
      node.plate.clear()
      const plate = (text: Text) =>
        node.plate
          .roundRect(text.x - text.width / 2 - 5, text.y - 1, text.width + 10, text.height + 2, 4)
          .fill({ color: 0x0a0a0c, alpha: 0.82 })
      plate(node.label)
      if (node.extra.visible) plate(node.extra)
    })
    this.tokenLayer.sortChildren()
    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue
      node.root.destroy({ children: true })
      this.nodes.delete(id)
    }
  }

  private makeNode(id: string): TokenNode {
    const { pixi } = this
    const root = new pixi.Container()
    const disc = new pixi.Graphics()
    const mask = new pixi.Graphics()
    const style = { fontFamily: 'Barlow Condensed, Barlow, sans-serif', fontWeight: '800' as const, fill: 0xffffff }
    const initial = new pixi.Text({ text: '', style: { ...style, fontSize: 18 } })
    initial.anchor.set(0.5)
    const plate = new pixi.Graphics()
    const label = new pixi.Text({
      text: '',
      style: { fontFamily: 'Barlow, sans-serif', fontWeight: '700', fontSize: this.big ? 16 : 11, fill: 0xffffff }
    })
    label.anchor.set(0.5, 0)
    const extra = new pixi.Text({
      text: '',
      style: { fontFamily: 'Barlow, sans-serif', fontWeight: '700', fontSize: this.big ? 14 : 10, fill: 0xd9c8ff }
    })
    extra.anchor.set(0.5, 0)
    root.addChild(disc, mask, initial, plate, label, extra)
    this.tokenLayer.addChild(root)
    const node = { root, disc, mask, sprite: null, spriteUrl: null, initial, plate, label, extra }
    this.nodes.set(id, node)
    return node
  }

  /** La imagen de la ficha: tapa el círculo (como `cover`), centrada en su encuadre y acercada */
  private placeImage(node: TokenNode, token: DrawToken, inner: number) {
    const image = token.image
    if (!image) {
      if (node.sprite) node.sprite.visible = false
      return
    }
    const texture = this.texture(image.url)
    if (!texture) {
      if (node.sprite) node.sprite.visible = false
      return
    }
    if (!node.sprite || node.spriteUrl !== image.url) {
      node.sprite?.destroy()
      node.sprite = new this.pixi.Sprite(texture)
      node.sprite.mask = node.mask
      node.spriteUrl = image.url
      node.root.addChildAt(node.sprite, 1)
    }
    const { width, height } = texture
    const k = ((2 * inner) / Math.max(1, Math.min(width, height))) * Math.max(0.2, image.zoom)
    node.sprite.visible = true
    node.sprite.scale.set(k)
    node.sprite.position.set(-image.x * width * k, -image.y * height * k)
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
