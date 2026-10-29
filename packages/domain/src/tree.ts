/** El árbol de páginas: subpáginas sin límite práctico, con un tope técnico */
export const MAX_PAGE_DEPTH = 32

/**
 * Por qué no se puede poner una página (con su rama) bajo otra, o null si se puede. parentPath: del primer nivel al
 * nuevo padre, ambos incluidos (vacío: a la raíz). subtreeHeight: cuántos niveles ocupa su rama, ella incluida
 */
export function moveBlocker(move: {
  pageId: string
  parentPath: readonly string[]
  subtreeHeight: number
}): 'CYCLE' | 'TOO_DEEP' | null {
  if (move.parentPath.includes(move.pageId)) return 'CYCLE'
  if (move.parentPath.length + move.subtreeHeight > MAX_PAGE_DEPTH) return 'TOO_DEEP'
  return null
}
