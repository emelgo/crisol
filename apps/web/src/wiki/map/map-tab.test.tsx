import type { MapPinView, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { ApiError } from '../../api/client.ts'
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
const PORT = crypto.randomUUID()
const LIGHTHOUSE = crypto.randomUUID()
const EMAIL = 'enrique@crisol.test'

/** La imagen del mapa: 1600 × 1200; el visor, 800 × 600 (encuadrada, a la mitad y sin margen) */
const VIEWER = { width: 800, height: 600 }

/** happy-dom no carga imágenes: esta dice sus medidas en cuanto se le da la dirección (o falla, si es «rota») */
class LoadedImage {
  naturalWidth = 1600
  naturalHeight = 1200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(url: string) {
    setTimeout(() => (url.includes('rota') ? this.onerror?.() : this.onload?.()))
  }
}

beforeEach(() => {
  // Los recorridos guiados, ya vistos: que no se pongan en medio
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mundo', 'mapa'] }))
  vi.stubGlobal('Image', LoadedImage)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEWER.width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWER.height)
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Setup = {
  /** Con imagen ya elegida */
  image?: boolean
  pins?: Array<Partial<Omit<MapPinView, 'id' | 'pageTitle'>>>
  locked?: boolean
}

/** Puerto Ceniza, con una pestaña de mapa «Costa»; abierta en esa pestaña */
async function renderMap({ image = true, pins = [], locked = false }: Setup = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: LIGHTHOUSE, worldId: WORLD.id, title: 'El Faro' }
    ],
    files: [
      { worldId: WORLD.id, name: 'costa.png', kind: 'image' },
      { worldId: WORLD.id, name: 'islas.png', kind: 'image' },
      { worldId: WORLD.id, name: 'rota.png', kind: 'image', url: '/api/files/rota' },
      { worldId: WORLD.id, name: 'notas.pdf', kind: 'pdf', mime: 'application/pdf' }
    ]
  })
  const tab = await api.client.call('createPageTab', { pageId: PORT, kind: 'map', name: 'Costa' })
  const map = await api.client.call('getMap', { tabId: tab.id })
  const coast = api.files.find((file) => file.name === 'costa.png')
  if (image && coast) {
    await api.client.call('updateMap', { mapId: map.id, image: { fileId: coast.id, width: 1600, height: 1200 } })
  }
  for (const pin of pins) await api.client.call('createMapPin', { mapId: map.id, x: 0.5, y: 0.5, ...pin })
  if (locked) await api.client.call('updatePage', { pageId: PORT, locked: true })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}?pestana=${tab.id}`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  return { api, router, map }
}

const viewer = () => screen.findByRole('application', { name: 'Mapa Costa' })
/** El escenario que se mueve: el padre de la imagen */
const stageOf = (element: HTMLElement) => element.querySelector('img')?.parentElement as HTMLElement
const pinsList = async () => within(await screen.findByRole('list', { name: 'Pines del mapa' }))
const panel = async () => within(await screen.findByRole('region', { name: 'Pin' }))
const savedPins = async (api: ReturnType<typeof fakeApi>, tabId: string) =>
  (await api.client.call('getMap', { tabId })).pins

/** Pulsar sin moverse en un punto del visor */
function tap(target: HTMLElement, x: number, y: number, pointerId = 1) {
  fireEvent.pointerDown(target, { pointerId, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(target, { pointerId, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}

/** Un paso de la rueda (el WheelEvent de happy-dom no lleva la posición del cursor) */
function wheel(fields: { deltaY: number; deltaMode: number; clientX: number; clientY: number }) {
  const event = new Event('wheel', { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value })
  return event
}

describe('un mapa sin imagen', () => {
  it('pide una imagen del mundo (solo imágenes) y, al elegirla, se ve el mapa', async () => {
    const { api } = await renderMap({ image: false })
    expect(await screen.findByText('Este mapa aún no tiene imagen.')).toBeDefined()
    const select = screen.getByLabelText('Imagen del mapa') as HTMLSelectElement
    // Las del mundo, en cuanto llegan
    await screen.findByRole('option', { name: 'rota.png' })
    expect(Array.from(select.options, (option) => option.textContent)).toEqual([
      'Elige una del mundo',
      'costa.png',
      'islas.png',
      'rota.png'
    ])
    await userEvent.selectOptions(select, 'islas.png')
    const element = await viewer()
    expect(element.querySelector('img')?.getAttribute('width')).toBe('1600')
    expect(api.calls).toContain('updateMap')
  })

  it('una imagen que no se puede leer no vale de mapa', async () => {
    await renderMap({ image: false })
    await screen.findByRole('option', { name: 'rota.png' })
    await userEvent.selectOptions(await screen.findByLabelText('Imagen del mapa'), 'rota.png')
    expect(await screen.findByText('El mapa tiene que ser una imagen del mundo')).toBeDefined()
  })

  it('se sube una imagen y queda de mapa; un archivo que no es imagen, no', async () => {
    const { api } = await renderMap({ image: false })
    const input = (await screen.findByText('Este mapa aún no tiene imagen.'))
      .closest('section')
      ?.querySelector('input[type="file"]') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    await userEvent.click(screen.getByRole('button', { name: 'Subir una imagen' }))
    expect(click).toHaveBeenCalled()
    // Un PDF: no
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('El mapa tiene que ser una imagen del mundo')).toBeDefined()
    // Una imagen: sí
    fireEvent.change(input, { target: { files: [new File(['png'], 'bahia.png', { type: 'image/png' })] } })
    await viewer()
    expect(api.files.some((file) => file.name === 'bahia.png')).toBe(true)
  })

  it('con la página en lectura, no se elige imagen', async () => {
    await renderMap({ image: false, locked: true })
    expect(await screen.findByText('Este mapa aún no tiene imagen.')).toBeDefined()
    expect(screen.queryByLabelText('Imagen del mapa')).toBeNull()
  })

  it('si no se puede cargar, lo dice y deja reintentar', async () => {
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], pages: [{ id: PORT, worldId: WORLD.id, title: 'P' }] })
    const tab = await api.client.call('createPageTab', { pageId: PORT, kind: 'map', name: 'Costa' })
    let fail = true
    const client = {
      ...api.client,
      call: ((name, input) =>
        name === 'getMap' && fail
          ? Promise.reject(new ApiError('FORBIDDEN', 403))
          : api.client.call(name, input)) as typeof api.client.call
    }
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}?pestana=${tab.id}`] })
    )
    render(
      <App router={router} accounts={fakeAccountClient({ account: { name: 'E', email: EMAIL } }).client} api={client} />
    )
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    fail = false
    await userEvent.click(retry)
    expect(await screen.findByText('Este mapa aún no tiene imagen.')).toBeDefined()
  })
})

describe('el visor del mapa', () => {
  it('se encuadra al abrir, y se acerca, se aleja y se vuelve a encuadrar con sus botones', async () => {
    await renderMap()
    const stage = stageOf(await viewer())
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
    expect(stage.style.getPropertyValue('--inv-k')).toBe('2')
    // En la página del mundo, el zoom va en su grupo, abajo a la derecha (Enrique, 2026-11-16)
    const tools = within(screen.getByRole('toolbar', { name: 'Acercar y alejar el mapa' }))
    expect(
      within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).queryByRole('button', { name: 'Acercar' })
    ).toBeNull()
    await userEvent.click(tools.getByRole('button', { name: 'Acercar' }))
    expect(stage.style.transform).toBe('translate(-100px, -75px) scale(0.625)')
    await userEvent.click(tools.getByRole('button', { name: 'Alejar' }))
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
    await userEvent.click(tools.getByRole('button', { name: 'Acercar' }))
    await userEvent.click(tools.getByRole('button', { name: 'Encuadrar' }))
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
  })

  it('con el teclado: las flechas lo mueven, + y - acercan y alejan, 0 encuadra', async () => {
    await renderMap()
    const element = await viewer()
    const stage = stageOf(element)
    element.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(stage.style.transform).toBe('translate(80px, 0px) scale(0.5)')
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{ArrowDown}')
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
    await userEvent.keyboard('+')
    expect(stage.style.transform).toContain('scale(0.625)')
    await userEvent.keyboard('=')
    expect(stage.style.transform).toContain('scale(0.78125)')
    await userEvent.keyboard('-')
    expect(stage.style.transform).toContain('scale(0.625)')
    await userEvent.keyboard('0')
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
    // Lo que no es suyo no lo mueve
    await userEvent.keyboard('a')
    expect(stage.style.transform).toBe('translate(0px, 0px) scale(0.5)')
  })

  it('la rueda acerca hacia el cursor', async () => {
    await renderMap()
    const element = await viewer()
    const stage = stageOf(element)
    fireEvent(element, wheel({ deltaY: -200, deltaMode: 0, clientX: 0, clientY: 0 }))
    // Dos pasos en el mismo fotograma se juntan; por líneas cuenta más
    fireEvent(element, wheel({ deltaY: -1, deltaMode: 1, clientX: 0, clientY: 0 }))
    await waitFor(() => expect(stage.style.transform).not.toContain('scale(0.5)'))
    // Hacia el punto (0, 0): no se mueve
    expect(stage.style.transform).toMatch(/^translate\(0px, 0px\) scale\(0\.6/)
  })

  it('arrastrar el fondo lo mueve, y no pone pin aunque esté «Poner un pin»', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    const stage = stageOf(element)
    await userEvent.click(screen.getByRole('button', { name: 'Poner un pin' }))
    fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 160, clientY: 120 })
    fireEvent.pointerUp(element, { pointerId: 1, clientX: 160, clientY: 120 })
    expect(stage.style.transform).toBe('translate(60px, 20px) scale(0.5)')
    expect(await savedPins(api, map.tabId)).toEqual([])
    // Un movimiento de un puntero que no se pulsó no hace nada
    fireEvent.pointerMove(element, { pointerId: 9, clientX: 500, clientY: 500 })
    expect(stage.style.transform).toBe('translate(60px, 20px) scale(0.5)')
  })

  it('el botón derecho del ratón no arrastra, y un gesto cancelado no pone pin', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    await userEvent.click(screen.getByRole('button', { name: 'Poner un pin' }))
    fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(element, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 10, clientY: 10 })
    fireEvent.pointerDown(element, { pointerId: 2, pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerCancel(element, { pointerId: 2, pointerType: 'touch', clientX: 10, clientY: 10 })
    expect(await savedPins(api, map.tabId)).toEqual([])
  })

  it('con dos dedos se acerca', async () => {
    await renderMap()
    const element = await viewer()
    const stage = stageOf(element)
    fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 300 })
    fireEvent.pointerDown(element, { pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 300 })
    fireEvent.pointerMove(element, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 300 })
    // Al doble de separación, el doble de cerca
    expect(stage.style.transform).toContain('scale(1)')
    fireEvent.pointerUp(element, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 300 })
    fireEvent.pointerUp(element, { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 300 })
    expect(screen.queryByRole('region', { name: 'Pin' })).toBeNull()
  })

  it('«Poner un pin» y pulsar en el mapa lo pone ahí, elegido; Escape deja la herramienta', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    const tool = screen.getByRole('button', { name: 'Poner un pin' })
    await userEvent.click(tool)
    expect(tool.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Pulsa donde quieras el pin. Escape para dejarlo.')).toBeDefined()
    element.focus()
    await userEvent.keyboard('{Escape}')
    expect(tool.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(tool)
    await userEvent.click(tool)
    expect(tool.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(tool)
    tap(element, 400, 150)
    const pin = await (await pinsList()).findByRole('button', { name: 'Pin sin nombre' })
    expect(pin.getAttribute('aria-pressed')).toBe('true')
    expect(pin.style.insetInlineStart).toBe('50%')
    expect(pin.style.insetBlockStart).toBe('25%')
    expect(await panel()).toBeDefined()
    expect(tool.getAttribute('aria-pressed')).toBe('false')
    expect(await savedPins(api, map.tabId)).toMatchObject([{ x: 0.5, y: 0.25 }])
    // Pulsar en el fondo suelta el pin
    tap(element, 10, 10)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pin' })).toBeNull())
    expect(pin.getAttribute('aria-pressed')).toBe('false')
  })

  it('Escape deja la herramienta y Supr borra el pin elegido con el foco en cualquier sitio del mapa', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    const tool = screen.getByRole('button', { name: 'Poner un pin' })
    // Con el foco en el botón de la herramienta (no en el mapa)
    await userEvent.click(tool)
    expect(tool.getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(tool)
    await userEvent.keyboard('{Escape}')
    expect(tool.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(tool)
    tap(element, 400, 150)
    const pin = await (await pinsList()).findByRole('button', { name: 'Pin sin nombre' })
    await waitFor(async () => expect(await savedPins(api, map.tabId)).toHaveLength(1))
    // Con el foco en el propio pin
    pin.focus()
    await userEvent.keyboard('{Delete}')
    await waitFor(async () => expect(await savedPins(api, map.tabId)).toHaveLength(0))
  })

  it('el botón derecho ofrece poner un pin ahí; Escape cierra el menú', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    fireEvent.contextMenu(element, { clientX: 200, clientY: 300 })
    let menu = within(await screen.findByRole('menu', { name: 'Qué poner aquí' }))
    element.focus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.contextMenu(element, { clientX: 200, clientY: 300 })
    menu = within(await screen.findByRole('menu', { name: 'Qué poner aquí' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Pin aquí' }))
    expect(screen.queryByRole('menu')).toBeNull()
    await (await pinsList()).findByRole('button', { name: 'Pin sin nombre' })
    expect(await savedPins(api, map.tabId)).toMatchObject([{ x: 0.25, y: 0.5 }])
    // Pulsar en el mapa cierra el menú
    fireEvent.contextMenu(element, { clientX: 200, clientY: 300 })
    await screen.findByRole('menu', { name: 'Qué poner aquí' })
    fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 1, clientY: 1 })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('«Pin con página nueva»: el nombre que se le dé crea su subpágina y el pin lleva a ella', async () => {
    const { api, map } = await renderMap()
    const element = await viewer()
    fireEvent.contextMenu(element, { clientX: 400, clientY: 300 })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin con página nueva' }))
    const pinPanel = await panel()
    const name = pinPanel.getByLabelText('Página')
    await waitFor(() => expect(document.activeElement).toBe(name))
    // Vacío no hace nada
    await userEvent.keyboard('{Enter}')
    expect(api.calls).not.toContain('createPage')
    await userEvent.type(name, 'Muelle Viejo{Enter}')
    await waitFor(async () => expect((await savedPins(api, map.tabId))[0]?.pageTitle).toBe('Muelle Viejo'))
    const created = api.pages.find((page) => page.title === 'Muelle Viejo')
    expect(created?.parentId).toBe(PORT)
    expect(await (await pinsList()).findByRole('button', { name: 'Muelle Viejo' })).toBeDefined()
    // Ya con su página: el panel de siempre, con «Abrir»
    expect(await pinPanel.findByRole('link', { name: 'Abrir' })).toBeDefined()
  })

  it('«Pin con página nueva» con el título de una que ya existe la enlaza, sin crear otra', async () => {
    const { api, map } = await renderMap()
    fireEvent.contextMenu(await viewer(), { clientX: 400, clientY: 300 })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin con página nueva' }))
    const name = (await panel()).getByLabelText('Página')
    await waitFor(() => expect(document.activeElement).toBe(name))
    // Cuando ya se conocen los títulos de las páginas
    await waitFor(() => expect(api.calls).toContain('listPageNames'))
    await userEvent.type(name, 'el faro{Enter}')
    await waitFor(async () => expect((await savedPins(api, map.tabId))[0]?.pageId).toBe(LIGHTHOUSE))
    expect(api.calls).not.toContain('createPage')
  })

  it('un pin se arrastra para moverlo; el clic del final no lo elige', async () => {
    const { api, map } = await renderMap({ pins: [{ label: 'Torre' }] })
    await viewer()
    const pin = await (await pinsList()).findByRole('button', { name: 'Torre' })
    fireEvent.pointerDown(pin, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 400, clientY: 300 })
    // Poco: aún no se mueve
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 401, clientY: 300 })
    expect(pin.style.insetInlineStart).toBe('50%')
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 480, clientY: 360 })
    expect(pin.style.insetInlineStart).toBe('60%')
    expect(pin.style.insetBlockStart).toBe('60%')
    fireEvent.pointerUp(pin, { pointerId: 1, clientX: 480, clientY: 360 })
    fireEvent.click(pin)
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    await waitFor(async () => expect(await savedPins(api, map.tabId)).toMatchObject([{ x: 0.6, y: 0.6 }]))
    // Ahora sí, un clic lo elige
    fireEvent.click(pin)
    expect(pin.getAttribute('aria-pressed')).toBe('true')
  })

  it('un pin bloqueado, o pulsado sin moverlo, no se mueve; con el botón derecho tampoco', async () => {
    const { api, map } = await renderMap({ pins: [{ label: 'Torre', locked: true }, { label: 'Muelle' }] })
    await viewer()
    const list = await pinsList()
    const tower = await list.findByRole('button', { name: 'Torre' })
    fireEvent.pointerDown(tower, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(tower, { pointerId: 1, clientX: 500, clientY: 300 })
    fireEvent.pointerUp(tower, { pointerId: 1, clientX: 500, clientY: 300 })
    const dock = list.getByRole('button', { name: 'Muelle' })
    fireEvent.pointerDown(dock, { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 400, clientY: 300 })
    fireEvent.pointerDown(dock, { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerUp(dock, { pointerId: 3, clientX: 401, clientY: 300 })
    expect((await savedPins(api, map.tabId)).map((pin) => pin.x)).toEqual([0.5, 0.5])
    expect(api.calls).not.toContain('updateMapPin')
  })

  it('doble clic en un pin con página la abre; sin página, no', async () => {
    const { router } = await renderMap({
      pins: [
        { label: 'Faro', pageId: LIGHTHOUSE },
        { label: 'Nada', x: 0.1 }
      ]
    })
    await viewer()
    const list = await pinsList()
    await userEvent.dblClick(list.getByRole('button', { name: 'Nada' }))
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${PORT}`)
    await userEvent.dblClick(list.getByRole('button', { name: 'Faro' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${LIGHTHOUSE}`))
  })

  it('los pines se pintan con su forma, su tamaño y su icono', async () => {
    await renderMap({
      pins: [
        { label: 'Gota', shape: 0, variant: 0 },
        { label: 'Escudo', shape: 4, variant: 1, icon: '⚔' },
        { label: 'Solo icono', variant: 2, icon: '🏰' },
        { label: 'Punto', variant: 2 },
        { label: 'Rara', shape: 42 }
      ]
    })
    await viewer()
    const list = await pinsList()
    const drop = list.getByRole('button', { name: 'Gota' })
    expect(drop.dataset.anchor).toBe('tip')
    expect(drop.querySelector('svg')?.getAttribute('width')).toBe('36')
    expect(drop.querySelector('circle')).not.toBeNull()
    const shield = list.getByRole('button', { name: 'Escudo' })
    expect(shield.dataset.anchor).toBe('center')
    expect(shield.querySelector('svg')?.getAttribute('width')).toBe('24')
    expect(shield.querySelector('text')?.textContent).toBe('⚔')
    expect(list.getByRole('button', { name: 'Solo icono' }).querySelector('svg')).toBeNull()
    expect(list.getByRole('button', { name: 'Solo icono' }).textContent).toContain('🏰')
    expect(list.getByRole('button', { name: 'Punto' }).textContent).toContain('•')
    // Una forma que no hay: la gota
    expect(list.getByRole('button', { name: 'Rara' }).querySelector('path')?.getAttribute('d')).toBe(
      drop.querySelector('path')?.getAttribute('d')
    )
  })

  it('«Cambiar la imagen» abre el selector y, al elegir otra, se cierra', async () => {
    const { api, map } = await renderMap()
    await viewer()
    const change = screen.getByRole('button', { name: 'Cambiar la imagen' })
    await userEvent.click(change)
    expect(change.getAttribute('aria-expanded')).toBe('true')
    await userEvent.selectOptions(screen.getByLabelText('Imagen del mapa'), 'islas.png')
    await waitFor(() => expect(change.getAttribute('aria-expanded')).toBe('false'))
    expect((await api.client.call('getMap', { tabId: map.tabId })).image?.name).toBe('islas.png')
    // Se abre y se cierra con el mismo botón
    await userEvent.click(change)
    await userEvent.click(change)
    expect(screen.queryByLabelText('Imagen del mapa')).toBeNull()
  })

  it('con la página en lectura se mira, pero no se ponen ni se cambian pines', async () => {
    await renderMap({ locked: true, pins: [{ label: 'Torre' }] })
    const element = await viewer()
    expect(screen.queryByRole('button', { name: 'Poner un pin' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cambiar la imagen' })).toBeNull()
    fireEvent.contextMenu(element, { clientX: 10, clientY: 10 })
    expect(screen.queryByRole('menu')).toBeNull()
    const pin = (await pinsList()).getByRole('button', { name: 'Torre' })
    fireEvent.pointerDown(pin, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 500, clientY: 300 })
    expect(pin.style.insetInlineStart).toBe('50%')
    fireEvent.click(pin)
    // Una ficha con su nombre, sin nada que cambiar
    const card = await screen.findByRole('region', { name: 'Pin' })
    expect(card.textContent).toContain('Torre')
    expect(card.querySelector('input, fieldset')).toBeNull()
  })
})

describe('el panel del pin', () => {
  /** Un mapa con un pin, ya elegido */
  async function withPin(pin: Setup['pins'] = [{ label: 'Torre' }]) {
    const setup = await renderMap({ pins: pin })
    await viewer()
    const first = pin?.[0]?.label ?? 'Pin sin nombre'
    await userEvent.click(await (await pinsList()).findByRole('button', { name: first }))
    const pinned = async () => (await savedPins(setup.api, setup.map.tabId))[0]
    return { ...setup, panel: await panel(), pinned }
  }

  it('el nombre se guarda con Intro o al salir; vacío, se queda con el de su página', async () => {
    const { panel, pinned } = await withPin()
    const name = panel.getByLabelText('Nombre')
    expect((name as HTMLInputElement).value).toBe('Torre')
    await userEvent.clear(name)
    await userEvent.type(name, 'Torre del Alba{Enter}')
    await waitFor(async () => expect((await pinned())?.label).toBe('Torre del Alba'))
    expect(await (await pinsList()).findByRole('button', { name: 'Torre del Alba' })).toBeDefined()
    await userEvent.clear(name)
    await userEvent.tab()
    await waitFor(async () => expect((await pinned())?.label).toBeNull())
  })

  it('la página se enlaza por su título (una nueva, como subpágina) y se quita dejándola vacía', async () => {
    const { api, panel, pinned } = await withPin()
    const target = panel.getByLabelText('Página')
    await waitFor(() => expect(api.calls).toContain('listPageNames'))
    await userEvent.type(target, 'El Faro{Enter}')
    await waitFor(async () => expect((await pinned())?.pageId).toBe(LIGHTHOUSE))
    expect(await panel.findByRole('link', { name: 'Abrir' })).toBeDefined()
    // La misma: nada
    await userEvent.type(target, '{Enter}')
    await userEvent.clear(target)
    await userEvent.type(target, 'Lonja{Enter}')
    await waitFor(async () => expect((await pinned())?.pageTitle).toBe('Lonja'))
    expect(api.pages.find((page) => page.title === 'Lonja')?.parentId).toBe(PORT)
    await userEvent.clear(target)
    await userEvent.tab()
    await waitFor(async () => expect((await pinned())?.pageId).toBeNull())
  })

  it('el color, la forma, el tamaño, el icono, cuándo se ve el nombre y el candado', async () => {
    const { panel, pinned } = await withPin()
    await userEvent.click(panel.getByRole('radio', { name: 'Mar' }))
    await waitFor(async () => expect((await pinned())?.color).toBe('sea'))
    fireEvent.change(panel.getByText('Otro color').parentElement?.querySelector('input') as HTMLInputElement, {
      target: { value: '#123456' }
    })
    await waitFor(async () => expect((await pinned())?.color).toBe('#123456'))
    await userEvent.click(panel.getByRole('radio', { name: 'Escudo' }))
    await waitFor(async () => expect((await pinned())?.shape).toBe(4))
    await userEvent.click(panel.getByRole('radio', { name: 'Pequeño' }))
    await waitFor(async () => expect((await pinned())?.variant).toBe(1))
    // El icono, de los de rol del paquete: un botón que abre su buscador
    await userEvent.click(panel.getByLabelText('Icono'))
    const icons = within(screen.getByRole('dialog', { name: 'El icono del pin' }))
    await userEvent.type(icons.getByRole('searchbox'), 'ancla')
    await userEvent.click(icons.getByRole('button', { name: 'Ancla' }))
    await waitFor(async () => expect((await pinned())?.icon).toBe('gi:anchor'))
    expect(screen.queryByRole('dialog', { name: 'El icono del pin' })).toBeNull()
    expect(document.activeElement).toBe(panel.getByLabelText('Icono'))
    await userEvent.selectOptions(panel.getByLabelText('Se ve el nombre'), 'Siempre')
    await waitFor(async () => expect((await pinned())?.display).toBe(1))
    await userEvent.click(panel.getByRole('checkbox', { name: 'Bloqueado' }))
    await waitFor(async () => expect((await pinned())?.locked).toBe(true))
  })

  it('si no se puede guardar, lo dice y vuelve lo que hay en el servidor', async () => {
    const { api, panel } = await withPin()
    const original = api.client.call
    vi.spyOn(api.client, 'call').mockImplementation(((name, input) =>
      name === 'updateMapPin'
        ? Promise.reject(new ApiError('NOT_FOUND', 404))
        : original(name, input)) as typeof original)
    await userEvent.click(panel.getByRole('radio', { name: 'Mar' }))
    expect((await panel.findAllByText('Ya no existe')).length).toBeGreaterThan(0)
  })

  it('si no se puede crear la página del pin, lo dice', async () => {
    const { api, panel, pinned } = await withPin()
    const original = api.client.call
    vi.spyOn(api.client, 'call').mockImplementation(((name, input) =>
      name === 'createPage'
        ? Promise.reject(new ApiError('FORBIDDEN', 403))
        : original(name, input)) as typeof original)
    await userEvent.type(panel.getByLabelText('Página'), 'Lonja{Enter}')
    expect(await panel.findByRole('alert')).toBeDefined()
    expect((await pinned())?.pageId).toBeNull()
  })

  it('si no se puede crear la página de un «Pin con página nueva», lo dice', async () => {
    const { api, map } = await renderMap()
    const original = api.client.call
    vi.spyOn(api.client, 'call').mockImplementation(((name, input) =>
      name === 'createPage'
        ? Promise.reject(new ApiError('FORBIDDEN', 403))
        : original(name, input)) as typeof original)
    fireEvent.contextMenu(await viewer(), { clientX: 400, clientY: 300 })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin con página nueva' }))
    const pinPanel = await panel()
    await userEvent.type(pinPanel.getByLabelText('Página'), 'Lonja{Enter}')
    expect(await pinPanel.findByRole('alert')).toBeDefined()
    expect((await savedPins(api, map.tabId))[0]?.pageId).toBeNull()
  })

  it('«Quitar el pin» lo quita y lo anuncia; «Cerrar» suelta el pin y vuelve al mapa', async () => {
    const { api, map, panel: first } = await withPin([{ label: 'Torre' }, { label: 'Muelle' }])
    await userEvent.click(first.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pin' })).toBeNull())
    expect(document.activeElement).toBe(await viewer())
    await userEvent.click((await pinsList()).getByRole('button', { name: 'Muelle' }))
    await userEvent.click((await panel()).getByRole('button', { name: 'Quitar el pin' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Muelle' })).toBeNull())
    expect((await savedPins(api, map.tabId)).map((pin) => pin.label)).toEqual(['Torre'])
    await waitFor(() => expect(screen.getAllByText('Pin quitado').length).toBeGreaterThan(0))
  })
})
