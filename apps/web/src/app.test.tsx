import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from './account/fake.ts'
import { App } from './app.tsx'
import { createAppRouter } from './router.tsx'

const renderAt = (path: string) =>
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
      accounts={fakeAccountClient().client}
    />
  )

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
})

describe('App', () => {
  it('enseña la portada en español', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Crisol' })).toBeDefined()
    expect(screen.getByText('Mundos de rol y mesa virtual')).toBeDefined()
  })

  it('cambia de tema y lo recuerda', async () => {
    renderAt('/')
    document.documentElement.dataset.theme = 'light'
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar a tema oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('crisol.tema')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined()
  })

  it('dice que la página no existe y ofrece volver', async () => {
    renderAt('/no-existe')
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/')
  })
})
