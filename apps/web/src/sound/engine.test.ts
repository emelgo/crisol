import type { SoundView, SoundVoice } from '@crisol/contracts'
import { describe, expect, it, vi } from 'vitest'
import { createServerClock } from './clock.ts'
import { DEFAULT_DEVICE } from './device.ts'
import { type AudioLike, createSoundEngine, voiceGain } from './engine.ts'

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
  plays = 0
  constructor(url: string) {
    this.src = url
    FakeAudio.all.push(this)
  }
  play() {
    this.plays++
    if (FakeAudio.blocked) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

const T0 = 1_000_000
const voice = (patch: Partial<SoundVoice> = {}): SoundVoice => ({
  key: 'k1',
  playlistId: '00000000-0000-4000-8000-000000000001',
  trackId: '00000000-0000-4000-8000-000000000002',
  name: 'Taberna',
  kind: 'ambient',
  source: { type: 'file', fileId: '00000000-0000-4000-8000-000000000003', url: '/api/files/a' },
  startedAt: T0,
  offset: 0,
  duration: 120,
  loop: false,
  volume: 1,
  fade: 0,
  stopAt: null,
  effectId: null,
  ...patch
})
const view = (voices: SoundVoice[], patch: Partial<SoundView> = {}): SoundView => ({
  campaignId: '00000000-0000-4000-8000-000000000009',
  volume: 1,
  paused: false,
  pausedAt: null,
  voices,
  lists: [],
  preload: [],
  ...patch
})

function setup(serverNow: { value: number }, local = { value: 0 }) {
  FakeAudio.all = []
  FakeAudio.blocked = false
  const onBlocked = vi.fn()
  // El reloj del aparato va 5 s por detrás del servidor: la muestra lo corrige
  const clock = createServerClock(() => serverNow.value - 5000)
  clock.sample(serverNow.value - 5000, serverNow.value)
  const engine = createSoundEngine({
    clock,
    device: DEFAULT_DEVICE,
    onBlocked,
    createAudio: (url) => new FakeAudio(url),
    intervalMs: 0,
    local: () => local.value
  })
  return { engine, onBlocked }
}

describe('la reproducción en cada aparato', () => {
  it('quien entra tarde salta a donde va la pista, con la hora del servidor y su desfase', async () => {
    const now = { value: T0 + 42_000 }
    const { engine } = setup(now)
    engine.update(view([voice()]))
    const audio = FakeAudio.all[0]
    expect(audio?.currentTime).toBe(42)
    await Promise.resolve()
    expect(audio?.paused).toBe(false)
  })

  it('corrige si se desvía más de medio segundo, y no antes', () => {
    const now = { value: T0 + 10_000 }
    const local = { value: 0 }
    const { engine } = setup(now, local)
    engine.update(view([voice()]))
    const audio = FakeAudio.all[0] as FakeAudio
    local.value = 5000
    now.value = T0 + 20_000
    audio.currentTime = 19.7
    engine.tick()
    expect(audio.currentTime).toBe(19.7)
    audio.currentTime = 19.2
    engine.tick()
    expect(audio.currentTime).toBe(20)
  })

  it('en pausa se para en el segundo de la pausa; al acabar, se calla', () => {
    const now = { value: T0 + 10_000 }
    const { engine } = setup(now)
    engine.update(view([voice()], { paused: true, pausedAt: T0 + 3000 }))
    const audio = FakeAudio.all[0] as FakeAudio
    expect(audio.currentTime).toBe(3)
    expect(audio.paused).toBe(true)
    engine.update(view([voice()]))
    now.value = T0 + 200_000
    audio.paused = false
    engine.tick()
    expect(audio.paused).toBe(true)
  })

  it('si el navegador no deja sonar, lo dice; un gesto lo desbloquea', async () => {
    const now = { value: T0 }
    const { engine, onBlocked } = setup(now)
    FakeAudio.blocked = true
    engine.update(view([voice()]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onBlocked).toHaveBeenLastCalledWith(true)
    FakeAudio.blocked = false
    engine.unlock()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onBlocked).toHaveBeenLastCalledWith(false)
    expect(FakeAudio.all[0]?.paused).toBe(false)
  })

  it('una pista que ya no suena se suelta; la siguiente se carga antes', () => {
    const now = { value: T0 }
    const { engine } = setup(now)
    engine.update(view([voice()], { preload: ['/api/files/b'] }))
    expect(FakeAudio.all.map((a) => a.src)).toEqual(['/api/files/a', '/api/files/b'])
    engine.update(view([voice({ key: 'k2', source: { type: 'file', fileId: 'b', url: '/api/files/b' } })]))
    // La de antes se para y la siguiente usa la que ya estaba cargada
    expect(FakeAudio.all).toHaveLength(2)
    expect(FakeAudio.all[0]?.paused).toBe(true)
  })

  it('el volumen: el general, el de la pista, el del aparato, el fundido y silenciar', () => {
    const v = voice({ volume: 0.5, fade: 2 })
    expect(
      voiceGain(v, view([v], { volume: 0.8 }), { ambient: 0.5, effects: 1, muted: false }, T0 + 10_000)
    ).toBeCloseTo(0.2)
    expect(voiceGain(v, view([v]), DEFAULT_DEVICE, T0 + 1000)).toBeCloseTo(0.5 * 0.8 * 0.5)
    expect(voiceGain(v, view([v]), { ...DEFAULT_DEVICE, muted: true }, T0 + 10_000)).toBe(0)
    const fx = voice({ kind: 'effects' })
    expect(voiceGain(fx, view([fx]), { ambient: 0, effects: 0.3, muted: false }, T0 + 10_000)).toBeCloseTo(0.3)
  })
})

describe('la hora del servidor', () => {
  it('se queda con la muestra del viaje más corto', () => {
    let local = 1000
    const clock = createServerClock(() => local)
    clock.hint(5000)
    expect(clock.now()).toBe(5000)
    local = 1400
    clock.sample(1000, 10_200) // viaje de 400: desfase 9000
    expect(clock.now()).toBe(10_400)
    local = 2100
    clock.sample(2000, 11_050) // viaje de 100: desfase 9000
    expect(clock.now()).toBe(11_100)
    local = 3000
    clock.sample(2000, 20_000) // viaje de 1000: peor, no vale
    expect(clock.now()).toBe(12_000)
    clock.hint(0)
    expect(clock.now()).toBe(12_000)
  })
})
