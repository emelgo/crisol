import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

// El tutorial guiado de Mis mundos ya hecho: que no se ponga en medio
beforeEach(() => {
  for (const email of ['e@crisol.test', 'a@crisol.test']) {
    localStorage.setItem(`crisol.recorridos.${email}`, JSON.stringify({ seen: ['mundos'] }))
  }
})

afterEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('enseña la portada en español', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Crisol' })).toBeDefined()
    expect(screen.getByText('Mundos de rol y mesa virtual')).toBeDefined()
  })

  it('el propietario tiene en la barra sus mundos y sus archivos, con la actual marcada, y abajo el historial y la papelera', async () => {
    const owner = fakeApi({ organizations: [{ id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' }] })
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
        api={owner.client}
      />
    )
    const sections = await screen.findByRole('navigation', { name: 'Secciones' })
    for (const name of ['Mundos', 'Archivos']) {
      expect(await within(sections).findByRole('link', { name })).toBeDefined()
    }
    expect(within(sections).getByRole('link', { name: 'Mundos' }).getAttribute('aria-current')).toBe('page')
    expect(within(sections).getByRole('link', { name: 'Archivos' }).getAttribute('aria-current')).toBeNull()
    // Historial y Papelera no llevan a otra página: se abren encima de la que se ve
    for (const name of ['Historial', 'Papelera']) {
      await userEvent.click(await screen.findByRole('button', { name }))
      const opened = await screen.findByRole('dialog', { name })
      expect(within(opened).getByRole('heading', { level: 1, name })).toBeDefined()
      expect(router.state.location.pathname).toBe('/mundos')
      await userEvent.click(within(opened).getAllByRole('button', { name: 'Cerrar' })[0] as HTMLElement)
      expect(screen.queryByRole('dialog', { name })).toBeNull()
    }
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
    await screen.findByText('Aún no tienes mundos')
    expect(within(sections).queryByRole('link', { name: 'Archivos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Historial' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Papelera' })).toBeNull()
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
