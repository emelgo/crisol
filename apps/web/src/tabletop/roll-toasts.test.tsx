import type { Campaign, DiceRoll, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'
import { TOAST_MS } from './roll-toasts.tsx'

vi.mock('./channel.ts', async () => (await import('./fakes.ts')).quietChannel())
vi.mock('./use-renderer.ts', async () => (await import('./fakes.ts')).blindRenderer())

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
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { realtime }
}

const toasts = () => within(screen.getByRole('list', { name: 'Últimas tiradas' }))

afterEach(() => {
  vi.useRealTimers()
})

describe('las tiradas sobre el d20', () => {
  it('fuera de su pestaña, cada tirada sale un momento y se apaga sola; las que no ve el grupo, marcadas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { realtime } = renderMesa()
    await screen.findByRole('tab', { name: 'Escenas' })
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Sigilo', 17) }))
    expect(toasts().getByText('Lucía')).toBeDefined()
    expect(toasts().getByText('Sigilo')).toBeDefined()
    expect(toasts().getByText('17')).toBeDefined()
    act(() =>
      realtime.emit({
        type: 'rolled',
        campaignId: CAMPAIGN.id,
        roll: rollOf('Bruno', 'Engaño', 9, { visibility: 'master' })
      })
    )
    expect(toasts().getByText('para ti')).toBeDefined()
    // Otra campaña, nada
    act(() =>
      realtime.emit({
        type: 'rolled',
        campaignId: crypto.randomUUID(),
        roll: { ...rollOf('Otro', 'Fuera', 3), campaignId: crypto.randomUUID() }
      })
    )
    expect(toasts().queryByText('Otro')).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(TOAST_MS + 50))
    expect(toasts().queryByText('Lucía')).toBeNull()
    expect(toasts().queryByText('Bruno')).toBeNull()
  })

  it('con la ficha de dados abierta no salen: ya están en su registro', async () => {
    const user = userEvent.setup()
    const { realtime } = renderMesa()
    await user.click(await screen.findByRole('button', { name: 'Dados' }))
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: rollOf('Lucía', 'Sigilo', 17) }))
    expect(toasts().queryByText('17')).toBeNull()
  })
})
