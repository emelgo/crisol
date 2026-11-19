import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

vi.mock('./channel.ts', async () => (await import('./fakes.ts')).quietChannel())
vi.mock('./use-renderer.ts', async () => (await import('./fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world = (role: World['role'] = 'master'): World => ({
  id: WORLD_ID,
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1
})
const WORLD_ID = crypto.randomUUID()
const campaign = (role: Campaign['role'] = 'master'): Campaign => ({
  id: CAMPAIGN_ID,
  worldId: WORLD_ID,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role,
  version: 1
})
const CAMPAIGN_ID = crypto.randomUUID()
const ALDRIC_ID = crypto.randomUUID()

function renderAt(path: string, role: Campaign['role'] = 'master') {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [world(role === 'master' ? 'master' : 'player')],
    campaigns: [campaign(role)],
    pages: [
      { id: ALDRIC_ID, worldId: WORLD_ID, title: 'Aldric Varn' },
      { id: crypto.randomUUID(), worldId: WORLD_ID, title: 'Puerto Gris' }
    ]
  })
  const realtime = fakeRealtime()
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { api, realtime }
}

const panel = () => within(screen.getByRole('complementary', { name: 'Panel de la mesa' }))

describe('las páginas en ventanas sobre la Mesa', () => {
  it('desde Páginas se abren varias a la vez, sin dejar la Mesa', async () => {
    const user = userEvent.setup()
    renderAt(`/mundos/${WORLD_ID}/campanas/${CAMPAIGN_ID}?panel=paginas`)
    await screen.findByRole('complementary', { name: 'Panel de la mesa' })
    await user.click(await panel().findByRole('button', { name: 'Aldric Varn' }))
    await user.click(panel().getByRole('button', { name: 'Puerto Gris' }))
    expect(await screen.findByRole('dialog', { name: 'Aldric Varn' })).toBeDefined()
    expect(screen.getByRole('dialog', { name: 'Puerto Gris' })).toBeDefined()
    // La pestaña sigue abierta: no se ha cambiado de vista
    expect(panel().getByRole('tab', { name: 'Páginas' }).getAttribute('aria-selected')).toBe('true')
    // «Lo que sabe el grupo», también en su ventana
    await user.click(panel().getByRole('button', { name: 'Lo que sabe el grupo' }))
    expect(await screen.findByRole('dialog', { name: 'Lo que sabe el grupo' })).toBeDefined()
  })

  it('«Enseñar a los jugadores»: a quien la conoce; si no la conoce nadie, deja revelarla y enseñarla', async () => {
    const user = userEvent.setup()
    const { api } = renderAt(`/mundos/${WORLD_ID}/campanas/${CAMPAIGN_ID}?panel=paginas`)
    await screen.findByRole('complementary', { name: 'Panel de la mesa' })
    await user.click(await panel().findByRole('button', { name: 'Aldric Varn' }))
    const win = within(await screen.findByRole('dialog', { name: 'Aldric Varn' }))
    await user.click(await win.findByRole('button', { name: 'Enseñar a los jugadores' }))
    // Su menú: a todos, a unos o en la vista de jugadores
    await user.click(win.getByRole('menuitem', { name: 'A todos' }))
    const aldric = api.pages.find((p) => p.title === 'Aldric Varn')?.id
    await waitFor(() => expect(api.shownPages).toEqual([{ campaignId: CAMPAIGN_ID, pageId: aldric }]))
    await user.click(await win.findByRole('button', { name: '2 no la conocen: revelar y enseñar' }))
    expect(await win.findByRole('button', { name: 'Enseñando · la ven 2' })).toBeDefined()
    expect(api.calls).toContain('reveal')
    expect(win.queryByRole('button', { name: /no la conocen/ })).toBeNull()
  })

  it('sus pestañas se cambian dentro de la ventana, sin dejar la Mesa (desde ahí se revela un pin)', async () => {
    const user = userEvent.setup()
    const { api } = renderAt(`/mundos/${WORLD_ID}/campanas/${CAMPAIGN_ID}?panel=paginas`)
    await api.client.call('createPageTab', { pageId: ALDRIC_ID, kind: 'text', name: 'Notas' })
    await screen.findByRole('complementary', { name: 'Panel de la mesa' })
    await user.click(await panel().findByRole('button', { name: 'Aldric Varn' }))
    const win = within(await screen.findByRole('dialog', { name: 'Aldric Varn' }))
    const tabs = within(await win.findByRole('navigation', { name: 'Pestañas de la página' }))
    await user.click(await tabs.findByRole('link', { name: 'Notas' }))
    await waitFor(() => expect(tabs.getByRole('link', { name: 'Notas' }).getAttribute('aria-current')).toBe('page'))
    // La ventana sigue con el nombre de la página, y la Mesa, con su pestaña
    expect(screen.getByRole('dialog', { name: 'Aldric Varn' })).toBeDefined()
    expect(panel().getByRole('tab', { name: 'Páginas' }).getAttribute('aria-selected')).toBe('true')
    await user.click(tabs.getByRole('link', { name: 'Texto' }))
    await waitFor(() => expect(tabs.getByRole('link', { name: 'Texto' }).getAttribute('aria-current')).toBe('page'))
  })

  it('un enlace de antes a la Mesa con una página (?pagina=) la abre en su ventana, con la pestaña Páginas', async () => {
    renderAt(`/mundos/${WORLD_ID}/campanas/${CAMPAIGN_ID}?panel=paginas&pagina=${ALDRIC_ID}`)
    expect(await screen.findByRole('dialog', { name: 'Aldric Varn' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Páginas' }).getAttribute('aria-selected')).toBe('true')
  })

  it('a la jugadora le llega el aviso de la página que le enseñan', async () => {
    const { api, realtime } = renderAt(`/mundos/${WORLD_ID}`, 'player')
    await screen.findByRole('heading', { level: 1 })
    const pageId = api.pages[0]?.id ?? ''
    act(() =>
      realtime.emit({ type: 'shown', worldId: WORLD_ID, campaignId: CAMPAIGN_ID, pageId, title: 'Aldric Varn' })
    )
    const notice = within(await screen.findByRole('region', { name: 'Lo nuevo' }))
    expect(notice.getByText('Te enseñan: Aldric Varn')).toBeDefined()
    expect(notice.getByRole('link', { name: 'Leerlo' }).getAttribute('href')).toBe(
      `/mundos/${WORLD_ID}/campanas/${CAMPAIGN_ID}/paginas/${pageId}`
    )
  })
})
