/**
 * La bandeja 3D, con three.js: dibuja cada dado con sus números (los que dejó la tirada simulada) y reproduce su
 * recorrido. Los descartados quedan tenues, el crítico brilla y, al rato, todo se desvanece. Se carga aparte: solo
 * cuando se tira por primera vez
 */
import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer
} from 'three'
import type { FallingDie } from '../falling.ts'
import { type DieKind, faceNormal, type Solid, solidOf, type Vec } from './solids.ts'
import { sizeOf, type Thrown, TRAY, throwDice } from './throw.ts'

export interface DiceScene {
  play(dice: readonly FallingDie[], color: string, onLanded: () => void): void
  dispose(): void
}

const FRAME_MS = 1000 / 60
/** Cuánto se quedan quietos a la vista y cuánto tardan en irse */
const STAY_MS = 2200
const FADE_MS = 600

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

/** El dado como malla: cada cara, con su textura; las coordenadas de textura, centradas en la cara */
function dieMesh(kind: DieKind, labels: readonly string[], color: string) {
  const solid: Solid = solidOf(kind)
  const scale = sizeOf(kind)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const geometry = new BufferGeometry()
  const materials: MeshStandardMaterial[] = []
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
    const marks =
      kind === 4
        ? face.map((vertex) => {
            const opposite = solid.faces.findIndex((other) => !other.includes(vertex))
            const [cu, cv] = uv(solid.verts[vertex] ?? center)
            return { text: labels[opposite] ?? '', u: 0.5 + (cu - 0.5) * 0.62, v: 0.5 + (cv - 0.5) * 0.62 }
          })
        : [{ text: labels[f] ?? '', u: 0.5, v: 0.5 }]
    materials.push(
      new MeshStandardMaterial({
        map: faceTexture(color, marks, kind === 4 || kind === 'T' || kind === 20),
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        flatShading: true
      })
    )
  })
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return { mesh: new Mesh(geometry, materials), materials }
}

interface Playing {
  mesh: Mesh
  materials: MeshStandardMaterial[]
  thrown: Thrown
  die: FallingDie
  start: number
}

export function createScene(canvas: HTMLCanvasElement): DiceScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.2))
  const sun = new DirectionalLight(0xffffff, 1.8)
  sun.position.set(-4, 12, 6)
  scene.add(sun)
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

  let playing: Playing[] = []
  let raf = 0
  const gold = new Color('#f2c260')
  const draw = (now: number) => {
    playing = playing.filter((p) => {
      const frames = p.thrown.frames
      const elapsed = now - p.start
      const index = Math.min(frames.length - 1, Math.floor(elapsed / FRAME_MS))
      const frame = frames[index]
      if (frame) {
        p.mesh.position.set(frame.position[0], frame.position[1], frame.position[2])
        p.mesh.quaternion.set(frame.quaternion[0], frame.quaternion[1], frame.quaternion[2], frame.quaternion[3])
      }
      const landedFor = elapsed - frames.length * FRAME_MS
      const fade = landedFor > STAY_MS ? 1 - (landedFor - STAY_MS) / FADE_MS : 1
      for (const material of p.materials) {
        material.opacity = Math.max(0, fade) * (landedFor > 0 && !p.die.kept ? 0.45 : 1)
        if (p.die.critical && landedFor > 0) {
          material.emissive.copy(gold)
          material.emissiveIntensity = 0.35 + 0.25 * Math.sin(now / 160)
        }
      }
      if (fade > 0) return true
      scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      for (const material of p.materials) {
        material.map?.dispose()
        material.dispose()
      }
      return false
    })
    renderer.render(scene, camera)
    raf = playing.length > 0 ? requestAnimationFrame(draw) : 0
  }

  return {
    play(dice, color, onLanded) {
      const thrown = throwDice(dice)
      const start = performance.now()
      thrown.forEach((t, i) => {
        const die = dice[i]
        if (!die) return
        const { mesh, materials } = dieMesh(t.kind, t.labels, color)
        scene.add(mesh)
        playing.push({ mesh, materials, thrown: t, die, start })
      })
      const longest = Math.max(...thrown.map((t) => t.frames.length))
      window.setTimeout(onLanded, longest * FRAME_MS)
      if (!raf) raf = requestAnimationFrame(draw)
    },
    dispose() {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }
}
