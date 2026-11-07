// Portado de packages/mesa/src/nucleo/rejilla.ts y camara.ts (Crisol actual, commit 3f68f11)
/** Tipos y cuentas de geometría que comparten la rejilla, las cámaras y las teselas. Puro: sin DOM ni render. */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** Un rectángulo: su esquina de arriba a la izquierda y su tamaño */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Si el punto cae dentro del polígono (regla par-impar) */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
