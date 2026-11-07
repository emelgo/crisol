// Portado de packages/mesa/src/nucleo/laser.ts (Crisol actual, commit 3f68f11)
/** La estela del puntero láser: va en vivo por el canal de la mesa y no se guarda. Puro */
import type { Point } from './geometry.ts'

/** Lo que dura cada punto de la estela */
export const LASER_LIFE_MS = 700

/** Los puntos de la estela que siguen vivos, con su vida (0–1) para el grosor y la opacidad */
export function liveTrail(
  points: readonly (Point & { t: number })[],
  now: number,
  life = LASER_LIFE_MS
): (Point & { life: number })[] {
  return points.filter((p) => now - p.t < life).map((p) => ({ x: p.x, y: p.y, life: 1 - (now - p.t) / life }))
}
