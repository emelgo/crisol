import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced } from '../testing.ts'

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

/** Una campaña abierta, como máster o como jugadora; los recorridos, ya vistos */
function renderCampaign(role: Campaign['role'], names = ['La Marca']) {
  const w = world(role === 'master' ? 'master' : 'player')
  const campaigns = names.map((name) => campaignOf(w, name, role))
  const api = fakeApi({ organizations: [ORG], worlds: [w], campaigns })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${w.id}/campanas/${campaigns[0]?.id}`] })
  )
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

describe('la ficha de dados', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campaña', 'dados', 'campana'] })
    )
  })

  it('el botón flotante (el d20, fuera de la barra) la abre y la cierra', async () => {
    renderCampaign('master')
    const button = await screen.findByRole('button', { name: 'Dados' })
    expect(button.closest('nav')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(button)
    expect(await screen.findByRole('complementary', { name: 'Dados' })).toBeTruthy()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
  })

  it('la X la cierra y devuelve el foco al d20; con el menú del engranaje abierto, Escape cierra solo el menú', async () => {
    renderCampaign('master')
    const button = await screen.findByRole('button', { name: 'Dados' })
    let dice = await openDice()
    await userEvent.click(dice.getByRole('button', { name: 'Opciones de los dados' }))
    expect(dice.getByRole('button', { name: 'Opciones de los dados' }).getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    expect(dice.getByRole('button', { name: 'Opciones de los dados' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('complementary', { name: 'Dados' })).toBeTruthy()
    await userEvent.click(dice.getByRole('button', { name: 'Cerrar los dados' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Dados' })).toBeNull())
    expect(document.activeElement).toBe(button)
    dice = await openDice()
    expect(dice.getByRole('textbox', { name: 'Tirada' })).toBeTruthy()
  })

  it('bajo la tirada no se repite lo escrito («1d20» bajo «1d20»); sí lo que la explica', async () => {
    renderCampaign('master')
    const dice = await openDice()
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.type(field, '1d20')
    expect(dice.queryByText('1d20')).toBeNull()
    await userEvent.type(field, ' # Sigilo')
    expect(dice.getByText('1d20 · Sigilo')).toBeTruthy()
  })

  it('la tirada se explica mientras se escribe; si no vale, dice por qué y no deja tirar', async () => {
    renderCampaign('master')
    const dice = await openDice()
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.type(field, '2d20kh1+5')
    expect(dice.getByText('Ventaja (2d20, se queda el mayor) + 5')).toBeTruthy()
    await userEvent.type(field, '+')
    expect(dice.getByText('No se entiende «2d20kh1+5+» al final')).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect((dice.getByRole('button', { name: 'Tirar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('los dados rápidos y la ventaja cambian la tirada', async () => {
    renderCampaign('master')
    const dice = await openDice()
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d6' }))
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d6' }))
    await userEvent.click(dice.getByRole('button', { name: 'Añadir un d20' }))
    expect((field as HTMLInputElement).value).toBe('2d6+1d20')
    const advantage = dice.getByRole('button', { name: 'Ventaja' })
    await userEvent.click(advantage)
    expect((field as HTMLInputElement).value).toBe('2d6+2d20kh1')
    expect(advantage.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(dice.getByRole('button', { name: 'Desventaja' }))
    expect((field as HTMLInputElement).value).toBe('2d6+2d20kl1')
    await userEvent.click(dice.getByRole('button', { name: 'Desventaja' }))
    expect((field as HTMLInputElement).value).toBe('2d6+1d20')
  })

  it('cada uno elige entre lo que puede: el máster, todos u oculta; la jugadora, todos, para mí o al máster', async () => {
    renderCampaign('master')
    let dice = await openDice()
    const names = () =>
      within(dice.getByRole('radiogroup', { name: 'Quién la ve' }))
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent)
    expect(names()).toEqual(['Todos', 'Oculta'])
    cleanup()
    renderCampaign('player')
    dice = await openDice()
    expect(names()).toEqual(['Todos', 'Para mí', 'Al máster'])
  })

  it('con Intro se tira en la campaña, con su visibilidad, y se anuncia el total', async () => {
    const { api, campaigns } = renderCampaign('player')
    const dice = await openDice()
    await userEvent.click(dice.getByRole('radio', { name: 'Al máster' }))
    const field = dice.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(field)
    await userEvent.type(field, '1d20+7 # Sigilo{Enter}')
    await waitFor(() => expect(announced()).toMatch(/^Sigilo: \d+/))
    const { rolls } = await api.client.call('listRolls', { campaignId: campaigns[0]?.id ?? '' })
    expect(rolls).toHaveLength(1)
    expect(rolls[0]).toMatchObject({ formula: '1d20+7', label: 'Sigilo', visibility: 'master' })
  })

  it('con varias campañas en el mundo se elige en cuál, y se recuerda', async () => {
    const { api, campaigns } = renderCampaign('master', ['La Marca', 'Los del Puerto'])
    const dice = await openDice()
    await userEvent.selectOptions(dice.getByRole('combobox', { name: 'Campaña' }), 'Los del Puerto')
    await userEvent.click(dice.getByRole('button', { name: 'Tirar' }))
    await waitFor(async () =>
      expect((await api.client.call('listRolls', { campaignId: campaigns[1]?.id ?? '' })).rolls).toHaveLength(1)
    )
    expect(Object.values(JSON.parse(localStorage.getItem('crisol.dados.campañas') ?? '{}'))).toEqual([campaigns[1]?.id])
  })
})
