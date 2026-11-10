import type { Campaign, TablePresenceEntry } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { PauseBanner, RoomBar } from './room.tsx'

const WORLD_ID = crypto.randomUUID()
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD_ID,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  system: null,
  systemChoices: null,
  version: 1
} as unknown as Campaign
const SINCE = '2026-11-10T20:58:00.000Z'
const present: TablePresenceEntry[] = [
  { userId: 'yo', name: 'Enrique', viewer: 'master', since: SINCE, active: true, tabs: 1 },
  {
    userId: 'lucia',
    name: 'Lucía',
    viewer: 'player',
    since: SINCE,
    active: true,
    tabs: 1,
    color: '#1d7466',
    character: { id: crypto.randomUUID(), name: 'Lía' }
  },
  { userId: 'ana', name: 'Ana', viewer: 'player', since: SINCE, active: false, tabs: 2, color: null, character: null },
  { userId: 'yo', name: 'Enrique', viewer: 'screen', since: SINCE, active: true, tabs: 1 }
]

function mount() {
  const api = fakeApi({
    campaigns: [CAMPAIGN],
    members: {
      [CAMPAIGN.id]: [
        { userId: 'yo', name: 'Enrique', role: 'master' },
        { userId: 'lucia', name: 'Lucía', role: 'player' },
        { userId: 'ana', name: 'Ana', role: 'player' }
      ]
    },
    tablePresence: present
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <RoomBar campaignId={CAMPAIGN.id} />
        <PauseBanner campaignId={CAMPAIGN.id} />
      </ApiProvider>
    </QueryClientProvider>
  )
  return api
}

describe('la sala en la Mesa del máster', () => {
  it('los retratos de quien juega y la Pantalla; al pulsarlos, quién está, con su personaje y si está a la vista', async () => {
    const user = userEvent.setup()
    mount()
    const faces = await screen.findByRole('button', { name: '2 jugadores en la Mesa' })
    await user.click(faces)
    const panel = screen.getByRole('dialog', { name: 'Sala' })
    const rows = within(panel).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent?.split('desde')[0])).toEqual([
      'LLía · LucíaA la vista · ',
      'AAnaEn otra ventana · ',
      'Vista de jugadoresA la vista · '
    ])
  })

  it('la pausa: el botón de arriba (no se repite en el panel) y la franja con «Reanudar»', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'Pausar la partida' }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Partida en pausa' + 'Reanudar')
    await user.click(screen.getByRole('button', { name: 'Reanudar' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.getByRole('button', { name: 'Pausar la partida' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('cómo mueven, y echar a alguien (con confirmación) y dejarle volver', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: '2 jugadores en la Mesa' }))
    const panel = screen.getByRole('dialog', { name: 'Sala' })
    await user.click(within(panel).getByRole('button', { name: 'En su turno' }))
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'En su turno' }).getAttribute('aria-pressed')).toBe('true')
    )
    await user.click(within(panel).getByRole('button', { name: 'Opciones de Ana' }))
    await user.click(screen.getByRole('menuitem', { name: 'Echar de la Mesa' }))
    expect(screen.getByText('¿Echar a Ana de la Mesa? No podrá volver hasta que le dejes.')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Echar de la Mesa' }))
    expect(await within(panel).findByRole('heading', { name: 'Fuera de la Mesa' })).toBeDefined()
    await user.click(within(panel).getByRole('button', { name: 'Dejar volver' }))
    await waitFor(() => expect(within(panel).queryByRole('heading', { name: 'Fuera de la Mesa' })).toBeNull())
  })
})
