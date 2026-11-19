import type { ActivityItem, Campaign, World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client.ts'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import { EANA } from '../chronologies/fixtures.ts'
import '../i18n.ts'
import { ActivityCenter, groupByDay, localDay } from './activity.tsx'
import { MasterToday, PlayerToday } from './today.tsx'

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
const campaignOf = (role: Campaign['role'], id = crypto.randomUUID()): Campaign => ({
  id,
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role,
  version: 1
})

function show(children: (client: ApiClient) => ReactNode, client: ApiClient) {
  const root = createRootRoute({ component: () => <ApiProvider client={client}>{children(client)}</ApiProvider> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory() })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const setup = (role: Campaign['role'], today = true) => {
  const campaign = campaignOf(role)
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [campaign],
    calendars: [{ id: CALENDAR, worldId: WORLD.id, name: 'Eana', definition: EANA }],
    todays: today
      ? [{ campaignId: campaign.id, calendarId: CALENDAR, date: { year: 1250, month: 'siega', day: 18 } }]
      : []
  })
  return { campaign, api }
}

describe('el «hoy» en el Inicio de la campaña (8 · campaña)', () => {
  it('el máster ve la fecha, el clima, el sol, la zona y la previsión; +1 día la avanza con «Deshacer»', async () => {
    const { campaign, api } = setup('master')
    show(() => <MasterToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    expect(await within(today).findByRole('heading', { name: /Frostelle, 18 de Siega/ })).toBeTruthy()
    expect(within(today).getByText('Año 1250 RC')).toBeTruthy()
    expect(within(today).getByText('Sol')).toBeTruthy()
    expect(within(today).getByText('Templada · 45° N')).toBeTruthy()
    expect(within(today).getByText('Próximos días')).toBeTruthy()
    expect(within(today).getAllByRole('button', { name: /Cambiar el clima del/ })).toHaveLength(8)
    await userEvent.click(within(today).getByRole('button', { name: '+1 día' }))
    expect(await within(today).findByRole('heading', { name: /19 de Siega/ })).toBeTruthy()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('La fecha pasa a')
    expect(within(status).getByRole('button', { name: 'Deshacer' })).toBeTruthy()
    await userEvent.click(within(today).getByRole('button', { name: '+1 semana' }))
    expect(await within(today).findByRole('heading', { name: /26 de Siega/ })).toBeTruthy()
  })

  it('«Poner fecha» elige un día en el mes del calendario', async () => {
    const { campaign, api } = setup('master')
    show(() => <MasterToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    await userEvent.click(await within(today).findByRole('button', { name: 'Poner fecha' }))
    const picker = await screen.findByRole('dialog', { name: 'Poner fecha' })
    await userEvent.click(within(picker).getByRole('button', { name: /^[^,]+, 3 de Siega/ }))
    await userEvent.click(within(picker).getByRole('button', { name: 'Poner fecha' }))
    expect(await within(today).findByRole('heading', { name: /3 de Siega/ })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Poner fecha' })).toBeNull()
  })

  it('un día de la previsión se cambia a mano: condición, grados y viento', async () => {
    const { campaign, api } = setup('master')
    show(() => <MasterToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    const [, tomorrow] = await within(today).findAllByRole('button', { name: /Cambiar el clima del/ })
    await userEvent.click(tomorrow as HTMLElement)
    const dialog = await screen.findByRole('dialog', { name: /Clima ·/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nieve' }))
    const high = within(dialog).getByRole('spinbutton', { name: 'Máxima' })
    await userEvent.clear(high)
    await userEvent.type(high, '2')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'nordeste' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(screen.queryByRole('dialog', { name: /Clima ·/ })).toBeNull()
  })

  it('sin fecha: «Sin fecha» y «Poner fecha»', async () => {
    const { campaign, api } = setup('master', false)
    show(() => <MasterToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    expect(within(today).getByRole('heading', { name: 'Sin fecha' })).toBeTruthy()
    expect(within(today).getByRole('button', { name: 'Poner fecha' })).toBeTruthy()
  })

  it('la zona se cambia con su latitud', async () => {
    const { campaign, api } = setup('master')
    show(() => <MasterToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    await userEvent.click(await within(today).findByRole('button', { name: 'Cambiar: zona' }))
    const dialog = await screen.findByRole('dialog', { name: 'Zona de la campaña' })
    await userEvent.click(within(dialog).getByRole('radio', { name: /De costa/ }))
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Sur' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(today).findByText('De costa · 45° S')).toBeTruthy()
  })

  it('quien juega ve hoy y el sol, sin previsión ni botones', async () => {
    const { campaign, api } = setup('player')
    show(() => <PlayerToday worldId={WORLD.id} campaign={campaign} />, api.client)
    const today = await screen.findByRole('region', { name: 'Hoy' })
    expect(await within(today).findByRole('heading', { name: /18 de Siega/ })).toBeTruthy()
    expect(within(today).queryByText('Próximos días')).toBeNull()
    expect(within(today).queryByRole('button')).toBeNull()
    expect(within(today).getByText(/min de luz/)).toBeTruthy()
  })
})

describe('el centro de actividad (8 · campaña)', () => {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
  const items: ActivityItem[] = [
    {
      type: 'note',
      noteId: crypto.randomUUID(),
      title: 'Diario de Mirra',
      by: { id: 'u2', name: 'Marta' },
      created: false,
      at: at(0)
    },
    { type: 'date', to: 'Flora, 3 de Siega del año 1250 RC', days: 1, travel: false, ai: false, at: at(0) }
  ]

  it('agrupa por día real, con el registro de ese día', () => {
    const groups = groupByDay(items, [{ day: localDay(at(0)), messages: 3, rolls: 2, shown: 0 }])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.items).toHaveLength(2)
    expect(groups[0]?.log?.messages).toBe(3)
  })

  it('enseña lo nuevo con «Sesión» y se marca como visto solo con su botón', async () => {
    const { campaign, api } = setup('master')
    let seen = false
    const client: ApiClient = {
      ...api.client,
      call: (async (name: string, input: unknown) => {
        if (name === 'getCampaignActivity')
          return seen
            ? { since: at(0), count: 0, items: [], log: [] }
            : { since: null, count: 2, items, log: [{ day: localDay(at(0)), messages: 3, rolls: 2, shown: 0 }] }
        if (name === 'markActivitySeen') {
          seen = true
          return { seenAt: at(0) }
        }
        return api.client.call(name as never, input as never)
      }) as ApiClient['call']
    }
    show(() => <ActivityCenter worldId={WORLD.id} campaign={campaign} master />, client)
    const center = await screen.findByRole('region', { name: 'Desde tu última visita' })
    expect(await within(center).findByText('2 cosas nuevas')).toBeTruthy()
    expect(within(center).getByText('Sesión')).toBeTruthy()
    expect(within(center).getByText('3 mensajes · 2 tiradas')).toBeTruthy()
    expect(within(center).getByRole('link', { name: 'Diario de Mirra' })).toBeTruthy()
    expect(center.textContent).toContain('La fecha pasa a Flora, 3 de Siega del año 1250 RC')
    await userEvent.click(within(center).getByRole('button', { name: 'Marcar como visto' }))
    expect(await within(center).findByText('Nada nuevo desde tu última visita')).toBeTruthy()
    await userEvent.click(within(center).getByRole('button', { name: 'Ver lo anterior' }))
    expect(within(center).getByRole('link', { name: 'Diario de Mirra' })).toBeTruthy()
  })
})
