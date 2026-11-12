/**
 * Mover en un árbol (páginas, carpetas de archivos, etiquetas, carpetas de plantillas): adónde va lo que se suelta o se
 * mueve con el teclado. Funciones puras, para cualquier cosa con id y madre; cada árbol pinta lo suyo y pide aquí el
 * movimiento. Sacado del árbol de páginas (wiki/tree.tsx), que fue el primero
 */

/** Dónde cae lo soltado respecto a una fila: delante, dentro o detrás */
export type Zone = 'before' | 'inside' | 'after'

/** Adónde va: su madre (null, lo más alto) y, si importa el orden, delante o detrás de una hermana */
export type Move = { parentId: string | null; before?: string; after?: string }

/** Lo mínimo de un elemento del árbol */
export interface TreeNode {
  id: string
  parentId: string | null
}

/** Una fila pintada: su nivel (1, lo más alto), su puesto entre sus hermanas y si está desplegada */
export interface TreeRow {
  level: number
  posinset: number
  setsize: number
  expanded: boolean
}

/**
 * La zona de una fila según la altura del puntero en ella (0 arriba, 1 abajo): el cuarto de arriba, delante; el de
 * abajo, detrás; el resto, dentro. Si no admite nada dentro (un archivo), mitad y mitad
 */
export function zoneAt(fraction: number, holds = true): Zone {
  if (!holds) return fraction < 0.5 ? 'before' : 'after'
  return fraction < 0.25 ? 'before' : fraction > 0.75 ? 'after' : 'inside'
}

/** Si `id` está dentro de `ancestorId` (o es ella): soltar ahí lo metería en sí mismo */
export function isInside(parentOf: (id: string) => string | null | undefined, id: string, ancestorId: string) {
  for (let at: string | null | undefined = id; at; at = parentOf(at)) {
    if (at === ancestorId) return true
  }
  return false
}

/**
 * Alt + flechas: arriba y abajo entre hermanas; derecha, dentro de la de encima; izquierda, detrás de su madre.
 * `siblings`: las hermanas del elemento, en su orden, con él; `parentOf`: la madre de una
 */
export function keyboardMove(
  node: TreeNode,
  siblings: readonly TreeNode[],
  parentOf: (id: string) => TreeNode | undefined,
  key: string
): Move | null {
  const at = siblings.findIndex((s) => s.id === node.id)
  const previous = siblings[at - 1]
  const next = siblings[at + 1]
  if (key === 'ArrowUp' && previous) return { parentId: node.parentId, before: previous.id }
  if (key === 'ArrowDown' && next) return { parentId: node.parentId, after: next.id }
  if (key === 'ArrowRight' && previous) return { parentId: previous.id }
  if (key === 'ArrowLeft' && node.parentId)
    return { parentId: parentOf(node.parentId)?.parentId ?? null, after: node.parentId }
  return null
}

/**
 * Llevarlo a la izquierda lo saca de su madre: sobre su propia fila, un nivel por cada paso; sobre la última de una
 * rama (cayendo detrás), detrás de la de ese nivel. Devuelve la fila de ese nivel, o null si no se saca.
 * `steps`: cuántos pasos se ha llevado a la izquierda desde que empezó a arrastrarse; `rowOf`: la fila de un id
 */
export function outdentTarget<R extends TreeRow>(
  row: R,
  node: (row: R) => TreeNode,
  rowOf: (id: string) => R | undefined,
  zone: Zone,
  steps: number,
  draggedId: string | null
): R | null {
  if (steps <= 0) return null
  const self = node(row).id === draggedId
  if (!self && (zone !== 'after' || row.expanded)) return null
  const level = Math.max(1, row.level - steps)
  let current: R | undefined = row
  while (current && current.level > level) {
    // Solo desde la última de cada rama: si no, caería lejos de donde se suelta
    if (!self && current.posinset !== current.setsize) return null
    const parentId: string | null = node(current).parentId
    current = parentId ? rowOf(parentId) : undefined
  }
  return current && current !== row ? current : null
}

/**
 * Adónde iría `dragged` al soltarlo en `target` (en su zona), o null si no se puede (en sí mismo o dentro de lo suyo).
 * `out`: la fila a la que se saca llevándolo a la izquierda (outdentTarget), si la hay
 */
export function dropMove(
  dragged: TreeNode,
  target: TreeNode,
  zone: Zone,
  parentOf: (id: string) => string | null | undefined,
  out: TreeNode | null = null
): Move | null {
  if (out) return out.id === dragged.id ? null : { parentId: out.parentId, after: out.id }
  if (dragged.id === target.id) return null
  const to: Move =
    zone === 'inside'
      ? { parentId: target.id }
      : { parentId: target.parentId, ...(zone === 'before' ? { before: target.id } : { after: target.id }) }
  return to.parentId && isInside(parentOf, to.parentId, dragged.id) ? null : to
}
