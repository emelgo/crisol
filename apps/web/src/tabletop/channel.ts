/**
 * El canal de la mesa (ADR-0018): un WebSocket a /api/table que dice quién mira (el máster o la pantalla de la tele),
 * recibe su proyección y se reconecta solo, esperando cada vez más. El máster manda por él su encuadre en vivo, que la
 * tele sigue con «Seguir», la medida en curso y el láser
 */
import type { LiveMeasure, SceneViewport, TableServerMessage, TableViewer } from '@crisol/contracts'

export type TableStatus = 'connecting' | 'open' | 'reconnecting' | 'forbidden' | 'ended'

export interface TableHandlers {
  onMessage(message: TableServerMessage): void
  onStatus?(status: TableStatus): void
}

export type DragMove = { tokenId: string; x: number; y: number }

export interface TableChannel {
  /** El encuadre del máster: como mucho uno cada `VIEWPORT_MS`, siempre el último */
  sendViewport(view: SceneViewport): void
  /** Unas fichas mientras se arrastran: como mucho uno cada `DRAG_MS`, con lo último de cada una */
  sendDrag(moves: DragMove[]): void
  /** La medida en curso (null: ya no mide): como mucho una cada `LIVE_MS`, siempre la última */
  sendMeasure(measure: LiveMeasure | null): void
  /** Los puntos nuevos de la estela del láser: se juntan y salen como mucho cada `LIVE_MS` */
  sendLaser(points: Array<{ x: number; y: number }>): void
  close(): void
}

/** El servidor cierra así cuando ya no hay sesión o no se puede llevar la mesa: no tiene sentido reconectar */
const SESSION_ENDED = 4401
const FORBIDDEN = 4403
const FIRST_WAIT_MS = 500
const MAX_WAIT_MS = 10_000
/** 20 por segundo: la tele va suave sin llenar el canal */
const VIEWPORT_MS = 50
/** El arrastre, algo menos (el servidor admite 30 mensajes en vivo por segundo entre los dos) */
const DRAG_MS = 70
/** Lo más que lleva un mensaje de arrastre */
const MAX_DRAG_MOVES = 20
/** La medida y el láser (comparten con lo demás los 30 mensajes por segundo) */
const LIVE_MS = 80
/** Lo más que lleva un mensaje del láser */
const MAX_LASER_POINTS = 30

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
  // El arrastre: lo último de cada ficha, esperando a su turno
  const dragging = new Map<string, DragMove>()
  let dragAt = Number.NEGATIVE_INFINITY
  let dragTimer: ReturnType<typeof setTimeout> | undefined
  // La medida (undefined: nada que mandar) y los puntos del láser, esperando a su turno
  let measure: LiveMeasure | null | undefined
  let measureAt = Number.NEGATIVE_INFINITY
  let measureTimer: ReturnType<typeof setTimeout> | undefined
  let laser: Array<{ x: number; y: number }> = []
  let laserAt = Number.NEGATIVE_INFINITY
  let laserTimer: ReturnType<typeof setTimeout> | undefined

  const status = (value: TableStatus) => handlers.onStatus?.(value)
  const isOpen = () => socket !== null && socket.readyState === 1

  const flush = () => {
    pending = undefined
    if (!latest || !isOpen()) return
    sentAt = Date.now()
    socket?.send(JSON.stringify({ type: 'viewport', view: latest }))
  }

  const flushDrag = () => {
    dragTimer = undefined
    if (dragging.size === 0 || !isOpen()) return dragging.clear()
    dragAt = Date.now()
    const moves = [...dragging.values()].slice(0, MAX_DRAG_MOVES)
    dragging.clear()
    socket?.send(JSON.stringify({ type: 'drag', moves }))
  }

  const flushMeasure = () => {
    measureTimer = undefined
    if (measure === undefined || !isOpen()) return
    measureAt = Date.now()
    socket?.send(JSON.stringify({ type: 'measure', measure }))
    measure = undefined
  }

  const flushLaser = () => {
    laserTimer = undefined
    if (laser.length === 0 || !isOpen()) {
      laser = []
      return
    }
    laserAt = Date.now()
    const points = laser.slice(-MAX_LASER_POINTS)
    laser = []
    socket?.send(JSON.stringify({ type: 'laser', points }))
  }

  /**
   * Lo que sale como mucho cada `LIVE_MS`: ahora (aunque esperase su temporizador, que el navegador frena en una pestaña
   * de fondo) o cuando le toque
   */
  const throttle = (at: number, timer: ReturnType<typeof setTimeout> | undefined, flushNow: () => void) => {
    const since = Date.now() - at
    if (since >= LIVE_MS) {
      clearTimeout(timer)
      flushNow()
      return undefined
    }
    return timer ?? setTimeout(flushNow, LIVE_MS - since)
  }

  const open = () => {
    status(joined ? 'reconnecting' : 'connecting')
    const current = new Socket(url)
    socket = current
    current.onopen = () => {
      current.send(JSON.stringify({ type: 'join', campaignId: options.campaignId, view: options.view }))
      // Quién está en la Mesa (ADR-0021): si se entra con la pestaña escondida, se dice
      if (typeof document !== 'undefined' && document.hidden)
        current.send(JSON.stringify({ type: 'presence', active: false }))
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

  // Si la pestaña está a la vista o no: lo enseña la sección Mesa de la campaña («activo» o «en otra pestaña»)
  const visibility = () => {
    if (socket && joined) socket.send(JSON.stringify({ type: 'presence', active: !document.hidden }))
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility)

  open()
  return {
    sendViewport(view) {
      latest = view
      if (pending) return
      const since = Date.now() - sentAt
      if (since >= VIEWPORT_MS) flush()
      else pending = setTimeout(flush, VIEWPORT_MS - since)
    },
    sendDrag(moves) {
      for (const move of moves) dragging.set(move.tokenId, move)
      if (dragTimer) return
      const since = Date.now() - dragAt
      if (since >= DRAG_MS) flushDrag()
      else dragTimer = setTimeout(flushDrag, DRAG_MS - since)
    },
    sendMeasure(next) {
      measure = next
      measureTimer = throttle(measureAt, measureTimer, flushMeasure)
    },
    sendLaser(points) {
      laser.push(...points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })))
      laserTimer = throttle(laserAt, laserTimer, flushLaser)
    },
    close() {
      stopped = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility)
      clearTimeout(retry)
      clearTimeout(pending)
      clearTimeout(dragTimer)
      clearTimeout(measureTimer)
      clearTimeout(laserTimer)
      socket?.close()
    }
  }
}
