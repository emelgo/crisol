import { HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

/** Con qué abrir el WebSocket de la edición en vivo (las pruebas de componentes no lo abren) */
export interface CollabClient {
  connect(): HocuspocusProviderWebsocket
}

/** El de verdad: /api/collab en el mismo sitio, con las cookies de la sesión */
export function createCollabClient(): CollabClient {
  return {
    connect: () =>
      new HocuspocusProviderWebsocket({
        url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/collab`
      })
  }
}

const ClientContext = createContext<CollabClient | null>(null)
const SocketContext = createContext<HocuspocusProviderWebsocket | null>(null)

export function CollabClientProvider({ client, children }: { client: CollabClient | null; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
}

/**
 * Un WebSocket por pestaña mientras se está en la wiki: lleva todos los documentos abiertos (el cuerpo y sus secretos)
 * y se cierra al salir de ella o al cambiar de cuenta
 */
export function CollabSocket({ children }: { children: ReactNode }) {
  const client = useContext(ClientContext)
  const [socket, setSocket] = useState<HocuspocusProviderWebsocket | null>(null)
  useEffect(() => {
    if (!client) return
    const opened = client.connect()
    setSocket(opened)
    return () => {
      opened.destroy()
      setSocket(null)
    }
  }, [client])
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

/** El WebSocket de la wiki, o null sin edición en vivo (o mientras se abre) */
export function useCollabSocket() {
  return useContext(SocketContext)
}
