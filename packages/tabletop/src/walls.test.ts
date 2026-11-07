import { describe, expect, it } from 'vitest'
import { joinCollinear, type Wall, wallEdges, withDoorGaps } from './walls.ts'

let next = 0
const wall = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id: `w${++next}`,
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

describe('qué muros paran cada canal', () => {
  it('las puertas abiertas no paran nada; un muro que solo para la luz no para la vista', () => {
    const walls = [
      wall(0, 0, 10, 0),
      wall(0, 10, 10, 10, { id: 'abierta', door: 'door' }),
      wall(0, 20, 10, 20, { id: 'cerrada', door: 'door' }),
      wall(0, 30, 10, 30, { sight: 'none' })
    ]
    const doors = { abierta: { open: true }, cerrada: { open: false } }
    expect(wallEdges(walls, doors, 'sight')).toHaveLength(2)
    expect(wallEdges(walls, doors, 'light')).toHaveLength(3)
    // Sin estado, la puerta está cerrada
    expect(wallEdges(walls, {}, 'sight')).toHaveLength(3)
  })

  it('«limitado» deja pasar el primero en la vista y la luz, pero en el paso para del todo', () => {
    const walls = [wall(0, 0, 10, 0, { sight: 'limited', move: 'limited', direction: 'left' })]
    expect(wallEdges(walls, {}, 'sight')).toEqual([expect.objectContaining({ limited: true, pass: 'left' })])
    expect(wallEdges(walls, {}, 'move')).toEqual([expect.objectContaining({ limited: false })])
  })

  it('los de largo cero no paran nada', () => {
    expect(wallEdges([wall(5, 5, 5, 5)], {}, 'sight')).toEqual([])
  })

  it('una puerta secreta abierta es un hueco como otro cualquiera', () => {
    const walls = [wall(0, 0, 10, 0, { id: 's', door: 'secret' })]
    expect(wallEdges(walls, { s: { open: true } }, 'sight')).toEqual([])
    expect(wallEdges(walls, {}, 'sight')).toHaveLength(1)
  })
})

describe('puerta sobre una pared', () => {
  const pared = wall(0, 0, 300, 0)
  const puerta = wall(100, 1, 170, 1, { id: 'p', door: 'door' })
  const open = { p: { open: true } }

  it('abierta, deja un hueco en la pared de debajo; cerrada, no', () => {
    const gaps = withDoorGaps([pared, puerta], open).filter((w) => w.door === null)
    expect(gaps.map((w) => [Math.round(w.a.x), Math.round(w.b.x)])).toEqual([
      [0, 100],
      [170, 300]
    ])
    // La luz pasa por el hueco: no hay tramo que tape el centro de la puerta
    const crosses = (doors: Record<string, { open: boolean }>) =>
      wallEdges([pared, puerta], doors, 'light').some((t) => t.a.x < 135 && t.b.x > 135)
    expect(crosses(open)).toBe(false)
    expect(crosses({})).toBe(true)
  })

  it('algo separada y torcida, abierta, abre su hueco; muy torcida, no', () => {
    const torcida = (y2: number) => wall(100, 6, 170, y2, { id: 'p', door: 'door' })
    // 6 y 8 px fuera de la línea en una puerta de 70 px: dentro del 15 %
    expect(withDoorGaps([pared, torcida(8)], open).filter((w) => w.door === null)).toHaveLength(2)
    // 40 px de desnivel en 70: más de 12° de giro, no está sobre la pared
    expect(withDoorGaps([pared, torcida(46)], open).filter((w) => w.door === null)).toHaveLength(1)
  })

  it('una puerta que tapa la pared entera la quita; una que cae fuera de ella no la toca', () => {
    expect(withDoorGaps([wall(0, 0, 50, 0), wall(-10, 0, 60, 0, { id: 'p', door: 'door' })], open)).toHaveLength(1)
    expect(withDoorGaps([wall(0, 0, 50, 0), wall(100, 0, 170, 0, { id: 'p', door: 'door' })], open)).toHaveLength(2)
    // Una puerta de largo cero no abre nada
    expect(withDoorGaps([pared, wall(5, 0, 5, 0, { id: 'p', door: 'door' })], open)).toHaveLength(2)
  })
})

describe('unir los tramos colineales y seguidos', () => {
  it('una pared partida en tramos queda en uno, con el id del primero', () => {
    const walls = [wall(0, 0, 10, 0, { id: 'uno' }), wall(10, 0, 20, 0), wall(20, 0, 35, 0)]
    expect(joinCollinear(walls)).toEqual([
      expect.objectContaining({ id: 'uno', a: { x: 0, y: 0 }, b: { x: 35, y: 0 } })
    ])
  })

  it('da igual el orden y el sentido en que vengan', () => {
    const joined = joinCollinear([wall(20, 0, 10, 0), wall(30, 0, 20, 0), wall(0, 0, 10, 0)])
    expect(joined).toHaveLength(1)
    const [only] = joined
    expect([only?.a.x, only?.b.x].sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([0, 30])
  })

  it('con tolerancia: los extremos casi iguales y los casi rectos se unen; una esquina no', () => {
    expect(joinCollinear([wall(0, 0, 10, 0), wall(10.3, 0.2, 20, 0)])).toHaveLength(1)
    expect(joinCollinear([wall(0, 0, 10, 0), wall(10, 0, 10, 10)])).toHaveLength(2)
    expect(joinCollinear([wall(0, 0, 10, 0), wall(10, 0, 20, 0)], 0.01)).toHaveLength(1)
  })

  it('una curva suave no se aplana más allá de la tolerancia', () => {
    // Un arco de 90° en 60 tramos: cada vértice está casi en línea con sus vecinos, pero no todo el arco
    const arc = Array.from({ length: 61 }, (_, i) => {
      const t = (i / 60) * (Math.PI / 2)
      return { x: 500 * Math.cos(t), y: 500 * Math.sin(t) }
    })
    const walls = arc.slice(1).map((p, i) => wall(arc[i]?.x ?? 0, arc[i]?.y ?? 0, p.x, p.y))
    const joined = joinCollinear(walls, 1)
    expect(joined.length).toBeGreaterThan(4)
    expect(joined.length).toBeLessThan(60)
    // Ningún vértice del arco queda a más de 1 px del tramo unido que lo cubre
    for (const p of arc) {
      const near = joined.some((w) => {
        const dx = w.b.x - w.a.x
        const dy = w.b.y - w.a.y
        const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (dx * dx + dy * dy)))
        return Math.hypot(p.x - w.a.x - dx * t, p.y - w.a.y - dy * t) <= 1 + 1e-9
      })
      expect(near).toBe(true)
    }
  })

  it('no une los que paran cosas distintas, ni toca las puertas', () => {
    const walls = [
      wall(0, 0, 10, 0),
      wall(10, 0, 20, 0, { sight: 'none' }),
      wall(20, 0, 30, 0, { id: 'p', door: 'door' }),
      wall(30, 0, 40, 0, { sight: 'none' })
    ]
    const joined = joinCollinear(walls)
    expect(joined).toHaveLength(4)
    expect(joined.find((w) => w.door === 'door')).toEqual(walls[2])
  })

  it('los de un sentido, solo con los de su mismo sentido, y conservan su orientación', () => {
    const left = { direction: 'left' as const }
    const joined = joinCollinear([wall(10, 0, 20, 0, left), wall(0, 0, 10, 0, left)])
    expect(joined).toEqual([expect.objectContaining({ a: { x: 0, y: 0 }, b: { x: 20, y: 0 } })])
    // Al revés: uno va hacia la derecha y otro hacia la izquierda, no se unen
    expect(joinCollinear([wall(0, 0, 10, 0, left), wall(20, 0, 10, 0, left)])).toHaveLength(2)
    // Encadenados hacia atrás, siguen apuntando hacia atrás
    const back = joinCollinear([wall(20, 0, 10, 0, left), wall(10, 0, 0, 0, left)])
    expect(back).toEqual([expect.objectContaining({ a: { x: 20, y: 0 }, b: { x: 0, y: 0 } })])
  })

  it('en un cruce sigue cada línea recta; los de largo cero se quitan', () => {
    const walls = [
      wall(0, 10, 10, 10),
      wall(10, 10, 20, 10),
      wall(10, 0, 10, 10),
      wall(10, 10, 10, 20),
      wall(3, 3, 3, 3)
    ]
    const joined = joinCollinear(walls)
    expect(joined).toHaveLength(2)
  })
})
