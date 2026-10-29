/**
 * Los modos de IA: qué hace Claude con la cuenta que lo conectó. Leer siempre es libre; según el modo y el tipo de
 * acción, lo demás se hace, espera la aprobación de esa cuenta o no se hace.
 */
export type AiMode = 'readOnly' | 'assistant' | 'copilot'

/** El tipo de cada acción del contrato */
export type ActionKind = 'read' | 'write' | 'delete' | 'players'

export const AI_MODES: readonly AiMode[] = ['readOnly', 'assistant', 'copilot']

/** Como en el Crisol actual */
export const DEFAULT_AI_MODE: AiMode = 'copilot'

/** run: se hace; ask: espera la aprobación; refuse: no se hace */
export type AiDecision = 'run' | 'ask' | 'refuse'

/** Solo lectura: solo consulta. Asistente: el resto espera. Copiloto: escribe libre; borrar y jugadores esperan */
export function aiDecision(mode: AiMode, kind: ActionKind): AiDecision {
  if (kind === 'read') return 'run'
  if (mode === 'readOnly') return 'refuse'
  if (mode === 'assistant') return 'ask'
  return kind === 'write' ? 'run' : 'ask'
}

/** Cuánto espera la herramienta a que se apruebe antes de contestar «esperando la aprobación» */
export const APPROVAL_WAIT_MS = 15_000

/** Lo que nadie aprueba en 24 h caduca */
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000

export const approvalExpiresAt = (requestedAt: Date) => new Date(requestedAt.getTime() + APPROVAL_TTL_MS)

/**
 * Cómo está una petición de la IA: en la cola, aprobada (haciéndose), hecha, fallida (se aprobó, pero con los permisos
 * de ahora no se pudo), rechazada o caducada
 */
export type ApprovalStatus = 'pending' | 'approved' | 'done' | 'failed' | 'rejected' | 'expired'

/** Lo que se guarda: la caducidad no, porque depende de la hora */
export type StoredApprovalStatus = Exclude<ApprovalStatus, 'expired'>

/** Una petición pendiente pasada su hora ya está caducada */
export function approvalStatus(stored: { status: StoredApprovalStatus; expiresAt: Date }, now: Date): ApprovalStatus {
  return stored.status === 'pending' && now.getTime() >= stored.expiresAt.getTime() ? 'expired' : stored.status
}
