import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from './account/fake.ts'
import { fakeApi } from './api/fake.ts'
import { App } from './app.tsx'
import { createAppRouter } from './router.tsx'

const renderAt = (path: string) =>
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
      accounts={fakeAccountClient().client}
      api={fakeApi().client}
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

  it('el propietario tiene en la barra sus mundos, el historial, la papelera y la IA, con la actual marcada', async () => {
    const owner = fakeApi({ organizations: [{ id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' }] })
    render(
      <App
        router={createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
        api={owner.client}
      />
    )
    const sections = await screen.findByRole('navigation', { name: 'Secciones' })
    for (const name of ['Mundos', 'Historial', 'Papelera', 'IA']) {
      expect(await within(sections).findByRole('link', { name })).toBeDefined()
    }
    expect(within(sections).getByRole('link', { name: 'Mundos' }).getAttribute('aria-current')).toBe('page')
    expect(within(sections).getByRole('link', { name: 'Historial' }).getAttribute('aria-current')).toBeNull()
  })

  it('quien no es propietario solo tiene sus mundos en la barra', async () => {
    render(
      <App
        router={createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))}
        accounts={fakeAccountClient({ account: { name: 'Ana', email: 'a@crisol.test' } }).client}
        api={fakeApi().client}
      />
    )
    const sections = await screen.findByRole('navigation', { name: 'Secciones' })
    expect(await within(sections).findByRole('link', { name: 'Mundos' })).toBeDefined()
    expect(within(sections).queryByRole('link', { name: 'Historial' })).toBeNull()
    expect(within(sections).queryByRole('link', { name: 'IA' })).toBeNull()
  })

  it('sin sesión no hay barra de secciones', async () => {
    renderAt('/entrar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull()
  })

  it('lo primero que se enfoca es «Saltar al contenido», que lleva a la página', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'Crisol' })
    await userEvent.tab()
    const skip = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(document.activeElement).toBe(skip)
    expect(skip.getAttribute('href')).toBe(`#${screen.getByRole('main').id}`)
  })

  it('dice que la página no existe y ofrece volver', async () => {
    renderAt('/no-existe')
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/')
  })
})
