/**
 * Cerrar lo que flota junto al d20 (los dados abiertos, el historial) desde dentro: suelta antes lo inerte de detrás
 * (en el móvil) para que el foco pueda volver al d20
 */
import { createContext, useContext, useSyncExternalStore } from 'react'

export const CloseFloating = createContext<() => void>(() => {})

export const useCloseFloating = () => useContext(CloseFloating)

/** El d20: adonde vuelve el foco al cerrar */
export const focusLauncher = () => document.querySelector<HTMLElement>('[data-tour="dados"]')?.focus()

/** En el móvil la ficha es una hoja con la página oscurecida: se porta como una ventana */
const SHEET = '(max-width: 48rem)'
export function useSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(SHEET)
      query?.addEventListener('change', onChange)
      return () => query?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(SHEET).matches ?? false,
    () => false
  )
}
