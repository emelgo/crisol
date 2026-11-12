/**
 * «Sin desenfoque» (Ajustes, tanda 5): en este aparato, sin fondo de ambiente ni cristal, todo opaco (para un ordenador
 * justo de fuerzas, o para quien lo prefiera). Se guarda en el navegador y se marca en <html data-plain>, que es lo que
 * miran los tokens (styles/tokens.css)
 */
import { useSyncExternalStore } from 'react'

const KEY = 'crisol.sin-desenfoque'
const listeners = new Set<() => void>()

const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Pone la marca en <html> (al cargar y al cambiarla) */
export function applyPlain(plain = read()) {
  document.documentElement.toggleAttribute('data-plain', plain)
}

export function setPlain(plain: boolean) {
  try {
    if (plain) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento: vale para esta visita
  }
  applyPlain(plain)
  for (const listener of listeners) listener()
}

export function usePlain() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => document.documentElement.hasAttribute('data-plain'),
    () => false
  )
}
