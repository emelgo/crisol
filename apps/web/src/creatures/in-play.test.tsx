import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Mesa', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
const WOLF: ContentItem = { type: 'personaje', key: 'lobo', source: null, data: { name: { es: 'Lobo', en: 'Wolf' } } }
const campaignAs = (role: Campaign['role']): Campaign => ({
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role,
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
})

/** Dos lobos (uno malherido) a la vista y un jefe oculto, y la pantalla «En juego» de quien la abre */
async function renderInPlay(role: Campaign['role']) {
  const campaign = campaignAs(role)
  const api = fakeApi({
    organizations: [ORG],
    worlds: [{ ...WORLD, role }],
    campaigns: [campaign],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] }
  })
  const wolves = (await api.client.call('putInPlay', { campaignId: campaign.id, key: 'lobo', count: 2 })).creatures
  const second = wolves[1]
  if (second) {
    const max = second.life?.max ?? 0
    await api.client.call('playCreature', { creatureId: second.id, version: second.version, damage: max / 2 })
  }
  await api.client.call('putInPlay', { campaignId: campaign.id, key: 'lobo', unique: true, name: 'Jefe', hidden: true })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${campaign.id}/en-juego`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Ana', email: 'ana@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, campaign }
}

describe('«En juego» (docs/specs/compendio-jugadores.md)', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.ana@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campana', 'en-juego'] })
    )
  )

  it('la jugadora ve las que están a la vista, juntas, con su estado en palabras; ni el jefe ni sus PG', async () => {
    await renderInPlay('player')
    expect(await screen.findByText('2 a la vista')).toBeDefined()
    const wolves = screen.getByRole('region', { name: 'Lobo' })
    expect(within(wolves).getByText('Lobo 1')).toBeDefined()
    expect(within(wolves).getByText('Sin heridas')).toBeDefined()
    expect(within(wolves).getByText('Con heridas graves')).toBeDefined()
    expect(screen.queryByText('Jefe')).toBeNull()
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull()
  })

  it('el máster ve cuál está oculta y la pone a la vista con el ojo', async () => {
    const user = userEvent.setup()
    const { api, campaign } = await renderInPlay('master')
    const boss = await screen.findByRole('button', { name: 'Oculta a los jugadores: Jefe' })
    expect(boss.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('Oculta').length).toBeGreaterThan(0)
    await user.click(boss)
    expect(
      (await screen.findByRole('button', { name: 'Oculta a los jugadores: Jefe' })).getAttribute('aria-pressed')
    ).toBe('false')
    const seen = await api.client.call('listVisibleInPlay', { campaignId: campaign.id })
    expect(seen.creatures.map((c) => c.name)).toContain('Jefe')
  })
})
