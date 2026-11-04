/**
 * La tirada en 3D: se simula entera con física antes de enseñarla, y después se cambian los números de cada dado para
 * que la cara que queda arriba sea la que dijo el servidor. Así caen de verdad y siempre en el resultado. Devuelve, por
 * dado, sus números y su recorrido (un fotograma cada 1/60 s), que la bandeja reproduce
 */
import { Body, ContactMaterial, ConvexPolyhedron, Material, Plane, Quaternion, Vec3, World } from 'cannon-es'
import { type DieKind, labelsFor, type Quat, readFace, relabel, solidOf, type Vec } from './solids.ts'

export interface Frame {
  position: Vec
  quaternion: Quat
}

export interface Thrown {
  kind: DieKind
  labels: string[]
  frames: Frame[]
  /** Si se quedó quieto (si no, la bandeja lo deja donde esté) */
  settled: boolean
}

/** La bandeja: el suelo y cuatro paredes, en unidades de la física (un dado mide 1) */
export const TRAY = { halfWidth: 7, halfDepth: 4.5 }

const STEP = 1 / 60
/** Lo que se enseña: como mucho, 2 s de tirada */
export const MAX_FRAMES = 120
/** Lo que se simula: hasta que se paren (casi siempre antes de 2 s; si no, se enseña más deprisa) */
const MAX_STEPS = 360
/** El tamaño de cada dado, para que se vean parecidos (la física y el dibujo usan el mismo) */
const SIZE: Record<DieKind, number> = { 4: 1.1, 6: 0.85, 8: 0.95, 10: 0.95, T: 0.95, 12: 0.95, 20: 1, F: 0.85 }

export const sizeOf = (kind: DieKind) => SIZE[kind]

/** Un azar con semilla (mulberry32): la misma tirada con la misma semilla, para las pruebas */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const wall = (world: World, material: Material, position: Vec3, rotation: Quaternion) => {
  const body = new Body({ mass: 0, material, shape: new Plane() })
  body.position.copy(position)
  body.quaternion.copy(rotation)
  world.addBody(body)
}

const around = (axis: Vec3, angle: number) => new Quaternion().setFromAxisAngle(axis, angle)

export function throwDice(
  dice: readonly { kind: DieKind; label: string }[],
  { seed = Math.floor(Math.random() * 2 ** 31) }: { seed?: number } = {}
): Thrown[] {
  const random = seeded(seed)
  // Valores probados con 30 tiradas de cada dado: casi todos se paran antes de 2 s, y siempre planos
  const world = new World({ gravity: new Vec3(0, -70, 0), allowSleep: true })
  const floor = new Material('suelo')
  const plastic = new Material('dado')
  world.addContactMaterial(new ContactMaterial(floor, plastic, { friction: 0.6, restitution: 0.15 }))
  world.addContactMaterial(new ContactMaterial(plastic, plastic, { friction: 0.3, restitution: 0.2 }))
  const { halfWidth: w, halfDepth: d } = TRAY
  // El suelo mira hacia arriba; las paredes, hacia dentro
  wall(world, floor, new Vec3(0, 0, 0), around(new Vec3(1, 0, 0), -Math.PI / 2))
  wall(world, floor, new Vec3(-w, 0, 0), around(new Vec3(0, 1, 0), Math.PI / 2))
  wall(world, floor, new Vec3(w, 0, 0), around(new Vec3(0, 1, 0), -Math.PI / 2))
  wall(world, floor, new Vec3(0, 0, -d), new Quaternion())
  wall(world, floor, new Vec3(0, 0, d), around(new Vec3(0, 1, 0), Math.PI))

  const bodies = dice.map((die, i) => {
    const shape = solidOf(die.kind)
    const size = SIZE[die.kind]
    const body = new Body({
      mass: 1,
      material: plastic,
      shape: new ConvexPolyhedron({
        vertices: shape.verts.map((v) => new Vec3(v[0] * size, v[1] * size, v[2] * size)),
        faces: shape.faces
      }),
      linearDamping: 0.5,
      angularDamping: 0.7,
      allowSleep: true,
      sleepSpeedLimit: 0.08,
      sleepTimeLimit: 0.15
    })
    // Lanzados desde la derecha hacia el centro, unos detrás de otros, girando
    body.position.set(w - 1.5, 2.2 + (i % 4) * 0.9, (random() - 0.5) * (2 * d - 3))
    body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)
    body.velocity.set(-(9 + random() * 4), 1 + random() * 2, (random() - 0.5) * 4)
    body.angularVelocity.set((random() - 0.5) * 20, (random() - 0.5) * 20, (random() - 0.5) * 20)
    world.addBody(body)
    return body
  })

  const frames: Frame[][] = dice.map(() => [])
  let settled = false
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step(STEP)
    bodies.forEach((body, i) => {
      frames[i]?.push({
        position: [body.position.x, body.position.y, body.position.z],
        quaternion: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w]
      })
    })
    if (bodies.every((body) => body.sleepState === Body.SLEEPING)) {
      settled = true
      break
    }
  }

  // Si tardaron más de 2 s, se enseña más deprisa: los mismos fotogramas para todos, para que no se descompasen
  const total = frames[0]?.length ?? 0
  const shown =
    total > MAX_FRAMES
      ? Array.from({ length: MAX_FRAMES }, (_, k) => Math.round((k * (total - 1)) / (MAX_FRAMES - 1)))
      : null
  // Con todos quietos, los números de cada uno para que arriba quede lo que dijo el servidor
  return dice.map((die, i) => {
    const all = frames[i] ?? []
    const path = shown ? shown.flatMap((k) => (all[k] ? [all[k]] : [])) : all
    const last = path.at(-1)
    const labels = labelsFor(die.kind)
    return {
      kind: die.kind,
      labels: last ? relabel(labels, readFace(die.kind, last.quaternion), die.label) : labels,
      frames: path,
      settled
    }
  })
}
