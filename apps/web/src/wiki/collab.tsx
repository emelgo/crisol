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
export function CollabSocket({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const client = useContext(ClientContext)
  const [socket, setSocket] = useState<HocuspocusProviderWebsocket | null>(null)
  // enabled: abierto solo mientras haga falta (en la Mesa, con alguna página en ventana), sin cambiar el árbol de dentro
  useEffect(() => {
    if (!client || !enabled) return
    const opened = client.connect()
    setSocket(opened)
    return () => {
      opened.destroy()
      setSocket(null)
    }
  }, [client, enabled])
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

/** El WebSocket de la wiki, o null sin edición en vivo (o mientras se abre) */
export function useCollabSocket() {
  return useContext(SocketContext)
}

interface SharedDocument {
  document: Y.Doc
  provider: HocuspocusProvider
  users: number
  /** El cierre, que espera un poco por si vuelve a pintarse enseguida */
  closing: ReturnType<typeof setTimeout> | null
}

/**
 * Lo que espera un documento sin nadie antes de cerrarse. Al llegar el cuerpo, un secreto se vuelve a pintar varias
 * veces seguidas: cerrar y volver a abrir el mismo nombre tan seguido le llega al servidor cruzado (cierra también la
 * conexión nueva) y lo que se escribía no salía de la pestaña
 */
const LINGER_MS = 1500

/**
 * Los documentos abiertos en cada WebSocket, uno por nombre: el WebSocket solo lleva un proveedor por documento, y quitar
 * uno quita el nombre entero (y se lo dice al servidor). Si un bloque se vuelve a pintar (un secreto, al llegar el
 * cuerpo) y el nuevo se abre antes de cerrarse el viejo, al cerrarse este el nuevo se quedaría sin conexión. Por eso se
 * comparten, y se cierran un poco después de irse el último que los usa
 */
const opened = new WeakMap<HocuspocusProviderWebsocket, Map<string, SharedDocument>>()

function openShared(socket: HocuspocusProviderWebsocket, name: string): SharedDocument {
  let documents = opened.get(socket)
  if (!documents) {
    documents = new Map()
    opened.set(socket, documents)
  }
  const existing = documents.get(name)
  if (existing) {
    if (existing.closing) clearTimeout(existing.closing)
    existing.closing = null
    existing.users++
    return existing
  }
  const document = new Y.Doc()
  // La sesión va en la cookie; el servidor pide un token para comprobar cada documento
  const provider = new HocuspocusProvider({ websocketProvider: socket, name, document, token: 'sesion' })
  provider.attach()
  const shared: SharedDocument = { document, provider, users: 1, closing: null }
  documents.set(name, shared)
  return shared
}

function closeShared(socket: HocuspocusProviderWebsocket, name: string, shared: SharedDocument) {
  shared.users--
  if (shared.users > 0) return
  shared.closing = setTimeout(() => {
    if (shared.users > 0) return
    opened.get(socket)?.delete(name)
    shared.provider.destroy()
    shared.document.destroy()
  }, LINGER_MS)
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
    const shared = openShared(socket, name)
    const onSynced = () => setState((current) => ({ ...current, synced: true }))
    const onStatus = ({ status }: { status: string }) =>
      setState((current) => ({ ...current, offline: status === 'disconnected' }))
    shared.provider.on('synced', onSynced)
    // Compartido y ya al día: no volverá a avisar
    if (shared.provider.synced) onSynced()
    socket.on('status', onStatus)
    setSession({ document: shared.document, provider: shared.provider })
    return () => {
      socket.off('status', onStatus)
      shared.provider.off('synced', onSynced)
      closeShared(socket, name, shared)
      setSession(null)
      setState({ synced: false, offline: false })
    }
  }, [socket, name])
  return { session, ...state }
}
