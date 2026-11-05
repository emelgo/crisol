import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'

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
  version: 1,
  system: null,
  systemChoices: null
}
const PAGE = crypto.randomUUID()
const EMAIL = 'enrique@crisol.test'

async function renderTable() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    pages: [{ id: PAGE, worldId: WORLD.id, title: 'Encuentros' }]
  })
  const tab = await api.client.call('createPageTab', { pageId: PAGE, kind: 'table', name: 'Bosque' })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PAGE}?pestana=${tab.id}`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  return { api, tab }
}

describe('la pestaña «Tabla» de una página', () => {
  beforeEach(() => localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mundo'] })))

  it('sus filas: añadir, escribir, ver lo que falla (que se pisen) y guardar; sin fórmula, 1dN', async () => {
    const { api, tab } = await renderTable()
    const add = await screen.findByRole('button', { name: 'Añadir una fila' })
    for (const text of ['Lobos', 'Bandidos']) {
      await userEvent.click(add)
      await userEvent.type(screen.getAllByRole('textbox', { name: /^Resultado del/ }).at(-1) as HTMLElement, text)
    }
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Fórmula' }).placeholder).toBe('1d2')
    // Que se pisen: dice qué falla y no deja guardar
    const to = screen.getByRole('spinbutton', { name: 'Hasta, en «Lobos»' })
    await userEvent.clear(to)
    await userEvent.type(to, '2')
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('se pisan'))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Guardar' }).disabled).toBe(true)
    await userEvent.clear(to)
    await userEvent.type(to, '1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sin reemplazo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull())
    const { table } = await api.client.call('getRandomTable', { tabId: tab.id })
    expect(table).toMatchObject({ replacement: false, rows: [{ text: 'Lobos' }, { text: 'Bandidos' }] })
  })

  it('tirar en una campaña: la fila que salió, «Ahora»; sin reemplazo, lo sacado se cuenta y se reinicia', async () => {
    const { api, tab } = await renderTable()
    await api.client.call('updateRandomTable', {
      tabId: tab.id,
      version: 1,
      replacement: false,
      rows: [{ id: 'a', from: 1, to: 1, text: 'Solo esto' }]
    })
    await screen.findByRole('button', { name: 'Añadir una fila' })
    // La tabla, ya con su fila, al recargarla
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar' }))
    expect(await screen.findByText('Ahora')).toBeDefined()
    expect(await screen.findByText('Una sacada')).toBeDefined()
    // Ya no queda nada: dice por qué
    await userEvent.click(screen.getByRole('button', { name: 'Tirar' }))
    expect(await screen.findByText('Ya ha salido todo: reiníciala')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Reiniciar' }))
    await waitFor(() => expect(screen.queryByText('Una sacada')).toBeNull())
    // Quién la ve: oculta
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Quién la ve' })).getByRole('radio', { name: 'Oculta' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Tirar' }))
    await waitFor(async () => {
      const { rolls } = await api.client.call('listRolls', { campaignId: CAMPAIGN.id })
      expect(rolls.find((r) => r.visibility === 'hidden')).toMatchObject({
        table: { name: 'Bosque', results: [{ text: 'Solo esto' }] }
      })
    })
  })
})
