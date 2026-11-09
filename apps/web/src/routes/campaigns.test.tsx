import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// Entrar en una campaña es entrar en su Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

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
const campaign = (w: World, name: string): Campaign => ({
  id: crypto.randomUUID(),
  worldId: w.id,
  name,
  description: '',
  color: null,
  cover: null,
  role: w.role,
  version: 1
})

/** La pestaña Campañas de ese mundo, con esas campañas (quien juega, sin ser propietario) */
const renderCampaigns = (w: World, campaigns: Campaign[] = []) => {
  const api = fakeApi({
    organizations: [w.role === 'master' ? ORG : { ...ORG, role: 'member' }],
    worlds: [w],
    campaigns
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${w.id}/campanas`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

const list = async () => within(await screen.findByRole('list', { name: 'Campañas' }))
const names = async () => (await list()).getAllByRole('link').map((link) => link.textContent)

describe('las campañas de un mundo', () => {
  // Los tutoriales guiados ya hechos: que no se pongan en medio
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundos', 'mundo', 'campanas', 'campana'] })
    )
  )

  it('salen en el orden en que se crearon, y cada una lleva a la suya', async () => {
    const w = world()
    const torre = campaign(w, 'La Torre')
    const { router } = renderCampaigns(w, [campaign(w, 'La Marca'), torre, campaign(w, 'Las Islas')])
    expect(await screen.findByRole('heading', { level: 1, name: 'Campañas' })).toBeDefined()
    expect(await names()).toEqual(['La Marca', 'La Torre', 'Las Islas'])
    // Cada una se abre en su espacio, en la misma pestaña (la Mesa, en otra)
    const link = (await list()).getByRole('link', { name: 'La Torre' })
    expect(link.getAttribute('href')).toBe(`/mundos/${w.id}/campanas/${torre.id}`)
    expect(link.getAttribute('target')).toBeNull()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}/campanas`)
  })

  it('sin campañas lo dice y deja crear la primera en un cuadro', async () => {
    const { api } = renderCampaigns(world())
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Crear la primera campaña' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva campaña' }))
    // El cursor ya está en el nombre
    expect(document.activeElement).toBe(dialog.getByLabelText('Nombre de la campaña'))
    await userEvent.type(dialog.getByLabelText('Nombre de la campaña'), 'La Marca')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear la campaña' }))
    expect(await names()).toEqual(['La Marca'])
    expect((await list()).getByText('Máster')).toBeDefined()
    expect(api.calls).toContain('createCampaign')
  })

  it('con campañas, «Nueva campaña» es un recuadro tras la última, y la nueva sale al final', async () => {
    const w = world()
    renderCampaigns(w, [campaign(w, 'La Marca')])
    const items = (await list()).getAllByRole('listitem')
    const last = within(items[items.length - 1] as HTMLElement)
    await userEvent.click(last.getByRole('button', { name: 'Nueva campaña' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva campaña' }))
    await userEvent.type(dialog.getByLabelText('Nombre de la campaña'), 'La Torre')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear la campaña' }))
    expect(await (await list()).findByRole('link', { name: 'La Torre' })).toBeDefined()
    expect(await names()).toEqual(['La Marca', 'La Torre'])
  })

  it('en su engranaje se cambian el nombre y la descripción', async () => {
    const w = world()
    const { api } = renderCampaigns(w, [campaign(w, 'La Marca')])
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de La Marca' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de La Marca' }))
    const input = dialog.getByLabelText('Nombre de la campaña')
    await userEvent.clear(input)
    await userEvent.type(input, 'La Marca del Este')
    await userEvent.type(dialog.getByLabelText('Descripción'), 'Frontera de los dragones')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect(await (await list()).findByRole('link', { name: 'La Marca del Este' })).toBeDefined()
    expect((await list()).getByText('Frontera de los dragones')).toBeDefined()
    expect(api.calls).toContain('updateCampaign')
    expect(api.calls).not.toContain('renameCampaign')
  })

  it('desde su zona de peligro se borra, escribiendo su nombre, y queda en la papelera del mundo', async () => {
    const w = world()
    const { api } = renderCampaigns(w, [campaign(w, 'La Marca')])
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de La Marca' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de La Marca' }))
    const zone = within(settings.getByRole('region', { name: 'Zona de peligro' }))
    await userEvent.click(zone.getByRole('button', { name: 'Borrar la campaña' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar «La Marca»?' }))
    const field = confirm.getByLabelText('Nombre de la campaña')
    expect(document.activeElement).toBe(field)
    const button = confirm.getByRole<HTMLButtonElement>('button', { name: 'Borrar la campaña' })
    await userEvent.type(field, 'La Marc')
    expect(button.disabled).toBe(true)
    await userEvent.type(field, 'a')
    await userEvent.click(button)
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()
    expect(api.calls).toContain('deleteCampaign')

    await userEvent.click(screen.getByRole('button', { name: 'Papelera' }))
    const trash = within(await screen.findByRole('dialog', { name: 'Papelera' }))
    expect(await trash.findByRole('heading', { level: 1, name: 'Papelera de Eana' })).toBeDefined()
    const items = within(await trash.findByRole('list', { name: 'En la papelera' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([expect.stringMatching(/^La Marca.*Campaña de Eana/)])
  })

  it('quien juega ve las suyas, sin engranaje ni «Nueva campaña»', async () => {
    const w = world('player')
    renderCampaigns(w, [campaign(w, 'La Marca')])
    expect(await names()).toEqual(['La Marca'])
    expect((await list()).getByText('Jugador')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Ajustes de La Marca' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nueva campaña' })).toBeNull()
  })

  it('quien juega, sin campañas, no puede crear la primera', async () => {
    renderCampaigns(world('player'))
    expect(await screen.findByText('Aún no hay campañas')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Crear la primera campaña' })).toBeNull()
  })

  it('las de un mundo que no está en la lista: no existe', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG] })
    const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${w.id}/campanas`] }))
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
        api={api.client}
      />
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Este mundo no existe' })).toBeDefined()
    expect(api.calls).not.toContain('listCampaigns')
  })
})
