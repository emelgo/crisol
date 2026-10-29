import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })

const renderWorlds = (api = fakeApi({ organizations: [ORG] }), accounts = signedIn()) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
  render(<App router={router} accounts={accounts.client} api={api.client} />)
  return { router, api }
}

describe('mis mundos', () => {
  it('con sesión, la portada lleva a mis mundos', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
    render(<App router={router} accounts={signedIn().client} api={fakeApi({ organizations: [ORG] }).client} />)
    await userEvent.click(await screen.findByRole('link', { name: 'Mis mundos' }))
    expect(await screen.findByRole('heading', { name: 'Mis mundos' })).toBeDefined()
  })

  it('sin mundos lo dice y deja crear el primero', async () => {
    renderWorlds()
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    await userEvent.type(screen.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el mundo' }))
    const list = await screen.findByRole('list', { name: 'Mundos' })
    expect(within(list).getByText('Eana')).toBeDefined()
    expect(within(list).getByText('Máster')).toBeDefined()
  })

  it('renombra un mundo', async () => {
    const world = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master' as const, version: 1 }
    const { api } = renderWorlds(fakeApi({ organizations: [ORG], worlds: [world] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Eana' }))
    const input = screen.getByLabelText('Nuevo nombre de Eana')
    await userEvent.clear(input)
    await userEvent.type(input, 'Eana (Fateforge)')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Eana (Fateforge)')).toBeDefined()
    expect(api.calls).toContain('renameWorld')
  })

  it('cancelar el renombrado deja el nombre como estaba', async () => {
    const world = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master' as const, version: 1 }
    renderWorlds(fakeApi({ organizations: [ORG], worlds: [world] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Eana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nuevo nombre de Eana')).toBeNull()
    expect(screen.getByText('Eana')).toBeDefined()
  })

  it('quien no es propietario no ve el formulario de crear', async () => {
    renderWorlds(fakeApi({ organizations: [{ ...ORG, role: 'member' }] }))
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    expect(screen.queryByLabelText('Nombre del mundo')).toBeNull()
  })

  it('sin sesión lleva a entrar', async () => {
    const { router } = renderWorlds(fakeApi(), fakeAccountClient())
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('si el servidor rechaza crear, lo dice', async () => {
    const api = fakeApi({ organizations: [ORG] })
    const original = api.client.call
    api.client.call = async (name, input) => {
      if (name === 'createWorld') throw new ApiError('FORBIDDEN', 403)
      return original(name, input)
    }
    renderWorlds(api)
    await userEvent.type(await screen.findByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el mundo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No tienes permiso')
  })
})
