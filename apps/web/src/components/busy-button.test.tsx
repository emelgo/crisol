import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BusyButton } from './busy-button.tsx'

describe('un botón ocupado', () => {
  it('mientras está ocupado no hace nada ni envía su formulario, pero se puede enfocar', async () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault())
    const { rerender } = render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <BusyButton type="submit" busy onClick={onClick}>
          Guardar
        </BusyButton>
      </form>
    )
    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(button)
    expect(document.activeElement).toBe(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()

    rerender(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <BusyButton type="submit" busy={false} onClick={onClick}>
          Guardar
        </BusyButton>
      </form>
    )
    expect(button.getAttribute('aria-disabled')).toBeNull()
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('sin tipo, es un botón normal: no envía el formulario', async () => {
    const onSubmit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <BusyButton busy={false}>Aprobar</BusyButton>
      </form>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
