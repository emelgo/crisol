import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const renderAt = (path: string, signedIn = true) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const accounts = fakeAccountClient(
    signedIn ? { account: { name: 'Enrique', email: 'enrique@crisol.test' } } : undefined
  )
  render(<App router={router} accounts={accounts.client} api={fakeApi().client} />)
  return router
}

// La navegación de la cuenta, cuando ya está en pantalla
const accountNav = async () => within(await screen.findByRole('navigation', { name: 'Cuenta' }))
const signOutButton = () => screen.queryByRole('button', { name: 'Cerrar sesión' })

describe('el menú de la cuenta', () => {
  it('el nombre lo abre con el email, el perfil y cerrar sesión; Escape lo cierra y el foco vuelve al nombre', async () => {
    renderAt('/mundos')
    const nav = await accountNav()
    const name = await nav.findByRole('button', { name: 'Enrique', expanded: false })
    expect(signOutButton()).toBeNull()
    await userEvent.click(name)
    expect(name.getAttribute('aria-expanded')).toBe('true')
    expect(nav.getByText('enrique@crisol.test')).toBeDefined()
    expect(nav.getByRole('link', { name: 'Perfil' })).toBeDefined()
    expect(nav.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(signOutButton()).toBeNull()
    expect(document.activeElement).toBe(name)
  })

  it('pulsar fuera lo cierra', async () => {
    renderAt('/mundos')
    const nav = await accountNav()
    await userEvent.click(await nav.findByRole('button', { name: 'Enrique' }))
    await userEvent.click(await screen.findByRole('heading', { level: 1, name: 'Mis mundos' }))
    expect(signOutButton()).toBeNull()
  })

  it('salir de él con el tabulador lo cierra', async () => {
    renderAt('/mundos')
    const nav = await accountNav()
    await userEvent.click(await nav.findByRole('button', { name: 'Enrique' }))
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(signOutButton())
    await userEvent.tab()
    expect(signOutButton()).toBeNull()
  })

  it('«Perfil» lleva al perfil y cierra el menú', async () => {
    const router = renderAt('/mundos')
    const nav = await accountNav()
    await userEvent.click(await nav.findByRole('button', { name: 'Enrique' }))
    await userEvent.click(nav.getByRole('link', { name: 'Perfil' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/perfil')
    expect(signOutButton()).toBeNull()
  })

  it('sin sesión, en su lugar está «Entrar»', async () => {
    renderAt('/', false)
    const nav = await accountNav()
    expect(await nav.findByRole('link', { name: 'Entrar' })).toBeDefined()
    expect(nav.queryByRole('button', { expanded: false })).toBeNull()
  })
})
