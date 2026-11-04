import type { Campaign, DiceRoll, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

// Sin WebGL en las pruebas: la escena se sustituye por una que apunta lo que le piden
const played: { dice: unknown[]; color: string; landed: () => void }[] = []
vi.mock('./3d/scene.ts', () => ({
  createScene: () => ({
    play: (dice: unknown[], color: string, landed: () => void) => played.push({ dice: [...dice], color, landed }),
    dispose: () => {}
  })
}))

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
const fromBruno = (label: string): DiceRoll => ({
  id: crypto.randomUUID(),
  campaignId: CAMPAIGN.id,
  by: { userId: 'bruno', name: 'Bruno', color: '#d39b3a' },
  ai: false,
  formula: '1d20+6',
  label,
  total: 26,
  detail: '1d20+6 → [20] + 6 = 26',
  critical: 'high',
  dice: [{ sides: 20, value: 20, kept: true }],
  visibility: 'all',
  createdAt: new Date().toISOString()
})

function renderTable() {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
  const realtime = fakeRealtime()
  const accounts = fakeAccountClient({
    account: { name: 'Enrique', email: 'enrique@crisol.test', diceColor: '#5a7fd6' }
  })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`] })
  )
  render(<App router={router} accounts={accounts.client} api={api.client} realtime={realtime.client} />)
  return { realtime, accounts }
}

const openDice = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Dados' }))
  return within(await screen.findByRole('complementary', { name: 'Dados' }))
}

describe('la bandeja de dados 3D', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campaña', 'dados'] })
    )
    played.length = 0
  })

  it('al tirar caen tus dados, con tu color; al pararse sale el total', async () => {
    renderTable()
    const dice = await openDice()
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.type(field, '2d6+3 # Daño{Enter}')
    await waitFor(() => expect(played).toHaveLength(1))
    expect(played[0]?.dice).toHaveLength(2)
    expect(played[0]?.color).toBe('#5a7fd6')
    act(() => played[0]?.landed())
    expect(await screen.findByTestId('total-tirada')).toBeTruthy()
  })

  it('caen también las de los demás, con su color (y las tuyas no caen dos veces); se puede apagar', async () => {
    const { realtime, accounts } = renderTable()
    const dice = await openDice()
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: fromBruno('Ataque') }))
    await waitFor(() => expect(played).toHaveLength(1))
    expect(played[0]?.color).toBe('#d39b3a')
    // Lo tuyo, que también llega por el canal, no cae otra vez
    act(() =>
      realtime.emit({
        type: 'rolled',
        campaignId: CAMPAIGN.id,
        roll: { ...fromBruno('Mía'), by: { userId: 'yo', name: 'Enrique', color: null } }
      })
    )
    await userEvent.click(dice.getByRole('button', { name: 'Opciones de los dados' }))
    await userEvent.click(dice.getByRole('checkbox', { name: 'Ver caer los dados de los demás' }))
    expect(accounts.calls).toContain('updateDice false')
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: fromBruno('Otra') }))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(played).toHaveLength(1)
  })
})
