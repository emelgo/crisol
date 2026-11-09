/**
 * La tirada en 3D: se simula entera con física antes de enseñarla, y después se cambian los números de cada dado para
 * que la cara que queda arriba sea la que dijo el servidor. Así caen de verdad y siempre en el resultado. Devuelve, por
 * dado, sus números y su recorrido (un fotograma cada 1/60 s), que la bandeja reproduce
 */
import { Body, ContactMaterial, ConvexPolyhedron, Material, Plane, Quaternion, Vec3, World } from 'cannon-es'
import { type DieKind, labelsFor, type Quat, readFace, relabel, sizeOf, solidOf, TRAY, type Vec } from './solids.ts'

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

/** Pasos de 1/120 s (más finos que los fotogramas: choques más limpios); se graba uno de cada dos */
const STEP = 1 / 120
const SUBSTEPS = 2

export { MAX_FRAMES, playbackRate } from './playback.ts'

/** Lo que se simula: hasta que se paren (casi siempre antes de 2,5 s; si no, se enseña más deprisa) */
const MAX_STEPS = 720
/**
 * La física de la tirada, como en el Crisol antiguo (packages/dice3d, que iba «perfecto»): dados macizos que salen bajos
 * y con algo de arco, rodando hacia donde van (no girando como peonzas), que se agarran al tapete (vuelcan unas pocas
 * veces en vez de patinar) y, ya casi parados, se asientan de golpe
 */
export const PHYSICS = {
  gravity: 62,
  floor: { friction: 0.9, restitution: 0.1 },
  walls: { friction: 0.14, restitution: 0.3 },
  dice: { friction: 0.2, restitution: 0.24 },
  linearDamping: 0.2,
  /** Algo más de freno al giro que al avance (resistencia a rodar) */
  angularDamping: 0.45,
  /** Por debajo de estas velocidades se frena mucho más: se asienta sin temblar ni arrastrarse */
  slow: { speed: 0.6, spin: 1.2, damping: 0.9 },
  sleepSpeed: 0.1
}

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
  const between = (min: number, max: number) => min + random() * (max - min)
  // Probados con cientos de tiradas de cada dado: todos se paran, y siempre planos
  const world = new World({ gravity: new Vec3(0, -PHYSICS.gravity, 0), allowSleep: true })
  const floor = new Material('suelo')
  const walls = new Material('pared')
  const plastic = new Material('dado')
  world.addContactMaterial(new ContactMaterial(floor, plastic, PHYSICS.floor))
  world.addContactMaterial(new ContactMaterial(walls, plastic, PHYSICS.walls))
  world.addContactMaterial(new ContactMaterial(plastic, plastic, PHYSICS.dice))
  const { halfWidth: w, halfDepth: d } = TRAY
  // El suelo mira hacia arriba; las paredes, hacia dentro
  wall(world, floor, new Vec3(0, 0, 0), around(new Vec3(1, 0, 0), -Math.PI / 2))
  wall(world, walls, new Vec3(-w, 0, 0), around(new Vec3(0, 1, 0), Math.PI / 2))
  wall(world, walls, new Vec3(w, 0, 0), around(new Vec3(0, 1, 0), -Math.PI / 2))
  wall(world, walls, new Vec3(0, 0, -d), new Quaternion())
  wall(world, walls, new Vec3(0, 0, d), around(new Vec3(0, 1, 0), Math.PI))

  // Apuntan a un punto de la zona central (no siempre el centro); cada dado, por su carril
  const targetX = between(-w * 0.35, w * 0.15)
  const targetZ = between(-d * 0.3, d * 0.3)
  const bodies = dice.map((die, i) => {
    const shape = solidOf(die.kind)
    const size = sizeOf(die.kind)
    const vertices = shape.verts.map((v) => new Vec3(v[0] * size, v[1] * size, v[2] * size))
    const radius = Math.max(...vertices.map((v) => v.length()))
    const body = new Body({
      mass: 1,
      material: plastic,
      shape: new ConvexPolyhedron({ vertices, faces: shape.faces }),
      linearDamping: PHYSICS.linearDamping,
      angularDamping: PHYSICS.angularDamping,
      allowSleep: true,
      sleepSpeedLimit: PHYSICS.sleepSpeed,
      sleepTimeLimit: 0.2
    })
    // Desde la derecha, bajos y con algo de arco, como desde la mano
    const lane = (i - (dice.length - 1) / 2) * 1.6 + between(-0.3, 0.3)
    const x = w - 1.6 - Math.floor(i / 4) * 1.2
    const z = Math.max(-d + 1.2, Math.min(d - 1.2, lane * 0.6 + between(-0.4, 0.4)))
    body.position.set(x, 1.4 + between(0, 1.5), z)
    body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)
    const toX = targetX - x
    const toZ = targetZ + lane * 0.5 - z
    const length = Math.hypot(toX, toZ) || 1
    const speed = between(11, 15)
    const vx = (toX / length) * speed
    const vz = (toZ / length) * speed
    body.velocity.set(vx, between(4, 7), vz)
    // Rodando hacia donde va (eje = arriba × dirección), casi al ritmo de rodar sin resbalar, con un poco de giro al
    // azar: de lado o como una peonza patinaría sobre el tapete en vez de rodar
    const axisLength = Math.hypot(vz, vx) || 1
    const roll = Math.min(45, (speed / radius) * between(0.85, 1))
    const extra = () => between(-1, 1) * between(2, 5)
    body.angularVelocity.set((vz / axisLength) * roll + extra(), extra() * 0.5, (-vx / axisLength) * roll + extra())
    world.addBody(body)
    return body
  })

  const frames: Frame[][] = dice.map(() => [])
  let settled = false
  // Quieto de verdad: un cuarto de segundo casi sin moverse (la física a veces no lo duerme, apoyado en una pared)
  const still = bodies.map(() => 0)
  for (let step = 0; step < MAX_STEPS; step++) {
    // Ya casi parado, se frena mucho más: se asienta de golpe, sin temblar ni arrastrarse
    for (const body of bodies) {
      const slow = body.velocity.length() < PHYSICS.slow.speed && body.angularVelocity.length() < PHYSICS.slow.spin
      // Pasados 3 s, el que aún tiembla (apoyado en otro o en una pared) se frena del todo
      const late = step * STEP > 3
      body.linearDamping = slow || late ? PHYSICS.slow.damping : PHYSICS.linearDamping
      body.angularDamping = slow || late ? PHYSICS.slow.damping : PHYSICS.angularDamping
    }
    world.step(STEP)
    if (step % SUBSTEPS !== SUBSTEPS - 1) continue
    bodies.forEach((body, i) => {
      frames[i]?.push({
        position: [body.position.x, body.position.y, body.position.z],
        quaternion: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w]
      })
    })
    bodies.forEach((body, i) => {
      const resting = body.velocity.length() < 0.05 && body.angularVelocity.length() < 0.1
      still[i] = resting || body.sleepState === Body.SLEEPING ? (still[i] ?? 0) + STEP * SUBSTEPS : 0
    })
    if (still.every((time) => time >= 0.25)) {
      settled = true
      break
    }
  }

  // Con todos quietos, los números de cada uno para que arriba quede lo que dijo el servidor
  return dice.map((die, i) => {
    const path = frames[i] ?? []
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
