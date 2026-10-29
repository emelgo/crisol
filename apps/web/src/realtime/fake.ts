/** Canal en memoria para las pruebas de componentes: la prueba manda los avisos */
import type { RealtimeMessage } from '@crisol/contracts'
import type { RealtimeClient, RealtimeHandlers } from './client.ts'

export function fakeRealtime() {
  const listeners = new Set<RealtimeHandlers>()
  const client: RealtimeClient = {
    connect(handlers) {
      listeners.add(handlers)
      return () => listeners.delete(handlers)
    }
  }
  return {
    client,
    emit: (message: RealtimeMessage) => {
      for (const handlers of listeners) handlers.onMessage(message)
    },
    reconnect: () => {
      for (const handlers of listeners) handlers.onReconnect?.()
    },
    newVersion: () => {
      for (const handlers of listeners) handlers.onNewVersion?.()
    },
    connections: () => listeners.size
  }
}
