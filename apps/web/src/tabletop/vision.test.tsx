import type { Campaign, ScreenView, TableServerMessage, World } from '@crisol/contracts'
import type { System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { FogGrid } from '@crisol/tabletop'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { decodeMask } from './fog-paint.ts'
import type { FogLayer, OverlayShape, RendererScene } from './renderer.ts'

// El canal de la mesa, de mentira: la prueba manda lo que llegaría del servidor
const channels = vi.hoisted(() => [] as Array<{ view: string; onMessage: (message: TableServerMessage) => void }>)
vi.mock('./channel.ts', () => ({
  connectTable: (
    options: { view: string },
    handlers: { onMessage: (message: TableServerMessage) => void; onStatus?: (status: string) => void }
  ) => {
    channels.push({ view: options.view, onMessage: handlers.onMessage })
    handlers.onStatus?.('open')
    return { sendViewport: () => {}, sendDrag: () => {}, close: () => {} }
  }
}))
// Sin WebGL: el lienzo no pinta, pero guarda lo último que le llega
const drawn = vi.hoisted(() => ({
  fog: [] as Array<FogLayer | null>,
  glow: [] as Array<FogLayer | null>,
  shapes: [] as OverlayShape[],
  scene: null as RendererScene | null
}))
vi.mock('./use-renderer.ts', async () => {
  const { useEffect, useRef } = await import('react')
  return {
    useTableRenderer: (scene: RendererScene | null) => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({
        setView: () => {},
        setScene: () => {},
        setTokens: () => {},
        setFog: (layer: FogLayer | null) => drawn.fog.push(layer),
        setGlow: (layer: FogLayer | null) => drawn.glow.push(layer),
        // Las de los editores (las herramientas pintan en otras capas)
        setShapes: (shapes: OverlayShape[], layer = 'editor') => {
          if (layer === 'editor') drawn.shapes = shapes
        },
        setLabels: () => {},
        setImages: () => {}
      })
      useEffect(() => {
        drawn.scene = scene
      }, [scene])
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
  drawn.fog = []
  drawn.glow = []
  drawn.shapes = []
  drawn.scene = null
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mesa'] }))
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})

async function renderMesa() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
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
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`] }))}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  /** Lo que llega por el canal: la mesa de ahora en la API falsa */
  const push = async () => {
    await waitFor(() => expect(channels.some((c) => c.view === 'master')).toBe(true))
    const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
    act(() => channels.find((c) => c.view === 'master')?.onMessage({ type: 'master', table }))
    return table
  }
  await push()
  const stage = await screen.findByRole('application', { name: 'Mesa: Cripta de Varn' })
  await waitFor(() => expect(stage.dataset.view).toBeDefined())
  /** Un punto del mapa en la pantalla (el lienzo empieza en 0, 0) */
  const at = (x: number, y: number) => {
    const view = JSON.parse(stage.dataset.view ?? '{}') as { x: number; y: number; scale: number }
    return { clientX: x * view.scale + view.x, clientY: y * view.scale + view.y }
  }
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number, extra = {}) =>
    fireEvent[type](stage, { button: 0, pointerId: 1, pointerType: 'mouse', ...at(x, y), ...extra })
  const click = (x: number, y: number, extra = {}) => {
    pointer('pointerDown', x, y, extra)
    pointer('pointerUp', x, y, extra)
  }
  const vision = () => api.client.call('getSceneVision', { sceneId: scene.id, campaignId: CAMPAIGN.id })
  return { api, scene, push, stage, pointer, click, vision }
}

const press = (key: string) => fireEvent.keyDown(document.body, { key })

describe('la visión en la mesa del máster', () => {
  it('la columna de herramientas, con sus teclas: cada una saca su panel', async () => {
    const user = userEvent.setup()
    await renderMesa()
    const tools = within(screen.getByRole('toolbar', { name: 'Herramientas de la mesa' }))
    expect(tools.getByRole('button', { name: 'Elegir y mover' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(tools.getByRole('button', { name: 'Muros y puertas' }))
    expect(screen.getByRole('complementary', { name: 'Muros y puertas' })).toBeDefined()
    press('l')
    expect(screen.getByRole('complementary', { name: 'Luces' })).toBeDefined()
    press('n')
    expect(screen.getByRole('complementary', { name: 'Niebla' })).toBeDefined()
    expect(screen.getByRole('toolbar', { name: 'Niebla' })).toBeDefined()
    press('v')
    expect(screen.getByRole('complementary', { name: 'Panel de la mesa' })).toBeDefined()
  })

  it('muros encadenados clic a clic (Mayús pega a la rejilla), una puerta secreta con doble clic, elegir y borrar', async () => {
    const user = userEvent.setup()
    const { click, pointer, vision } = await renderMesa()
    press('m')
    // Tres puntos (el segundo, con Mayús, a la esquina de la rejilla) y Escape: dos muros
    click(100, 100)
    pointer('pointerMove', 290, 120, { shiftKey: true })
    expect(drawn.shapes.some((s) => s.kind === 'line' && s.b.x === 300 && s.b.y === 100)).toBe(true)
    click(290, 120, { shiftKey: true })
    click(300, 400)
    press('Escape')
    await waitFor(async () => expect((await vision()).walls).toHaveLength(2))
    const walls = (await vision()).walls
    expect(walls[0]).toMatchObject({ a: { x: 100, y: 100 }, b: { x: 300, y: 100 }, door: null })
    expect(walls[1]).toMatchObject({ a: { x: 300, y: 100 }, b: { x: 300, y: 400 } })
    // Una puerta secreta: un tramo que se acaba con doble clic
    const panel = within(screen.getByRole('complementary', { name: 'Muros y puertas' }))
    await user.click(panel.getByRole('button', { name: 'Puerta secreta' }))
    click(600, 100)
    click(700, 100)
    click(700, 100)
    await waitFor(async () => expect((await vision()).walls).toHaveLength(3))
    expect((await vision()).walls[2]).toMatchObject({ door: 'secret' })
    expect(await panel.findByText('2 muros, 1 puerta')).toBeDefined()
    // Elegir el primero y borrarlo con Supr
    click(200, 103)
    const selected = within(await panel.findByRole('region', { name: 'Muro' }))
    expect(selected.getByRole('switch', { name: 'Frena la vista' }).getAttribute('aria-checked')).toBe('true')
    press('Delete')
    await waitFor(async () => expect((await vision()).walls).toHaveLength(2))
  })

  it('mover un extremo se lleva los muros que se tocan en él; un clic en él empieza otro muro', async () => {
    const { api, scene, pointer, click, push, vision } = await renderMesa()
    await api.client.call('changeWalls', {
      sceneId: scene.id,
      walls: {
        add: [
          { a: { x: 100, y: 100 }, b: { x: 300, y: 100 } },
          { a: { x: 300, y: 100 }, b: { x: 300, y: 300 } }
        ]
      }
    })
    await push()
    press('m')
    await waitFor(() => expect(drawn.shapes.filter((s) => s.kind === 'dot')).toHaveLength(3))
    pointer('pointerDown', 300, 100)
    pointer('pointerMove', 350, 150)
    pointer('pointerUp', 350, 150)
    await waitFor(async () =>
      expect((await vision()).walls.map((w) => [w.a, w.b])).toEqual([
        [
          { x: 100, y: 100 },
          { x: 350, y: 150 }
        ],
        [
          { x: 350, y: 150 },
          { x: 300, y: 300 }
        ]
      ])
    )
    click(100, 100)
    click(100, 400)
    press('Escape')
    await waitFor(async () => expect((await vision()).walls).toHaveLength(3))
    expect((await vision()).walls[2]).toMatchObject({ a: { x: 100, y: 100 }, b: { x: 100, y: 400 } })
  })

  it('las puertas: un clic las abre o las cierra en la campaña; la secreta, marcada', async () => {
    const user = userEvent.setup()
    const { api, scene, push, vision } = await renderMesa()
    await api.client.call('changeWalls', {
      sceneId: scene.id,
      walls: {
        add: [
          { a: { x: 100, y: 100 }, b: { x: 200, y: 100 }, door: 'door' },
          { a: { x: 400, y: 100 }, b: { x: 500, y: 100 }, door: 'secret' }
        ]
      }
    })
    await push()
    const door = await screen.findByRole('button', { name: 'Puerta, Cerrada' })
    expect(screen.getByRole('button', { name: 'Puerta secreta, Cerrada' })).toBeDefined()
    await user.click(door)
    expect(door.getAttribute('aria-pressed')).toBe('true')
    const id = (await vision()).walls[0]?.id ?? ''
    await waitFor(async () => expect((await vision()).doors?.[id]).toBe(true))
  })

  it('la niebla a mano: un rectángulo destapa; reiniciarla pide confirmarlo; la visión automática se quita', async () => {
    const user = userEvent.setup()
    const { api, scene, pointer, push } = await renderMesa()
    press('n')
    const tools = within(screen.getByRole('toolbar', { name: 'Niebla' }))
    await user.click(tools.getByRole('radio', { name: 'Rectángulo' }))
    pointer('pointerDown', 0, 0)
    pointer('pointerMove', 600, 400)
    expect(drawn.shapes.some((s) => s.kind === 'polygon' && s.points.length === 4)).toBe(true)
    pointer('pointerUp', 600, 400)
    const table = async () => (await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).vision
    await waitFor(async () => expect(decodeMask((await table())?.explored ?? '').count()).toBe(60 * 40))
    await push()
    // La mesa lo enseña atenuado: lo destapado, claro
    const layer = drawn.fog.at(-1)
    expect(layer).toMatchObject({ columns: 120, rows: 80, cellSize: 10 })
    expect(layer?.pixels[(10 * 120 + 10) * 4 + 3]).toBe(0)
    expect(layer?.pixels[(70 * 120 + 110) * 4 + 3]).toBeGreaterThan(0)
    // Reiniciar, con su aviso
    const panel = within(screen.getByRole('complementary', { name: 'Niebla' }))
    await user.click(panel.getByRole('button', { name: 'Reiniciar la niebla' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Reiniciar la niebla' }))
    await user.click(dialog.getByRole('button', { name: 'Reiniciar' }))
    await waitFor(async () => expect(decodeMask((await table())?.explored ?? '').count()).toBe(0))
    // Visión automática (nace sí en la API falsa)
    await user.click(panel.getByRole('switch', { name: 'Visión automática' }))
    await waitFor(async () =>
      expect((await api.client.call('getSceneVision', { sceneId: scene.id })).automaticVision).toBe(false)
    )
    expect(await panel.findByText('Solo se ve lo que destapes.')).toBeDefined()
    // Los bordes de la tele
    await user.click(panel.getByRole('radio', { name: 'Recortados' }))
    await waitFor(async () => expect((await table())?.tileFit).toBe('cropped'))
  })

  it('las luces: un clic pone una y se elige; sus radios en pies; se quita', async () => {
    const user = userEvent.setup()
    const { click, vision } = await renderMesa()
    press('l')
    click(500, 300)
    const panel = within(screen.getByRole('complementary', { name: 'Luces' }))
    const light = within(await panel.findByRole('region', { name: 'Luz 1' }))
    expect((await vision()).lights[0]).toMatchObject({ x: 500, y: 300, bright: 20, dim: 40 })
    // Su radio, dibujado: 20 pies son 4 casillas de 100 px
    await waitFor(() => expect(drawn.shapes.some((s) => s.kind === 'circle' && s.radius === 400)).toBe(true))
    const bright = light.getByLabelText('Brillante (pies)')
    await user.clear(bright)
    await user.type(bright, '30{Enter}')
    await waitFor(async () => expect((await vision()).lights[0]?.bright).toBe(30))
    await user.click(light.getByRole('radio', { name: 'Luna' }))
    await waitFor(async () => expect((await vision()).lights[0]?.color).toBe('#b8d0ff'))
    await user.click(light.getByRole('button', { name: 'Quitar la luz' }))
    await waitFor(async () => expect((await vision()).lights).toHaveLength(0))
  })

  it('«Ver como el grupo»: quién mira, lo que no ve y «Volver»', async () => {
    const user = userEvent.setup()
    const { api, scene, push } = await renderMesa()
    const lia = (await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Lía' })).character.id
    const bram = (await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Bram' })).character.id
    const placed = await api.client.call('placeTokens', {
      campaignId: CAMPAIGN.id,
      sceneId: scene.id,
      tokens: [
        { characterId: lia, x: 150, y: 150 },
        { characterId: bram, x: 250, y: 150 }
      ]
    })
    await api.client.call('updateToken', { tokenId: placed.tokens[1]?.id ?? '', hidden: true })
    await push()
    press('n')
    await user.click(screen.getByRole('button', { name: 'Ver como el grupo' }))
    expect(screen.getByText('Viendo como el grupo')).toBeDefined()
    const panel = within(screen.getByRole('complementary', { name: 'Lo que ve el grupo' }))
    expect(panel.getByText('Lía')).toBeDefined()
    expect(panel.getByText('Bram, oculta')).toBeDefined()
    // La lista de fichas (la del teclado) ya no tiene la que no ve
    expect(within(screen.getByRole('list', { name: 'Fichas' })).getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByRole('complementary', { name: 'Niebla' })).toBeDefined()
  })
})

describe('la tele con la niebla', () => {
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
  const encode = (grid: FogGrid) => btoa(String.fromCharCode(...grid.encode()))

  it('lo no explorado negro, lo explorado en gris, la luz que brilla, y solo las teselas que tocan lo visto', async () => {
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
    const explored = new FogGrid(1200, 800).fillRect({ x: 0, y: 0, width: 400, height: 400 })
    const visible = new FogGrid(1200, 800).fillRect({ x: 0, y: 0, width: 200, height: 200 })
    const screenView: ScreenView = {
      campaignId: CAMPAIGN.id,
      campaignName: 'La Marca',
      scene: SCENE,
      hidden: false,
      camera: { mode: 'follow' },
      tokens: [],
      combat: null,
      fog: {
        width: 1200,
        height: 800,
        cellSize: 10,
        explored: encode(explored),
        visible: encode(visible),
        darkness: 0.5
      },
      lights: [
        {
          id: crypto.randomUUID(),
          color: '#ffb04a',
          intensity: 1,
          bright: 50,
          dim: 100,
          origin: { x: 100, y: 100 },
          cells: encode(new FogGrid(1200, 800).fillCircle({ x: 100, y: 100 }, 100))
        }
      ]
    }
    act(() => channels.find((c) => c.view === 'screen')?.onMessage({ type: 'screen', screen: screenView }))
    await waitFor(() => expect(drawn.fog.at(-1)).toBeTruthy())
    const fog = drawn.fog.at(-1) as FogLayer
    const alpha = (column: number, row: number) => fog.pixels[(row * fog.columns + column) * 4 + 3]
    expect(alpha(100, 70)).toBe(255)
    expect(alpha(30, 30)).toBeGreaterThan(100)
    expect(alpha(30, 30)).toBeLessThan(255)
    expect(drawn.glow.at(-1)).toBeTruthy()
    // Las teselas: la de arriba a la izquierda (a medias, con su huella); la de la derecha, ninguna
    const scene = drawn.scene as RendererScene
    expect(scene.tileUrl(0, 0, 0)).toMatch(/\/screen\/tiles\/.+\/0\/0\/0\?m=/)
    expect(scene.tileUrl(0, 2, 1)).toBeNull()
  })
})
