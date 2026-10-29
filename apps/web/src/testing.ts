/** Ayudas para las pruebas de componentes */
import { screen, within } from '@testing-library/react'

/** Lo que se ve en la página, sin la región viva (que repite lo que se anuncia) */
export const inMain = () => within(screen.getByRole('main'))

/** Lo último que se ha anunciado a los lectores de pantalla */
export const announced = () => screen.getByRole('status').textContent
