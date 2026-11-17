import type { Campaign, CampaignTableView, World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import { EANA } from '../chronologies/fixtures.ts'
import '../i18n.ts'
import { TodayChip } from './today-chip.tsx'

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
const CALENDAR = crypto.randomUUID()
const campaign: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}

async function renderChip() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [campaign],
    calendars: [{ id: CALENDAR, worldId: WORLD.id, name: 'Eana', definition: EANA }],
    todays: [{ campaignId: campaign.id, calendarId: CALENDAR, date: { year: 1250, month: 'siega', day: 18 } }]
  })
  const scene = await api.client.call('createScene', { worldId: WORLD.id, name: 'El vado del Tejo' })
  const opened = await api.client.call('openScene', { campaignId: campaign.id, sceneId: scene.id })
  const table: CampaignTableView = {
    ...opened,
    weather: { setting: { mode: 'today' }, effective: { kind: 'rain', intensity: 0.6, wind: 0.4 } }
  }
  const root = createRootRoute({
    component: () => (
      <ApiProvider client={api.client}>
        <TodayChip worldId={WORLD.id} campaignId={campaign.id} table={table} />
      </ApiProvider>
    )
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory() })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { api }
}

describe('el chip del «hoy» en la Mesa (8 · campaña)', () => {
  it('lleva el día y los grados; su menú cambia la fecha', async () => {
    await renderChip()
    const chip = await screen.findByRole('button', { name: /El hoy de la campaña: Frostelle, 18 de Siega/ })
    expect(chip.textContent).toContain('18 de Siega')
    await userEvent.click(chip)
    const menu = screen.getByRole('region', { name: /El hoy de la campaña/ })
    await userEvent.click(within(menu).getByRole('button', { name: '+1 día' }))
    expect(await screen.findByRole('button', { name: /19 de Siega/ })).toBeTruthy()
  })

  it('«Viaje…» con la distancia escrita avanza el hoy con los días del viaje', async () => {
    await renderChip()
    await userEvent.click(await screen.findByRole('button', { name: /El hoy de la campaña/ }))
    await userEvent.click(screen.getByRole('button', { name: /Viaje…/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Viaje' })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'A pie' }))
    const advance = await within(dialog).findByRole('button', { name: /Avanzar hoy · [1-9]/ })
    await waitFor(() => expect((advance as HTMLButtonElement).disabled).toBe(false))
    expect(dialog.textContent).toContain('Llegáis el')
    await userEvent.click(advance)
    expect(await screen.findByRole('button', { name: /El hoy de la campaña: .*(19|2\d) de Siega/ })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Viaje' })).toBeNull()
  })

  it('la capa de clima a mano y la escena interior se guardan', async () => {
    const { api } = await renderChip()
    await userEvent.click(await screen.findByRole('button', { name: /El hoy de la campaña/ }))
    const menu = screen.getByRole('region', { name: /El hoy de la campaña/ })
    expect(menu.textContent).toContain('la de hoy')
    await userEvent.click(within(menu).getByRole('radio', { name: 'A mano' }))
    await userEvent.click(within(menu).getByRole('radio', { name: 'Nieve' }))
    expect(within(menu).getByRole('slider', { name: 'Intensidad' })).toBeTruthy()
    await waitFor(() => expect(api.calls).toContain('setWeatherLayer'))
    await userEvent.click(within(menu).getByRole('switch', { name: /Escena interior/ }))
    await waitFor(() => expect(api.calls).toContain('updateScene'))
  })
})
