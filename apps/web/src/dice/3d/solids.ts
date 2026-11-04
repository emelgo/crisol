/**
 * Los sólidos de los dados (d4, d6, d8, d10, d12, d20, el de decenas del d% y el Fate): sus vértices, sus caras (cada
 * una en el orden de las agujas del reloj vista desde dentro, es decir, hacia fuera) y sus números. Y qué número sale
 * con el dado quieto: el de la cara de arriba (en el d4, el del vértice de arriba, que es el de la cara de abajo)
 */
export type Vec = [number, number, number]
/** Un cuaternión, como lo da la física: x, y, z, w */
export type Quat = [number, number, number, number]
/** Un dado: sus caras (4, 6…), el de decenas del d% (T) o el Fate (F) */
export type DieKind = 4 | 6 | 8 | 10 | 12 | 20 | 'T' | 'F'

export interface Solid {
  verts: Vec[]
  faces: number[][]
}

const PHI = (1 + Math.sqrt(5)) / 2
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const mid = (ps: Vec[]): Vec => {
  const c: Vec = [0, 0, 0]
  for (const p of ps) {
    c[0] += p[0]
    c[1] += p[1]
    c[2] += p[2]
  }
  return [c[0] / ps.length, c[1] / ps.length, c[2] / ps.length]
}
const corners = (): Vec[] => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): Vec => [x, y, z])))
const vertexOf = (solid: Solid, i: number): Vec => solid.verts[i] ?? [0, 0, 0]

/** Los vértices de una cara, en orden alrededor de su centro y hacia fuera */
function orient(verts: Vec[], idx: number[]): number[] {
  const c = mid(idx.map((i) => verts[i] ?? [0, 0, 0]))
  const n = norm(c)
  const u = norm(sub(verts[idx[0] ?? 0] ?? [0, 0, 0], c))
  const w = cross(n, u)
  return idx
    .map((i): [number, number] => {
      const p = sub(verts[i] ?? [0, 0, 0], c)
      return [Math.atan2(dot(p, w), dot(p, u)), i]
    })
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1])
}

/** Un sólido regular: sus caras son los vértices más lejos en la dirección de cada normal (las del sólido dual) */
function solid(verts: Vec[], normals: Vec[]): Solid {
  const r = Math.max(...verts.map((p) => Math.hypot(p[0], p[1], p[2])))
  const v = verts.map((p): Vec => [p[0] / r, p[1] / r, p[2] / r])
  const faces = normals.map((n) => {
    const d = v.map((p) => dot(p, n))
    const top = Math.max(...d)
    return orient(
      v,
      d.flatMap((x, i) => (x > top - 1e-6 ? [i] : []))
    )
  })
  return { verts: v, faces }
}

/** El d10: dos pirámides de cinco caras giradas, con cometas planas (de ahí la altura del anillo) */
function trapezohedron(): Solid {
  const h = 0.1056
  const v: Vec[] = [
    [0, 0, 1],
    [0, 0, -1]
  ]
  for (let k = 0; k < 10; k++) v.push([Math.cos((k * Math.PI) / 5), Math.sin((k * Math.PI) / 5), k % 2 ? -h : h])
  const ring = (k: number) => 2 + (k % 10)
  const faces: number[][] = []
  for (let k = 0; k < 10; k += 2) faces.push(orient(v, [0, ring(k), ring(k + 1), ring(k + 2)]))
  for (let k = 1; k < 10; k += 2) faces.push(orient(v, [1, ring(k), ring(k + 1), ring(k + 2)]))
  return { verts: v, faces }
}

const ICO: Vec[] = [-1, 1].flatMap((a) =>
  [-1, 1].flatMap((b): Vec[] => [
    [0, a, b * PHI],
    [a, b * PHI, 0],
    [b * PHI, 0, a]
  ])
)
const DOD: Vec[] = [
  ...corners(),
  ...[-1, 1].flatMap((a) =>
    [-1, 1].flatMap((b): Vec[] => [
      [0, a / PHI, b * PHI],
      [a / PHI, b * PHI, 0],
      [b * PHI, 0, a / PHI]
    ])
  )
]
// Las normales de las caras del dodecaedro y del icosaedro: los vértices del dual, girados como toca
const ICO_DUAL: Vec[] = [-1, 1].flatMap((a) =>
  [-1, 1].flatMap((b): Vec[] => [
    [0, a * PHI, b],
    [a * PHI, b, 0],
    [b, 0, a * PHI]
  ])
)
const DOD_DUAL: Vec[] = [
  ...corners(),
  ...[-1, 1].flatMap((a) =>
    [-1, 1].flatMap((b): Vec[] => [
      [0, a * PHI, b / PHI],
      [a * PHI, b / PHI, 0],
      [b / PHI, 0, a * PHI]
    ])
  )
]
const TET: Vec[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1]
]
const AXES: Vec[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
]

export const SOLIDS: Record<4 | 6 | 8 | 10 | 12 | 20, Solid> = {
  4: solid(
    TET,
    TET.map((p): Vec => [-p[0], -p[1], -p[2]])
  ),
  6: solid(corners(), AXES),
  8: solid(AXES, corners()),
  10: trapezohedron(),
  12: solid(DOD, ICO_DUAL),
  20: solid(ICO, DOD_DUAL)
}

/** El sólido de cada dado: el de decenas es un d10 y el Fate, un d6 */
export const solidOf = (kind: DieKind): Solid => SOLIDS[kind === 'T' ? 10 : kind === 'F' ? 6 : kind]

/** Los números de cada cara, en el orden de las caras */
export function labelsFor(kind: DieKind): string[] {
  if (kind === 'F') return ['+', '+', '−', '−', '', '']
  if (kind === 'T') return ['10', '20', '30', '40', '50', '60', '70', '80', '90', '00']
  if (kind === 10) return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  return Array.from({ length: kind }, (_, i) => String(i + 1))
}

/** La normal de una cara, hacia fuera */
export function faceNormal(solid: Solid, face: readonly number[]): Vec {
  const a = vertexOf(solid, face[0] ?? 0)
  const b = vertexOf(solid, face[1] ?? 0)
  const c = vertexOf(solid, face[2] ?? 0)
  return norm(cross(sub(b, a), sub(c, a)))
}

/** Gira un vector con un cuaternión (x, y, z, w) */
export function rotate(q: Quat, v: Vec): Vec {
  const [x, y, z, w] = q
  const ix = w * v[0] + y * v[2] - z * v[1]
  const iy = w * v[1] + z * v[0] - x * v[2]
  const iz = w * v[2] + x * v[1] - y * v[0]
  const iw = -x * v[0] - y * v[1] - z * v[2]
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x
  ]
}

/**
 * La cara que se lee con el dado quieto así girado (arriba es +y): la de arriba; en el d4, la de abajo, cuyo número es
 * el del vértice que queda arriba
 */
export function readFace(kind: DieKind, q: Quat): number {
  const s = solidOf(kind)
  const up: Vec = kind === 4 ? [0, -1, 0] : [0, 1, 0]
  let best = 0
  let bestDot = Number.NEGATIVE_INFINITY
  s.faces.forEach((face, i) => {
    const d = dot(rotate(q, faceNormal(s, face)), up)
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  })
  return best
}

/** Los números, cambiados para que la cara que se lee lleve el que se quiere (se cambia por el que lo llevaba) */
export function relabel(labels: readonly string[], face: number, wanted: string): string[] {
  const next = [...labels]
  const from = next.indexOf(wanted)
  if (from < 0 || from === face) return next
  next[from] = next[face] ?? ''
  next[face] = wanted
  return next
}
