import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const renderHome = () => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  render(<App router={router} accounts={fakeAccountClient().client} api={fakeApi().client} />)
  return router
}

describe('la portada: «Tengo una invitación»', () => {
  it('se pega el enlace; uno que no lo es se avisa (y el aviso se va al escribir); el bueno lleva a unirse', async () => {
    const router = renderHome()
    await userEvent.click(await screen.findByRole('button', { name: 'Tengo una invitación' }))
    const field = screen.getByLabelText('El enlace de la invitación')
    // Se abre para pegarlo
    expect(document.activeElement).toBe(field)
    await userEvent.type(field, 'hola')
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }))
    expect(screen.getByRole('alert').textContent).toBe('Ese enlace no es una invitación.')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
    await userEvent.clear(field)
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.type(field, 'https://crisol.example/unirse/AbC123xyz{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/unirse/AbC123xyz'))
  })

  it('«Volver» deja la portada como estaba, con el foco en su botón', async () => {
    renderHome()
    await userEvent.click(await screen.findByRole('button', { name: 'Tengo una invitación' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.queryByLabelText('El enlace de la invitación')).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Entrar' }).length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tengo una invitación' }))
    )
  })
})
