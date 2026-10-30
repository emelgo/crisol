/**
 * Las sesiones de edición (ADR-0003): los cambios de una cuenta en una página se agrupan en una sola entrada del
 * historial y una versión. Empieza con el primer cambio y se cierra tras unos minutos sin cambios, a los 15 minutos,
 * al irse su última conexión a la página, o antes de una operación del servidor sobre ella. Viven en memoria: si el
 * servidor se para con una abierta, se cierra al volver a cargar la página (la huella no coincide)
 */

export interface SessionTimes {
  /** Sin cambios durante este tiempo, se cierra */
  idleMs: number
  /** Como mucho dura esto */
  maxMs: number
}

export const SESSION_TIMES: SessionTimes = { idleMs: 3 * 60_000, maxMs: 15 * 60_000 }

interface Open {
  worldId: string
  idle: ReturnType<typeof setTimeout>
  max: ReturnType<typeof setTimeout>
}

export interface Sessions {
  /** Un cambio de esa cuenta en esa página: abre su sesión o la alarga */
  touch(pageId: string, worldId: string, userId: string): void
  /** Una conexión más (o menos) de esa cuenta a algún documento de la página */
  connected(pageId: string, userId: string): void
  disconnected(pageId: string, userId: string): void
  /** Cierra las sesiones abiertas de una página (antes de una operación del servidor sobre ella) */
  closePage(pageId: string): Promise<void>
  /** Cierra todas (al parar el servidor) */
  closeAll(): Promise<void>
  /** Si alguien tiene una abierta en la página */
  isOpen(pageId: string): boolean
}

/** close: apunta la sesión (su versión y su operación). Las de una página se cierran de una en una */
export function createSessions(
  close: (session: { pageId: string; worldId: string; userId: string }) => Promise<void>,
  onError: (error: unknown) => void,
  times: SessionTimes = SESSION_TIMES
): Sessions {
  const open = new Map<string, Map<string, Open>>()
  const connections = new Map<string, number>()
  // Lo que se está cerrando en cada página: el siguiente cierre espera al anterior
  const queue = new Map<string, Promise<void>>()

  const finish = (pageId: string, userId: string): Promise<void> => {
    const session = open.get(pageId)?.get(userId)
    if (!session) return queue.get(pageId) ?? Promise.resolve()
    clearTimeout(session.idle)
    clearTimeout(session.max)
    open.get(pageId)?.delete(userId)
    if (open.get(pageId)?.size === 0) open.delete(pageId)
    const previous = queue.get(pageId) ?? Promise.resolve()
    const next = previous.then(() => close({ pageId, worldId: session.worldId, userId })).catch(onError)
    queue.set(pageId, next)
    void next.then(() => {
      if (queue.get(pageId) === next) queue.delete(pageId)
    })
    return next
  }

  return {
    touch(pageId, worldId, userId) {
      const page = open.get(pageId) ?? new Map<string, Open>()
      open.set(pageId, page)
      const current = page.get(userId)
      if (current) {
        clearTimeout(current.idle)
        current.idle = setTimeout(() => void finish(pageId, userId), times.idleMs)
        return
      }
      page.set(userId, {
        worldId,
        idle: setTimeout(() => void finish(pageId, userId), times.idleMs),
        max: setTimeout(() => void finish(pageId, userId), times.maxMs)
      })
    },
    connected(pageId, userId) {
      const key = `${pageId}/${userId}`
      connections.set(key, (connections.get(key) ?? 0) + 1)
    },
    disconnected(pageId, userId) {
      const key = `${pageId}/${userId}`
      const left = (connections.get(key) ?? 1) - 1
      if (left > 0) {
        connections.set(key, left)
        return
      }
      connections.delete(key)
      void finish(pageId, userId)
    },
    async closePage(pageId) {
      const users = [...(open.get(pageId)?.keys() ?? [])]
      await Promise.all(users.map((userId) => finish(pageId, userId)))
      await (queue.get(pageId) ?? Promise.resolve())
    },
    async closeAll() {
      await Promise.all([...open.keys()].map((pageId) => this.closePage(pageId)))
      // Y las que ya se estaban cerrando (al irse su última conexión)
      await Promise.all([...queue.values()])
    },
    isOpen: (pageId) => (open.get(pageId)?.size ?? 0) > 0
  }
}
