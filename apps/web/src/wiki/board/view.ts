/** El encuadre de la pizarra (puro, para sus herramientas de abajo y sus pruebas) */

const MIN_ZOOM = 0.1
const MAX_ZOOM = 30

/** El zoom tras multiplicarlo (o ponerlo) alrededor del centro de lo que se ve, con su encuadre */
export function zoomedAround(
  state: { width: number; height: number; scrollX: number; scrollY: number; zoom: { value: number } },
  next: number
) {
  const value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  const cx = state.width / 2
  const cy = state.height / 2
  return {
    zoom: value,
    scrollX: state.scrollX + cx / value - cx / state.zoom.value,
    scrollY: state.scrollY + cy / value - cy / state.zoom.value
  }
}
