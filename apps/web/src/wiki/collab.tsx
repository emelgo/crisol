import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import * as Y from 'yjs'

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

/**
 * Un documento de Yjs abierto por el WebSocket de la wiki mientras se usa: el cuerpo de una página (page:<id>) o un
 * secreto o una nota oculta (doc:<id>). null: aún no (o sin nombre)
 */
export function useCollabDocument(name: string | null) {
  const socket = useCollabSocket()
  const [session, setSession] = useState<{ document: Y.Doc; provider: HocuspocusProvider } | null>(null)
  const [state, setState] = useState({ synced: false, offline: false })
  useEffect(() => {
    if (!socket || !name) return
    const document = new Y.Doc()
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name,
      document,
      // La sesión va en la cookie; el servidor pide un token para comprobar cada documento
      token: 'sesion',
      onSynced: () => setState((current) => ({ ...current, synced: true }))
    })
    const onStatus = ({ status }: { status: string }) =>
      setState((current) => ({ ...current, offline: status === 'disconnected' }))
    socket.on('status', onStatus)
    provider.attach()
    setSession({ document, provider })
    return () => {
      socket.off('status', onStatus)
      provider.destroy()
      document.destroy()
      setSession(null)
      setState({ synced: false, offline: false })
    }
  }, [socket, name])
  return { session, ...state }
}
