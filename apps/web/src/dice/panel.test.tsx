import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced } from '../testing.ts'

// El máster abre la campaña en la Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world = (role: World['role']): World => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1
})
const campaignOf = (w: World, name: string, role: Campaign['role']): Campaign => ({
  id: crypto.randomUUID(),
  worldId: w.id,
  name,
  description: '',
  color: null,
  cover: null,
  role,
  version: 1
})

/** Una campaña abierta (o el mundo, fuera de ella), como máster o como jugadora; los recorridos, ya vistos */
function renderCampaign(role: Campaign['role'], names = ['La Marca'], where: 'campaign' | 'world' = 'campaign') {
  const w = world(role === 'master' ? 'master' : 'player')
  const campaigns = names.map((name) => campaignOf(w, name, role))
  const api = fakeApi({ organizations: [ORG], worlds: [w], campaigns })
  const path = where === 'campaign' ? `/mundos/${w.id}/campanas/${campaigns[0]?.id}` : `/mundos/${w.id}`
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, campaigns }
}

const openDice = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Dados' }))
  return within(await screen.findByRole('complementary', { name: 'Dados' }))
}

const write = async (dice: ReturnType<typeof within>) => {
  await userEvent.click(dice.getByRole('button', { name: 'Escribir la tirada' }))
  return dice.getByRole('textbox', { name: 'Tirada' }) as HTMLInputElement
}

const lastRolls = async (api: ReturnType<typeof fakeApi>, campaignId: string | undefined) =>
  (await api.client.call('listRolls', { campaignId: campaignId ?? '' })).rolls

describe('los dados', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campaña', 'dados', 'campana', 'mesa', 'mesa-jugador'] })
    )
  })

  it('el d20 (fuera de la barra) los abre y los cierra; también Escape (el foco vuelve a él) y pulsar fuera', async () => {
    renderCampaign('master')
    const button = await screen.findByRole('button', { name: 'Dados' })
    expect(button.closest('nav')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(button)
    expect(await screen.findByRole('complementary', { name: 'Dados' })).toBeTruthy()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    await openDice()
    await userEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    await openDice()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    expect(document.activeElement).toBe(button)
  })

  it('pulsar un dado suma uno; el botón derecho quita uno; la × de la bandeja quita ese dado entero', async () => {
    const { api, campaigns } = renderCampaign('master')
    const dice = await openDice()
    // Sin nada juntado no hay bandeja
    expect(dice.queryByRole('button', { name: 'Tirar' })).toBeNull()
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d8' }))
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d8 (van 1)' }))
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d4' }))
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d6' }))
    const chips = () =>
      within(dice.getByRole('list', { name: 'En la tirada' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    expect(chips()).toEqual(['2d8', '1d4', '1d6'])
    await userEvent.pointer({
      keys: '[MouseRight]',
      target: dice.getByRole('button', { name: 'Añadir un d8 (van 2)' })
    })
    expect(chips()).toEqual(['1d8', '1d4', '1d6'])
    await userEvent.click(dice.getByRole('button', { name: 'Quitar 1d6' }))
    expect(chips()).toEqual(['1d8', '1d4'])
    await userEvent.click(dice.getByRole('button', { name: 'Sumar uno' }))
    await userEvent.click(dice.getByRole('button', { name: 'Sumar uno' }))
    await userEvent.click(dice.getByRole('button', { name: 'Restar uno' }))
    expect(dice.getByRole('group', { name: 'Modificador' }).textContent).toContain('+1')
    await userEvent.click(dice.getByRole('button', { name: 'Tirar' }))
    await waitFor(async () => expect(await lastRolls(api, campaigns[0]?.id)).toHaveLength(1))
    expect((await lastRolls(api, campaigns[0]?.id))[0]).toMatchObject({ formula: '1d8+1d4+1', visibility: 'all' })
  })

  it('con el teclado: Retroceso quita uno del dado enfocado; en el menú de quién la ve, Escape cierra solo el menú', async () => {
    renderCampaign('master')
    const dice = await openDice()
    const d6 = dice.getByRole('button', { name: 'Añadir un d6' })
    d6.focus()
    await userEvent.keyboard('{Enter}{Enter}')
    expect(dice.getByRole('button', { name: 'Añadir un d6 (van 2)' })).toBe(document.activeElement)
    await userEvent.keyboard('{Backspace}')
    expect(dice.getByRole('button', { name: 'Añadir un d6 (van 1)' })).toBeTruthy()
    await userEvent.click(dice.getByRole('button', { name: /^Quién la ve/ }))
    expect(dice.getByRole('menuitemradio', { name: 'Todos' })).toBe(document.activeElement)
    await userEvent.keyboard('{Escape}')
    expect(dice.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Dados' })).toBeTruthy()
    expect(dice.getByRole('button', { name: /^Quién la ve/ })).toBe(document.activeElement)
  })

  it('la ventaja va en el d20 (si no lo hay, lo pone); al tirar, se vacía, se cierra y se anuncia el total', async () => {
    const { api, campaigns } = renderCampaign('master')
    let dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d6' }))
    const advantage = dice.getByRole('button', { name: 'Ventaja' })
    await userEvent.click(advantage)
    expect(advantage.getAttribute('aria-pressed')).toBe('true')
    expect(within(dice.getByRole('list', { name: 'En la tirada' })).getByText('1d20')).toBeTruthy()
    await userEvent.click(dice.getByRole('button', { name: 'Tirar' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    await waitFor(() => expect(announced()).toMatch(/: \d+$/))
    expect((await lastRolls(api, campaigns[0]?.id))[0]).toMatchObject({ formula: '1d6+2d20kh1' })
    dice = await openDice()
    expect(dice.queryByRole('list', { name: 'En la tirada' })).toBeNull()
  })

  it('quién la ve: el máster, todos o solo él; la jugadora, todos, el máster o solo ella; se recuerda', async () => {
    renderCampaign('master')
    let dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d20' }))
    const options = async () => {
      await userEvent.click(dice.getByRole('button', { name: /^Quién la ve/ }))
      const names = within(dice.getByRole('menu', { name: 'Quién la ve' }))
        .getAllByRole('menuitemradio')
        .map((r) => r.textContent)
      return names
    }
    expect(await options()).toEqual(['Todos', 'Solo yo'])
    cleanup()
    const { api, campaigns } = renderCampaign('player')
    dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d20' }))
    expect(await options()).toEqual(['Todos', 'Máster', 'Solo yo'])
    await userEvent.click(dice.getByRole('menuitemradio', { name: 'Máster' }))
    expect(dice.getByRole('button', { name: 'Quién la ve: Máster' })).toBeTruthy()
    expect(localStorage.getItem('crisol.dados.quien')).toBe('"master"')
    await userEvent.click(dice.getByRole('button', { name: 'Tirar' }))
    await waitFor(async () => expect(await lastRolls(api, campaigns[0]?.id)).toHaveLength(1))
    expect((await lastRolls(api, campaigns[0]?.id))[0]).toMatchObject({ visibility: 'master' })
  })

  it('escrita: se explica mientras se escribe (sin repetir lo escrito); si no vale, dice por qué y no deja tirar', async () => {
    renderCampaign('master')
    const dice = await openDice()
    const field = await write(dice)
    await userEvent.clear(field)
    await userEvent.type(field, '1d20')
    expect(dice.queryByText('1d20')).toBeNull()
    await userEvent.type(field, ' # Sigilo')
    expect(dice.getByText('1d20 · Sigilo')).toBeTruthy()
    await userEvent.clear(field)
    await userEvent.type(field, '2d20kh1+5')
    expect(dice.getByText('Ventaja (2d20, se queda el mayor) + 5')).toBeTruthy()
    expect(dice.getByRole('button', { name: 'Ventaja' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(dice.getByRole('button', { name: 'Desventaja' }))
    expect(field.value).toBe('2d20kl1+5')
    await userEvent.type(field, '+')
    expect(dice.getByText('No se entiende «2d20kl1+5+» al final')).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect((dice.getByRole('button', { name: 'Tirar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('escrita, con Intro se tira; la próxima vez los dados se abren escribiendo', async () => {
    const { api, campaigns } = renderCampaign('master')
    let dice = await openDice()
    const field = await write(dice)
    await userEvent.clear(field)
    await userEvent.type(field, '1d20+7 # Sigilo{Enter}')
    await waitFor(() => expect(announced()).toMatch(/^Sigilo: \d+/))
    expect((await lastRolls(api, campaigns[0]?.id))[0]).toMatchObject({ formula: '1d20+7', label: 'Sigilo' })
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    dice = await openDice()
    expect(dice.getByRole('textbox', { name: 'Tirada' })).toBeTruthy()
    expect(localStorage.getItem('crisol.dados.modo')).toBe('"write"')
  })

  it('fuera de la campaña, con varias en el mundo, se elige en cuál se tira, y se recuerda', async () => {
    const { api, campaigns } = renderCampaign('master', ['La Marca', 'Los del Puerto'], 'world')
    const dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d20' }))
    await userEvent.selectOptions(dice.getByRole('combobox', { name: 'Campaña' }), 'Los del Puerto')
    await userEvent.click(dice.getByRole('button', { name: 'Tirar' }))
    await waitFor(async () => expect(await lastRolls(api, campaigns[1]?.id)).toHaveLength(1))
    expect(Object.values(JSON.parse(localStorage.getItem('crisol.dados.campañas') ?? '{}'))).toEqual([campaigns[1]?.id])
  })

  it('fuera de la Mesa, «Historial» abre las tiradas en una ficha junto al d20; Escape la cierra', async () => {
    renderCampaign('player')
    const dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Historial' }))
    const history = within(await screen.findByRole('complementary', { name: 'Historial' }))
    expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull()
    expect(history.getByRole('list', { name: 'Tiradas de la campaña' })).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Historial' })).toBeNull())
  })
})
