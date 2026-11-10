/**
 * La jugadora en su Mesa (docs/specs/mover-jugadores.md): arrastra lo que lleva (en vivo y, al soltar, a la API), la
 * ficha vuelve con su aviso si no le deja, abre las puertas que ve y pasa su turno; y el máster asigna una criatura
 */
import type { Campaign, ScreenView, TableServerMessage, TokenView } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AccountsProvider } from '../account/context.tsx'
import { fakeAccountClient } from '../account/fake.ts'
import { type ApiClient, ApiError } from '../api/client.ts'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { TableScreen } from './screen.tsx'
import { TokenCard } from './token-card.tsx'

// El canal de la mesa, de mentira: se le manda lo que ve el grupo y se ve lo que arrastra
const channel = vi.hoisted(() => ({
  onMessage: null as ((message: TableServerMessage) => void) | null,
  drags: [] as unknown[]
}))
vi.mock('./channel.ts', () => ({
  connectTable: (
    _options: unknown,
    handlers: { onMessage: (message: TableServerMessage) => void; onStatus?: (status: string) => void }
  ) => {
    channel.onMessage = handlers.onMessage
    handlers.onStatus?.('open')
    return { sendViewport: () => {}, sendDrag: (moves: unknown) => channel.drags.push(moves), close: () => {} }
  }
}))
vi.mock('./use-renderer.ts', async () => (await import('./fakes.ts')).blindRenderer())

const ME = 'cuenta-lucia'
const CAMPAIGN = {
  id: crypto.randomUUID(),
  worldId: crypto.randomUUID(),
  name: 'La Marca',
  role: 'player'
} as unknown as Campaign
const GRID = {
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
const LIA = crypto.randomUUID()
const BRAM = crypto.randomUUID()
const token = (id: string, name: string, x: number, controllers: string[]): ScreenView['tokens'][number] => ({
  id,
  x,
  y: 150,
  size: 1,
  label: name,
  name,
  faction: 'group',
  img: null,
  image: null,
  state: null,
  conditions: [],
  controllers
})

function viewOf(patch: Partial<ScreenView> = {}): ScreenView {
  return {
    campaignId: CAMPAIGN.id,
    campaignName: 'La Marca',
    scene: {
      id: crypto.randomUUID(),
      image: { width: 800, height: 600, tiles: { version: crypto.randomUUID(), size: 512, levels: 1 } },
      grid: GRID,
      initialView: null
    },
    hidden: false,
    camera: { mode: 'follow' },
    tokens: [token(LIA, 'Lía', 150, [ME]), token(BRAM, 'Bram', 450, ['otra'])],
    combat: null,
    ...patch
  }
}

/** La Mesa de la jugadora con lo que llega por el canal; lo que pide a la API queda apuntado (y falla si se dice) */
async function mountMesa(view: ScreenView, fails: Record<string, string> = {}) {
  channel.drags.length = 0
  const api = fakeApi({ campaigns: [CAMPAIGN] })
  const calls: Array<{ name: string; input: unknown }> = []
  const client: ApiClient = {
    ...api.client,
    call: (async (name: string, input: unknown) => {
      calls.push({ name, input })
      const code = fails[name]
      if (code) throw new ApiError(code, 400)
      if (name === 'moveTokens' || name === 'setDoor' || name === 'nextTurn') return {}
      return api.client.call(name as never, input as never)
    }) as ApiClient['call']
  }
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsProvider
        client={fakeAccountClient({ account: { id: ME, name: 'Lucía', email: 'l@crisol.test' } }).client}
      >
        <ApiProvider client={client}>
          <TableScreen campaignId={CAMPAIGN.id} viewer="player" />
        </ApiProvider>
      </AccountsProvider>
    </QueryClientProvider>
  )
  await waitFor(() => expect(channel.onMessage).not.toBeNull())
  act(() => channel.onMessage?.({ type: 'screen', screen: view }))
  const stage = screen.getByRole('img', { name: 'Lo que ve el grupo' })
  await waitFor(() => expect(stage.dataset.view).toBeDefined())
  /** Un punto del mapa en la pantalla (el lienzo empieza en 0, 0) */
  const at = (x: number, y: number) => {
    const shown = JSON.parse(stage.dataset.view ?? '{}') as { x: number; y: number; scale: number }
    return { clientX: x * shown.scale + shown.x, clientY: y * shown.scale + shown.y }
  }
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number, kind = 'mouse') =>
    fireEvent[type](stage, { button: 0, pointerId: 1, pointerType: kind, ...at(x, y) })
  return { calls, pointer }
}

describe('la jugadora mueve sus fichas en su Mesa', () => {
  it('arrastra la suya (con el dedo también): en vivo por el canal y, al soltar, a la API; la ajena, no', async () => {
    const { calls, pointer } = await mountMesa(viewOf())
    pointer('pointerDown', 450, 150)
    pointer('pointerMove', 550, 150)
    pointer('pointerUp', 550, 150)
    expect(channel.drags).toEqual([])
    pointer('pointerDown', 150, 150, 'touch')
    pointer('pointerMove', 250, 150, 'touch')
    pointer('pointerMove', 350, 150, 'touch')
    pointer('pointerUp', 350, 150, 'touch')
    expect(channel.drags.at(-1)).toEqual([{ tokenId: LIA, x: 350, y: 150 }])
    await waitFor(() =>
      expect(calls.filter((c) => c.name === 'moveTokens')).toEqual([
        { name: 'moveTokens', input: { campaignId: CAMPAIGN.id, moves: [{ tokenId: LIA, x: 350, y: 150 }] } }
      ])
    )
  })

  it('si el servidor no le deja, la ficha vuelve y sale por qué, corto', async () => {
    const { pointer } = await mountMesa(viewOf(), { moveTokens: 'WALL' })
    const stage = screen.getByRole('img', { name: 'Lo que ve el grupo' })
    pointer('pointerDown', 150, 150)
    pointer('pointerMove', 350, 150)
    expect(stage.dataset.dragging).toBe('')
    pointer('pointerUp', 350, 150)
    expect((await screen.findByRole('status')).textContent).toBe('Hay un muro')
    expect(stage.dataset.dragging).toBeUndefined()
  })

  it('abre la puerta que ve; la de llave no se puede pulsar', async () => {
    const user = userEvent.setup()
    const door = (id: string, locked: boolean) => ({
      id,
      a: { x: 400, y: 100 },
      b: { x: 400, y: 200 },
      open: false,
      locked
    })
    const open = crypto.randomUUID()
    const { calls } = await mountMesa(viewOf({ doors: [door(open, false), door(crypto.randomUUID(), true)] }))
    expect(screen.getByRole('button', { name: 'Puerta con llave' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Abrir la puerta' }))
    expect(calls.find((c) => c.name === 'setDoor')?.input).toEqual({
      campaignId: CAMPAIGN.id,
      wallId: open,
      open: true
    })
  })

  it('en su turno, «Pasar turno»; en el de otro, no sale', async () => {
    const user = userEvent.setup()
    const combat = (mine: boolean): ScreenView['combat'] => ({
      round: 1,
      combatants: [
        {
          id: crypto.randomUUID(),
          kind: 'character',
          tokenId: LIA,
          name: 'Lía',
          img: null,
          initiative: 12,
          active: mine,
          defeated: false,
          controllers: [ME]
        },
        {
          id: crypto.randomUUID(),
          kind: 'character',
          tokenId: BRAM,
          name: 'Bram',
          img: null,
          initiative: 15,
          active: !mine,
          defeated: false,
          controllers: ['otra']
        }
      ]
    })
    const { calls } = await mountMesa(viewOf({ combat: combat(false) }))
    expect(screen.queryByRole('button', { name: 'Pasar turno' })).toBeNull()
    act(() => channel.onMessage?.({ type: 'screen', screen: viewOf({ combat: combat(true) }) }))
    await user.click(await screen.findByRole('button', { name: 'Pasar turno' }))
    expect(calls.some((c) => c.name === 'nextTurn')).toBe(true)
  })
})

describe('el máster asigna una criatura a un jugador', () => {
  it('desde los ajustes de su ficha: «Lo lleva…» con los jugadores de la campaña', async () => {
    const user = userEvent.setup()
    const api = fakeApi({
      campaigns: [{ ...CAMPAIGN, role: 'master' } as Campaign],
      members: {
        [CAMPAIGN.id]: [
          { userId: 'yo', name: 'Enrique', role: 'master' },
          { userId: ME, name: 'Lucía', role: 'player' },
          { userId: 'ana', name: 'Ana', role: 'player' }
        ]
      }
    })
    const calls: Array<{ name: string; input: unknown }> = []
    const client: ApiClient = {
      ...api.client,
      call: (async (name: string, input: unknown) => {
        calls.push({ name, input })
        if (name === 'assignToken') return { creatureId: '', controllers: [] }
        return api.client.call(name as never, input as never)
      }) as ApiClient['call']
    }
    const wolf: TokenView = {
      id: crypto.randomUUID(),
      sceneId: crypto.randomUUID(),
      x: 0,
      y: 0,
      size: 1,
      label: 'Lobo',
      faction: 'neutral',
      hidden: false,
      image: null,
      actor: {
        kind: 'creature',
        id: crypto.randomUUID(),
        name: 'Lobo',
        img: null,
        version: 1,
        life: null,
        stats: [],
        conditions: []
      },
      controllers: ['ana']
    }
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ApiProvider client={client}>
          <TokenCard
            token={wolf}
            campaignId={CAMPAIGN.id}
            cardRef={createRef()}
            onClose={() => {}}
            onSheet={() => {}}
            onImage={() => {}}
          />
        </ApiProvider>
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Ajustes de la ficha' }))
    const lucia = await screen.findByRole('checkbox', { name: 'Lucía' })
    expect((screen.getByRole('checkbox', { name: 'Ana' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'Enrique' })).toBeNull()
    await user.click(lucia)
    expect(calls.find((c) => c.name === 'assignToken')?.input).toEqual({
      campaignId: CAMPAIGN.id,
      creatureId: wolf.actor.id,
      userIds: ['ana', ME]
    })
  })
})
