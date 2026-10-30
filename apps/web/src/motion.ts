/**
 * Las animaciones: completas (por defecto), reducidas (solo fundidos) o como pida el sistema. Se aplica con
 * data-motion en <html> («full» o «reduced»), que es lo que miran los estilos; index.html lo pone antes de pintar
 */
export type Motion = 'full' | 'reduced' | 'system'

export const MOTION_KEY = 'crisol.movimiento'

const REDUCE = '(prefers-reduced-motion: reduce)'

export function chosenMotion(): Motion {
  try {
    const stored = localStorage.getItem(MOTION_KEY)
    return stored === 'reduced' || stored === 'system' ? stored : 'full'
  } catch {
    return 'full'
  }
}

/** Lo que se ve con lo elegido: con «como el sistema», lo que pida el sistema ahora */
export function resolveMotion(choice: Motion, systemReduces: boolean): 'full' | 'reduced' {
  if (choice === 'system') return systemReduces ? 'reduced' : 'full'
  return choice
}

const systemReduces = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCE).matches

function apply(choice: Motion) {
  document.documentElement.dataset.motion = resolveMotion(choice, systemReduces())
}

export function setMotion(choice: Motion) {
  try {
    localStorage.setItem(MOTION_KEY, choice)
  } catch {
    // Sin almacenamiento, vale para esta visita
  }
  apply(choice)
}

/**
 * Al arrancar la app: aplica lo elegido (por si index.html no lo hizo, como con los cambios en caliente) y, con «como
 * el sistema», si el sistema cambia mientras la app está abierta, lo sigue
 */
export function startMotion() {
  apply(chosenMotion())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(REDUCE).addEventListener('change', () => {
    if (chosenMotion() === 'system') apply('system')
  })
}
