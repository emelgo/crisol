import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
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

const renderAt = (path: string, role: World['role'] = 'master') => {
  const api = fakeApi({
    organizations: [role === 'master' ? ORG : { ...ORG, role: 'member' }],
    worlds: [{ ...world, role }],
    campaigns: [{ ...campaign, role }]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

const trashItems = () =>
  within(screen.getByRole('list', { name: 'En la papelera' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('borrar y la papelera', () => {
  it('el máster borra una campaña tras confirmar; está en la papelera del mundo y la restaura', async () => {
    const { router } = renderAt(`/mundos/${world.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar La Marca' }))
    expect(screen.getByText('¿Borrar La Marca? Irá a la papelera: se puede restaurar durante 30 días.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()

    await userEvent.click(screen.getByRole('link', { name: 'Papelera de Eana' }))
    expect(router.state.location.pathname).toBe(`/mundos/${world.id}/papelera`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Papelera de Eana' })).toBeDefined()
    expect(trashItems()[0]).toMatch(/^La Marca.*Se borra del todo el/)
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar La Marca' }))
    expect(await screen.findByText('La papelera está vacía')).toBeDefined()
    await userEvent.click(screen.getByRole('link', { name: 'Eana' }))
    expect(await screen.findByRole('link', { name: 'La Marca' })).toBeDefined()
  })

  it('cancelar no borra', async () => {
    const { api } = renderAt(`/mundos/${world.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar La Marca' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('link', { name: 'La Marca' })).toBeDefined()
    expect(api.calls).not.toContain('deleteCampaign')
  })

  it('el propietario borra un mundo y lo restaura desde la papelera de la organización', async () => {
    renderAt('/mundos')
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar Eana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    const sections = screen.getByRole('navigation', { name: 'Secciones' })
    await userEvent.click(within(sections).getByRole('link', { name: 'Papelera' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Papelera' })).toBeDefined()
    expect(trashItems()[0]).toMatch(/^Eana.*Mundo/)
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Eana' }))
    expect(await screen.findByText('La papelera está vacía')).toBeDefined()
  })

  it('si entretanto se borró su mundo, la campaña no se restaura sola: lo dice', async () => {
    const { api } = renderAt('/papelera')
    await api.client.call('deleteCampaign', { campaignId: campaign.id })
    window.dispatchEvent(new Event('focus'))
    const restore = await screen.findByRole('button', { name: 'Restaurar La Marca' })
    await api.client.call('deleteWorld', { worldId: world.id })
    await userEvent.click(restore)
    expect(await screen.findByText('Restaura antes su mundo')).toBeDefined()
  })

  it('un jugador no ve ni borrar ni la papelera', async () => {
    renderAt(`/mundos/${world.id}`, 'player')
    await screen.findByRole('link', { name: 'La Marca' })
    expect(screen.queryByRole('button', { name: 'Borrar La Marca' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Papelera de Eana' })).toBeNull()
  })
})
