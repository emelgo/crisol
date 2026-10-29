/** Cuánto se guarda lo borrado y el historial: la papelera se purga a los 30 días y el historial a los 90 */
export const TRASH_DAYS = 30
export const HISTORY_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

/** Cuándo se purgará algo borrado en ese momento */
export const purgeAt = (deletedAt: Date) => new Date(deletedAt.getTime() + TRASH_DAYS * DAY_MS)

/** Lo borrado antes de esto ya se purga */
export const trashCutoff = (now: Date) => daysBefore(now, TRASH_DAYS)

/** Las operaciones de antes de esto ya se purgan */
export const historyCutoff = (now: Date) => daysBefore(now, HISTORY_DAYS)
