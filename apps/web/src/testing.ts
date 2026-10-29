/** Ayudas para las pruebas de componentes */
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Lo que se ve en la página, sin la región viva (que repite lo que se anuncia) */
export const inMain = () => within(screen.getByRole('main'))

/** Lo último que se ha anunciado a los lectores de pantalla */
export const announced = () => screen.getByRole('status').textContent

/** Cierra la sesión como lo haría alguien: abre el menú de la cuenta (el nombre) y pulsa «Cerrar sesión» */
export async function signOut() {
  const nav = within(await screen.findByRole('navigation', { name: 'Cuenta' }))
  await userEvent.click(await nav.findByRole('button', { expanded: false }))
  await userEvent.click(nav.getByRole('button', { name: 'Cerrar sesión' }))
}
