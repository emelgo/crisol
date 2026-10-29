import type { RealtimeMessage } from '@crisol/contracts'
import { type Actor, type Capability, can, type Target } from '@crisol/domain'

/** A quién le llega: a una cuenta, o a quienes pueden eso sobre eso con sus pertenencias de ese momento */
export type Audience = { userId: string } | { capability: Capability; target: Target }

export interface RealtimeEvent {
  to: Audience
  message: RealtimeMessage
}

/** Lo que el canal necesita de una conexión */
export interface RealtimeSocket {
  send(data: string): void
}

export interface Realtime {
  /** Manda los eventos, en el orden en que se publican, a quien le toque. No espera ni falla */
  publish(...events: RealtimeEvent[]): void
  /**
   * La cuenta ya no está en la campaña: se le avisa. No hay suscripciones guardadas que cerrar, porque cada evento
   * vuelve a mirar sus pertenencias; desde ahora no le llega nada de ella
   */
  revoke(userId: string, scope: { worldId: string; campaignId: string }): void
  /** Da de alta una conexión de la cuenta; devuelve con qué darla de baja */
  connect(userId: string, socket: RealtimeSocket): () => void
  /** Cuando ya se ha mandado todo lo publicado (para las pruebas) */
  idle(): Promise<void>
}

/** El bus del proceso. loadActor lee las pertenencias de la base de datos en cada publicación: revocar es inmediato */
export function createRealtime(
  loadActor: (userId: string) => Promise<Actor>,
  onError: (error: unknown) => void = () => {}
): Realtime {
  const sockets = new Map<string, Set<RealtimeSocket>>()
  let queue = Promise.resolve()

  async function deliver(events: RealtimeEvent[]) {
    const actors = new Map<string, Promise<Actor>>()
    const actorOf = (userId: string) => {
      const loaded = actors.get(userId) ?? loadActor(userId)
      actors.set(userId, loaded)
      return loaded
    }
    for (const event of events) {
      const data = JSON.stringify(event.message)
      for (const [userId, connections] of sockets) {
        try {
          const to = event.to
          const receives = 'userId' in to ? to.userId === userId : can(await actorOf(userId), to.capability, to.target)
          if (!receives) continue
        } catch (error) {
          onError(error)
          continue
        }
        for (const socket of connections) {
          try {
            socket.send(data)
          } catch (error) {
            onError(error)
          }
        }
      }
    }
  }

  const realtime: Realtime = {
    publish(...events) {
      queue = queue.then(() => deliver(events)).catch(onError)
    },
    revoke(userId, scope) {
      realtime.publish({ to: { userId }, message: { type: 'revoked', ...scope } })
    },
    connect(userId, socket) {
      const connections = sockets.get(userId) ?? new Set()
      connections.add(socket)
      sockets.set(userId, connections)
      return () => {
        connections.delete(socket)
        if (connections.size === 0) sockets.delete(userId)
      }
    },
    idle: () => queue
  }
  return realtime
}
