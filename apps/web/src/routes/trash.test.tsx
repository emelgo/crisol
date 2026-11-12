import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { inMain } from '../testing.ts'

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

/** Abre la ventana de ajustes de algo por su engranaje y, en su zona de peligro, la confirmación de borrarlo */
async function openDelete(name: string, action: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Ajustes de ${name}` }))
  const settings = within(await screen.findByRole('dialog', { name: `Ajustes de ${name}` }))
  const zone = within(settings.getByRole('region', { name: 'Zona de peligro' }))
  await userEvent.click(zone.getByRole('button', { name: action }))
  return within(await screen.findByRole('dialog', { name: `¿Borrar «${name}»?` }))
}

describe('borrar y la papelera', () => {
  // Los tutoriales guiados ya hechos: que no se pongan en medio
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.e@crisol.test', JSON.stringify({ seen: ['mundos', 'mundo', 'campanas'] }))
  )

  it('el máster borra una campaña tras confirmar; está en la papelera del mundo y la restaura', async () => {
    const { router } = renderAt(`/mundos/${world.id}/campanas`)
    const confirm = await openDelete('La Marca', 'Borrar la campaña')
    expect(
      confirm.getByText('Irá a la papelera y sus jugadores dejarán de verla. Se podrá recuperar durante 30 días.')
    ).toBeDefined()
    await userEvent.type(confirm.getByLabelText('Nombre de la campaña'), 'La Marca')
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar la campaña' }))
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()

    // La papelera de la barra, dentro del mundo, es la suya, y se abre encima sin dejar la página
    await userEvent.click(screen.getByRole('button', { name: 'Papelera' }))
    const trash = await screen.findByRole('dialog', { name: 'Papelera' })
    expect(await within(trash).findByRole('heading', { level: 1, name: 'Papelera de Eana' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${world.id}/campanas`)
    expect(trashItems()[0]).toMatch(/^La Marca.*Se borra del todo el/)
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar La Marca' }))
    expect(await screen.findByText('La papelera está vacía.')).toBeDefined()
    await userEvent.click(within(trash).getByRole('button', { name: 'Cerrar' }))
    expect(await inMain().findByRole('link', { name: 'La Marca' })).toBeDefined()
  })

  it('cancelar no borra', async () => {
    const { api } = renderAt(`/mundos/${world.id}/campanas`)
    const confirm = await openDelete('La Marca', 'Borrar la campaña')
    await userEvent.click(confirm.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: '¿Borrar «La Marca»?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Ajustes de La Marca' })).toBeDefined()
    expect(inMain().getByRole('link', { name: 'La Marca' })).toBeDefined()
    expect(api.calls).not.toContain('deleteCampaign')
  })

  it('el propietario borra un mundo y lo restaura desde la papelera de la organización', async () => {
    renderAt('/mundos')
    const confirm = await openDelete('Eana', 'Borrar el mundo')
    await userEvent.type(confirm.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar el mundo' }))
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Papelera' }))
    const trash = await screen.findByRole('dialog', { name: 'Papelera' })
    expect(await within(trash).findByRole('heading', { level: 1, name: 'Papelera' })).toBeDefined()
    expect(trashItems()[0]).toMatch(/^Eana.*Mundo/)
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Eana' }))
    expect(await screen.findByText('La papelera está vacía.')).toBeDefined()
    await userEvent.click(within(trash).getByRole('button', { name: 'Cerrar' }))
    expect(await inMain().findByRole('link', { name: 'Eana' })).toBeDefined()
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
    renderAt(`/mundos/${world.id}/campanas`, 'player')
    await screen.findByRole('link', { name: 'La Marca' })
    expect(screen.queryByRole('button', { name: 'Ajustes de La Marca' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Papelera' })).toBeNull()
  })
})
