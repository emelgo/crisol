/**
 * Las salas de la mesa (ADR-0018): una por campaña mientras alguien la mira. Cada conexión dice quién mira (el máster o
 * la pantalla de la tele) y recibe su proyección; cuando algo cambia, la sala la vuelve a calcular y la manda. El
 * encuadre del máster va en vivo a las pantallas que lo siguen, sin guardarse, y también la medida en curso (con «la
 * tele ve lo que mides») y el láser, solo en lo que el grupo ve o vio
 */
import type {
  CampaignTableView,
  LiveMeasure,
  SceneViewport,
  ScreenView,
  TableServerMessage,
  TableViewer
} from '@crisol/contracts'

/** Lo que la sala necesita de una conexión */
export interface TableSocket {
  send(data: string): void
}

/** Lo que ve el grupo ahora en la escena presentada: para no mandar a la pantalla el arrastre fuera de su vista */
export interface ScreenSight {
  hasPoint(p: { x: number; y: number }): boolean
}

/**
 * La mesa de una campaña, ya proyectada para cada quien mira; null si la campaña ya no existe. Con lo que el grupo ve
 * ahora de la escena presentada (el arrastre) y lo que ve o vio (la medida y el láser)
 */
export type LoadTable = (campaignId: string) => Promise<{
  master: CampaignTableView
  screen: ScreenView
  screenVisible?: ScreenSight | null
  screenMask?: ScreenSight | null
} | null>

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
   * ve el grupo (de la escena presentada, sin ocultar) y mientras pasan por lo que ve
   */
  drag(campaignId: string, moves: TokenMove[], from: TableSocket): void
  /**
   * La medida en curso del máster: a sus otras pestañas, siempre; a la pantalla, con «la tele ve lo que mides», si
   * mira la misma escena y la medida cae entera en lo que el grupo ve o vio (si no, se le quita la que tuviera)
   */
  measure(campaignId: string, measure: LiveMeasure | null, from: TableSocket): void
  /** La estela del láser: a las otras pestañas del máster, entera; a la pantalla, sus puntos en lo que ve o vio */
  laser(campaignId: string, points: Point[], from: TableSocket): void
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
  screenVisible: ScreenSight | null
  /** Lo que el grupo ve o vio de la escena presentada, si es la abierta (la medida y el láser son de la abierta) */
  sameSceneMask: ScreenSight | null
  measureOnScreen: boolean
  /** La pantalla tiene una medida pintada (hay que quitársela si deja de valer) */
  measureShown: boolean
  /** Su cola: lo que tiene que proyectar, en orden (cada campaña la suya: una lenta no hace esperar a las demás) */
  chain: Promise<void>
  /** Ya hay una vuelta en la cola sin empezar: los cambios que lleguen hasta entonces van en ella */
  queued: boolean
}

type TokenMove = { tokenId: string; x: number; y: number }
type Point = { x: number; y: number }

const send = (socket: TableSocket, message: TableServerMessage) => socket.send(JSON.stringify(message))

export function createTableRooms(load: LoadTable, onError: (error: unknown) => void = () => {}): TableRooms {
  const rooms = new Map<string, Room>()
  /** Lo que está en cola en alguna sala (para `idle`) */
  const running = new Set<Promise<void>>()

  /** Proyecta la mesa y la manda a las conexiones de la sala (a todas o a una) */
  async function refresh(campaignId: string, only?: TableSocket) {
    const room = rooms.get(campaignId)
    if (!room) return
    const table = await load(campaignId)
    if (!table) return
    room.scenes = new Set([table.master.open?.id, table.master.presented?.id].filter((id): id is string => !!id))
    // El encuadre del máster es de su escena abierta: la pantalla solo lo sigue si es la que enseña
    room.follows =
      table.master.camera.mode === 'follow' &&
      !table.screen.hidden &&
      table.screen.scene !== null &&
      table.master.open?.id === table.screen.scene.id
    room.openTokens = new Set(table.master.tokens.map((t) => t.id))
    room.screenTokens = new Set(table.screen.tokens.map((t) => t.id))
    room.screenVisible = table.screenVisible ?? null
    const same = table.master.open !== null && table.master.open.id === table.screen.scene?.id
    room.sameSceneMask = same ? (table.screenMask ?? null) : null
    room.measureOnScreen = table.master.measureOnScreen === true
    // Se apagó «la tele ve lo que mides» o cambió la escena: la medida pintada se va
    if (room.measureShown && (!room.measureOnScreen || !room.sameSceneMask)) {
      room.measureShown = false
      toScreens(room, { type: 'measure', measure: null })
    }
    for (const [socket, viewer] of room.sockets) {
      if (only && socket !== only) continue
      if (viewer === 'master') send(socket, { type: 'master', table: table.master })
      else {
        send(socket, { type: 'screen', screen: table.screen })
        if (only && room.follows && room.viewport) send(socket, { type: 'viewport', view: room.viewport })
      }
    }
  }

  /** A las pantallas de la sala */
  function toScreens(room: Room, message: TableServerMessage) {
    for (const [socket, viewer] of room.sockets) if (viewer === 'screen') send(socket, message)
  }

  /** A las otras pestañas del máster */
  function toOtherMasters(room: Room, message: TableServerMessage, from: TableSocket) {
    for (const [socket, viewer] of room.sockets) if (viewer === 'master' && socket !== from) send(socket, message)
  }

  /**
   * Algo cambió y la sala aún no se ha puesto al día: hasta entonces, el arrastre no llega a la pantalla (la ficha pudo
   * ocultarse o salir de lo que ve el grupo)
   */
  function stale(room: Room) {
    room.screenTokens = new Set()
    room.screenVisible = null
  }

  /** En la cola de la sala, en orden y sin dejar que un fallo pare a los demás */
  const enqueue = (room: Room, work: () => Promise<void>) => {
    const next = room.chain.then(work).catch(onError)
    room.chain = next
    running.add(next)
    void next.then(() => running.delete(next))
    return next
  }

  /** Una vuelta para proyectar la sala entera, salvo que ya haya una en la cola sin empezar */
  const refreshAll = (campaignId: string, room: Room) => {
    if (room.queued) return
    room.queued = true
    void enqueue(room, () => {
      room.queued = false
      return refresh(campaignId)
    })
  }

  return {
    async join(campaignId, viewer, socket) {
      const room: Room = rooms.get(campaignId) ?? {
        sockets: new Map(),
        scenes: new Set<string>(),
        follows: false,
        viewport: null,
        openTokens: new Set<string>(),
        screenTokens: new Set<string>(),
        screenVisible: null,
        sameSceneMask: null,
        measureOnScreen: false,
        measureShown: false,
        chain: Promise.resolve(),
        queued: false
      }
      rooms.set(campaignId, room)
      room.sockets.set(socket, viewer)
      await enqueue(room, () => refresh(campaignId, socket))
      return () => {
        room.sockets.delete(socket)
        if (room.sockets.size === 0) rooms.delete(campaignId)
      }
    },
    changed(campaignId) {
      const room = rooms.get(campaignId)
      if (!room) return
      stale(room)
      refreshAll(campaignId, room)
    },
    sceneChanged(sceneId) {
      for (const [campaignId, room] of rooms)
        if (room.scenes.has(sceneId)) {
          stale(room)
          refreshAll(campaignId, room)
        }
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
      const sight = room.screenVisible
      const seen = own.filter((m) => room.screenTokens.has(m.tokenId) && sight?.hasPoint(m) === true)
      for (const [socket, viewer] of room.sockets) {
        if (socket === from) continue
        const sent = viewer === 'master' ? own : seen
        if (sent.length > 0) send(socket, { type: 'drag', moves: sent })
      }
    },
    measure(campaignId, measure, from) {
      const room = rooms.get(campaignId)
      if (!room) return
      toOtherMasters(room, { type: 'measure', measure }, from)
      const mask = room.sameSceneMask
      const fits =
        measure !== null && room.measureOnScreen && mask !== null && measure.points.every((p) => mask.hasPoint(p))
      if (fits) {
        room.measureShown = true
        toScreens(room, { type: 'measure', measure })
      } else if (room.measureShown) {
        room.measureShown = false
        toScreens(room, { type: 'measure', measure: null })
      }
    },
    laser(campaignId, points, from) {
      const room = rooms.get(campaignId)
      if (!room) return
      toOtherMasters(room, { type: 'laser', points }, from)
      const mask = room.sameSceneMask
      const seen = mask ? points.filter((p) => mask.hasPoint(p)) : []
      if (seen.length > 0) toScreens(room, { type: 'laser', points: seen })
    },
    size(campaignId) {
      return rooms.get(campaignId)?.sockets.size ?? 0
    },
    async idle() {
      while (running.size > 0) await Promise.all([...running])
    }
  }
}
