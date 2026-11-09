/**
 * La bandeja 3D, con three.js: dibuja cada dado con sus números (los que dejó la tirada simulada) y reproduce su
 * recorrido. Los descartados quedan tenues, el crítico brilla y, al rato, todo se desvanece. Se carga aparte: solo
 * cuando se tira por primera vez
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer
} from 'three'
import type { FallingDie } from '../falling.ts'
import { playbackRate } from './playback.ts'
import { simulator } from './simulate.ts'
import { type DieKind, faceNormal, type Solid, sizeOf, solidOf, TRAY, type Vec } from './solids.ts'
import type { Thrown } from './throw.ts'

export interface DiceScene {
  play(dice: readonly FallingDie[], color: string, onLanded: () => void): void
  dispose(): void
}

const FRAME_MS = 1000 / 60
/** Cuánto se quedan quietos a la vista y cuánto tardan en irse */
const STAY_MS = 2200
const FADE_MS = 600
/** Como mucho, tantos dados a la vez: si se tira más deprisa, los más viejos se van antes */
const MAX_ON_SCREEN = 60

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Blanco o casi negro, lo que se lea mejor sobre el color del dado */
function inkFor(color: string) {
  const n = Number.parseInt(color.slice(1), 16)
  const light = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return light > 0.6 ? '#1c1c1f' : '#ffffff'
}

/** La textura de una cara: el color del dado y su número (en el d4, los de sus tres vértices, junto a cada esquina) */
function faceTexture(color: string, marks: readonly { text: string; u: number; v: number }[], small: boolean) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = inkFor(color)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${small ? 34 : 56}px "Barlow Condensed", sans-serif`
    for (const mark of marks) {
      // El 6 y el 9, con su raya, para no confundirlos
      const text = mark.text === '6' || mark.text === '9' ? `${mark.text}.` : mark.text
      ctx.fillText(text, mark.u * size, (1 - mark.v) * size)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

interface Mark {
  /** De qué cara es el número: la suya o, en el d4, la de enfrente de cada vértice */
  face: number
  u: number
  v: number
}

/** La forma de un tipo de dado (igual para todos los de ese tipo) y dónde va el número en cada cara */
interface Shape {
  geometry: BufferGeometry
  marks: Mark[][]
}

/** Cada cara, con su grupo de material; las coordenadas de textura, centradas en la cara */
function shapeOf(kind: DieKind): Shape {
  const solid: Solid = solidOf(kind)
  const scale = sizeOf(kind)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const geometry = new BufferGeometry()
  const marks: Mark[][] = []
  let start = 0
  solid.faces.forEach((face, f) => {
    const pts = face.map((i) => solid.verts[i] ?? ([0, 0, 0] as Vec))
    const center = pts.reduce<Vec>(
      (c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length, c[2] + p[2] / pts.length],
      [0, 0, 0]
    )
    const n = faceNormal(solid, face)
    const u = norm(sub(pts[0] ?? center, center))
    const w = cross(n, u)
    const extent = Math.max(...pts.map((p) => Math.hypot(dot(sub(p, center), u), dot(sub(p, center), w)))) * 2.2
    const uv = (p: Vec): [number, number] => [
      0.5 + dot(sub(p, center), u) / extent,
      0.5 + dot(sub(p, center), w) / extent
    ]
    for (let k = 1; k < pts.length - 1; k++) {
      for (const p of [pts[0], pts[k], pts[k + 1]] as Vec[]) {
        positions.push(p[0] * scale, p[1] * scale, p[2] * scale)
        normals.push(n[0], n[1], n[2])
        uvs.push(...uv(p))
      }
    }
    const count = (pts.length - 2) * 3
    geometry.addGroup(start, count, f)
    start += count
    // En el d4 se lee el vértice de arriba: cada esquina lleva el número de la cara de enfrente
    marks.push(
      kind === 4
        ? face.map((vertex) => {
            const [cu, cv] = uv(solid.verts[vertex] ?? center)
            return {
              face: solid.faces.findIndex((other) => !other.includes(vertex)),
              u: 0.5 + (cu - 0.5) * 0.62,
              v: 0.5 + (cv - 0.5) * 0.62
            }
          })
        : [{ face: f, u: 0.5, v: 0.5 }]
    )
  })
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return { geometry, marks }
}

/** Una tirada a la vista: sus dados y las texturas que comparten (diez d6 del mismo color, seis texturas) */
interface Throw {
  dice: { mesh: Mesh; materials: MeshStandardMaterial[]; thrown: Thrown; die: FallingDie }[]
  textures: CanvasTexture[]
  start: number
  /** Todos sus dados tienen los mismos fotogramas */
  frames: number
  /** A qué ritmo se reproduce (1, o algo más si la tirada fue larga) y cuánto dura en pantalla, en ms */
  rate: number
  duration: number
}

export function createScene(canvas: HTMLCanvasElement): DiceScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Como en el Crisol antiguo: tono de cine y sombras suaves bajo los dados (se ven apoyados, no flotando)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.1))
  const sun = new DirectionalLight(0xffffff, 1.9)
  sun.position.set(-4, 12, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  Object.assign(sun.shadow.camera, {
    left: -TRAY.halfWidth - 2,
    right: TRAY.halfWidth + 2,
    top: TRAY.halfDepth + 2,
    bottom: -TRAY.halfDepth - 2,
    near: 0.5,
    far: 40
  })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)
  // El tapete: invisible, solo recoge las sombras
  const floor = new Mesh(new PlaneGeometry(200, 200), new ShadowMaterial({ color: 0x000000, opacity: 0.38 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  // Desde arriba y un poco de lado, con toda la bandeja a la vista
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 20, 7)
  camera.lookAt(0, 0, 0)
  const resize = () => {
    const width = canvas.clientWidth || 1
    const height = canvas.clientHeight || 1
    renderer.setSize(width, height, false)
    const aspect = width / height
    const halfHeight = Math.max(TRAY.halfDepth + 1, (TRAY.halfWidth + 1) / aspect)
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const shapes = new Map<DieKind, Shape>()
  const shape = (kind: DieKind) => {
    let found = shapes.get(kind)
    if (!found) {
      found = shapeOf(kind)
      shapes.set(kind, found)
    }
    return found
  }
  const physics = simulator()
  let throws: Throw[] = []
  let raf = 0
  let disposed = false
  const gold = new Color('#f2c260')

  const free = (t: Throw) => {
    for (const { mesh, materials } of t.dice) {
      scene.remove(mesh)
      for (const material of materials) material.dispose()
    }
    for (const texture of t.textures) texture.dispose()
  }

  // Entre dos fotogramas de la física, la posición y el giro se mezclan: en cada refresco de la pantalla (60, 120 o
  // 144 por segundo), donde toca de verdad. Sin eso, saltaba de fotograma en fotograma y se veía a tirones
  const qa = new Quaternion()
  const qb = new Quaternion()
  const draw = (now: number) => {
    throws = throws.filter((t) => {
      const elapsed = now - t.start
      const at = Math.min(t.frames - 1, (elapsed / FRAME_MS) * t.rate)
      const a = Math.floor(at)
      const b = Math.min(t.frames - 1, a + 1)
      const k = at - a
      const landedFor = elapsed - t.duration
      const fade = landedFor > STAY_MS ? 1 - (landedFor - STAY_MS) / FADE_MS : 1
      for (const { mesh, materials, thrown, die } of t.dice) {
        const from = thrown.frames[a]
        const to = thrown.frames[b] ?? from
        if (from && to) {
          mesh.position.set(
            from.position[0] + (to.position[0] - from.position[0]) * k,
            from.position[1] + (to.position[1] - from.position[1]) * k,
            from.position[2] + (to.position[2] - from.position[2]) * k
          )
          qa.set(from.quaternion[0], from.quaternion[1], from.quaternion[2], from.quaternion[3])
          qb.set(to.quaternion[0], to.quaternion[1], to.quaternion[2], to.quaternion[3])
          mesh.quaternion.slerpQuaternions(qa, qb, k)
        }
        for (const material of materials) {
          material.opacity = Math.max(0, fade) * (landedFor > 0 && !die.kept ? 0.45 : 1)
          if (die.critical && landedFor > 0) {
            material.emissive.copy(gold)
            material.emissiveIntensity = 0.35 + 0.25 * Math.sin(now / 160)
          }
        }
      }
      if (fade > 0) return true
      free(t)
      return false
    })
    renderer.render(scene, camera)
    raf = throws.length > 0 ? requestAnimationFrame(draw) : 0
  }

  const show = (thrown: Thrown[], dice: readonly FallingDie[], color: string) => {
    // Las texturas de esta tirada, una por número distinto
    const textures = new Map<string, CanvasTexture>()
    const texture = (marks: { text: string; u: number; v: number }[], small: boolean) => {
      const key = `${small}|${marks.map((m) => `${m.text}@${m.u.toFixed(3)},${m.v.toFixed(3)}`).join(';')}`
      let found = textures.get(key)
      if (!found) {
        found = faceTexture(color, marks, small)
        textures.set(key, found)
      }
      return found
    }
    const frames = thrown[0]?.frames.length ?? 0
    const rate = playbackRate(frames)
    const t: Throw = {
      dice: [],
      textures: [],
      start: performance.now(),
      frames,
      rate,
      duration: (Math.max(0, frames - 1) / rate) * FRAME_MS
    }
    thrown.forEach((one, i) => {
      const die = dice[i]
      if (!die) return
      const { geometry, marks } = shape(one.kind)
      const small = one.kind === 4 || one.kind === 'T' || one.kind === 20
      const materials = marks.map(
        (face) =>
          new MeshStandardMaterial({
            map: texture(
              face.map((m) => ({ text: one.labels[m.face] ?? '', u: m.u, v: m.v })),
              small
            ),
            roughness: 0.45,
            metalness: 0.05,
            transparent: true,
            flatShading: true
          })
      )
      const mesh = new Mesh(geometry, materials)
      mesh.castShadow = true
      scene.add(mesh)
      t.dice.push({ mesh, materials, thrown: one, die })
    })
    t.textures = [...textures.values()]
    // Si hay demasiados a la vista, se van los más viejos
    let onScreen = throws.reduce((n, other) => n + other.dice.length, t.dice.length)
    while (onScreen > MAX_ON_SCREEN && throws.length > 0) {
      const oldest = throws.shift()
      if (oldest) {
        onScreen -= oldest.dice.length
        free(oldest)
      }
    }
    throws.push(t)
    if (!raf) raf = requestAnimationFrame(draw)
    return t.duration
  }

  return {
    play(dice, color, onLanded) {
      void physics.run(dice.map((d) => ({ kind: d.kind, label: d.label }))).then((thrown) => {
        if (disposed) return
        window.setTimeout(onLanded, show(thrown, dice, color))
      })
    },
    dispose() {
      disposed = true
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
      physics.stop()
      for (const t of throws) free(t)
      throws = []
      for (const { geometry } of shapes.values()) geometry.dispose()
      floor.geometry.dispose()
      floor.material.dispose()
      shapes.clear()
      renderer.dispose()
    }
  }
}
