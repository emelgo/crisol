import type { Campaign, DiceRoll, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'
import { NOTICE_MS } from './notices.tsx'

vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())
// Sin WebGL: los dados no caen y el resultado sale al momento
vi.mock('./3d/scene.ts', () => ({ createScene: () => null }))

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
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
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
let n = 0
const rollOf = (who: string, label: string, total: number, extra: Partial<DiceRoll> = {}): DiceRoll => ({
  id: `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`,
  campaignId: CAMPAIGN.id,
  by: { userId: who.toLowerCase(), name: who, color: null },
  ai: false,
  formula: '1d20+4',
  label,
  total,
  detail: `1d20+4 → [${total - 4}] + 4 = ${total}`,
  critical: null,
  dice: [{ sides: 20, value: total - 4, kept: true }],
  visibility: 'all',
  createdAt: new Date().toISOString(),
  ...extra
})

function renderMesa() {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
  const realtime = fakeRealtime()
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/mesa`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { realtime, api }
}

const toasts = () => within(screen.getByRole('list', { name: 'Últimas tiradas' }))
/** Lo que llega por el canal sin caer (otro jugador, sin 3D) sale tras esperar un poco a la bandeja */
const arrive = () => act(() => vi.advanceTimersByTimeAsync(500))

afterEach(() => {
  vi.useRealTimers()
})

describe('el resultado sobre el d20', () => {
  it('cada tirada sale un momento y se apaga sola; las que no ve el grupo, marcadas; las de otra campaña, no', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { realtime } = renderMesa()
    await screen.findByRole('tab', { name: 'Escenas' })
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Sigilo', 17) }))
    await arrive()
    expect(toasts().getByText('Lucía')).toBeDefined()
    expect(toasts().getByText(/Sigilo/)).toBeDefined()
    expect(toasts().getByText('17')).toBeDefined()
    act(() =>
      realtime.emit({
        type: 'rolled',
        campaignId: CAMPAIGN.id,
        roll: rollOf('Bruno', 'Engaño', 9, { visibility: 'master', critical: 'high' })
      })
    )
    await arrive()
    expect(toasts().getByText('para ti')).toBeDefined()
    expect(toasts().getByText('Crítico')).toBeDefined()
    act(() =>
      realtime.emit({
        type: 'rolled',
        campaignId: crypto.randomUUID(),
        roll: { ...rollOf('Otro', 'Fuera', 3), campaignId: crypto.randomUUID() }
      })
    )
    await arrive()
    expect(toasts().queryByText('Otro')).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(NOTICE_MS + 50))
    expect(toasts().queryByText('Lucía')).toBeNull()
    expect(toasts().queryByText('Bruno')).toBeNull()
  })

  it('con los dados abiertos no sale; pulsarlo abre el historial; «Otra vez» la repite', async () => {
    const user = userEvent.setup()
    const { realtime, api } = renderMesa()
    await user.click(await screen.findByRole('button', { name: 'Dados' }))
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Sigilo', 17) }))
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(toasts().queryByText('17')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Dados' }))
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Percepción', 12) }))
    const repeat = await toasts().findByRole('button', { name: 'Otra vez: Percepción' })
    await user.click(repeat)
    await waitFor(async () =>
      expect((await api.client.call('listRolls', { campaignId: CAMPAIGN.id })).rolls.at(-1)).toMatchObject({
        label: 'Percepción',
        by: { name: 'Enrique' }
      })
    )
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Fuerza', 8) }))
    await user.click(await toasts().findByRole('button', { name: /Fuerza.*Abrir el historial/ }))
    expect(await screen.findByRole('list', { name: 'Tiradas de la campaña' })).toBeTruthy()
  })
})
