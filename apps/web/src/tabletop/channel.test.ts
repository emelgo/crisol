import type { TableServerMessage } from '@crisol/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectTable } from './channel.ts'

/** Un WebSocket de mentira: la prueba decide cuándo se abre, qué llega y cómo se cierra */
class FakeSocket {
  static all: FakeSocket[] = []
  static readonly OPEN = 1
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  sent: unknown[] = []
  closed = false
  readonly url: string
  constructor(url: string) {
    this.url = url
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(message: TableServerMessage | string) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

const last = () => FakeSocket.all.at(-1) as FakeSocket
const CAMPAIGN = '00000000-0000-4000-8000-000000000001'
const SCREEN: TableServerMessage = {
  type: 'screen',
  screen: {
    campaignId: CAMPAIGN,
    campaignName: 'La Marca',
    scene: null,
    hidden: false,
    camera: { mode: 'follow' },
    tokens: [],
    combat: null
  }
}

describe('el canal de la mesa', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.all = []
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const open = (view: 'master' | 'screen', handlers: Parameters<typeof connectTable>[1]) =>
    connectTable(
      { campaignId: CAMPAIGN, view, url: 'wss://crisol.test/api/table', WebSocket: FakeSocket as never },
      handlers
    )

  it('al abrirse dice quién mira; entrega lo que llega y deja de escuchar al cerrarse', () => {
    const onMessage = vi.fn()
    const channel = open('screen', { onMessage })
    expect(last().url).toBe('wss://crisol.test/api/table')
    last().open()
    expect(last().sent).toEqual([{ type: 'join', campaignId: CAMPAIGN, view: 'screen' }])
    last().receive(SCREEN)
    last().receive('no es JSON')
    expect(onMessage).toHaveBeenCalledExactlyOnceWith(SCREEN)
    channel.close()
    expect(last().closed).toBe(true)
    last().drop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('si se corta, vuelve esperando cada vez más (y avisa); al entrar bien, la espera vuelve a empezar', () => {
    const onStatus = vi.fn()
    open('screen', { onMessage: () => {}, onStatus })
    last().open()
    last().receive(SCREEN)
    expect(onStatus).toHaveBeenLastCalledWith('open')
    last().drop()
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting')
    vi.advanceTimersByTime(499)
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(2)
    // Sin abrirse, la espera se dobla
    last().drop()
    vi.advanceTimersByTime(999)
    expect(FakeSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(3)
    last().open()
    expect(last().sent).toEqual([{ type: 'join', campaignId: CAMPAIGN, view: 'screen' }])
    last().receive(SCREEN)
    last().drop()
    vi.advanceTimersByTime(500)
    expect(FakeSocket.all).toHaveLength(4)
  })

  it('sin permiso o sin sesión no vuelve a intentarlo', () => {
    const onStatus = vi.fn()
    open('screen', { onMessage: () => {}, onStatus })
    last().open()
    last().receive({ type: 'error', code: 'FORBIDDEN' })
    last().drop(4403)
    expect(onStatus).toHaveBeenLastCalledWith('forbidden')
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
    open('screen', { onMessage: () => {}, onStatus })
    last().drop(4401)
    expect(onStatus).toHaveBeenLastCalledWith('ended')
  })

  it('el encuadre del máster sale como mucho 20 veces por segundo, siempre el último, y se repite al volver', () => {
    const channel = open('master', { onMessage: () => {} })
    // Sin conexión no se manda (se guarda para cuando entre)
    channel.sendViewport({ x: 1, y: 1, scale: 1 })
    last().open()
    expect(last().sent).toEqual([
      { type: 'join', campaignId: CAMPAIGN, view: 'master' },
      { type: 'viewport', view: { x: 1, y: 1, scale: 1 } }
    ])
    vi.advanceTimersByTime(100)
    last().sent = []
    channel.sendViewport({ x: 2, y: 2, scale: 1 })
    channel.sendViewport({ x: 3, y: 3, scale: 1 })
    channel.sendViewport({ x: 4, y: 4, scale: 1 })
    expect(last().sent).toEqual([{ type: 'viewport', view: { x: 2, y: 2, scale: 1 } }])
    vi.advanceTimersByTime(50)
    expect(last().sent).toEqual([
      { type: 'viewport', view: { x: 2, y: 2, scale: 1 } },
      { type: 'viewport', view: { x: 4, y: 4, scale: 1 } }
    ])
    // Se corta y vuelve: el último encuadre va otra vez, tras entrar
    last().drop()
    vi.advanceTimersByTime(500)
    last().open()
    expect(last().sent).toEqual([
      { type: 'join', campaignId: CAMPAIGN, view: 'master' },
      { type: 'viewport', view: { x: 4, y: 4, scale: 1 } }
    ])
  })

  it('el arrastre sale a su ritmo, con lo último de cada ficha', () => {
    const channel = open('master', { onMessage: () => {} })
    last().open()
    last().sent = []
    channel.sendDrag([{ tokenId: 'a', x: 1, y: 1 }])
    channel.sendDrag([
      { tokenId: 'a', x: 2, y: 2 },
      { tokenId: 'b', x: 5, y: 5 }
    ])
    channel.sendDrag([{ tokenId: 'a', x: 3, y: 3 }])
    expect(last().sent).toEqual([{ type: 'drag', moves: [{ tokenId: 'a', x: 1, y: 1 }] }])
    vi.advanceTimersByTime(70)
    expect(last().sent.at(-1)).toEqual({
      type: 'drag',
      moves: [
        { tokenId: 'a', x: 3, y: 3 },
        { tokenId: 'b', x: 5, y: 5 }
      ]
    })
  })

  it('la medida sale a su ritmo, siempre la última (también la de «ya no mide»)', () => {
    const channel = open('master', { onMessage: () => {} })
    last().open()
    last().sent = []
    const line = (x: number) => ({
      shape: 'line' as const,
      points: [
        { x: 0, y: 0 },
        { x, y: 0 }
      ]
    })
    channel.sendMeasure(line(100))
    channel.sendMeasure(line(200))
    channel.sendMeasure(null)
    expect(last().sent).toEqual([{ type: 'measure', measure: line(100) }])
    vi.advanceTimersByTime(80)
    expect(last().sent.at(-1)).toEqual({ type: 'measure', measure: null })
    vi.advanceTimersByTime(200)
    expect(last().sent).toHaveLength(2)
  })

  it('pide la hora al servidor solo ya dentro de la sala (el sonido mide su desfase)', () => {
    const channel = open('screen', { onMessage: () => {} })
    channel.sendTime()
    last().open()
    channel.sendTime()
    expect(last().sent).toEqual([{ type: 'join', campaignId: CAMPAIGN, view: 'screen' }])
    last().receive(SCREEN)
    channel.sendTime()
    expect(last().sent.at(-1)).toEqual({ type: 'time', t: Date.now() })
  })

  it('el láser junta sus puntos nuevos y manda como mucho 30, redondeados', () => {
    const channel = open('master', { onMessage: () => {} })
    last().open()
    last().sent = []
    channel.sendLaser([{ x: 1.4, y: 2.6 }])
    for (let i = 0; i < 40; i++) channel.sendLaser([{ x: i, y: i }])
    expect(last().sent).toEqual([{ type: 'laser', points: [{ x: 1, y: 3 }] }])
    vi.advanceTimersByTime(80)
    const sent = last().sent.at(-1) as { points: unknown[] }
    expect(sent.points).toHaveLength(30)
    expect(sent.points.at(-1)).toEqual({ x: 39, y: 39 })
  })

  it('si su temporizador se retrasa (una pestaña de fondo), lo que espera sale con lo siguiente', () => {
    const channel = open('master', { onMessage: () => {} })
    last().open()
    last().sent = []
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValue(now)
    channel.sendLaser([{ x: 1, y: 1 }])
    clock.mockReturnValue(now + 10)
    channel.sendLaser([{ x: 2, y: 2 }])
    // El temporizador no llega; pasan 200 ms y se mueve otra vez
    clock.mockReturnValue(now + 200)
    channel.sendLaser([{ x: 3, y: 3 }])
    expect(last().sent).toEqual([
      { type: 'laser', points: [{ x: 1, y: 1 }] },
      {
        type: 'laser',
        points: [
          { x: 2, y: 2 },
          { x: 3, y: 3 }
        ]
      }
    ])
    clock.mockRestore()
  })
})
