import type { RealtimeMessage } from '@crisol/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRealtimeClient } from './client.ts'

/** Un WebSocket de mentira: la prueba decide cuándo se abre, qué llega y cómo se cierra */
class FakeSocket {
  static all: FakeSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  closed = false
  readonly url: string
  constructor(url: string) {
    this.url = url
    FakeSocket.all.push(this)
  }
  close() {
    this.closed = true
  }
  open() {
    this.onopen?.()
  }
  receive(message: RealtimeMessage | string) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }
  drop(code = 1006) {
    this.onclose?.({ code })
  }
}

const last = () => FakeSocket.all.at(-1) as FakeSocket

describe('el cliente del canal en tiempo real', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.all = []
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const client = () => createRealtimeClient({ url: 'ws://crisol.test/api/realtime', WebSocket: FakeSocket as never })

  it('entrega los mensajes y deja de escuchar al desconectar', () => {
    const onMessage = vi.fn()
    const disconnect = client().connect({ onMessage })
    expect(last().url).toBe('ws://crisol.test/api/realtime')
    last().open()
    last().receive({ type: 'changed', what: 'worlds' })
    last().receive('no es JSON')
    expect(onMessage).toHaveBeenCalledExactlyOnceWith({ type: 'changed', what: 'worlds' })
    disconnect()
    expect(last().closed).toBe(true)
    last().drop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('si se corta, vuelve a conectar esperando cada vez más, y al volver avisa de que pudo perderse algo', () => {
    const onReconnect = vi.fn()
    client().connect({ onMessage: vi.fn(), onReconnect })
    last().open()
    last().drop()
    vi.advanceTimersByTime(999)
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(2)
    last().drop()
    vi.advanceTimersByTime(1999)
    expect(FakeSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(3)
    expect(onReconnect).not.toHaveBeenCalled()
    last().open()
    expect(onReconnect).toHaveBeenCalledOnce()
    // Abierta otra vez, la espera vuelve a empezar desde un segundo
    last().drop()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(4)
  })

  it('la espera no pasa de 30 segundos', () => {
    client().connect({ onMessage: vi.fn() })
    for (let i = 0; i < 10; i++) {
      last().drop()
      vi.advanceTimersByTime(30_000)
    }
    expect(FakeSocket.all).toHaveLength(11)
  })

  it('el saludo del servidor no es un aviso: si su versión de la web es otra, lo dice', () => {
    const onMessage = vi.fn()
    const onNewVersion = vi.fn()
    const connect = (build: string | null) =>
      createRealtimeClient({ url: 'ws://crisol.test/api/realtime', WebSocket: FakeSocket as never, build }).connect({
        onMessage,
        onNewVersion
      })
    connect('/assets/index-a.js')
    last().receive({ type: 'hello', build: '/assets/index-a.js' })
    expect(onNewVersion).not.toHaveBeenCalled()
    last().receive({ type: 'hello', build: '/assets/index-b.js' })
    expect(onNewVersion).toHaveBeenCalledOnce()
    // Sin versión en uno de los dos lados (desarrollo), no se compara
    connect(null)
    last().receive({ type: 'hello', build: '/assets/index-b.js' })
    connect('/assets/index-a.js')
    last().receive({ type: 'hello', build: null })
    expect(onNewVersion).toHaveBeenCalledOnce()
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('si el servidor cierra porque acabó la sesión, no reconecta', () => {
    client().connect({ onMessage: vi.fn() })
    last().open()
    last().drop(4401)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
  })
})
