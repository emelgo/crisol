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

/**
 * La imagen, 1000 × 700, en un visor de 800 × 600: encuadrada a 0,8 y 20 px más abajo. De un punto del mapa (0–1) a
 * la pantalla
 */
const at = (x: number, y: number) => ({ clientX: x * 800, clientY: 20 + y * 560 })

async function renderMap(prepare?: (api: ReturnType<typeof fakeApi>, mapId: string) => Promise<void>) {
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
  await prepare?.(api, mapId)
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
  const viewer = await screen.findByRole('application', { name: 'Mapa' })
  const saved = async () => (await api.client.call('getMap', { tabId: tab.id })).elements
  return { api, viewer, saved, mapId }
}

/** Pulsar sin moverse en un punto del mapa */
function tap(target: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(x, y) })
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(x, y) })
}

/** Arrastrar desde un elemento hasta un punto del mapa (el visor sigue el arrastre en la ventana) */
function dragTo(target: Element, x: number, y: number) {
  const rect = { clientX: Number(target.getAttribute('data-x') ?? 0), clientY: 0 }
  fireEvent.pointerDown(target, { pointerId: 2, pointerType: 'mouse', button: 0, ...rect })
  fireEvent(window, new PointerEvent('pointermove', { pointerId: 2, ...at(x, y) }))
  fireEvent(window, new PointerEvent('pointerup', { pointerId: 2, ...at(x, y) }))
}

const square = {
  pieces: [
    [
      [0.1, 0.1],
      [0.4, 0.1],
      [0.4, 0.4],
      [0.1, 0.4]
    ] as [number, number][]
  ]
}

describe('dibujar y retocar en el mapa (módulo 9)', () => {
  it('una región punto a punto: Intro la cierra y se abre su panel con el foco en el nombre', async () => {
    const { viewer, saved } = await renderMap()
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).getByRole('button', { name: 'Región' })
    )
    expect(screen.getAllByRole('status').some((status) => /vértice/.test(status.textContent ?? ''))).toBe(true)
    tap(viewer, 0.1, 0.1)
    tap(viewer, 0.4, 0.1)
    tap(viewer, 0.4, 0.4)
    // Un doble clic no pone dos puntos en el mismo sitio
    tap(viewer, 0.4, 0.4)
    expect(viewer.querySelectorAll('circle[r="5"]')).toHaveLength(3)
    viewer.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    const [region] = await saved()
    expect(region).toMatchObject({
      kind: 'region',
      geometry: {
        pieces: [
          [
            [0.1, 0.1],
            [0.4, 0.1],
            [0.4, 0.4]
          ]
        ]
      }
    })
    const panel = within(await screen.findByRole('region', { name: 'Región' }))
    const name = panel.getByLabelText('Nombre')
    await waitFor(() => expect(document.activeElement).toBe(name))
    await userEvent.type(name, 'Aldoria{Enter}')
    await waitFor(async () => expect((await saved())[0]?.label).toBe('Aldoria'))
  })

  it('una región se cierra pulsando su primer punto (resaltado al acercarse) o con doble clic, sin punto de más', async () => {
    const { viewer, saved } = await renderMap()
    viewer.focus()
    await userEvent.keyboard('r')
    tap(viewer, 0.1, 0.1)
    tap(viewer, 0.4, 0.1)
    tap(viewer, 0.4, 0.4)
    // Junto al primero (a 5 px de pantalla), se resalta; pulsarlo la cierra con sus tres vértices
    fireEvent.pointerMove(viewer, { pointerId: 1, clientX: 85, clientY: 79 })
    await waitFor(() => expect(viewer.querySelector('circle[data-closing]')).not.toBeNull())
    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 85, clientY: 79 })
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 85, clientY: 79 })
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    expect((await saved())[0]?.geometry).toEqual({
      pieces: [
        [
          [0.1, 0.1],
          [0.4, 0.1],
          [0.4, 0.4]
        ]
      ]
    })
    // Con doble clic: el punto del doble clic no se queda
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Región' })).getByRole('button', { name: 'Cerrar' })
    )
    viewer.focus()
    await userEvent.keyboard('r')
    tap(viewer, 0.5, 0.5)
    tap(viewer, 0.8, 0.5)
    tap(viewer, 0.8, 0.8)
    tap(viewer, 0.6, 0.9)
    tap(viewer, 0.6, 0.9)
    fireEvent.doubleClick(viewer, at(0.6, 0.9))
    await waitFor(async () => expect(await saved()).toHaveLength(2))
    expect((await saved())[1]?.geometry).toEqual({
      pieces: [
        [
          [0.5, 0.5],
          [0.8, 0.5],
          [0.8, 0.8]
        ]
      ]
    })
  })

  it('una ruta que empieza en un pin se pega a él y lo recuerda; Retroceso quita el último punto y Esc cancela', async () => {
    let pinId = ''
    const { viewer, saved } = await renderMap(async (api, mapId) => {
      pinId = (await api.client.call('createMapPin', { mapId, x: 0.2, y: 0.2, label: 'Varn' })).id
    })
    viewer.focus()
    await userEvent.keyboard('l')
    expect(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' }))
        .getByRole('button', { name: 'Ruta' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    // Cerca del pin (a 4 px de pantalla): se pega a él
    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 164, clientY: 136 })
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 164, clientY: 136 })
    tap(viewer, 0.5, 0.5)
    tap(viewer, 0.9, 0.9)
    await userEvent.keyboard('{Backspace}')
    expect(viewer.querySelectorAll('circle[r="5"]')).toHaveLength(2)
    await userEvent.keyboard('{Enter}')
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    expect((await saved())[0]).toMatchObject({
      kind: 'path',
      geometry: {
        points: [
          [0.2, 0.2],
          [0.5, 0.5]
        ],
        from: pinId,
        to: null
      }
    })
    // Esc deja lo que se dibuja sin guardarlo
    await userEvent.keyboard('l')
    tap(viewer, 0.6, 0.6)
    await userEvent.keyboard('{Escape}')
    expect(viewer.querySelectorAll('circle[r="5"]')).toHaveLength(0)
    expect(await saved()).toHaveLength(1)
  })

  it('un texto: se pone donde se pulsa, con su nombre para cambiar', async () => {
    const { viewer, saved } = await renderMap()
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).getByRole('button', { name: 'Texto' })
    )
    tap(viewer, 0.5, 0.9)
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    expect((await saved())[0]).toMatchObject({ kind: 'label', label: 'Texto', geometry: { at: [0.5, 0.9] } })
    const panel = within(await screen.findByRole('region', { name: 'Texto' }))
    expect(panel.getByLabelText('Texto')).toBeDefined()
    expect(panel.getByLabelText('Giro')).toBeDefined()
  })

  it('un texto en su caja: va en su centro con la letra a su alto; se elige al pulsarlo, doble clic lo edita y Supr lo quita', async () => {
    const { viewer, saved } = await renderMap()
    viewer.focus()
    await userEvent.keyboard('t')
    // Una caja de 0,2 × 0,1 del mapa (70 px de la imagen de alto: la letra, 56 de 1000 → 56)
    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.4, 0.5) })
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'mouse', ...at(0.6, 0.6) })
    expect(viewer.querySelector('[class*="textBox"]')).not.toBeNull()
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.6, 0.6) })
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    const [label] = await saved()
    expect(label?.geometry).toEqual({ at: [0.5, 0.55] })
    expect(label?.style.size).toBe(56)
    expect(viewer.querySelector('[class*="textBox"]')).toBeNull()
    // Cerrar su panel, pulsarlo: se elige; doble clic: a escribirlo; Supr (con el foco en el mapa) lo quita
    await userEvent.click(within(screen.getByRole('region', { name: 'Texto' })).getByRole('button', { name: 'Cerrar' }))
    const text = viewer.querySelector('[data-kind="label"]') as Element
    fireEvent.pointerDown(text, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.5, 0.55) })
    fireEvent.pointerUp(text, { pointerId: 1, pointerType: 'mouse', button: 0, ...at(0.5, 0.55) })
    const panel = within(await screen.findByRole('region', { name: 'Texto' }))
    expect(document.activeElement).not.toBe(panel.getByLabelText('Texto'))
    fireEvent.doubleClick(text, at(0.5, 0.55))
    await waitFor(() => expect(document.activeElement).toBe(panel.getByLabelText('Texto')))
    viewer.focus()
    await userEvent.keyboard('{Delete}')
    await waitFor(async () => expect(await saved()).toHaveLength(0))
  })

  it('elegir lo dibujado: su estilo se cambia en su panel; Supr lo quita y Ctrl+Z lo vuelve a poner', async () => {
    const { viewer, saved } = await renderMap(async (api, mapId) => {
      await api.client.call('createMapElement', { mapId, kind: 'region', geometry: square, label: 'Aldoria' })
    })
    const region = await waitFor(() => {
      const found = viewer.querySelector('[data-kind="region"]')
      if (!found) throw new Error('sin región')
      return found
    })
    fireEvent.click(region)
    const panel = within(await screen.findByRole('region', { name: 'Región' }))
    await userEvent.click(panel.getByLabelText('Rayado'))
    await waitFor(async () => expect((await saved())[0]?.style.fill).toBe('hatch'))
    await userEvent.click(panel.getByLabelText('Discontinuo'))
    await waitFor(async () => expect((await saved())[0]?.style.stroke).toBe('dashed'))
    await userEvent.click(panel.getByLabelText('Oculto a los jugadores'))
    await waitFor(async () => expect((await saved())[0]?.hidden).toBe(true))
    viewer.focus()
    await userEvent.keyboard('{Delete}')
    await waitFor(async () => expect(await saved()).toHaveLength(0))
    expect(screen.queryByRole('region', { name: 'Región' })).toBeNull()
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(async () => expect(await saved()).toMatchObject([{ label: 'Aldoria', hidden: true }]))
  })

  it('retocar: arrastrar un vértice (se pega al pin cercano), el «+» añade uno y el botón derecho lo quita', async () => {
    const { viewer, saved } = await renderMap(async (api, mapId) => {
      await api.client.call('createMapPin', { mapId, x: 0.5, y: 0.5, label: 'Faro' })
      await api.client.call('createMapElement', { mapId, kind: 'region', geometry: square, label: 'Aldoria' })
    })
    const region = await waitFor(() => {
      const found = viewer.querySelector('[data-kind="region"]')
      if (!found) throw new Error('sin región')
      return found
    })
    fireEvent.click(region)
    const vertices = await screen.findAllByRole('button', { name: /Arrastra para moverlo/ })
    expect(vertices).toHaveLength(4)
    // El tercer vértice, casi en el pin: se pega a él
    dragTo(vertices[2] as HTMLElement, 0.501, 0.501)
    await waitFor(async () =>
      expect((await saved())[0]?.geometry).toEqual({
        pieces: [
          [
            [0.1, 0.1],
            [0.4, 0.1],
            [0.5, 0.5],
            [0.1, 0.4]
          ]
        ]
      })
    )
    // El «+» del primer lado: un vértice nuevo entre los dos primeros
    const plus = screen.getAllByRole('button', { name: 'Arrastra para añadir un vértice' })
    dragTo(plus[0] as HTMLElement, 0.25, 0.05)
    await waitFor(async () => {
      const geometry = (await saved())[0]?.geometry
      expect(geometry && 'pieces' in geometry ? geometry.pieces[0] : []).toHaveLength(5)
    })
    // Quitarlo con el botón derecho; con tres, ya no se quitan más
    fireEvent.contextMenu((await screen.findAllByRole('button', { name: /Arrastra para moverlo/ }))[1] as HTMLElement)
    await waitFor(async () => {
      const geometry = (await saved())[0]?.geometry
      expect(geometry && 'pieces' in geometry ? geometry.pieces[0] : []).toHaveLength(4)
    })
  })

  it('arrastrar lo elegido lo mueve entero', async () => {
    const { viewer, saved } = await renderMap(async (api, mapId) => {
      await api.client.call('createMapElement', { mapId, kind: 'label', geometry: { at: [0.5, 0.5] }, label: 'Mar' })
    })
    const label = await waitFor(() => {
      const found = viewer.querySelector('[data-kind="label"]')
      if (!found) throw new Error('sin texto')
      return found
    })
    fireEvent.click(label)
    await screen.findByRole('region', { name: 'Texto' })
    fireEvent.pointerDown(label, { pointerId: 3, pointerType: 'mouse', button: 0, ...at(0.5, 0.5) })
    fireEvent(window, new PointerEvent('pointermove', { pointerId: 3, ...at(0.6, 0.5) }))
    fireEvent(window, new PointerEvent('pointerup', { pointerId: 3, ...at(0.6, 0.5) }))
    await waitFor(async () => {
      const geometry = (await saved())[0]?.geometry
      expect(geometry && 'at' in geometry ? geometry.at[0] : 0).toBeCloseTo(0.6)
    })
  })
})
