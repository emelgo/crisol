import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { type ActionName, ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = {
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
const campaign: Campaign = {
  id: crypto.randomUUID(),
  worldId: world.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}

/** La API, con esa acción fallando (como un 500 o sin red) hasta que `recover` la arregle. role: el de quien entra */
function renderAt(
  path: string,
  broken: ActionName,
  error: unknown = new ApiError('UNKNOWN', 500),
  role: World['role'] = 'master'
) {
  const api = fakeApi({
    organizations: [role === 'master' ? ORG : { ...ORG, role: 'member' }],
    worlds: [{ ...world, role }],
    campaigns: [{ ...campaign, role }]
  })
  const original = api.client.call
  let failing = true
  api.client.call = async (name, input) => {
    if (failing && name === broken) throw error
    return original(name, input)
  }
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
    />
  )
  return {
    recover: () => {
      failing = false
    }
  }
}

// Un 500 o un fallo de red se reintentan (tres veces, cada vez esperando más) antes de darse por fallidos
const afterRetries = () => vi.advanceTimersByTimeAsync(10_000)
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

describe('si no llega lo que necesita una página', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Los tutoriales guiados ya hechos: que no se pongan en medio
    localStorage.setItem('crisol.recorridos.e@crisol.test', JSON.stringify({ seen: ['mundos', 'mundo', 'campanas'] }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('un mundo: dice que no se ha podido cargar (no que no existe) y deja reintentarlo', async () => {
    const { recover } = renderAt(`/mundos/${world.id}`, 'listWorlds')
    await afterRetries()
    expect(await screen.findByRole('heading', { level: 1, name: 'No se ha podido cargar' })).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.queryByText('Este mundo no existe')).toBeNull()
    recover()
    await user().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
  })

  it('una campaña, sin red: lo mismo, con sus campañas', async () => {
    const { recover } = renderAt(
      `/mundos/${world.id}/campanas/${campaign.id}`,
      'listCampaigns',
      new TypeError('Failed to fetch')
    )
    await afterRetries()
    expect(await screen.findByRole('heading', { level: 1, name: 'No se ha podido cargar' })).toBeDefined()
    expect(screen.queryByText('Esta campaña no existe')).toBeNull()
    recover()
    await user().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
  })

  it('mientras reintenta, se ve como cargando: ni el error ni «no existe»', async () => {
    renderAt(`/mundos/${world.id}`, 'listWorlds')
    await afterRetries()
    await user().click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText('Este mundo no existe')).toBeNull()
    await afterRetries()
    expect(await screen.findByRole('heading', { level: 1, name: 'No se ha podido cargar' })).toBeDefined()
  })

  it('mis mundos: el error, en vez de una lista vacía', async () => {
    renderAt('/mundos', 'listWorlds')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeDefined()
  })

  it('las campañas de un mundo (en el Inicio de quien juega): el error, bajo el mundo', async () => {
    renderAt(`/mundos/${world.id}`, 'listCampaigns', undefined, 'player')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
  })

  it('y en su pestaña Campañas: el error, bajo el título', async () => {
    renderAt(`/mundos/${world.id}/campanas`, 'listCampaigns')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('heading', { level: 1, name: 'Campañas' })).toBeDefined()
    expect(screen.queryByText('Aún no hay campañas')).toBeNull()
  })

  it('lo último de la wiki: el error, bajo el mundo, y se puede reintentar', async () => {
    const { recover } = renderAt(`/mundos/${world.id}`, 'listRecentPages')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(screen.queryByText('Aún no hay artículos.')).toBeNull()
    recover()
    await user().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no hay artículos.')).toBeDefined()
  })

  it('si falla una parte del Inicio, el título de la página sigue siendo el del mundo', async () => {
    const { recover } = renderAt(`/mundos/${world.id}`, 'listRecentPages')
    await afterRetries()
    await screen.findByRole('alert')
    const titles = () => screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)
    expect(titles()).toEqual(['Eana'])
    expect(document.title).toBe('Eana · Crisol')
    recover()
    await user().click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Aún no hay artículos.')
    expect(document.title).toBe('Eana · Crisol')
  })

  it('en la campaña, los miembros: el error, en vez de nada', async () => {
    renderAt(`/mundos/${world.id}/campanas/${campaign.id}`, 'listMembers')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
  })

  it('y el enlace de invitación: el error, bajo los miembros', async () => {
    renderAt(`/mundos/${world.id}/campanas/${campaign.id}`, 'getInvitation')
    await afterRetries()
    expect((await screen.findByRole('alert')).textContent).toBe('Algo ha fallado. Vuelve a intentarlo.')
    expect(screen.getByRole('list', { name: 'Miembros' })).toBeDefined()
  })
})
