import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'

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
const PAGE = crypto.randomUUID()
const EMAIL = 'enrique@crisol.test'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mundo', 'mapa'] }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})
afterEach(() => vi.restoreAllMocks())

/** La imagen, 1000 × 700, en un visor de 800 × 600: encuadrada a 0,8 y 20 px más abajo */
const at = (x: number, y: number) => ({ clientX: x * 800, clientY: 20 + y * 560 })
function tap(target: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(x, y) })
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(x, y) })
}

/** Con escala (100 px de la imagen son 30 km) y un camino de 300 px (90 km), o sin escala */
async function renderMap({ scale = true } = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PAGE, worldId: WORLD.id, title: 'Valdren' }],
    files: [{ worldId: WORLD.id, name: 'valdren.png', kind: 'image' }]
  })
  const tab = await api.client.call('createPageTab', { pageId: PAGE, kind: 'map', name: 'Mapa' })
  const { id: mapId } = await api.client.call('getMap', { tabId: tab.id })
  const file = api.files[0]
  if (file) await api.client.call('updateMap', { mapId, image: { fileId: file.id, width: 1000, height: 700 } })
  if (scale) await api.client.call('updateMap', { mapId, scale: { length: 100, value: 30, unit: 'km' } })
  await api.client.call('createMapElement', {
    mapId,
    kind: 'path',
    label: 'Camino real',
    geometry: {
      points: [
        [0.1, 0.5],
        [0.4, 0.5]
      ]
    }
  })
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
  const viewer = await screen.findByRole('application', { name: 'Mapa Mapa' })
  const saved = async () => api.client.call('getMap', { tabId: tab.id })
  return { viewer, saved }
}

describe('medir en el mapa (módulo 9)', () => {
  it('de punto a punto: la distancia con la escala y los días a pie, a caballo y en barco; Esc vuelve a empezar', async () => {
    const { viewer } = await renderMap()
    viewer.focus()
    await userEvent.keyboard('m')
    const panel = within(await screen.findByRole('region', { name: 'Medir' }))
    expect(panel.getByText(/Pulsa de punto a punto/)).toBeDefined()
    // 600 px de la imagen: 180 km
    tap(viewer, 0.1, 0.9)
    tap(viewer, 0.7, 0.9)
    expect(panel.getByText('En línea recta')).toBeDefined()
    expect(panel.getByText('180')).toBeDefined()
    // A 24, 30 y 48 al día (lo de serie, en la unidad de la escala)
    expect(panel.getByText('8 días')).toBeDefined()
    expect(panel.getByText('6 días')).toBeDefined()
    expect(panel.getByText('4 días')).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(panel.getByText(/Pulsa de punto a punto/)).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Medir' })).toBeNull()
  })

  it('pulsar una ruta la mide entera', async () => {
    const { viewer } = await renderMap()
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).getByRole('button', { name: 'Medir' })
    )
    const route = await waitFor(() => {
      const found = viewer.querySelector('[data-kind="path"] path')
      if (!found) throw new Error('sin ruta')
      return found
    })
    fireEvent.pointerDown(route, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.2, 0.5) })
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.2, 0.5) })
    const panel = within(await screen.findByRole('region', { name: 'Medir' }))
    expect(panel.getByText('Por «Camino real»')).toBeDefined()
    expect(panel.getByText('90')).toBeDefined()
    // 90: 3,75 días a pie (4), 3 a caballo y 1,9 en barco (2)
    expect(panel.getByText('4 días')).toBeDefined()
    expect(panel.getByText('3 días')).toBeDefined()
    expect(panel.getByText('2 días')).toBeDefined()
  })

  it('sin escala lo dice; «Ponerla» abre los ajustes: una raya de dos puntos y lo que mide la calibran', async () => {
    const { viewer, saved } = await renderMap({ scale: false })
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).getByRole('button', { name: 'Medir' })
    )
    const panel = within(await screen.findByRole('region', { name: 'Medir' }))
    await userEvent.click(panel.getByRole('button', { name: 'Ponerla' }))
    const settings = within(await screen.findByRole('region', { name: 'Ajustes del mapa' }))
    await userEvent.click(settings.getByRole('button', { name: 'Dibujar la raya' }))
    expect(settings.getByText(/Pulsa en un extremo/)).toBeDefined()
    // 200 px de la imagen
    tap(viewer, 0.1, 0.1)
    tap(viewer, 0.3, 0.1)
    const length = await settings.findByLabelText('Cuánto mide')
    await userEvent.clear(length)
    await userEvent.type(length, '50')
    await userEvent.selectOptions(settings.getByLabelText('Unidad'), 'leguas')
    await userEvent.click(settings.getByRole('button', { name: 'Guardar la escala' }))
    await waitFor(async () => expect((await saved()).scale).toMatchObject({ value: 50, unit: 'leguas' }))
    expect((await saved()).scale?.length).toBeCloseTo(200)
    expect(settings.getByText('Una raya de referencia mide 50 leguas.')).toBeDefined()
  })

  it('lo que se anda en un día se cambia en los ajustes y vuelve a lo de serie', async () => {
    const { saved } = await renderMap()
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes del mapa' }))
    const settings = within(await screen.findByRole('region', { name: 'Ajustes del mapa' }))
    const foot = settings.getByLabelText('A pie')
    await userEvent.clear(foot)
    await userEvent.type(foot, '25')
    await userEvent.tab()
    await waitFor(async () => expect((await saved()).speeds.foot).toBe(25))
    await userEvent.click(await settings.findByRole('button', { name: 'Volver a lo de serie' }))
    await waitFor(async () => expect((await saved()).speeds).toEqual({ foot: 24, horse: 30, ship: 48 }))
  })
})
