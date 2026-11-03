import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const CITY = crypto.randomUUID()

describe('aplicar una plantilla a una página ya hecha', () => {
  beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))

  it('desde «⋯»: se elige, se ve lo que añade (y lo que ya tiene) y se aplica sin borrar nada', async () => {
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      pages: [
        {
          id: CITY,
          worldId: WORLD.id,
          title: 'Ciudad Libre',
          properties: [{ name: 'Población', type: 'number', value: 12000 }]
        }
      ]
    })
    const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${CITY}`] }))
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
        api={api.client}
      />
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar plantilla…' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Aplicar plantilla' }))
    await userEvent.click(dialog.getByRole('radio', { name: /^Lugar/ }))
    const summary = within(dialog.getByRole('region', { name: 'Lo que añade Lugar' }))
    expect(summary.getByText('Tipo')).toBeDefined()
    // Población ya está (a mano): no se repite
    expect(within(summary.getByText('Población').closest('li') as HTMLElement).getByText('Ya está')).toBeDefined()
    expect(summary.getByText('Habitantes')).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: 'Aplicar Lugar' }))
    await waitFor(async () => {
      const page = await api.client.call('getPage', { pageId: CITY })
      expect(page.template).toBe('lugar')
      expect(page.properties.map((p) => p.name)).toEqual(['Población', 'Tipo', 'Dentro de', 'Gobierna'])
    })
  })
})
