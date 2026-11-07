import type { Campaign, ScreenView, TableServerMessage, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import type { DrawToken, MapImageDraw, MapLabel, OverlayShape, ShapeLayer } from './renderer.ts'

// El canal de la mesa, de mentira: la prueba manda lo que llegaría del servidor y ve lo que sale en vivo
const channels = vi.hoisted(() => [] as Array<{ view: string; onMessage: (message: TableServerMessage) => void }>)
const sent = vi.hoisted(() => ({ measures: [] as unknown[], laser: [] as unknown[] }))
vi.mock('./channel.ts', () => ({
  connectTable: (
    options: { view: string },
    handlers: { onMessage: (message: TableServerMessage) => void; onStatus?: (status: string) => void }
  ) => {
    channels.push({ view: options.view, onMessage: handlers.onMessage })
    handlers.onStatus?.('open')
    return {
      sendViewport: () => {},
      sendDrag: () => {},
      sendMeasure: (measure: unknown) => sent.measures.push(measure),
      sendLaser: (points: unknown) => sent.laser.push(points),
      close: () => {}
    }
  }
}))
// Sin WebGL: el lienzo no pinta, pero guarda lo último de cada capa
const drawn = vi.hoisted(() => ({
  shapes: {} as Partial<Record<string, OverlayShape[]>>,
  labels: [] as MapLabel[],
  images: [] as MapImageDraw[],
  tokens: [] as DrawToken[]
}))
vi.mock('./use-renderer.ts', async () => {
  const { useRef } = await import('react')
  return {
    useTableRenderer: () => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({
        setView: () => {},
        setScene: () => {},
        setTokens: (tokens: DrawToken[]) => {
          drawn.tokens = tokens
        },
        setFog: () => {},
        setGlow: () => {},
        setShapes: (shapes: OverlayShape[], layer: ShapeLayer = 'editor') => {
          drawn.shapes[layer] = shapes
        },
        setLabels: (labels: MapLabel[]) => {
          drawn.labels = labels
        },
        setImages: (images: MapImageDraw[]) => {
          drawn.images = images
        },
        snapshot: async () => 'data:image/webp;base64,AAAA'
      })
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
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
const WOLF: ContentItem = { type: 'personaje', key: 'lobo', source: null, data: { name: { es: 'Lobo', en: 'Wolf' } } }
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}
const EMAIL = 'enrique@crisol.test'

beforeEach(() => {
  channels.length = 0
  sent.measures = []
  sent.laser = []
  drawn.shapes = {}
  drawn.labels = []
  drawn.images = []
  drawn.tokens = []
  localStorage.clear()
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mesa'] }))
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})

/** La cripta con dos lobos (en 350, 250 y 450, 350), casillas de 100 px y 5 pies */
async function renderMesa() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] },
    pages: [{ id: crypto.randomUUID(), worldId: WORLD.id, title: 'Cripta de Varn' }]
  })
  const page = api.pages[0] as { id: string }
  const tab = await api.client.call('createPageTab', { pageId: page.id, kind: 'scene', name: 'Cripta de Varn' })
  const created = await api.client.call('getScene', { tabId: tab.id })
  const scene = await api.client.call('setSceneImage', {
    sceneId: created.id,
    width: 1200,
    height: 800,
    tiles: { version: crypto.randomUUID(), size: 512, levels: 2 }
  })
  await api.client.call('updateScene', {
    sceneId: scene.id,
    grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5, units: 'pies' }
  })
  await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scene.id })
  const placed = await api.client.call('placeTokens', {
    campaignId: CAMPAIGN.id,
    sceneId: scene.id,
    tokens: [{ content: { key: 'lobo', count: 2 }, column: 2, row: 2 }]
  })
  const wolves = placed.tokens.map((token) => token.id)
  await api.client.call('moveTokens', {
    campaignId: CAMPAIGN.id,
    moves: [
      { tokenId: wolves[0] as string, x: 350, y: 250 },
      { tokenId: wolves[1] as string, x: 450, y: 350 }
    ]
  })
  render(
    <App
      router={createAppRouter(
        createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/mesa`] })
      )}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  const push = async () => {
    await waitFor(() => expect(channels.some((c) => c.view === 'master')).toBe(true))
    const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
    act(() => channels.find((c) => c.view === 'master')?.onMessage({ type: 'master', table }))
    return table
  }
  await push()
  const stage = await screen.findByRole('application', { name: 'Mesa: Cripta de Varn' })
  await waitFor(() => expect(stage.dataset.view).toBeDefined())
  const at = (x: number, y: number) => {
    const view = JSON.parse(stage.dataset.view ?? '{}') as { x: number; y: number; scale: number }
    return { clientX: x * view.scale + view.x, clientY: y * view.scale + view.y }
  }
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number, extra = {}) =>
    fireEvent[type](stage, { button: 0, pointerId: 1, pointerType: 'mouse', ...at(x, y), ...extra })
  const drag = (from: [number, number], to: [number, number], extra = {}) => {
    pointer('pointerDown', ...from, extra)
    pointer('pointerMove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, extra)
    pointer('pointerMove', ...to, extra)
    pointer('pointerUp', ...to, extra)
  }
  const marks = async () => (await api.client.call('listMarks', { campaignId: CAMPAIGN.id })).marks
  return { api, scene, push, stage, pointer, drag, marks, wolves }
}

const press = (key: string) => fireEvent.keyDown(document.body, { key })

describe('las herramientas de la mesa', () => {
  it('la columna, con sus teclas: cada herramienta saca su barra y su panel; abajo, los paneles', async () => {
    await renderMesa()
    const tools = within(screen.getByRole('toolbar', { name: 'Herramientas de la mesa' }))
    for (const name of ['Medir', 'Plantillas de área', 'Láser', 'Dibujar', 'Texto', 'Sellos', 'Pines', 'Imágenes'])
      expect(tools.getByRole('button', { name })).toBeDefined()
    press('r')
    expect(tools.getByRole('button', { name: 'Medir' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('complementary', { name: 'Plantillas' })).toBeDefined()
    expect(screen.getByRole('toolbar', { name: 'Medir' })).toBeDefined()
    press('d')
    expect(screen.getByRole('complementary', { name: 'Dibujos' })).toBeDefined()
    press('p')
    expect(screen.getByRole('complementary', { name: 'Pines' })).toBeDefined()
    press('w')
    expect(screen.getByRole('complementary', { name: 'Widgets' })).toBeDefined()
    expect(tools.getByRole('button', { name: 'Widgets' }).getAttribute('aria-pressed')).toBe('true')
    press('f')
    expect(screen.getByRole('complementary', { name: 'Instantáneas' })).toBeDefined()
    // Los de la visión siguen con las suyas
    press('m')
    expect(screen.getByRole('complementary', { name: 'Muros y puertas' })).toBeDefined()
  })

  it('medir un cono (en vivo por el canal, con las fichas de dentro marcadas), dejarlo como plantilla, elegir las de dentro y dañarlas', async () => {
    const user = userEvent.setup()
    const { api, drag, marks, push, wolves } = await renderMesa()
    press('r')
    const bar = within(screen.getByRole('toolbar', { name: 'Medir' }))
    await user.click(bar.getByRole('radio', { name: 'Cono' }))
    drag([150, 250], [750, 250])
    // 30 pies, junto a su punta; las dos fichas, dentro
    expect(drawn.labels).toEqual([{ at: { x: 750, y: 250 }, text: '30 pies', strong: true, offset: { x: 44, y: 30 } }])
    await waitFor(() => expect(drawn.tokens.filter((token) => token.target).map((token) => token.id)).toEqual(wolves))
    expect(sent.measures.at(-1)).toMatchObject({ shape: 'cone', angle: 53.13 })
    await user.click(bar.getByRole('button', { name: 'Dejar como plantilla' }))
    await waitFor(async () => expect(await marks()).toHaveLength(1))
    expect((await marks())[0]).toMatchObject({ kind: 'template', shape: 'cone', a: { x: 150, y: 250 }, hidden: false })
    // La medida se va (también de la tele)
    expect(sent.measures.at(-1)).toBeNull()
    await push()
    const panel = within(screen.getByRole('complementary', { name: 'Plantillas' }))
    const selected = within(await panel.findByRole('region', { name: 'Cono de 30 pies' }))
    expect(selected.getByText('Dentro: 2 fichas')).toBeDefined()
    // Sin enseñarla en la tele
    await user.click(panel.getByRole('button', { name: 'En la tele: Cono de 30 pies' }))
    await waitFor(async () => expect((await marks())[0]?.hidden).toBe(true))
    // Elegirlas: el daño a varias, con las dos
    await user.click(selected.getByRole('button', { name: 'Elegirlas' }))
    const damage = within(screen.getByRole('region', { name: 'Daño a varias' }))
    expect(damage.getByText('Dentro de la plantilla: 2')).toBeDefined()
    await user.type(damage.getByLabelText('Cuánto'), '3')
    await user.click(damage.getByRole('button', { name: 'Aplicar' }))
    await waitFor(async () => {
      const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
      expect(table.tokens.map((token) => token.actor.life?.value)).toEqual(
        table.tokens.map((token) => (token.actor.life ? token.actor.life.max - 3 : undefined))
      )
    })
  })

  it('un camino a clics con sus tramos; moverla y girarla; Supr la quita', async () => {
    const user = userEvent.setup()
    const { pointer, drag, marks, push } = await renderMesa()
    press('r')
    // Clic, clic, doble clic: dos tramos (15 y 10 pies, con todas las diagonales iguales)
    pointer('pointerDown', 50, 50)
    pointer('pointerUp', 50, 50)
    pointer('pointerMove', 350, 50)
    pointer('pointerDown', 350, 50)
    pointer('pointerUp', 350, 50)
    pointer('pointerMove', 550, 250)
    pointer('pointerDown', 550, 250)
    pointer('pointerUp', 550, 250)
    pointer('pointerDown', 550, 250)
    pointer('pointerUp', 550, 250)
    expect(drawn.labels.map((label) => label.text)).toEqual(['15 pies', '10 pies', '25 pies'])
    press('Escape')
    expect(drawn.labels).toEqual([])
    // Con la de plantillas, la forma queda al soltar
    press('a')
    await user.click(
      within(screen.getByRole('toolbar', { name: 'Plantillas de área' })).getByRole('radio', { name: 'Círculo' })
    )
    drag([600, 400], [800, 400])
    await waitFor(async () => expect(await marks()).toHaveLength(1))
    await push()
    // Moverla (arrastrando por dentro) y girarla (por el asa de su punta)
    drag([600, 450], [700, 450])
    await waitFor(async () =>
      expect((await marks())[0]).toMatchObject({ a: { x: 700, y: 400 }, b: { x: 900, y: 400 } })
    )
    await push()
    drag([900, 400], [700, 600])
    await waitFor(async () => expect((await marks())[0]).toMatchObject({ b: { x: 700, y: 600 } }))
    press('Delete')
    await waitFor(async () => expect(await marks()).toHaveLength(0))
  })

  it('arrastrar una ficha enseña lo que recorre', async () => {
    const { pointer } = await renderMesa()
    pointer('pointerDown', 350, 250)
    pointer('pointerMove', 450, 250)
    pointer('pointerMove', 650, 250)
    expect(drawn.labels.at(-1)?.text).toBe('15 pies')
    expect(sent.measures.at(-1)).toMatchObject({ shape: 'line' })
    pointer('pointerUp', 650, 250)
    expect(drawn.labels).toEqual([])
    expect(sent.measures.at(-1)).toBeNull()
  })

  it('«La tele ve lo que mides» y la regla de las diagonales', async () => {
    const user = userEvent.setup()
    const { api, scene } = await renderMesa()
    press('r')
    const panel = within(screen.getByRole('complementary', { name: 'Plantillas' }))
    await user.click(panel.getByRole('switch', { name: 'La tele ve lo que mides' }))
    await waitFor(async () =>
      expect((await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).measureOnScreen).toBe(true)
    )
    expect(panel.getByRole('switch', { name: 'La tele ve lo que mides' }).getAttribute('aria-checked')).toBe('true')
    await user.selectOptions(panel.getByLabelText('Diagonales'), 'alternate')
    await waitFor(async () =>
      expect((await api.client.call('getScene', { sceneId: scene.id })).grid.diagonals).toBe('alternate')
    )
  })

  it('dibujar a mano y borrar con la goma (en una operación), un texto y un sello del máster', async () => {
    const user = userEvent.setup()
    const { pointer, drag, marks, push } = await renderMesa()
    press('d')
    pointer('pointerDown', 100, 600)
    for (let x = 120; x <= 500; x += 20) pointer('pointerMove', x, 600)
    pointer('pointerUp', 500, 600)
    await waitFor(async () => expect(await marks()).toHaveLength(1))
    expect((await marks())[0]).toMatchObject({ kind: 'drawing', tool: 'pen', color: '#ff6b5b', width: 6 })
    await push()
    const bar = within(screen.getByRole('toolbar', { name: 'Dibujar' }))
    await user.click(bar.getByRole('radio', { name: 'Goma' }))
    drag([300, 560], [300, 640])
    await waitFor(async () => expect(await marks()).toHaveLength(2))
    expect((await marks()).every((mark) => mark.kind === 'drawing')).toBe(true)
    await push()
    expect(screen.getByText('2 trazos')).toBeDefined()
    // Un texto: donde se pulsa sale su campo; Intro lo deja
    press('t')
    pointer('pointerDown', 700, 200)
    pointer('pointerUp', 700, 200)
    await user.type(screen.getByRole('textbox', { name: 'Texto nuevo' }), '¡Ojo con el suelo!{Enter}')
    await waitFor(async () => expect((await marks()).some((mark) => mark.kind === 'text')).toBe(true))
    expect((await marks()).find((mark) => mark.kind === 'text')).toMatchObject({ x: 700, y: 200, size: 45 })
    await push()
    expect(document.querySelector('[data-mark]')?.textContent).toBe('¡Ojo con el suelo!')
    // Un sello del máster
    press('s')
    const stamps = within(screen.getByRole('toolbar', { name: 'Sellos' }))
    await user.click(stamps.getByRole('button', { name: 'Solo para mí' }))
    await user.click(stamps.getByRole('button', { name: /Sellos/ }))
    await user.click(stamps.getByRole('radio', { name: 'Cofre' }))
    pointer('pointerDown', 900, 600)
    pointer('pointerUp', 900, 600)
    await waitFor(async () => expect((await marks()).some((mark) => mark.kind === 'stamp')).toBe(true))
    expect((await marks()).find((mark) => mark.kind === 'stamp')).toMatchObject({ icon: 'package', hidden: true })
  })

  it('un pin que lleva a una página y el láser en vivo', async () => {
    const user = userEvent.setup()
    const { pointer, marks, push } = await renderMesa()
    press('p')
    pointer('pointerDown', 600, 300)
    pointer('pointerUp', 600, 300)
    await waitFor(async () => expect(await marks()).toHaveLength(1))
    expect((await marks())[0]).toMatchObject({ kind: 'pin', label: '1', hidden: true })
    await push()
    const panel = within(screen.getByRole('complementary', { name: 'Pines' }))
    const settings = within(await panel.findByRole('region', { name: '1' }))
    await user.type(settings.getByLabelText('Página'), 'Cripta de Varn{Enter}')
    await waitFor(async () => expect((await marks())[0]).toMatchObject({ kind: 'pin', pageId: expect.any(String) }))
    // El láser: su estela, en vivo
    press('x')
    pointer('pointerDown', 100, 100)
    pointer('pointerMove', 200, 100)
    expect(sent.laser).toEqual([[{ x: 100, y: 100 }], [{ x: 200, y: 100 }]])
    // Sigue mientras se mueve, aunque se repinte la mesa
    for (let x = 220; x <= 400; x += 20) pointer('pointerMove', x, 100)
    await push()
    for (let x = 420; x <= 600; x += 20) pointer('pointerMove', x, 100)
    pointer('pointerUp', 600, 100)
    expect(sent.laser).toHaveLength(22)
  })

  it('un reloj de progreso: crearlo, pulsar sus segmentos y quitarlo de la tele', async () => {
    const user = userEvent.setup()
    const { api, push } = await renderMesa()
    press('w')
    const panel = within(screen.getByRole('complementary', { name: 'Widgets' }))
    await user.click(panel.getByRole('button', { name: 'Reloj' }))
    await waitFor(async () =>
      expect((await api.client.call('listWidgets', { campaignId: CAMPAIGN.id })).widgets).toHaveLength(1)
    )
    await push()
    const card = within(screen.getByRole('article', { name: 'Reloj' }))
    await user.click(card.getByRole('button', { name: 'Reloj: 0 de 6' }))
    expect(await card.findByRole('button', { name: 'Reloj: 1 de 6' })).toBeDefined()
    await user.click(card.getByRole('button', { name: 'En la tele' }))
    await waitFor(async () =>
      expect((await api.client.call('listWidgets', { campaignId: CAMPAIGN.id })).widgets[0]).toMatchObject({
        value: 1,
        shown: false
      })
    )
  })

  it('guardar una instantánea con su miniatura, mover una ficha y volver a ella (con aviso)', async () => {
    const user = userEvent.setup()
    const { api, push, wolves } = await renderMesa()
    press('f')
    const panel = within(screen.getByRole('complementary', { name: 'Instantáneas' }))
    await user.type(panel.getByLabelText('Nombre'), 'Antes de la emboscada')
    await user.click(panel.getByRole('button', { name: 'Guardar instantánea' }))
    expect(await panel.findByText('Antes de la emboscada')).toBeDefined()
    const saved = await api.client.call('listSnapshots', { campaignId: CAMPAIGN.id })
    expect(saved.snapshots[0]?.thumbnail).toBe('data:image/webp;base64,AAAA')
    await api.client.call('moveTokens', {
      campaignId: CAMPAIGN.id,
      moves: [{ tokenId: wolves[0] as string, x: 950, y: 650 }]
    })
    await push()
    await user.click(panel.getByRole('button', { name: 'Volver a ella' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Volver a la instantánea' }))
    await user.click(dialog.getByRole('button', { name: 'Volver' }))
    await waitFor(async () => {
      const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
      expect(table.tokens.find((token) => token.id === wolves[0])).toMatchObject({ x: 350, y: 250 })
    })
  })

  it('la pantalla del máster: sube desde abajo con el statblock de cada criatura y la nota de la escena', async () => {
    const user = userEvent.setup()
    await renderMesa()
    press('g')
    const drawer = within(screen.getByRole('region', { name: 'Pantalla del máster' }))
    expect(drawer.getByText('2 en la escena')).toBeDefined()
    expect(await drawer.findByRole('heading', { name: 'Lobo 1' })).toBeDefined()
    expect(await drawer.findByRole('article', { name: 'Cripta de Varn' })).toBeDefined()
    // Sin los statblocks
    await user.click(
      within(screen.getByRole('complementary', { name: 'Pantalla del máster' })).getByRole('switch', {
        name: 'Statblocks de las criaturas de la escena'
      })
    )
    expect(drawer.queryByText('2 en la escena')).toBeNull()
    await user.click(drawer.getByRole('button', { name: 'Cerrar la pantalla del máster' }))
    expect(screen.queryByRole('region', { name: 'Pantalla del máster' })).toBeNull()
  })
})

describe('las herramientas en la tele', () => {
  const SCENE = {
    id: crypto.randomUUID(),
    image: { width: 1200, height: 800, tiles: { version: crypto.randomUUID(), size: 512, levels: 2 } },
    grid: {
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
    },
    initialView: { x: 600, y: 400, scale: 1 }
  }

  it('lo dejado en el mapa, los widgets y, en vivo, la medida y el láser', async () => {
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
    render(
      <App
        router={createAppRouter(
          createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/pantalla`] })
        )}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
        api={api.client}
      />
    )
    await waitFor(() => expect(channels.some((c) => c.view === 'screen')).toBe(true))
    const channel = channels.find((c) => c.view === 'screen') as (typeof channels)[number]
    const view: ScreenView = {
      campaignId: CAMPAIGN.id,
      campaignName: 'La Marca',
      scene: SCENE,
      hidden: false,
      camera: { mode: 'follow' },
      tokens: [],
      combat: null,
      marks: [
        {
          kind: 'template',
          id: crypto.randomUUID(),
          shape: 'circle',
          a: { x: 300, y: 300 },
          b: { x: 500, y: 300 },
          color: '#8ab4f8',
          damageType: 'fire'
        },
        { kind: 'text', id: crypto.randomUUID(), x: 600, y: 600, text: '¡Ojo!', color: '#ff6b5b', size: 45 }
      ],
      widgets: [
        {
          id: crypto.randomUUID(),
          kind: 'clock',
          label: 'La cripta despierta',
          icon: null,
          color: '#c9302c',
          value: 4,
          min: null,
          max: null,
          segments: 6,
          showCount: false,
          duration: null,
          running: null
        }
      ]
    }
    act(() => channel.onMessage({ type: 'screen', screen: view }))
    // La plantilla con la trama del fuego
    await waitFor(() =>
      expect((drawn.shapes.marks ?? []).filter((shape) => shape.kind === 'line').length).toBeGreaterThan(5)
    )
    expect(document.querySelector('[data-mark]')?.textContent).toBe('¡Ojo!')
    const widgets = within(screen.getByRole('region', { name: 'Widgets' }))
    expect(widgets.getByRole('img', { name: 'La cripta despierta: 4 de 6' })).toBeDefined()
    expect(widgets.queryByRole('button')).toBeNull()
    act(() =>
      channel.onMessage({
        type: 'measure',
        measure: {
          shape: 'line',
          points: [
            { x: 50, y: 50 },
            { x: 650, y: 50 }
          ]
        }
      })
    )
    await waitFor(() => expect(drawn.labels.map((label) => label.text)).toEqual(['30 pies']))
    act(() =>
      channel.onMessage({
        type: 'laser',
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 120 }
        ]
      })
    )
    await waitFor(() =>
      expect((drawn.shapes.live ?? []).some((shape) => shape.kind === 'line' && shape.color === 0xff3b3b)).toBe(true)
    )
    act(() => channel.onMessage({ type: 'measure', measure: null }))
    await waitFor(() => expect(drawn.labels).toEqual([]))
  })
})
