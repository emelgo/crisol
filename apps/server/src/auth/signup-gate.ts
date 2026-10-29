/**
 * Registro cerrado (ADR-0002): solo se crea una cuenta dentro de un flujo del servidor que lo permita (arranque del
 * propietario, invitación). Cualquier otra vía (el endpoint público de Better Auth, un proveedor social) se rechaza.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const allowance = new AsyncLocalStorage<true>()

/** Ejecuta fn permitiendo que dentro se cree una cuenta */
export function allowSignup<T>(fn: () => Promise<T>): Promise<T> {
  return allowance.run(true, fn)
}

export function signupAllowed(): boolean {
  return allowance.getStore() === true
}
