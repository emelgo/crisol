import type { Wall } from '@crisol/tabletop'
import { describe, expect, it } from 'vitest'
import { moveAllowed, playerMayUseDoor } from './rules.ts'

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id,
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
  sight: 'full',
  light: 'full',
  move: 'full',
  direction: 'both',
  door: null,
  locked: false,
  ...extra
})

/** Una pared vertical en x 200 con una puerta (y 80–120) y una secreta (y 180–220) */
const walls = [
  wall('arriba', 200, 0, 200, 80),
  wall('puerta', 200, 80, 200, 120, { door: 'door' }),
  wall('medio', 200, 120, 200, 180),
  wall('secreta', 200, 180, 200, 220, { door: 'secret' }),
  wall('abajo', 200, 220, 200, 400)
]
const everywhere = { hasPoint: () => true }
const nowhere = { hasPoint: () => false }

describe('las reglas de las puertas y del paso (docs/specs/vision.md)', () => {
  it('cruzar un muro o una puerta cerrada (también la secreta) se rechaza; por la abierta, se pasa', () => {
    expect(moveAllowed(walls, {}, { x: 100, y: 300 }, { x: 300, y: 300 })).toBe(false)
    expect(moveAllowed(walls, {}, { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(false)
    expect(moveAllowed(walls, {}, { x: 100, y: 200 }, { x: 300, y: 200 })).toBe(false)
    expect(moveAllowed(walls, { puerta: { open: true } }, { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(true)
    expect(moveAllowed(walls, { secreta: { open: true } }, { x: 100, y: 200 }, { x: 300, y: 200 })).toBe(true)
    expect(moveAllowed(walls, {}, { x: 100, y: 100 }, { x: 150, y: 300 })).toBe(true)
  })

  it('un jugador abre solo puertas normales, sin llave y a la vista de su grupo', () => {
    const door = walls[1] as Wall
    expect(playerMayUseDoor(door, everywhere)).toBe(true)
    expect(playerMayUseDoor(door, nowhere)).toBe(false)
    expect(playerMayUseDoor({ ...door, locked: true }, everywhere)).toBe(false)
    expect(playerMayUseDoor(walls[3] as Wall, everywhere)).toBe(false)
    expect(playerMayUseDoor(walls[0] as Wall, everywhere)).toBe(false)
  })

  it('una puerta se ve desde cualquiera de sus dos lados (su centro cae en la raya entre casillas)', () => {
    const door = walls[1] as Wall
    expect(playerMayUseDoor(door, { hasPoint: (p) => p.x < 200 })).toBe(true)
    expect(playerMayUseDoor(door, { hasPoint: (p) => p.x > 200 })).toBe(true)
    expect(playerMayUseDoor(door, { hasPoint: (p) => p.x < 150 })).toBe(false)
  })
})
