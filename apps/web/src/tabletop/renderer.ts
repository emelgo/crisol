/**
 * El lienzo de la mesa con PixiJS (ADR-0018 § 9), para la mesa del máster y la tele: el mapa por teselas (las del
 * nivel que toca según el zoom, con las del siguiente debajo mientras llegan y el nivel más pequeño entero al fondo),
 * la rejilla encima, en píxeles de la pantalla, la niebla y el brillo de las luces (una imagen pequeña estirada con
 * suavizado), las formas de los editores (muros, luces, la niebla a mano) y las fichas. Con las herramientas
 * (docs/specs/herramientas-mesa.md): las imágenes sueltas (debajo o encima de las fichas), lo dejado en el mapa
 * (plantillas, dibujos), lo que va en vivo (la medida, el láser) y sus rótulos. PixiJS se carga aparte (import()), solo
 * en la mesa y en la tele
 */
import type { SceneGrid, SceneTiles } from '@crisol/contracts'
import { type Point, type Size, type TilePyramid, type TileRef, tileWorldRect, type Viewport } from '@crisol/tabletop'
import type { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { pyramidOf, screenGridLines, tilesToDraw } from './view.ts'

type Pixi = typeof import('pixi.js')

export interface RendererScene {
  id: string
  width: number
  height: number
  tiles: SceneTiles
  grid: SceneGrid
  /** La dirección de una tesela; null si no se pide (la tele, fuera de lo que ve el grupo) */
  tileUrl: (level: number, x: number, y: number) => string | null
}

/** Una capa de la niebla o del brillo: una imagen RGBA de una celda por píxel, que cubre `cellSize` píxeles del mapa */
export interface FogLayer {
  columns: number
  rows: number
  cellSize: number
  pixels: Uint8ClampedArray<ArrayBuffer>
}

/**
 * Lo que dibujan los editores encima del mapa: los puntos en píxeles del mapa; los grosores y el radio de un punto,
 * en píxeles de la pantalla (no crecen con el zoom). `dash`: largo del trazo y del hueco, en píxeles de la pantalla
 */
export type OverlayShape =
  | {
      kind: 'line'
      a: Point
      b: Point
      color: number
      width: number
      alpha?: number
      dash?: readonly [number, number]
      /** El grosor, en píxeles del mapa (crece con el zoom) */
      scaled?: boolean
    }
  | { kind: 'dot'; at: Point; color: number; radius: number; stroke?: number; alpha?: number }
  | {
      kind: 'circle'
      at: Point
      /** En píxeles del mapa */
      radius: number
      color: number
      width: number
      fill?: number
      dash?: readonly [number, number]
    }
  | {
      kind: 'polygon'
      points: readonly Point[]
      color: number
      width: number
      alpha?: number
      fill?: number
      closed?: boolean
      dash?: readonly [number, number]
      scaled?: boolean
      /** El color del relleno, si no es el del trazo */
      fillColor?: number
    }

/** Las capas de formas: lo dejado en el mapa (debajo de las fichas), los editores y lo que va en vivo (encima) */
export type ShapeLayer = 'marks' | 'editor' | 'live'

/** Un rótulo sobre el mapa (una medida): en un punto del mapa, con su letra fija en la pantalla */
export interface MapLabel {
  at: Point
  text: string
  /** El total de una medida, en oro lleno */
  strong?: boolean
  /** Su color (por defecto, el oro de las medidas) */
  color?: number
  /** Cuánto se aparta de su punto, en píxeles de la pantalla (para no tapar la ficha) */
  offset?: { x: number; y: number }
}

/** Una imagen suelta en el mapa: su centro, su tamaño y su giro en píxeles del mapa */
export interface MapImageDraw {
  id: string
  url: string
  x: number
  y: number
  width: number
  height: number
  /** En grados */
  rotation: number
  above: boolean
  alpha: number
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
  /** Queda dentro de una plantilla: un aro naranja a trazos */
  target?: boolean
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
  /** La niebla y el brillo, con la misma transformación que el mapa */
  private readonly fogLayer: Container
  private fog: { layer: FogLayer | null; sprite: Sprite | null; canvas: HTMLCanvasElement | null } = {
    layer: null,
    sprite: null,
    canvas: null
  }
  private glow: { layer: FogLayer | null; sprite: Sprite | null; canvas: HTMLCanvasElement | null } = {
    layer: null,
    sprite: null,
    canvas: null
  }
  private readonly shapeLayers: Record<ShapeLayer, Graphics>
  private shapes: Record<ShapeLayer, readonly OverlayShape[]> = { marks: [], editor: [], live: [] }
  private readonly labelLayer: Container
  private labels: readonly MapLabel[] = []
  /** Las imágenes sueltas: debajo de la rejilla y encima de las fichas */
  private readonly imageLayers: { below: Container; above: Container }
  private images: readonly MapImageDraw[] = []
  private readonly imageSprites = new Map<string, { sprite: Sprite; url: string }>()
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
    this.imageLayers = { below: new pixi.Container(), above: new pixi.Container() }
    this.world.addChild(this.imageLayers.below)
    this.grid = new pixi.Graphics()
    this.fogLayer = new pixi.Container()
    this.shapeLayers = { marks: new pixi.Graphics(), editor: new pixi.Graphics(), live: new pixi.Graphics() }
    this.tokenLayer = new pixi.Container()
    this.labelLayer = new pixi.Container()
    app.stage.addChild(
      this.world,
      this.grid,
      this.fogLayer,
      this.shapeLayers.marks,
      this.shapeLayers.editor,
      this.tokenLayer,
      this.imageLayers.above,
      this.shapeLayers.live,
      this.labelLayer
    )
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

  /** La niebla (null: sin niebla) */
  setFog(layer: FogLayer | null) {
    this.fog = this.placeLayer(this.fog, layer, false)
    this.schedule()
  }

  /** El brillo de las luces, que se suma a lo de debajo (null: sin luces) */
  setGlow(layer: FogLayer | null) {
    this.glow = this.placeLayer(this.glow, layer, true)
    this.schedule()
  }

  /** Lo que dibujan los editores, encima de la niebla y debajo de las fichas (o en otra capa) */
  setShapes(shapes: readonly OverlayShape[], layer: ShapeLayer = 'editor') {
    this.shapes = { ...this.shapes, [layer]: shapes }
    this.schedule()
  }

  /** Los rótulos de las medidas, encima de todo */
  setLabels(labels: readonly MapLabel[]) {
    this.labels = labels
    this.schedule()
  }

  /** Las imágenes sueltas del mapa */
  setImages(images: readonly MapImageDraw[]) {
    this.images = images
    this.schedule()
  }

  /**
   * Una captura pequeña de lo que se ve (el mapa entero encuadrado, sin la interfaz), en data URL de hasta `maxBytes`:
   * para la miniatura de una instantánea. null si no se puede
   */
  async snapshot(maxSide: number, maxBytes: number): Promise<string | null> {
    if (this.destroyed || !this.scene) return null
    this.layout()
    const source = this.app.renderer.extract.canvas({ target: this.app.stage }) as HTMLCanvasElement
    const k = Math.min(1, maxSide / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * k))
    canvas.height = Math.max(1, Math.round(source.height * k))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.8, 0.6, 0.4, 0.25]) {
      const url = canvas.toDataURL('image/webp', quality)
      if (url.length <= maxBytes) return url
    }
    return null
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
    this.imageLayers.above.position.set(view.x, view.y)
    this.imageLayers.above.scale.set(view.scale)
    this.fogLayer.position.set(view.x, view.y)
    this.fogLayer.scale.set(view.scale)
    this.grid.clear()
    if (!scene || !pyramid || this.size.width === 0) {
      for (const sprite of this.sprites.values()) sprite.destroy()
      this.sprites.clear()
      this.fogLayer.visible = false
      for (const layer of Object.values(this.shapeLayers)) layer.clear()
      for (const child of this.labelLayer.removeChildren()) child.destroy()
      this.drawImages([])
      this.drawTokens([])
      return
    }
    this.fogLayer.visible = true
    this.tick++
    const draw = tilesToDraw(pyramid, view, this.size, window.devicePixelRatio || 1)
    // Por su dirección: si cambia (la tele, al explorar), es otra tesela
    const wanted = new Map<string, { ref: TileRef; layer: Container }>()
    const want = (refs: TileRef[], layer: Container) => {
      for (const ref of refs) {
        const url = scene.tileUrl(ref.level, ref.x, ref.y)
        if (url) wanted.set(url, { ref, layer })
      }
    }
    want(draw.base, this.layers.base)
    want(draw.under, this.layers.under)
    want(draw.tiles, this.layers.top)
    // Las que ya no hacen falta se quitan (su textura se queda en la caché)
    for (const [key, sprite] of this.sprites) {
      if (wanted.has(key)) continue
      sprite.destroy()
      this.sprites.delete(key)
    }
    for (const [key, { ref, layer }] of wanted) {
      if (this.sprites.has(key)) continue
      const texture = this.texture(key)
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
    // Las imágenes de las fichas y las sueltas también están en uso
    const inUse = new Set(wanted.keys())
    for (const token of this.tokens) if (token.image) inUse.add(token.image.url)
    for (const image of this.images) inUse.add(image.url)
    this.evict(inUse)
    this.drawGrid(scene)
    this.drawImages(this.images)
    for (const layer of ['marks', 'editor', 'live'] as const)
      this.drawShapes(this.shapeLayers[layer], this.shapes[layer])
    this.drawTokens(this.tokens)
    this.drawLabels()
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
      if (token.target) {
        // A trazos, por fuera del borde
        const radius = r + ring + 6
        const dashes = Math.max(10, Math.round(radius / 3))
        for (let i = 0; i < dashes; i++) {
          const from = (i / dashes) * Math.PI * 2
          const to = from + (Math.PI / dashes) * 1.1
          node.disc.moveTo(radius * Math.cos(from), radius * Math.sin(from)).arc(0, 0, radius, from, to)
        }
        node.disc.stroke({ width: 2.5, color: 0xff8a4c, alpha: 0.95 })
      }
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
      // Del ancho de la ficha (parte en líneas): los de fichas vecinas no se juntan («Sin heridasSin heridas»)
      node.extra.style.wordWrapWidth = Math.max(2 * r, 48)
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
      style: {
        fontFamily: 'Barlow, sans-serif',
        fontWeight: '700',
        fontSize: this.big ? 14 : 10,
        fill: 0xd9c8ff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 80
      }
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

  /** Pone (o quita) una capa de la niebla: un lienzo pequeño que PixiJS estira con suavizado */
  private placeLayer(
    current: { layer: FogLayer | null; sprite: Sprite | null; canvas: HTMLCanvasElement | null },
    layer: FogLayer | null,
    add: boolean
  ) {
    if (!layer || layer.columns <= 0 || layer.rows <= 0) {
      current.sprite?.destroy(true)
      return { layer: null, sprite: null, canvas: null }
    }
    const same = current.canvas && current.canvas.width === layer.columns && current.canvas.height === layer.rows
    const canvas = same ? (current.canvas as HTMLCanvasElement) : document.createElement('canvas')
    canvas.width = layer.columns
    canvas.height = layer.rows
    canvas.getContext('2d')?.putImageData(new ImageData(layer.pixels, layer.columns, layer.rows), 0, 0)
    let sprite = current.sprite
    if (same && sprite) sprite.texture.source.update()
    else {
      sprite?.destroy(true)
      const texture = this.pixi.Texture.from(canvas)
      texture.source.scaleMode = 'linear'
      sprite = new this.pixi.Sprite(texture)
      if (add) sprite.blendMode = 'add'
      this.fogLayer.addChild(sprite)
      // La niebla, debajo del brillo
      if (!add) this.fogLayer.setChildIndex(sprite, 0)
    }
    sprite.position.set(0, 0)
    sprite.width = layer.columns * layer.cellSize
    sprite.height = layer.rows * layer.cellSize
    return { layer, sprite, canvas }
  }

  /** Las imágenes sueltas: cada una con su sprite, centrada, con su tamaño y su giro */
  private drawImages(images: readonly MapImageDraw[]) {
    const seen = new Set<string>()
    for (const image of images) {
      const texture = this.texture(image.url)
      if (!texture) continue
      seen.add(image.id)
      let entry = this.imageSprites.get(image.id)
      if (!entry || entry.url !== image.url) {
        entry?.sprite.destroy()
        entry = { sprite: new this.pixi.Sprite(texture), url: image.url }
        entry.sprite.anchor.set(0.5)
        this.imageSprites.set(image.id, entry)
      }
      const { sprite } = entry
      const layer = image.above ? this.imageLayers.above : this.imageLayers.below
      if (sprite.parent !== layer) layer.addChild(sprite)
      sprite.position.set(image.x, image.y)
      sprite.width = image.width
      sprite.height = image.height
      sprite.rotation = (image.rotation * Math.PI) / 180
      sprite.alpha = image.alpha
    }
    for (const [id, entry] of this.imageSprites) {
      if (seen.has(id)) continue
      entry.sprite.destroy()
      this.imageSprites.delete(id)
    }
  }

  /** Los rótulos, en píxeles de la pantalla: una placa oscura con borde de oro (o llena, el total) */
  private drawLabels() {
    for (const child of this.labelLayer.removeChildren()) child.destroy({ children: true })
    const { x: vx, y: vy, scale } = this.view
    for (const label of this.labels) {
      const color = label.color ?? 0xf2c260
      const text = new this.pixi.Text({
        text: label.text,
        style: {
          fontFamily: 'Barlow, sans-serif',
          fontWeight: '800',
          fontSize: this.big ? 18 : 14,
          fill: label.strong ? 0x1b1608 : color
        }
      })
      text.anchor.set(0.5)
      const plate = new this.pixi.Graphics()
      const w = text.width + 16
      const h = text.height + 4
      plate.roundRect(-w / 2, -h / 2, w, h, 6).fill({ color: label.strong ? color : 0x111214, alpha: 0.95 })
      if (!label.strong) plate.stroke({ width: 1, color })
      const node = new this.pixi.Container()
      node.addChild(plate, text)
      node.position.set(
        Math.round(label.at.x * scale + vx + (label.offset?.x ?? 0)),
        Math.round(label.at.y * scale + vy + (label.offset?.y ?? 0))
      )
      this.labelLayer.addChild(node)
    }
  }

  /** Unas formas, en píxeles de la pantalla */
  private drawShapes(g: Graphics, shapes: readonly OverlayShape[]) {
    g.clear()
    const { x: vx, y: vy, scale } = this.view
    const sx = (p: Point) => p.x * scale + vx
    const sy = (p: Point) => p.y * scale + vy
    const stroke = (
      points: Point[],
      closed: boolean,
      color: number,
      width: number,
      dash?: readonly [number, number],
      alpha = 1
    ) => {
      const screen = points.map((p) => ({ x: sx(p), y: sy(p) }))
      if (closed && screen.length > 2) screen.push(screen[0] as Point)
      if (!dash) {
        for (const [i, p] of screen.entries()) {
          if (i === 0) g.moveTo(p.x, p.y)
          else g.lineTo(p.x, p.y)
        }
      } else {
        // A trazos a lo largo de toda la línea (el patrón sigue de un tramo al siguiente)
        let on = true
        let left = dash[0]
        for (let i = 1; i < screen.length; i++) {
          const a = screen[i - 1] as Point
          const b = screen[i] as Point
          const length = Math.hypot(b.x - a.x, b.y - a.y)
          let at = 0
          while (at < length) {
            const step = Math.min(left, length - at)
            if (on) {
              const k0 = at / length
              const k1 = (at + step) / length
              g.moveTo(a.x + (b.x - a.x) * k0, a.y + (b.y - a.y) * k0).lineTo(
                a.x + (b.x - a.x) * k1,
                a.y + (b.y - a.y) * k1
              )
            }
            at += step
            left -= step
            if (left <= 1e-6) {
              on = !on
              left = on ? dash[0] : dash[1]
            }
          }
        }
      }
      g.stroke({ width, color, alpha, cap: 'round', join: 'round' })
    }
    const widthOf = (shape: { width: number; scaled?: boolean }) =>
      shape.scaled ? Math.max(0.5, shape.width * scale) : shape.width
    for (const shape of shapes) {
      if (shape.kind === 'line') stroke([shape.a, shape.b], false, shape.color, widthOf(shape), shape.dash, shape.alpha)
      else if (shape.kind === 'dot') {
        g.circle(sx(shape.at), sy(shape.at), shape.radius).fill({ color: shape.color, alpha: shape.alpha ?? 1 })
        if (shape.stroke !== undefined) g.stroke({ width: 2, color: shape.stroke })
      } else if (shape.kind === 'circle') {
        const sides = Math.max(24, Math.min(160, Math.round(shape.radius * scale * 0.4)))
        const points = Array.from({ length: sides }, (_, i) => ({
          x: shape.at.x + shape.radius * Math.cos((i / sides) * Math.PI * 2),
          y: shape.at.y + shape.radius * Math.sin((i / sides) * Math.PI * 2)
        }))
        if (shape.fill) g.poly(points.flatMap((p) => [sx(p), sy(p)])).fill({ color: shape.color, alpha: shape.fill })
        stroke(points, true, shape.color, shape.width, shape.dash)
      } else {
        if (shape.fill && shape.points.length > 2)
          g.poly(shape.points.flatMap((p) => [sx(p), sy(p)])).fill({
            color: shape.fillColor ?? shape.color,
            alpha: shape.fill
          })
        if (shape.width > 0)
          stroke([...shape.points], shape.closed ?? false, shape.color, widthOf(shape), shape.dash, shape.alpha)
      }
    }
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
