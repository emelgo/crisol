/**
 * Las conexiones de IA en este proceso (ADR-0030): cuándo usó cada una el conector por última vez y cuáles se han
 * quitado. Los tokens de acceso son JWT de una hora que se comprueban sin base de datos: quitar una conexión revoca sus
 * tokens de refresco, y aquí se apunta para rechazar al momento los de acceso que ya tenía. Si el servidor se reinicia,
 * lo que se olvida es como mucho esa hora (y el último uso vuelve al de la última renovación)
 */
export interface AiConnections {
  /** Apunta que esa conexión acaba de usar el conector */
  used(userId: string, clientId: string, resource: string): void
  lastUsed(userId: string, clientId: string, resource: string): Date | undefined
  /** Quitada ahora: los tokens emitidos hasta este momento dejan de valer */
  removed(userId: string, clientId: string, resource: string): void
  /** Si un token emitido entonces (iat, en segundos) es de una conexión quitada después */
  isRemoved(userId: string, clientId: string, resource: string, issuedAt: number): boolean
}

const key = (userId: string, clientId: string, resource: string) => JSON.stringify([userId, clientId, resource])

export function createAiConnections(now: () => number = Date.now): AiConnections {
  const uses = new Map<string, number>()
  const removals = new Map<string, number>()
  return {
    used(userId, clientId, resource) {
      uses.set(key(userId, clientId, resource), now())
    },
    lastUsed(userId, clientId, resource) {
      const at = uses.get(key(userId, clientId, resource))
      return at === undefined ? undefined : new Date(at)
    },
    removed(userId, clientId, resource) {
      const k = key(userId, clientId, resource)
      removals.set(k, now())
      uses.delete(k)
    },
    isRemoved(userId, clientId, resource, issuedAt) {
      const at = removals.get(key(userId, clientId, resource))
      return at !== undefined && issuedAt * 1000 <= at
    }
  }
}
