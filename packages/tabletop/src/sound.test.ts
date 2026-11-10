import { describe, expect, it } from 'vitest'
import { audibleSounds, hearSound, type MapSound, MUFFLED_GAIN, soundEdges } from './sound.ts'
import type { Edge, Wall } from './walls.ts'

const sound = (extra: Partial<MapSound> = {}): MapSound => ({
  id: 's',
  x: 0,
  y: 0,
  radius: 100,
  volume: 1,
  easing: true,
  walls: 'block',
  ...extra
})

const wall = (extra: Partial<Edge> = {}): Edge => ({
  a: { x: 50, y: -100 },
  b: { x: 50, y: 100 },
  limited: false,
  pass: null,
  ...extra
})

describe('el sonido en el mapa', () => {
  it('con suavizado, se apaga poco a poco hacia el borde (entero en el centro, nada en el borde)', () => {
    expect(hearSound(sound(), { x: 0, y: 0 }, []).gain).toBeCloseTo(1)
    expect(hearSound(sound(), { x: 50, y: 0 }, []).gain).toBeCloseTo(0.5)
    expect(hearSound(sound(), { x: 100, y: 0 }, []).gain).toBe(0)
    expect(hearSound(sound(), { x: 150, y: 0 }, []).gain).toBe(0)
    let before = 1
    for (let d = 0; d <= 100; d += 5) {
      const now = hearSound(sound(), { x: d, y: 0 }, []).gain
      expect(now).toBeLessThanOrEqual(before + 1e-9)
      before = now
    }
  })

  it('sin suavizado, igual hasta el borde', () => {
    expect(hearSound(sound({ easing: false }), { x: 99, y: 0 }, []).gain).toBe(1)
    expect(hearSound(sound({ easing: false }), { x: 101, y: 0 }, []).gain).toBe(0)
  })

  it('el volumen del sonido cuenta', () => {
    expect(hearSound(sound({ volume: 0.5 }), { x: 0, y: 0 }, []).gain).toBeCloseTo(0.5)
  })

  it('un muro que frena lo corta; uno que amortigua lo deja pasar más bajo y apagado', () => {
    const behind = { x: 60, y: 0 }
    expect(hearSound(sound(), behind, [wall()])).toEqual({ gain: 0, muffled: false })
    const muffled = hearSound(sound({ walls: 'muffle' }), behind, [wall()])
    const open = hearSound(sound({ walls: 'muffle' }), behind, [])
    expect(muffled.muffled).toBe(true)
    expect(muffled.gain).toBeCloseTo(open.gain * MUFFLED_GAIN)
    // Del mismo lado del muro, como si no estuviera
    expect(hearSound(sound(), { x: 40, y: 0 }, [wall()]).gain).toBeGreaterThan(0)
  })

  it('un muro limitado deja pasar el primero; dos lo cortan', () => {
    const limited = wall({ limited: true })
    expect(hearSound(sound(), { x: 60, y: 0 }, [limited]).gain).toBeGreaterThan(0)
    const second = wall({ a: { x: 55, y: -100 }, b: { x: 55, y: 100 }, limited: true })
    expect(hearSound(sound(), { x: 60, y: 0 }, [limited, second]).gain).toBe(0)
  })

  it('de varios oyentes manda el que lo oye más fuerte', () => {
    const [heard] = audibleSounds(
      [sound()],
      [
        { x: 80, y: 0 },
        { x: 10, y: 0 }
      ],
      []
    )
    expect(heard?.gain).toBeCloseTo(hearSound(sound(), { x: 10, y: 0 }, []).gain)
    expect(audibleSounds([sound()], [], [])).toEqual([])
    // Lo que no se oye no sale
    expect(audibleSounds([sound()], [{ x: 500, y: 0 }], [])).toEqual([])
  })

  it('los tramos que paran el sonido: sin los que no lo paran ni las puertas abiertas', () => {
    const base: Wall = {
      id: 'w',
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      sight: 'full',
      light: 'full',
      move: 'full',
      sound: 'full',
      direction: 'both',
      door: null,
      locked: false
    }
    const edges = soundEdges(
      [
        base,
        { ...base, id: 'n', sound: 'none' },
        { ...base, id: 'd', door: 'door', a: { x: 0, y: 20 }, b: { x: 10, y: 20 } },
        { ...base, id: 'l', sound: 'limited', a: { x: 0, y: 40 }, b: { x: 10, y: 40 } }
      ],
      { d: { open: true } }
    )
    expect(edges.map((e) => [e.a.y, e.limited])).toEqual([
      [0, false],
      [40, true]
    ])
  })

  it('diez sonidos y cien muros, sin coste que se note', () => {
    const edges = Array.from({ length: 100 }, (_, i) =>
      wall({ a: { x: i * 20, y: -500 }, b: { x: i * 20 + 10, y: 500 } })
    )
    const sounds = Array.from({ length: 10 }, (_, i) => sound({ id: `s${i}`, x: i * 100, radius: 600 }))
    const listeners = Array.from({ length: 6 }, (_, i) => ({ x: i * 150, y: 30 }))
    const start = performance.now()
    for (let n = 0; n < 100; n++) audibleSounds(sounds, listeners, edges)
    expect((performance.now() - start) / 100).toBeLessThan(5)
  })
})
