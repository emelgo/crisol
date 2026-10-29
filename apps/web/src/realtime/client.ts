/** El canal en tiempo real del navegador: un WebSocket a /api/realtime que se reconecta solo */
import type { RealtimeMessage } from '@crisol/contracts'

export interface RealtimeHandlers {
  onMessage(message: RealtimeMessage): void
  /** Ha vuelto tras un corte: pudo perderse algún aviso */
  onReconnect?(): void
}

export interface RealtimeClient {
  /** Abre el canal; devuelve con qué cerrarlo */
  connect(handlers: RealtimeHandlers): () => void
}

/** El servidor cierra así cuando ya no hay sesión: no tiene sentido reconectar */
const SESSION_ENDED = 4401
const FIRST_WAIT_MS = 1000
const MAX_WAIT_MS = 30_000

type SocketLike = Pick<WebSocket, 'close'> & {
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number }) => void) | null
}

export function createRealtimeClient(
  options: { url?: string; WebSocket?: new (url: string) => SocketLike } = {}
): RealtimeClient {
  const url = options.url ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/realtime`
  // El del navegador cumple SocketLike (sus manejadores reciben eventos más completos)
  const Socket = (options.WebSocket ?? WebSocket) as new (url: string) => SocketLike
  return {
    connect(handlers) {
      let socket: SocketLike | null = null
      let timer: ReturnType<typeof setTimeout> | undefined
      let wait = FIRST_WAIT_MS
      let opened = false
      let stopped = false

      const open = () => {
        const current = new Socket(url)
        socket = current
        current.onopen = () => {
          if (opened) handlers.onReconnect?.()
          opened = true
          wait = FIRST_WAIT_MS
        }
        current.onmessage = (event) => {
          try {
            handlers.onMessage(JSON.parse(String(event.data)) as RealtimeMessage)
          } catch {
            // Un mensaje que no se entiende se ignora
          }
        }
        current.onclose = (event) => {
          if (stopped || event.code === SESSION_ENDED) return
          timer = setTimeout(open, wait)
          wait = Math.min(wait * 2, MAX_WAIT_MS)
        }
      }

      open()
      return () => {
        stopped = true
        clearTimeout(timer)
        socket?.close()
      }
    }
  }
}
