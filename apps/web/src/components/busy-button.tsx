import type { ComponentProps } from 'react'

/**
 * Un botón que lanza una petición. Mientras está en curso (busy) no hace nada, pero conserva el foco: con disabled, el
 * navegador lo mandaría a body
 */
export function BusyButton({ busy, onClick, type = 'button', ...props }: ComponentProps<'button'> & { busy: boolean }) {
  return (
    <button
      type={type}
      {...props}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        // También el envío del formulario (con Intro en un campo, el navegador pulsa este botón)
        if (busy) event.preventDefault()
        else onClick?.(event)
      }}
    />
  )
}
