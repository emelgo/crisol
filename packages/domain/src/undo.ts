/**
 * Deshacer una operación del historial: qué se puede deshacer, si algo de lo que tocó se cambió después y los pasos
 * inversos. Aplicarlos (con las filas bloqueadas) es cosa de la base de datos.
 */

/** Una fila tal como la guarda el historial: completa, con los nombres de columna de SQL */
export type Row = Record<string, unknown>

/** Un cambio de una operación: cómo estaba la fila antes y cómo quedó (null: no existía o se quitó) */
export interface RowChange {
  tableName: string
  rowId: string
  before: Row | null
  after: Row | null
}

/**
 * Un paso del deshacer: quitar una fila, o dejarla como estaba (la misma fila, con el mismo id y su versión). after: como
 * la dejó la operación (null si la quitó), para devolver solo lo que ella cambió
 */
export type UndoStep =
  | { kind: 'remove'; tableName: string; rowId: string }
  | { kind: 'restore'; tableName: string; row: Row; after: Row | null }

/** Por qué no se puede deshacer una operación, sin mirar sus filas; null si se puede */
export function undoBlocker(operation: {
  via: 'ui' | 'ai' | 'system'
  undoneById: string | null
}): 'ALREADY_UNDONE' | 'NOT_UNDOABLE' | null {
  // Lo deshecho no se deshace dos veces: se deshace su deshacer
  if (operation.undoneById) return 'ALREADY_UNDONE'
  // Lo del sistema (crear la organización, dar de alta al propietario) sostiene todo lo demás
  if (operation.via === 'system') return 'NOT_UNDOABLE'
  return null
}

/**
 * El primer cambio cuya fila ya no está como la dejó la operación: otra la tocó después. La versión identifica el
 * estado: deshacer deja la de antes, así que tras deshacer lo posterior se puede deshacer lo anterior. Si la operación
 * tocó una fila varias veces (crearla y luego darle sus propiedades), cuenta cómo la dejó al final
 */
export function staleChange(
  changes: readonly RowChange[],
  current: (tableName: string, rowId: string) => Row | null
): RowChange | null {
  const last = new Map<string, RowChange>()
  for (const change of changes) last.set(`${change.tableName}/${change.rowId}`, change)
  for (const change of last.values()) {
    const now = current(change.tableName, change.rowId)
    const stale = change.after === null ? now !== null : now === null || now.version !== change.after.version
    if (stale) return change
  }
  return null
}

/** Los pasos inversos, del último cambio al primero (lo que dependía de algo se quita antes que ese algo) */
export function undoSteps(changes: readonly RowChange[]): UndoStep[] {
  return [...changes]
    .reverse()
    .map((change) =>
      change.before === null
        ? { kind: 'remove', tableName: change.tableName, rowId: change.rowId }
        : { kind: 'restore', tableName: change.tableName, row: change.before, after: change.after }
    )
}

/**
 * La fila que deja un paso de deshacer: si sigue ahí, la de ahora con las columnas que cambió la operación como estaban
 * antes; lo demás no se toca (un contador que lleva su propia cuenta fuera del historial, como las entradas del enlace).
 * Si ya no está, la de antes entera
 */
export function restoredRow(current: Row | null, before: Row, after: Row | null): Row {
  if (!current || !after) return before
  const changed = Object.keys(before).filter(
    (column) => JSON.stringify(before[column]) !== JSON.stringify(after[column])
  )
  return { ...current, ...Object.fromEntries(changed.map((column) => [column, before[column]])) }
}
