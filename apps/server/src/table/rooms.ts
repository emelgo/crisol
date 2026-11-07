/**
 * Las salas de la mesa (ADR-0018): una por campaña mientras alguien la mira. Cada conexión dice quién mira (el máster o
 * la pantalla de la tele) y recibe su proyección; cuando algo cambia, la sala la vuelve a calcular y la manda. El
 * encuadre del máster va en vivo a las pantallas que lo siguen, sin guardarse
 */
import type { CampaignTableView, SceneViewport, ScreenView, TableServerMessage, TableViewer } from '@crisol/contracts'

/** Lo que la sala necesita de una conexión */
export interface TableSocket {
  send(data: string): void
}

/** La mesa de una campaña, ya proyectada para cada quien mira; null si la campaña ya no existe */
export type LoadTable = (campaignId: string) => Promise<{ master: CampaignTableView; screen: ScreenView } | null>

export interface TableRooms {
  /** Una conexión ya autorizada mira la mesa de la campaña; devuelve con qué darla de baja */
  join(campaignId: string, viewer: TableViewer, socket: TableSocket): Promise<() => void>
  /** La mesa de la campaña cambió: se proyecta otra vez para cada conexión */
  changed(campaignId: string): void
  /** Una escena cambió (su imagen, su rejilla): las salas que la tienen abierta o presentada se refrescan */
  sceneChanged(sceneId: string): void
  /** El encuadre del máster en vivo: a las pantallas de la campaña que lo siguen */
  viewport(campaignId: string, view: SceneViewport): void
  /**
   * Unas fichas mientras el máster las arrastra: a las otras pestañas del máster, todas; a la pantalla, solo las que
   * ve (las de la escena presentada que no están ocultas)
   */
  drag(campaignId: string, moves: TokenMove[], from: TableSocket): void
  /** Cuántas conexiones mira cada campaña (para las pruebas y los registros) */
  size(campaignId: string): number
  /** Cuando ya se ha mandado todo lo pendiente (para las pruebas) */
  idle(): Promise<void>
}

interface Room {
  sockets: Map<TableSocket, TableViewer>
  /** Lo último proyectado: qué escenas tiene y si la pantalla sigue al máster */
  scenes: Set<string>
  follows: boolean
  /** El último encuadre del máster: una pantalla que entra (o se recarga) empieza en él */
  viewport: SceneViewport | null
  /** Las fichas de la escena abierta (las que arrastra el máster) y las que ve la pantalla */
  openTokens: Set<string>
  screenTokens: Set<string>
}

type TokenMove = { tokenId: string; x: number; y: number }

const send = (socket: TableSocket, message: TableServerMessage) => socket.send(JSON.stringify(message))

export function createTableRooms(load: LoadTable, onError: (error: unknown) => void = () => {}): TableRooms {
  const rooms = new Map<string, Room>()
  let queue = Promise.resolve()

  /** Proyecta la mesa y la manda a las conexiones de la sala (a todas o a una) */
  async function refresh(campaignId: string, only?: TableSocket) {
    const room = rooms.get(campaignId)
    if (!room) return
    const table = await load(campaignId)
    if (!table) return
    room.scenes = new Set([table.master.open?.id, table.master.presented?.id].filter((id): id is string => !!id))
    room.follows = table.master.camera.mode === 'follow' && !table.screen.hidden && table.screen.scene !== null
    room.openTokens = new Set(table.master.tokens.map((t) => t.id))
    room.screenTokens = new Set(table.screen.tokens.map((t) => t.id))
    for (const [socket, viewer] of room.sockets) {
      if (only && socket !== only) continue
      if (viewer === 'master') send(socket, { type: 'master', table: table.master })
      else {
        send(socket, { type: 'screen', screen: table.screen })
        if (only && room.follows && room.viewport) send(socket, { type: 'viewport', view: room.viewport })
      }
    }
  }

  /** En orden y sin dejar que un fallo pare a los demás */
  const enqueue = (work: () => Promise<void>) => {
    queue = queue.then(work).catch(onError)
    return queue
  }

  return {
    async join(campaignId, viewer, socket) {
      const room: Room = rooms.get(campaignId) ?? {
        sockets: new Map(),
        scenes: new Set<string>(),
        follows: false,
        viewport: null,
        openTokens: new Set<string>(),
        screenTokens: new Set<string>()
      }
      rooms.set(campaignId, room)
      room.sockets.set(socket, viewer)
      await enqueue(() => refresh(campaignId, socket))
      return () => {
        room.sockets.delete(socket)
        if (room.sockets.size === 0) rooms.delete(campaignId)
      }
    },
    changed(campaignId) {
      if (rooms.has(campaignId)) void enqueue(() => refresh(campaignId))
    },
    sceneChanged(sceneId) {
      for (const [campaignId, room] of rooms) if (room.scenes.has(sceneId)) void enqueue(() => refresh(campaignId))
    },
    viewport(campaignId, view) {
      const room = rooms.get(campaignId)
      if (!room) return
      room.viewport = view
      if (!room.follows) return
      for (const [socket, viewer] of room.sockets) if (viewer === 'screen') send(socket, { type: 'viewport', view })
    },
    drag(campaignId, moves, from) {
      const room = rooms.get(campaignId)
      if (!room) return
      const own = moves.filter((m) => room.openTokens.has(m.tokenId))
      const seen = own.filter((m) => room.screenTokens.has(m.tokenId))
      for (const [socket, viewer] of room.sockets) {
        if (socket === from) continue
        const sent = viewer === 'master' ? own : seen
        if (sent.length > 0) send(socket, { type: 'drag', moves: sent })
      }
    },
    size(campaignId) {
      return rooms.get(campaignId)?.sockets.size ?? 0
    },
    idle() {
      return queue
    }
  }
}
