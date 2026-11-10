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
import { announced } from '../testing.ts'
import { againVisibility } from './log.tsx'

// El máster abre la campaña en la Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

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
  createdAt: '2026-11-04T21:02:00.000Z',
  ...extra
})

function renderLog(rolls: DiceRoll[]) {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN], rolls })
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
  return { api, realtime }
}

const openLog = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Dados' }))
  const dice = within(await screen.findByRole('complementary', { name: 'Dados' }))
  // En la Mesa, el historial sale en una ventana
  await userEvent.click(dice.getByRole('button', { name: 'Historial' }))
  const list = await screen.findByRole('list', { name: 'Tiradas de la campaña' })
  return { log: within(list), history: within(list.closest<HTMLElement>('[data-window]') ?? document.body) }
}

const entries = (log: ReturnType<typeof within>) =>
  log.getAllByRole('listitem').map((li: HTMLElement) => li.textContent?.replace(/\s+/g, ' ').trim())

describe('el registro de la campaña', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campaña', 'dados', 'campana', 'mesa', 'mesa-jugador'] })
    )
    n = 0
  })

  it('en el orden en que se tiraron, con quién, el total, el crítico y las marcas de las privadas', async () => {
    renderLog([
      rollOf('Ana', 'Percepción', 17),
      rollOf('Bruno', 'Ataque', 26, { critical: 'high' }),
      rollOf('Ana', 'Sigilo', 11, { visibility: 'master' }),
      rollOf('Bruno', 'Corazonada', 5, { visibility: 'self', critical: 'low' }),
      rollOf('Enrique', '¿La oyen?', 8, { visibility: 'hidden' })
    ])
    const { log } = await openLog()
    const items = await log.findAllByRole('listitem')
    expect(items).toHaveLength(5)
    const [percepcion, ataque, sigilo, corazonada, oyen] = items.map((li) => within(li))
    expect(percepcion?.getByText('Ana')).toBeTruthy()
    expect(percepcion?.getByText('17')).toBeTruthy()
    expect(ataque?.getByText('Crítico')).toBeTruthy()
    expect(sigilo?.getByText('Al máster')).toBeTruthy()
    // Lo «para mí» de otro, visto por el máster
    expect(corazonada?.getByText('Para sí')).toBeTruthy()
    expect(corazonada?.getByText('Pifia')).toBeTruthy()
    // Lo suyo, como «Tú»
    expect(oyen?.getByText('Tú')).toBeTruthy()
    expect(oyen?.getByText('Oculta')).toBeTruthy()
  })

  it('lo que salió en cada dado y lo que se sumó; «Otra vez» tira otra vez lo mismo', async () => {
    const { api } = renderLog([rollOf('Ana', 'Percepción', 17)])
    const { log } = await openLog()
    const item = within((await log.findAllByRole('listitem'))[0] as HTMLElement)
    expect(item.getByTitle('1d20+4 → [13] + 4 = 17').textContent).toBe('13+ 4')
    await userEvent.click(item.getByRole('button', { name: 'Otra vez: Percepción' }))
    await waitFor(() => expect(log.getAllByRole('listitem')).toHaveLength(2))
    const { rolls } = await api.client.call('listRolls', { campaignId: CAMPAIGN.id })
    expect(rolls.at(-1)).toMatchObject({ formula: '1d20+4', label: 'Percepción', by: { name: 'Enrique' } })
  })

  it('lo que tiro sale abajo; lo que tiran los demás llega en vivo y se anuncia', async () => {
    const { realtime } = renderLog([rollOf('Ana', 'Percepción', 17)])
    const { log } = await openLog()
    await log.findAllByRole('listitem')
    // Con el historial abierto en su ventana, se tira desde los dados
    await userEvent.click(screen.getByRole('button', { name: 'Dados' }))
    const dice = within(await screen.findByRole('complementary', { name: 'Dados' }))
    await userEvent.click(dice.getByRole('button', { name: 'Escribir la tirada' }))
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.type(field, '1d6 # Daño{Enter}')
    await waitFor(() => expect(entries(log).at(-1)).toMatch(/Tú.*Daño/))
    const bruno = rollOf('Bruno', 'Ataque', 21)
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: bruno }))
    await waitFor(() => expect(entries(log).at(-1)).toMatch(/Bruno.*Ataque.*21/))
    expect(announced()).toBe('Bruno · Ataque: 21')
    // La misma, otra vez (por el aviso y por la respuesta): una sola
    act(() => realtime.emit({ type: 'rolled', campaignId: CAMPAIGN.id, roll: bruno }))
    expect(log.getAllByRole('listitem')).toHaveLength(3)
  })

  it('las anteriores, de 50 en 50, al pedirlas', async () => {
    renderLog(Array.from({ length: 55 }, (_, i) => rollOf('Ana', `Tirada ${i + 1}`, 10)))
    const { history, log } = await openLog()
    await waitFor(() => expect(log.getAllByRole('listitem')).toHaveLength(50))
    expect(entries(log)[0]).toContain('Tirada 6')
    await userEvent.click(history.getByRole('button', { name: 'Ver las anteriores' }))
    await waitFor(() => expect(log.getAllByRole('listitem')).toHaveLength(55))
    expect(entries(log)[0]).toContain('Tirada 1')
    expect(history.queryByRole('button', { name: 'Ver las anteriores' })).toBeNull()
  })
})

describe('repetir una tirada', () => {
  const of = (visibility: DiceRoll['visibility']) => rollOf('Ana', 'Sigilo', 11, { visibility })
  it('la suya, igual; una pública, para todos; una privada de otro, nunca para todos', () => {
    expect(againVisibility(of('master'), true, 'player')).toBe('master')
    expect(againVisibility(of('all'), false, 'master')).toBe('all')
    expect(againVisibility(of('master'), false, 'master')).toBe('hidden')
    expect(againVisibility(of('self'), false, 'player')).toBe('self')
    expect(againVisibility(of('hidden'), true, 'player')).toBe('self')
  })
})
