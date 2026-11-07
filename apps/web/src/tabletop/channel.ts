/**
 * El canal de la mesa (ADR-0018): un WebSocket a /api/table que dice quién mira (el máster o la pantalla de la tele),
 * recibe su proyección y se reconecta solo, esperando cada vez más. El máster manda por él su encuadre en vivo, que la
 * tele sigue con «Seguir»
 */
import type { SceneViewport, TableServerMessage, TableViewer } from '@crisol/contracts'

export type TableStatus = 'connecting' | 'open' | 'reconnecting' | 'forbidden' | 'ended'

export interface TableHandlers {
  onMessage(message: TableServerMessage): void
  onStatus?(status: TableStatus): void
}

export interface TableChannel {
  /** El encuadre del máster: como mucho uno cada `VIEWPORT_MS`, siempre el último */
  sendViewport(view: SceneViewport): void
  close(): void
}

/** El servidor cierra así cuando ya no hay sesión o no se puede llevar la mesa: no tiene sentido reconectar */
const SESSION_ENDED = 4401
const FORBIDDEN = 4403
const FIRST_WAIT_MS = 500
const MAX_WAIT_MS = 10_000
/** 20 por segundo: la tele va suave sin llenar el canal */
const VIEWPORT_MS = 50

type SocketLike = {
  readyState: number
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number }) => void) | null
}

export function connectTable(
  options: {
    campaignId: string
    view: TableViewer
    url?: string
    WebSocket?: new (url: string) => SocketLike
  },
  handlers: TableHandlers
): TableChannel {
  const url = options.url ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/table`
  const Socket = (options.WebSocket ?? WebSocket) as new (url: string) => SocketLike
  let socket: SocketLike | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let wait = FIRST_WAIT_MS
  let stopped = false
  let joined = false
  // El encuadre: el último pedido, cuándo salió el último y el que espera a su turno
  let latest: SceneViewport | null = null
  let sentAt = Number.NEGATIVE_INFINITY
  let pending: ReturnType<typeof setTimeout> | undefined

  const status = (value: TableStatus) => handlers.onStatus?.(value)
  const isOpen = () => socket !== null && socket.readyState === 1

  const flush = () => {
    pending = undefined
    if (!latest || !isOpen()) return
    sentAt = Date.now()
    socket?.send(JSON.stringify({ type: 'viewport', view: latest }))
  }

  const open = () => {
    status(joined ? 'reconnecting' : 'connecting')
    const current = new Socket(url)
    socket = current
    current.onopen = () => {
      current.send(JSON.stringify({ type: 'join', campaignId: options.campaignId, view: options.view }))
      // Al volver, la sala no sabe dónde mira el máster: se le repite
      if (options.view === 'master' && latest) flush()
    }
    current.onmessage = (event) => {
      let message: TableServerMessage
      try {
        message = JSON.parse(String(event.data)) as TableServerMessage
      } catch {
        return
      }
      if (message.type !== 'error' && !joined) joined = true
      if (message.type === 'master' || message.type === 'screen') {
        wait = FIRST_WAIT_MS
        status('open')
      }
      handlers.onMessage(message)
    }
    current.onclose = (event) => {
      if (stopped || socket !== current) return
      socket = null
      if (event.code === SESSION_ENDED) return status('ended')
      if (event.code === FORBIDDEN) return status('forbidden')
      joined = true
      status('reconnecting')
      retry = setTimeout(open, wait)
      wait = Math.min(wait * 2, MAX_WAIT_MS)
    }
  }

  open()
  return {
    sendViewport(view) {
      latest = view
      if (pending) return
      const since = Date.now() - sentAt
      if (since >= VIEWPORT_MS) flush()
      else pending = setTimeout(flush, VIEWPORT_MS - since)
    },
    close() {
      stopped = true
      clearTimeout(retry)
      clearTimeout(pending)
      socket?.close()
    }
  }
}
