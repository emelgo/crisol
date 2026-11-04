import { describe, expect, it } from 'vitest'
import { type DieKind, faceNormal, labelsFor, readFace, relabel, rotate, SOLIDS, solidOf } from './solids.ts'
import { MAX_FRAMES, throwDice } from './throw.ts'

const KINDS: DieKind[] = [4, 6, 8, 10, 12, 20, 'T', 'F']

describe('los sólidos de los dados', () => {
  it('cada uno con sus caras, todas hacia fuera', () => {
    for (const [sides, faces] of [
      [4, 4],
      [6, 6],
      [8, 8],
      [10, 10],
      [12, 12],
      [20, 20]
    ] as const) {
      const solid = SOLIDS[sides]
      expect(solid.faces).toHaveLength(faces)
      for (const face of solid.faces) {
        const center = face
          .map((i) => solid.verts[i] as [number, number, number])
          .reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]])
        const n = faceNormal(solid, face)
        expect(n[0] * center[0] + n[1] * center[1] + n[2] * center[2]).toBeGreaterThan(0)
      }
    }
  })

  it('los números de cada dado: el d10 lleva el 0, el de decenas el 00 y el Fate +, − y en blanco', () => {
    expect(labelsFor(20)).toHaveLength(20)
    expect(labelsFor(10)).toContain('0')
    expect(labelsFor('T')).toContain('00')
    expect(labelsFor('F')).toEqual(['+', '+', '−', '−', '', ''])
  })
})

describe('que caiga lo que dijo el servidor', () => {
  it('con la cara de arriba de un dado quieto, se cambian los números para que salga el resultado', () => {
    const labels = labelsFor(6)
    const next = relabel(labels, 2, '5')
    expect(next[2]).toBe('5')
    expect([...next].sort()).toEqual([...labels].sort())
  })

  it('cada dado cae con física, se para en menos de 2 s y queda en su resultado', () => {
    for (const kind of KINDS) {
      const labels = labelsFor(kind)
      for (const wanted of [labels[0], labels.at(-1)]) {
        const [die] = throwDice([{ kind, label: wanted ?? '' }], { seed: 7 })
        if (!die) throw new Error('sin dado')
        // Quieto de verdad y apoyado en una cara (la que se lee, plana arriba o abajo); en pantalla, 2 s como mucho
        expect(die.settled, String(kind)).toBe(true)
        expect(die.frames.length).toBeLessThanOrEqual(MAX_FRAMES)
        const last = die.frames.at(-1)
        if (!last) throw new Error('sin fotogramas')
        const face = readFace(kind, last.quaternion)
        const normal = rotate(last.quaternion, faceNormal(solidOf(kind), solidOf(kind).faces[face] ?? []))
        expect(Math.abs(normal[1]), `${kind}: plana`).toBeGreaterThan(0.95)
        expect(die.labels[face], `${kind} → ${wanted}`).toBe(wanted)
      }
    }
  })

  it('con muchas semillas, siempre se para y en pantalla dura 2 s como mucho', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const kind of [12, 20] as const) {
        const [die] = throwDice([{ kind, label: '7' }], { seed })
        expect(die?.settled, `d${kind}, semilla ${seed}`).toBe(true)
        expect(die?.frames.length).toBeLessThanOrEqual(MAX_FRAMES)
      }
    }
  })

  it('varios a la vez no se atraviesan ni salen de la bandeja', () => {
    const dice = throwDice(
      Array.from({ length: 8 }, (_, i) => ({ kind: 6 as const, label: String((i % 6) + 1) })),
      { seed: 3 }
    )
    for (const die of dice) {
      const end = die.frames.at(-1)?.position
      expect(Math.abs(end?.[0] ?? 99)).toBeLessThan(8)
      expect(Math.abs(end?.[2] ?? 99)).toBeLessThan(5)
      expect(end?.[1] ?? -1).toBeGreaterThan(0)
    }
  })
})
