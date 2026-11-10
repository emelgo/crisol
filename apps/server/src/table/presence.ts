/**
 * Quién está en la Mesa de cada campaña ahora (ADR-0021: lo enseña la sección Mesa de la campaña): cada conexión del
 * canal de la mesa, con quién es, cómo mira (el máster, una jugadora, la tele), desde cuándo y si tiene la pestaña a
 * la vista. En memoria, como las salas: al reiniciar el servidor, cada uno vuelve a entrar
 */
import type { TableViewer } from '@crisol/contracts'

export interface PresenceEntry {
  userId: string
  viewer: TableViewer
  /** Desde cuándo (la primera de sus conexiones) */
  since: string
  /** Con alguna de sus pestañas a la vista */
  active: boolean
  /** Cuántas pestañas tiene abiertas */
  tabs: number
}

export interface TablePresence {
  /** Entra una conexión; con `close`, para cortarla si echan a quien la tiene (docs/specs/sala.md) */
  add(campaignId: string, key: object, entry: { userId: string; viewer: TableViewer; close?: () => void }): void
  setActive(campaignId: string, key: object, active: boolean): boolean
  remove(campaignId: string, key: object): void
  list(campaignId: string): PresenceEntry[]
  /** Cierra las Mesas de jugador de esa persona en esa campaña (la echan); cuántas */
  disconnect(campaignId: string, userId: string): number
}

export function createTablePresence(now: () => Date = () => new Date()): TablePresence {
  const rooms = new Map<
    string,
    Map<object, { userId: string; viewer: TableViewer; since: Date; active: boolean; close?: () => void }>
  >()
  return {
    add(campaignId, key, entry) {
      const room = rooms.get(campaignId) ?? new Map()
      room.set(key, { ...entry, since: now(), active: true })
      rooms.set(campaignId, room)
    },
    setActive(campaignId, key, active) {
      const found = rooms.get(campaignId)?.get(key)
      if (!found || found.active === active) return false
      found.active = active
      return true
    },
    remove(campaignId, key) {
      const room = rooms.get(campaignId)
      room?.delete(key)
      if (room && room.size === 0) rooms.delete(campaignId)
    },
    disconnect(campaignId, userId) {
      let closed = 0
      for (const entry of [...(rooms.get(campaignId)?.values() ?? [])]) {
        if (entry.userId !== userId || entry.viewer !== 'player') continue
        entry.close?.()
        closed++
      }
      return closed
    },
    list(campaignId) {
      // Una entrada por persona y forma de mirar: sus pestañas, juntas
      const merged = new Map<string, PresenceEntry & { at: Date }>()
      for (const entry of rooms.get(campaignId)?.values() ?? []) {
        const id = `${entry.userId}|${entry.viewer}`
        const seen = merged.get(id)
        if (!seen) {
          merged.set(id, {
            userId: entry.userId,
            viewer: entry.viewer,
            since: entry.since.toISOString(),
            active: entry.active,
            tabs: 1,
            at: entry.since
          })
          continue
        }
        seen.tabs++
        seen.active ||= entry.active
        if (entry.since < seen.at) {
          seen.at = entry.since
          seen.since = entry.since.toISOString()
        }
      }
      return [...merged.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).map(({ at: _, ...entry }) => entry)
    }
  }
}
