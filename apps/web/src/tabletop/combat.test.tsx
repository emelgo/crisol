import type { Campaign, TableServerMessage, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { i18next } from '../i18n.ts'
import { createAppRouter } from '../router.tsx'
import { reorder, startedText } from './combat-panel.tsx'
import type { DrawToken } from './renderer.ts'

const channels = vi.hoisted(() => [] as Array<{ view: string; onMessage: (message: TableServerMessage) => void }>)
const drawn = vi.hoisted(() => ({ tokens: [] as DrawToken[] }))
vi.mock('./channel.ts', () => ({
  connectTable: (options: { view: string }, handlers: { onMessage: (message: TableServerMessage) => void }) => {
    channels.push({ view: options.view, onMessage: handlers.onMessage })
    return { sendViewport: () => {}, sendDrag: () => {}, close: () => {} }
  }
}))
vi.mock('./use-renderer.ts', async () => {
  const { useRef } = await import('react')
  return {
    useTableRenderer: () => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({
        setView: () => {},
        setScene: () => {},
        setFog: () => {},
        setGlow: () => {},
        setShapes: () => {},
        setLabels: () => {},
        setImages: () => {},
        setTokens: (tokens: DrawToken[]) => {
          drawn.tokens = tokens
        }
      })
      return { host, renderer, ready: true, failed: false, size: { width: 800, height: 600 } }
    }
  }
})

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
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}
const EMAIL = 'enrique@crisol.test'
const t = i18next.t.bind(i18next)

beforeEach(() => {
  channels.length = 0
  drawn.tokens = []
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mesa'] }))
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})

describe('las piezas del combate', () => {
  it('el orden al soltar uno encima de otro', () => {
    expect(reorder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(reorder(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
    expect(reorder(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
  })

  it('el aviso de un turno: de quién es, qué caducó, qué se recargó y qué se repuso', () => {
    expect(
      startedText(t as never, {
        names: ['Goblin 1', 'Goblin 2'],
        expired: [{ name: 'Goblin 1', condition: 'Derribado' }],
        recharged: [{ name: 'Goblin 2', action: 'Aliento' }],
        restored: []
      })
    ).toBe('Turno de Goblin 1 y Goblin 2. Goblin 1 ya no está «Derribado». Goblin 2 recarga «Aliento».')
  })
})

/** La mesa con dos lobos en el mapa, con el canal de mentira */
async function renderTable() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] },
    pages: [{ id: crypto.randomUUID(), worldId: WORLD.id, title: 'Cripta de Varn' }]
  })
  const tab = await api.client.call('createPageTab', { pageId: api.pages[0]?.id ?? '', kind: 'scene' })
  const scene = await api.client.call('getScene', { tabId: tab.id })
  await api.client.call('setSceneImage', {
    sceneId: scene.id,
    width: 1200,
    height: 800,
    tiles: { version: crypto.randomUUID(), size: 512, levels: 2 }
  })
  await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scene.id })
  await api.client.call('placeTokens', {
    campaignId: CAMPAIGN.id,
    sceneId: scene.id,
    tokens: [{ content: { key: 'lobo', count: 2 }, column: 2, row: 2 }]
  })
  render(
    <App
      router={createAppRouter(
        createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/mesa`] })
      )}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  const push = async () => {
    await waitFor(() => expect(channels.some((c) => c.view === 'master')).toBe(true))
    const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
    act(() => channels.find((c) => c.view === 'master')?.onMessage({ type: 'master', table }))
    return table
  }
  await push()
  return { api, push }
}

describe('el combate en la mesa', () => {
  it('empezar, escribir la iniciativa, pasar turnos (con su aviso y su aro), dañar a dos a la vez y acabar', async () => {
    const user = userEvent.setup()
    const { api, push } = await renderTable()
    await user.click(await screen.findByRole('tab', { name: 'Combate' }))
    await user.click(await screen.findByRole('button', { name: 'Empezar el combate' }))
    await waitFor(async () =>
      expect((await api.client.call('getCombat', { campaignId: CAMPAIGN.id })).combat?.combatants).toHaveLength(2)
    )
    await push()
    const panel = within(await screen.findByRole('complementary', { name: 'Combate' }))
    expect(panel.getByText('Sin empezar')).toBeDefined()
    // Escribir la de cada uno (el sistema de prueba no la tira)
    const first = panel.getByLabelText('Iniciativa de Lobo 1')
    await user.clear(first)
    await user.type(first, '15{Enter}')
    await waitFor(async () =>
      expect((await api.client.call('getCombat', { campaignId: CAMPAIGN.id })).combat?.combatants[0]).toMatchObject({
        name: 'Lobo 1',
        initiative: 15
      })
    )
    await push()
    await user.click(panel.getByRole('button', { name: 'Primer turno' }))
    expect(await panel.findByRole('status')).toHaveProperty('textContent', 'Turno de Lobo 1.')
    await push()
    expect(panel.getByText('Ronda 1')).toBeDefined()
    await waitFor(() => expect(drawn.tokens.find((token) => token.label === 'L1')?.turn).toBe(true))
    expect(drawn.tokens.find((token) => token.label === 'L2')?.turn).toBe(false)

    // Elegir a los dos en el mapa (el segundo con Mayús): el daño a varias
    const stage = screen.getByRole('application', { name: /^Mesa:/ })
    const view = JSON.parse(stage.dataset.view ?? '{}') as { x: number; y: number; scale: number }
    const tokens = (await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).tokens
    const tap = (token: { x: number; y: number }, shiftKey = false) => {
      const at = { clientX: token.x * view.scale + view.x, clientY: token.y * view.scale + view.y }
      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, shiftKey, ...at })
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', button: 0, shiftKey, ...at })
    }
    tap(tokens[0] as { x: number; y: number })
    tap(tokens[1] as { x: number; y: number }, true)
    const damage = within(await screen.findByRole('region', { name: 'Daño a varias' }))
    expect(damage.getByText('2 elegidas')).toBeDefined()
    await user.type(damage.getByLabelText('Cuánto'), '100')
    await user.click(damage.getByRole('button', { name: 'Aplicar' }))
    await waitFor(async () =>
      expect(
        (await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).tokens.map((t) => t.actor.life?.value)
      ).toEqual([0, 0])
    )
    await push()

    // Acabar: las copias a 0 se van
    await user.click(panel.getByRole('button', { name: 'Acabar combate' }))
    const end = within(await screen.findByRole('dialog', { name: 'Acabar combate' }))
    await user.click(end.getByRole('radio', { name: 'Ninguna' }))
    expect(end.getByText('No se quita nadie.')).toBeDefined()
    await user.click(end.getByRole('radio', { name: 'Todas' }))
    expect(end.getByText('Se quitan de la mesa y de «En juego»: Lobo 1 y Lobo 2.')).toBeDefined()
    await user.click(end.getByRole('button', { name: 'Acabar' }))
    await waitFor(async () =>
      expect((await api.client.call('getCombat', { campaignId: CAMPAIGN.id })).combat).toBeNull()
    )
  })
})

describe('la franja de turnos de la tele', () => {
  it('la ronda, el orden y de quién es el turno; la ficha de quien tiene el turno, con su aro', async () => {
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
    render(
      <App
        router={createAppRouter(
          createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/pantalla`] })
        )}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
        api={api.client}
      />
    )
    await waitFor(() => expect(channels.some((c) => c.view === 'screen')).toBe(true))
    const lia = crypto.randomUUID()
    const grid = {
      type: 'square' as const,
      size: 100,
      offsetX: 0,
      offsetY: 0,
      distance: 5,
      units: 'pies',
      diagonals: 'equal' as const,
      visible: true,
      color: '#000000',
      opacity: 0.3
    }
    act(() =>
      channels
        .find((c) => c.view === 'screen')
        ?.onMessage({
          type: 'screen',
          screen: {
            campaignId: CAMPAIGN.id,
            campaignName: 'La Marca',
            scene: {
              id: crypto.randomUUID(),
              image: { width: 1200, height: 800, tiles: { version: crypto.randomUUID(), size: 512, levels: 2 } },
              grid,
              initialView: null
            },
            hidden: false,
            camera: { mode: 'follow' },
            tokens: [
              {
                id: lia,
                x: 150,
                y: 150,
                size: 1,
                label: 'Lía',
                name: 'Lía',
                faction: 'group',
                img: null,
                image: null,
                state: null,
                conditions: []
              }
            ],
            combat: {
              round: 2,
              combatants: [
                {
                  id: crypto.randomUUID(),
                  kind: 'character',
                  tokenId: lia,
                  name: 'Lía',
                  img: null,
                  initiative: 19,
                  active: true,
                  defeated: false
                },
                {
                  id: crypto.randomUUID(),
                  kind: 'creature',
                  tokenId: null,
                  name: 'Goblin 1',
                  img: null,
                  initiative: null,
                  active: false,
                  defeated: true
                }
              ]
            }
          }
        })
    )
    const strip = await screen.findByRole('region', { name: 'Turnos' })
    expect(strip.textContent).toContain('Ronda 2')
    expect(strip.textContent).toContain('Turno de Lía')
    expect(within(strip).getAllByRole('listitem')).toHaveLength(2)
    await waitFor(() => expect(drawn.tokens[0]?.turn).toBe(true))
  })
})
