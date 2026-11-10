import { describe, expect, it } from 'vitest'
import { DEFAULT_DEVICE } from './device.ts'
import type { AudioLike } from './engine.ts'
import { createMapSoundEngine, type MapSoundSource, mapVoicesOf, masterMapSounds } from './map-sounds.ts'

class FakeAudio implements AudioLike {
  static blocked = false
  static all: FakeAudio[] = []
  src: string
  currentTime = 0
  volume = 1
  loop = false
  paused = true
  readyState = 4
  preload = ''
  constructor(url: string) {
    this.src = url
    FakeAudio.all.push(this)
  }
  play() {
    if (FakeAudio.blocked) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

const forge: MapSoundSource = {
  id: 's1',
  x: 0,
  y: 0,
  radius: 100,
  volume: 1,
  easing: true,
  walls: 'block',
  url: '/api/files/forja'
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('los sonidos del mapa en cada aparato', () => {
  it('acercar la ficha sube el volumen; un muro que frena lo corta', () => {
    const far = mapVoicesOf({ sounds: [forge], walls: [], listeners: [{ x: 80, y: 0 }] })
    const near = mapVoicesOf({ sounds: [forge], walls: [], listeners: [{ x: 10, y: 0 }] })
    expect(near[0]?.gain).toBeGreaterThan(far[0]?.gain ?? 1)
    const wall = { a: { x: 5, y: -50 }, b: { x: 5, y: 50 }, limited: false, pass: null }
    expect(mapVoicesOf({ sounds: [forge], walls: [wall], listeners: [{ x: 10, y: 0 }] })).toEqual([])
  })

  it('el máster: los encendidos, con pista y con la oscuridad que piden, con su radio en píxeles', () => {
    const base = {
      name: '',
      x: 10,
      y: 20,
      radius: 3,
      volume: 1,
      easing: true,
      walls: 'block' as const,
      darkOnly: false
    }
    const file = { type: 'file' as const, fileId: 'f', url: '/api/files/f' }
    const sounds = masterMapSounds(
      [
        { ...base, id: 'a', source: file, enabled: true },
        { ...base, id: 'b', source: file, enabled: false },
        { ...base, id: 'c', source: { type: 'none' } },
        { ...base, id: 'd', source: file, darkOnly: true }
      ],
      { cell: 50, darkness: 0.2 }
    )
    expect(sounds).toEqual([
      { id: 'a', x: 10, y: 20, radius: 150, volume: 1, easing: true, walls: 'block', url: '/api/files/f' }
    ])
    expect(
      masterMapSounds([{ ...base, id: 'd', source: file, darkOnly: true }], { cell: 50, darkness: 0.9 })
    ).toHaveLength(1)
  })

  it('suena en bucle con el volumen del ambiente de este aparato, sube poco a poco y para lo que ya no se oye', async () => {
    FakeAudio.all = []
    const engine = createMapSoundEngine({
      device: { ...DEFAULT_DEVICE, ambient: 0.5 },
      onBlocked: () => {},
      createAudio: (url) => new FakeAudio(url),
      intervalMs: 0
    })
    engine.update([{ id: 's1', url: '/api/files/forja', gain: 0.8 }])
    const audio = FakeAudio.all[0] as FakeAudio
    expect(audio.loop).toBe(true)
    for (let i = 0; i < 20; i++) engine.tick()
    await flush()
    expect(audio.paused).toBe(false)
    expect(audio.volume).toBeCloseTo(0.4)
    engine.setDevice({ ...DEFAULT_DEVICE, muted: true })
    for (let i = 0; i < 20; i++) engine.tick()
    expect(audio.volume).toBe(0)
    expect(audio.paused).toBe(true)
    engine.update([])
    expect(engine.playing()).toBe(false)
    engine.dispose()
  })

  it('si el navegador no deja sonar, lo dice; un gesto lo desbloquea', async () => {
    FakeAudio.all = []
    FakeAudio.blocked = true
    let blocked = false
    const engine = createMapSoundEngine({
      device: DEFAULT_DEVICE,
      onBlocked: (value) => {
        blocked = value
      },
      createAudio: (url) => new FakeAudio(url),
      intervalMs: 0
    })
    engine.update([{ id: 's1', url: '/api/files/forja', gain: 1 }])
    engine.tick()
    await flush()
    expect(blocked).toBe(true)
    expect(engine.playing()).toBe(true)
    FakeAudio.blocked = false
    engine.unlock()
    await flush()
    expect(blocked).toBe(false)
    expect(FakeAudio.all[0]?.paused).toBe(false)
    engine.dispose()
  })
})
