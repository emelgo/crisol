import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useReturnFocus } from './focus.ts'

/** Un botón que abre un formulario; cerrar() lo cierra (al guardar, cuando llegue la respuesta) */
let close: () => void = () => {}
function Opener() {
  const button = useReturnFocus()
  const [open, setOpen] = useState(false)
  close = () => {
    button.back()
    setOpen(false)
  }
  return (
    <>
      {open ? (
        <input aria-label="Dentro" />
      ) : (
        <button type="button" ref={button.ref} onClick={() => setOpen(true)}>
          Abrir
        </button>
      )}
      <input aria-label="Fuera" />
    </>
  )
}

describe('devolver el foco al botón que abrió algo', () => {
  it('al cerrarse, el foco vuelve al botón', async () => {
    render(<Opener />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByLabelText('Dentro'))
    act(() => close())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }))
  })

  it('si mientras tanto la persona se fue a otro sitio, no se le quita el foco', async () => {
    render(<Opener />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByLabelText('Fuera'))
    act(() => close())
    expect(document.activeElement).toBe(screen.getByLabelText('Fuera'))
  })
})
