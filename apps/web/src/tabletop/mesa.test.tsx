import type { Campaign, ScreenView, TableServerMessage, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { cameraTarget } from './screen.tsx'

// El canal de la mesa, de mentira: la prueba manda lo que llegaría del servidor y ve lo que sale
const channels = vi.hoisted(
  () =>
    [] as Array<{
      view: string
      onMessage: (message: TableServerMessage) => void
      viewports: unknown[]
      closed: boolean
    }>
)
vi.mock('./channel.ts', () => ({
  connectTable: (
    options: { view: string },
    handlers: { onMessage: (message: TableServerMessage) => void; onStatus?: (status: string) => void }
  ) => {
    const channel = { view: options.view, onMessage: handlers.onMessage, viewports: [] as unknown[], closed: false }
    channels.push(channel)
    handlers.onStatus?.('open')
    return {
      sendViewport: (view: unknown) => channel.viewports.push(view),
      sendDrag: () => {},
      close: () => {
        channel.closed = true
      }
    }
  }
}))
// Sin WebGL: el lienzo no pinta, pero dice su tamaño y recibe la vista
const views = vi.hoisted(() => [] as unknown[])
vi.mock('./use-renderer.ts', async () => {
  const { useRef } = await import('react')
  return {
    useTableRenderer: () => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({ setView: (view: unknown) => views.push(view), setScene: () => {}, setTokens: () => {} })
      return { host, renderer, ready: true, failed: false, size: { width: 800, height: 600 } }
    }
  }
})

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
const EMAIL = 'enrique@crisol.test'

beforeEach(() => {
  channels.length = 0
  views.length = 0
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mesa'] }))
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})
afterEach(() => {
  vi.restoreAllMocks()
})

async function renderMesa(campaign: Campaign = CAMPAIGN) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [campaign],
    pages: [
      { id: crypto.randomUUID(), worldId: WORLD.id, title: 'Cripta de Varn' },
      { id: crypto.randomUUID(), worldId: WORLD.id, title: 'Faro de Brena' }
    ]
  })
  const scenes = []
  for (const page of api.pages) {
    const tab = await api.client.call('createPageTab', { pageId: page.id, kind: 'scene', name: page.title })
    const scene = await api.client.call('getScene', { tabId: tab.id })
    scenes.push(
      await api.client.call('setSceneImage', {
        sceneId: scene.id,
        width: 1200,
        height: 800,
        tiles: { version: crypto.randomUUID(), size: 512, levels: 2 }
      })
    )
  }
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${campaign.id}/mesa`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  const master = async () => {
    await waitFor(() => expect(channels.some((c) => c.view === 'master')).toBe(true))
    return channels.find((c) => c.view === 'master') as (typeof channels)[number]
  }
  /** Lo que llega por el canal: la mesa de ahora en la API falsa */
  const push = async () => {
    const table = await api.client.call('getCampaignTable', { campaignId: campaign.id })
    const channel = await master()
    act(() => channel.onMessage({ type: 'master', table }))
    return table
  }
  return { api, router, scenes, master, push }
}

describe('la mesa del máster', () => {
  it('sin escena abierta lo dice; el panel lista las del mundo y «Abrir» abre una (sin presentarla)', async () => {
    const user = userEvent.setup()
    const { api, push } = await renderMesa()
    await push()
    expect(await screen.findByText('Ninguna escena abierta.')).toBeDefined()
    const panel = within(screen.getByRole('complementary', { name: 'Panel de la mesa' }))
    const list = within(await panel.findByRole('list', { name: 'Escenas' }))
    expect(list.getAllByRole('listitem').map((item) => item.querySelector('b')?.textContent)).toEqual([
      'Cripta de Varn',
      'Faro de Brena'
    ])
    // El buscador filtra por nombre o por su página
    await user.type(panel.getByRole('searchbox', { name: 'Buscar escenas' }), 'faro')
    expect(list.getAllByRole('listitem')).toHaveLength(1)
    await user.clear(panel.getByRole('searchbox', { name: 'Buscar escenas' }))
    await user.click(list.getByRole('button', { name: 'Abrir Cripta de Varn' }))
    expect(await screen.findByRole('application', { name: 'Mesa: Cripta de Varn' })).toBeDefined()
    const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
    expect(table.open?.name).toBe('Cripta de Varn')
    expect(table.presented).toBeNull()
    expect(list.getAllByRole('listitem')[0]?.textContent).toContain('Abierta')
  })

  it('presentar, ocultar y destapar: lo que ve el grupo, marcado arriba y en el panel', async () => {
    const user = userEvent.setup()
    const { api, scenes, push } = await renderMesa()
    await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scenes[0]?.id ?? '' })
    await push()
    await user.click(await screen.findByRole('button', { name: 'Presentar' }))
    expect((await screen.findAllByText('En la tele')).length).toBe(2)
    expect((await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).presented?.id).toBe(scenes[0]?.id)
    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(await screen.findByText('Tele a oscuras')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Ocultar' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Presentar' }))
    await waitFor(() => expect(screen.queryByText('Tele a oscuras')).toBeNull())
  })

  it('con «Seguir» manda su encuadre al moverse; «Fija» deja el marco de la tele, que se mueve con las flechas', async () => {
    const user = userEvent.setup()
    const { api, scenes, push, master } = await renderMesa()
    await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scenes[0]?.id ?? '' })
    await api.client.call('presentScene', { campaignId: CAMPAIGN.id })
    await push()
    const stage = await screen.findByRole('application', { name: 'Mesa: Cripta de Varn' })
    expect(screen.getByText('La tele sigue tu vista')).toBeDefined()
    const channel = await master()
    const before = channel.viewports.length
    fireEvent.keyDown(stage, { key: 'ArrowRight' })
    fireEvent.keyDown(stage, { key: '+' })
    expect(channel.viewports.length).toBeGreaterThan(before)
    // Fija: en lo que se ve ahora
    await user.click(screen.getByRole('radio', { name: 'Fija' }))
    const frame = await screen.findByRole('region', { name: 'Lo que se ve en la tele' })
    const camera = async () => (await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).camera
    const first = await camera()
    expect(first.mode).toBe('fixed')
    frame.focus()
    fireEvent.keyDown(frame, { key: 'ArrowRight' })
    await waitFor(async () => {
      const now = await camera()
      expect(now.mode === 'fixed' && first.mode === 'fixed' && now.view.x).toBeCloseTo(
        first.mode === 'fixed' ? first.view.x + 100 : 0
      )
    })
    // Con la fija, moverse ya no manda nada
    const sent = channel.viewports.length
    fireEvent.keyDown(stage, { key: 'ArrowLeft' })
    expect(channel.viewports.length).toBe(sent)
    await user.click(screen.getByRole('radio', { name: 'Seguir' }))
    await waitFor(async () => expect((await camera()).mode).toBe('follow'))
  })

  it('el nombre de la escena abre su menú: cambiar de escena o ir a su página', async () => {
    const user = userEvent.setup()
    const { api, scenes, push, router } = await renderMesa()
    await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scenes[0]?.id ?? '' })
    await push()
    await user.click(await screen.findByRole('button', { name: 'Cripta de Varn, Cambiar de escena' }))
    const menu = within(await screen.findByRole('navigation', { name: 'Cambiar de escena' }))
    await user.click(await menu.findByRole('button', { name: /Faro de Brena/ }))
    await waitFor(async () =>
      expect((await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).open?.id).toBe(scenes[1]?.id)
    )
    await user.click(await screen.findByRole('button', { name: 'Faro de Brena, Cambiar de escena' }))
    await user.click(screen.getByRole('link', { name: 'Ir a su página' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${scenes[1]?.pageId}`))
  })

  it('un jugador no tiene mesa', async () => {
    await renderMesa({ ...CAMPAIGN, role: 'player' })
    expect(await screen.findByRole('heading', { name: 'Esta campaña no existe' })).toBeDefined()
    expect(channels).toHaveLength(0)
  })
})

describe('la pantalla de la tele', () => {
  const SCENE = {
    id: crypto.randomUUID(),
    image: { width: 1200, height: 800, tiles: { version: crypto.randomUUID(), size: 512, levels: 2 } },
    grid: {
      type: 'square' as const,
      size: 50,
      offsetX: 0,
      offsetY: 0,
      distance: 5,
      units: 'pies',
      diagonals: 'equal' as const,
      visible: true,
      color: '#000000',
      opacity: 0.3
    },
    initialView: { x: 600, y: 400, scale: 1 }
  }
  const screenOf = (patch: Partial<ScreenView>): ScreenView => ({
    campaignId: CAMPAIGN.id,
    campaignName: 'La Marca',
    scene: SCENE,
    hidden: false,
    camera: { mode: 'follow' },
    tokens: [],
    combat: null,
    ...patch
  })

  it('la cámara: el encuadre fijo, el último del máster o la vista inicial de la escena', () => {
    const followed = { x: 1, y: 2, scale: 3 }
    expect(cameraTarget(screenOf({}), followed)).toEqual(followed)
    expect(cameraTarget(screenOf({}), null)).toEqual(SCENE.initialView)
    expect(cameraTarget(screenOf({ camera: { mode: 'fixed', view: { x: 9, y: 9, scale: 2 } } }), followed)).toEqual({
      x: 9,
      y: 9,
      scale: 2
    })
    expect(cameraTarget(screenOf({ scene: null }), followed)).toBeNull()
  })

  it('a oscuras con el nombre de la campaña; al presentar, el mapa con su fundido; pantalla completa', async () => {
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/pantalla`] })
    )
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
        api={api.client}
      />
    )
    await waitFor(() => expect(channels.some((c) => c.view === 'screen')).toBe(true))
    const channel = channels.find((c) => c.view === 'screen') as (typeof channels)[number]
    // Sin barra ni nada más
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull()
    act(() => channel.onMessage({ type: 'screen', screen: screenOf({ hidden: true, scene: null }) }))
    expect(await screen.findByRole('heading', { name: 'La Marca' })).toBeDefined()
    expect(document.querySelector('[data-dark]')).not.toBeNull()
    act(() => channel.onMessage({ type: 'screen', screen: screenOf({}) }))
    await waitFor(() => expect(document.querySelector('[data-dark]')).toBeNull())
    expect(screen.getByRole('img', { name: 'Lo que ve el grupo' })).toBeDefined()
    // El encuadre del máster llega y la tele va hacia él
    act(() => channel.onMessage({ type: 'viewport', view: { x: 300, y: 200, scale: 2 } }))
    await waitFor(() => expect(views.length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: 'Pantalla completa' })).toBeDefined()
    // Ocultar: vuelve a oscuras
    act(() => channel.onMessage({ type: 'screen', screen: screenOf({ hidden: true, scene: null }) }))
    expect(document.querySelector('[data-dark]')).not.toBeNull()
  })
})
