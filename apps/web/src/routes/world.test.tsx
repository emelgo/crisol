import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world = (role: World['role'] = 'master'): World => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1
})
const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })

const renderAt = (path: string, api: ReturnType<typeof fakeApi>) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={signedIn().client} api={api.client} />)
  return router
}

describe('un mundo y sus campañas', () => {
  it('desde mis mundos se entra en un mundo', async () => {
    const w = world()
    const router = renderAt('/mundos', fakeApi({ organizations: [ORG], worlds: [w] }))
    await userEvent.click(await screen.findByRole('link', { name: 'Eana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}`)
  })

  it('el máster crea campañas y las renombra', async () => {
    const w = world()
    renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()
    await userEvent.type(screen.getByLabelText('Nombre de la campaña'), 'La Marca')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la campaña' }))
    const list = await screen.findByRole('list', { name: 'Campañas' })
    expect(within(list).getByText('La Marca')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Renombrar La Marca' }))
    const input = screen.getByLabelText('Nuevo nombre de La Marca')
    await userEvent.clear(input)
    await userEvent.type(input, 'La Marca del Este')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await within(list).findByText('La Marca del Este')).toBeDefined()
  })

  it('un jugador ve sus campañas pero no puede crear ni renombrar', async () => {
    const w = world('player')
    const api = fakeApi({ organizations: [{ ...ORG, role: 'member' }], worlds: [w] })
    api.campaigns.push({ id: crypto.randomUUID(), worldId: w.id, name: 'La Marca', role: 'player', version: 1 })
    renderAt(`/mundos/${w.id}`, api)
    const list = await screen.findByRole('list', { name: 'Campañas' })
    expect(within(list).getByText('Jugador')).toBeDefined()
    expect(screen.queryByLabelText('Nombre de la campaña')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renombrar La Marca' })).toBeNull()
  })

  it('la franja dice si eres su máster y cuántas campañas tiene', async () => {
    const w = world()
    const campaigns = ['La Marca', 'La Torre'].map((name) => ({
      id: crypto.randomUUID(),
      worldId: w.id,
      name,
      role: 'master' as const,
      version: 1
    }))
    renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w], campaigns }))
    expect(await screen.findByText('Eres su máster.')).toBeDefined()
    const count = await screen.findByText('Campañas', { selector: 'dt' })
    expect(count.nextElementSibling?.textContent).toBe('2')
  })

  it('un mundo que no está en la lista no existe', async () => {
    renderAt(`/mundos/${crypto.randomUUID()}`, fakeApi({ organizations: [ORG] }))
    expect(await screen.findByRole('heading', { name: 'Este mundo no existe' })).toBeDefined()
  })
})
