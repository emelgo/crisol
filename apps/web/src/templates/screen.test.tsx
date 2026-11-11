import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

function renderTemplates() {
  const api = fakeApi({ organizations: [ORG], worlds: [] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/plantillas'] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('la pantalla «Plantillas»', () => {
  // Su tutorial guiado ya visto: si no, sale y se lleva el foco
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas'] }))
  )

  it('las tuyas (con «Plantilla nueva»), sin plantillas de serie; al pasar por una, lo que trae', async () => {
    renderTemplates()
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas' })).toBeDefined()
    // La API falsa trae de entrada las de ejemplo, como propias
    const mine = within(await screen.findByRole('list', { name: 'Tuyas' }))
    expect(mine.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'PNJ',
      'Lugar',
      'Facción',
      'Objeto',
      'Misión',
      'Sesión'
    ])
    expect(screen.queryByRole('list', { name: 'De serie' })).toBeNull()
    expect(mine.getByRole('button', { name: 'Plantilla nueva' })).toBeDefined()
    await userEvent.hover(mine.getByRole('link', { name: 'Facción' }))
    const preview = within(screen.getByRole('complementary', { name: 'Lo que trae' }))
    expect(preview.getByText('Líder')).toBeDefined()
    expect(preview.getByText('Miembros')).toBeDefined()
    expect(preview.getByText('Quiénes son')).toBeDefined()
  })

  it('«Plantilla nueva» crea «Plantilla sin título» y la abre con el título listo para escribir', async () => {
    const { api, router } = renderTemplates()
    await userEvent.click(await screen.findByRole('button', { name: 'Plantilla nueva' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/plantillas\/[0-9a-f-]{36}$/))
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    expect(title.textContent).toBe('Plantilla sin título')
    await userEvent.keyboard('Frente{Enter}')
    await waitFor(async () =>
      expect((await api.client.call('listTemplates', {})).templates.map((t) => t.name)).toContain('Frente')
    )
    // Otra más: no se repite el nombre
    await userEvent.click(screen.getByRole('button', { name: 'Plantilla nueva' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plantilla nueva' }))
    await waitFor(async () =>
      expect((await api.client.call('listTemplates', {})).templates.map((t) => t.name)).toEqual(
        expect.arrayContaining(['Plantilla sin título', 'Plantilla sin título 2'])
      )
    )
  })

  it('el engranaje de una tuya: cambiarla de nombre y borrarla escribiendo su nombre', async () => {
    const { api } = renderTemplates()
    await api.client.call('createTemplate', { name: 'Frente', icon: 'hourglass' })
    const mine = within(await screen.findByRole('list', { name: 'Tuyas' }))
    await userEvent.click(await mine.findByRole('button', { name: 'Ajustes de Frente' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Frente' }))
    await userEvent.clear(dialog.getByLabelText('Nombre'))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Frentes{Enter}')
    expect(await mine.findByRole('link', { name: 'Frentes' })).toBeDefined()
    await userEvent.click(mine.getByRole('button', { name: 'Ajustes de Frentes' }))
    const again = within(screen.getByRole('dialog', { name: 'Ajustes de Frentes' }))
    await userEvent.click(again.getByRole('button', { name: 'Borrar la plantilla' }))
    const confirm = within(screen.getByRole('dialog', { name: '¿Borrar la plantilla Frentes?' }))
    await userEvent.type(confirm.getByLabelText('Nombre'), 'Frentes')
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar la plantilla' }))
    await waitFor(() => expect(mine.queryByRole('link', { name: 'Frentes' })).toBeNull())
  })
})
