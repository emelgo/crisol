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

  it('las tuyas (con «Plantilla nueva») y las de serie, con su candado; al pasar por una, lo que trae', async () => {
    renderTemplates()
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas' })).toBeDefined()
    const builtIn = within(await screen.findByRole('list', { name: 'De serie' }))
    expect(builtIn.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'PNJ',
      'Lugar',
      'Facción',
      'Objeto',
      'Misión',
      'Sesión'
    ])
    expect(builtIn.getAllByLabelText('No se puede cambiar')).toHaveLength(6)
    expect(
      within(screen.getByRole('list', { name: 'Tuyas' })).getByRole('button', { name: 'Plantilla nueva' })
    ).toBeDefined()
    await userEvent.hover(builtIn.getByRole('link', { name: 'Facción' }))
    const preview = within(screen.getByRole('complementary', { name: 'Lo que trae' }))
    expect(preview.getByText('Líder')).toBeDefined()
    expect(preview.getByText('Miembros')).toBeDefined()
    expect(preview.getByText('Quiénes son')).toBeDefined()
  })

  it('«Plantilla nueva» desde cero: nombre e icono, y se abre', async () => {
    const { router } = renderTemplates()
    await userEvent.click(await screen.findByRole('button', { name: 'Plantilla nueva' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Plantilla nueva' }))
    expect(dialog.getByRole('radio', { name: 'Desde cero' })).toHaveProperty('checked', true)
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Frente')
    await userEvent.click(dialog.getByRole('radio', { name: 'Reloj de arena' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Crear la plantilla' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/plantillas\/[0-9a-f-]{36}$/))
    expect(await screen.findByRole('heading', { level: 1, name: 'Frente' })).toBeDefined()
  })

  it('«Copiar» una de serie: la nueva viene de ella, con sus campos', async () => {
    const { api } = renderTemplates()
    const pnj = (await screen.findAllByRole('listitem')).find((li) => within(li).queryByRole('link', { name: 'PNJ' }))
    if (!pnj) throw new Error('sin PNJ')
    await userEvent.click(within(pnj).getByRole('button', { name: 'Copiar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Plantilla nueva' }))
    expect(dialog.getByRole('radio', { name: 'Copiando otra' })).toHaveProperty('checked', true)
    expect(dialog.getByLabelText('Nombre')).toHaveProperty('value', 'PNJ (copia)')
    await userEvent.clear(dialog.getByLabelText('Nombre'))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'PNJ de Eana{Enter}')
    await waitFor(async () => {
      const { templates } = await api.client.call('listTemplates', {})
      expect(templates.find((t) => t.name === 'PNJ de Eana')).toMatchObject({ basedOn: 'pnj', builtIn: false })
    })
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
