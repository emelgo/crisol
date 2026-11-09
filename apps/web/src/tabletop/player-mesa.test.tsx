import type { Campaign, ScreenView, TableServerMessage, World } from '@crisol/contracts'
import type { System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

// El canal de la mesa, de mentira: se ve con qué vista entra y se le manda lo que ve el grupo
const channels = vi.hoisted(() => [] as Array<{ view: string; onMessage: (message: TableServerMessage) => void }>)
vi.mock('./channel.ts', () => ({
  connectTable: (
    options: { view: string },
    handlers: { onMessage: (message: TableServerMessage) => void; onStatus?: (status: string) => void }
  ) => {
    channels.push({ view: options.view, onMessage: handlers.onMessage })
    handlers.onStatus?.('open')
    return { sendViewport: () => {}, sendDrag: () => {}, close: () => {} }
  }
}))
vi.mock('./use-renderer.ts', async () => (await import('./fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Otra', role: 'member' as const }
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'player',
  version: 1
}
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'player',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}

async function renderAt(path: string, withCharacter = true) {
  channels.length = 0
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN], systems: [SYSTEM] })
  if (withCharacter) await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Lía' })
  const realtime = fakeRealtime()
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Lucía', email: 'lucia@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { api, realtime, router }
}

describe('quien juega', () => {
  it('abre la campaña en su Inicio: su personaje (a su ficha) e «Ir a la Mesa», que se abre en otra pestaña', async () => {
    await renderAt(`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
    expect((await screen.findByRole('link', { name: /^Lía/ })).getAttribute('href')).toMatch(
      new RegExp(`/campanas/${CAMPAIGN.id}/personajes/[^/?]+\\?vista=ficha$`)
    )
    const toMesa = screen.getByRole('link', { name: 'Ir a la Mesa' })
    expect(toMesa.getAttribute('href')).toBe(`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/mesa`)
    expect(toMesa.getAttribute('target')).toBe('_blank')
    // Su campaña y dejarla, abajo
    expect(screen.getByText('La campaña: La Marca')).toBeDefined()
  })

  it('sin personaje, a crear el suyo', async () => {
    await renderAt(`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`, false)
    expect(await screen.findByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Crear tu personaje' })).toBeDefined()
  })

  it('su Mesa ve lo que el grupo, con su barra (sin Escenas ni Ajustes); la página que le enseñan se le abre', async () => {
    const user = userEvent.setup()
    const { realtime } = await renderAt(`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/mesa`)
    await waitFor(() => expect(channels.map((c) => c.view)).toContain('player'))
    const panel = within(await screen.findByRole('complementary', { name: 'Panel de la mesa' }))
    // Las tiradas, en el d20 (no hay pestaña de tiradas)
    expect(panel.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Combate',
      'Personajes',
      'Compendio',
      'Páginas'
    ])
    // El combate, de lo que ve el grupo
    const view: ScreenView = {
      campaignName: 'La Marca',
      scene: null,
      hidden: false,
      camera: { mode: 'follow' },
      tokens: [],
      combat: {
        round: 2,
        combatants: [
          {
            id: crypto.randomUUID(),
            kind: 'character',
            tokenId: null,
            name: 'Lía',
            img: null,
            initiative: 15,
            active: true,
            defeated: false
          },
          {
            id: crypto.randomUUID(),
            kind: 'creature',
            tokenId: null,
            name: 'Goblin',
            img: null,
            initiative: null,
            active: false,
            defeated: false
          }
        ]
      }
    } as unknown as ScreenView
    act(() => channels.find((c) => c.view === 'player')?.onMessage({ type: 'screen', screen: view }))
    await user.click(panel.getByRole('tab', { name: /^Combate/ }))
    const order = within(panel.getByRole('list', { name: 'Combate' }))
    expect(order.getByText('Ronda 2')).toBeDefined()
    expect(order.getByText('Lía').closest('li')?.getAttribute('aria-current')).toBe('step')
    // Su hoja, en ventana
    await user.click(panel.getByRole('tab', { name: 'Personajes' }))
    await user.click(await panel.findByRole('button', { name: /^Lía/ }))
    expect(await screen.findByRole('dialog', { name: 'Lía' })).toBeDefined()
    // Lo que enseña el máster
    const pageId = crypto.randomUUID()
    act(() =>
      realtime.emit({ type: 'shown', worldId: WORLD.id, campaignId: CAMPAIGN.id, pageId, title: 'Aldric Varn' })
    )
    expect(await screen.findByRole('dialog', { name: 'Aldric Varn' })).toBeDefined()
  })
})
