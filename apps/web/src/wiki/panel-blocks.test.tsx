import type { PanelBlock, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import type { ApiClient } from '../api/client.ts'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// El tutorial del mundo, ya visto (si no, sale y se lleva el foco)
beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))

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
const DOCKS = crypto.randomUUID()

/** Puerto Ceniza (con una subpágina, Los Muelles) y Velaria, una ciudad etiquetada */
async function renderPort(panel: PanelBlock[] = [], wrap?: (client: ApiClient) => ApiClient) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: DOCKS, worldId: WORLD.id, parentId: PORT, title: 'Los Muelles', icon: '⚓' },
      {
        worldId: WORLD.id,
        title: 'Velaria',
        properties: [{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] }]
      }
    ],
    files: [{ worldId: WORLD.id, name: 'faro.png' }]
  })
  if (panel.length) await api.client.call('setPagePanel', { pageId: PORT, blocks: panel })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={wrap ? wrap(api.client) : api.client}
    />
  )
  const saved = async () => (await api.client.call('getPage', { pageId: PORT })).panel
  return { api, router, saved }
}

const panel = async () => within(await screen.findByRole('complementary', { name: 'Panel de la página' }))

async function add(kind: string) {
  const inside = await panel()
  await userEvent.click(inside.getByRole('button', { name: 'Añadir bloque' }))
  await userEvent.click(inside.getByRole('button', { name: kind }))
}

/** Abre las opciones de un bloque (sus seis puntos) */
async function options(name: string) {
  await userEvent.click((await panel()).getByRole('button', { name: `Opciones de «${name}»` }))
}

const block = async (name: string) => within((await panel()).getByRole('region', { name }))
/** Los bloques, por su nombre y en su orden (las propiedades, que también son una región, no cuentan) */
const order = async () =>
  (await panel()).getAllByRole('region').flatMap((region) => region.getAttribute('aria-label') ?? [])

describe('el panel de bloques de una página', () => {
  it('vacío, lo dice; un bloque de texto nuevo pide su título y guarda lo escrito al salir', async () => {
    const { saved } = await renderPort()
    expect(await (await panel()).findByText('Panel vacío')).toBeDefined()
    await add('Texto')
    const title = (await panel()).getByRole('textbox', { name: 'Título' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    await waitFor(async () => expect(await saved()).toHaveLength(1))
    expect((await panel()).queryByText('Panel vacío')).toBeNull()

    await userEvent.type(title, '  Rumores  {Enter}')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'text', title: 'Rumores' }))
    // El bloque toma el nombre de su título
    const rumors = await block('Rumores')
    await userEvent.type(rumors.getByRole('textbox', { name: 'Texto' }), 'Dicen que el faro se apagó')
    await userEvent.tab()
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ text: 'Dicen que el faro se apagó' }))
  })

  it('el título sin cambios no se guarda otra vez', async () => {
    const { api } = await renderPort([{ id: 'nota', type: 'text', title: 'Rumores', text: '' }])
    const title = (await block('Rumores')).getByRole('textbox', { name: 'Título' })
    await userEvent.click(title)
    await userEvent.tab()
    const textarea = (await block('Rumores')).getByRole('textbox', { name: 'Texto' })
    await userEvent.click(textarea)
    await userEvent.tab()
    expect(api.calls.filter((c) => c === 'setPagePanel')).toHaveLength(1)
  })

  it('la barra: + y − cambian el valor, que se guarda al parar; pulsar en ella la deja hasta ahí', async () => {
    const { saved } = await renderPort()
    await add('Barra')
    const bar = await block('Barra')
    const less = bar.getByRole('button', { name: 'Menos' })
    // A cero no se puede bajar
    expect(less).toHaveProperty('disabled', true)
    await userEvent.click(bar.getByRole('button', { name: 'Más' }))
    await userEvent.click(bar.getByRole('button', { name: 'Más' }))
    await userEvent.click(bar.getByRole('button', { name: 'Más' }))
    await userEvent.click(less)
    const meter = bar.getByRole('meter', { name: 'Barra' })
    expect(meter.getAttribute('aria-valuenow')).toBe('2')
    expect(meter.getAttribute('aria-valuetext')).toBe('2 de 10')
    expect(bar.getByText('2 / 10')).toBeDefined()
    // Los clics seguidos van juntos, al parar
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'meter', style: 'bar', value: 2 }))

    vi.spyOn(meter, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 200, 10))
    fireEvent.click(meter, { clientX: 240 })
    expect(meter.getAttribute('aria-valuenow')).toBe('7')
    // Más allá del final, el máximo
    fireEvent.click(meter, { clientX: 400 })
    expect(meter.getAttribute('aria-valuenow')).toBe('10')
    expect(bar.getByRole('button', { name: 'Más' })).toHaveProperty('disabled', true)
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ value: 10 }))
  })

  it('sus opciones: el máximo (que recorta el valor), la forma de círculo y el color', async () => {
    const { saved } = await renderPort([
      { id: 'vida', type: 'meter', title: 'Vida', style: 'bar', value: 8, max: 10, color: 'wine' }
    ])
    await options('Vida')
    const max = (await panel()).getByRole('spinbutton', { name: 'Máximo' })
    await userEvent.clear(max)
    await userEvent.type(max, '5')
    await userEvent.tab()
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ max: 5, value: 5 }))

    await userEvent.click((await panel()).getByRole('button', { name: 'Mar' }))
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ color: 'sea' }))
    expect((await panel()).getByRole('button', { name: 'Mar' }).getAttribute('aria-pressed')).toBe('true')

    await userEvent.click((await panel()).getByRole('button', { name: 'Círculo' }))
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ style: 'circle' }))
    const ring = (await block('Vida')).getByRole('meter', { name: 'Vida' })
    expect(ring.tagName.toLowerCase()).toBe('svg')
    expect(ring.textContent).toBe('100%')
  })

  it('el máximo, entre 1 y su tope; si no cambia, no se guarda', async () => {
    const { api, saved } = await renderPort([{ id: 'fama', type: 'rating', title: 'Fama', value: 2, max: 5 }])
    await options('Fama')
    const max = (await panel()).getByRole('spinbutton', { name: 'Máximo' })
    await userEvent.click(max)
    await userEvent.tab()
    expect(api.calls.filter((c) => c === 'setPagePanel')).toHaveLength(1)
    await userEvent.clear(max)
    await userEvent.type(max, '50')
    await userEvent.tab()
    // Las estrellas, diez como mucho
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ max: 10, value: 2 }))
    await userEvent.clear(max)
    await userEvent.tab()
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ max: 1, value: 1 }))
  })

  it('las estrellas: pulsar una enciende hasta ella; otra vez, a media; y otra, apagada', async () => {
    const { saved } = await renderPort()
    await add('Estrellas')
    const stars = await block('Estrellas')
    expect(stars.getAllByRole('button', { name: /de 5 estrellas$/ })).toHaveLength(5)
    const third = stars.getByRole('button', { name: '3 de 5 estrellas' })
    await userEvent.click(third)
    expect(third.getAttribute('aria-pressed')).toBe('true')
    expect(third.getAttribute('data-fill')).toBe('full')
    await userEvent.click(third)
    expect(third.getAttribute('data-fill')).toBe('half')
    expect(third.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(third)
    expect(third.getAttribute('data-fill')).toBe('none')
    expect(stars.getByRole('button', { name: '2 de 5 estrellas' }).getAttribute('data-fill')).toBe('full')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'rating', value: 2 }))
  })

  it('las fichas: pulsar una gasta hasta ella; pulsar la última encendida la apaga', async () => {
    const { saved } = await renderPort()
    await add('Fichas')
    const tokens = await block('Fichas')
    const second = tokens.getByRole('button', { name: 'Ficha 2 de 5' })
    await userEvent.click(second)
    expect(tokens.getByRole('button', { name: 'Ficha 1 de 5' }).getAttribute('aria-pressed')).toBe('true')
    expect(second.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(second)
    expect(second.getAttribute('aria-pressed')).toBe('false')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'tokens', value: 1, color: 'sea' }))
    // Sus opciones también tienen color, pero no forma
    await options('Fichas')
    expect((await panel()).queryByRole('button', { name: 'Círculo' })).toBeNull()
    await userEvent.click((await panel()).getByRole('button', { name: 'Musgo' }))
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ color: 'moss' }))
  })

  it('las subpáginas, enlazadas con su icono; sin ellas, lo dice', async () => {
    const { router } = await renderPort()
    await add('Subpáginas')
    const docks = await (await block('Subpáginas')).findByRole('link', { name: /Los Muelles/ })
    expect(docks.textContent).toBe('⚓ Los Muelles')
    await userEvent.click(docks)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${DOCKS}`))
    await add('Subpáginas')
    expect(await (await block('Subpáginas')).findByText('Aún no tiene subpáginas.')).toBeDefined()
  })

  it('las páginas con una etiqueta: se elige en sus opciones (sin #) y salen las de ella y sus hijas', async () => {
    const { saved } = await renderPort()
    await add('Páginas con etiqueta')
    const tagged = await block('Páginas con etiqueta')
    expect(tagged.getByText('Elige una etiqueta en sus opciones.')).toBeDefined()
    await options('Páginas con etiqueta')
    await userEvent.type((await panel()).getByRole('textbox', { name: 'Etiqueta' }), '#Lugar{Enter}')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'tagged', tag: 'Lugar' }))
    expect(await tagged.findByRole('link', { name: 'Velaria' })).toBeDefined()
    expect(tagged.getByText('#Lugar')).toBeDefined()
    // Una etiqueta que nadie lleva
    const field = (await panel()).getByRole('textbox', { name: 'Etiqueta' })
    await userEvent.clear(field)
    await userEvent.type(field, 'reino{Enter}')
    expect(await tagged.findByText('Ninguna página con esa etiqueta.')).toBeDefined()
  })

  it('una imagen se elige de las del mundo y se le pone pie', async () => {
    const { saved } = await renderPort()
    await add('Imagen')
    const image = await block('Imagen')
    // Vacío, un recuadro discreto: al pulsarlo, se elige o se sube
    await userEvent.click(image.getByRole('button', { name: 'Añadir imagen' }))
    const select = await image.findByRole('combobox', { name: 'Imagen' })
    await waitFor(() => expect(within(select).getByRole('option', { name: 'faro.png' })).toBeDefined())
    await userEvent.selectOptions(select, 'faro.png')
    const picture = await image.findByRole('img', { name: 'faro.png' })
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'image', fileId: expect.any(String) }))
    await userEvent.type(image.getByRole('textbox', { name: 'Pie' }), 'El faro de noche ')
    await userEvent.tab()
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ caption: 'El faro de noche' }))
    expect(picture.getAttribute('alt')).toBe('El faro de noche')
  })

  it('una imagen se puede subir desde el bloque, y queda puesta', async () => {
    const { api, saved } = await renderPort()
    await add('Imagen')
    const image = await block('Imagen')
    await userEvent.click(image.getByRole('button', { name: 'Añadir imagen' }))
    const input = (await panel()).getByRole('region', { name: 'Imagen' }).querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('sin campo de archivo')
    const click = vi.spyOn(input, 'click')
    await userEvent.click(image.getByRole('button', { name: 'Subir una imagen' }))
    expect(click).toHaveBeenCalled()
    await userEvent.upload(input, new File(['png'], 'mapa.png', { type: 'image/png' }))
    expect(await image.findByRole('img', { name: 'mapa.png' })).toBeDefined()
    expect(api.calls).toContain('uploadFile')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ fileId: expect.any(String) }))
  })

  it('subir algo que no es una imagen no la pone', async () => {
    const { api } = await renderPort()
    await add('Imagen')
    const region = (await panel()).getByRole('region', { name: 'Imagen' })
    await userEvent.click(within(region).getByRole('button', { name: 'Añadir imagen' }))
    const input = region.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('sin campo de archivo')
    // El accept del campo no deja elegirlo con userEvent: se sube a mano
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'reglas.pdf', { type: 'application/pdf' })] } })
    await waitFor(() => expect(api.calls).toContain('uploadFile'))
    expect(within(region).queryByRole('img')).toBeNull()
  })

  it('los bloques se suben, se bajan y se quitan desde sus opciones', async () => {
    const { saved } = await renderPort([
      { id: 'uno', type: 'text', title: 'Uno', text: '' },
      { id: 'dos', type: 'text', title: 'Dos', text: '' }
    ])
    expect(await order()).toEqual(['Uno', 'Dos'])
    await options('Uno')
    // El primero no sube
    expect((await panel()).getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', true)
    await userEvent.click((await panel()).getByRole('button', { name: 'Bajar' }))
    expect(await order()).toEqual(['Dos', 'Uno'])
    await waitFor(async () => expect((await saved()).map((b) => b.id)).toEqual(['dos', 'uno']))
    // Y el último no baja
    expect((await panel()).getByRole('button', { name: 'Bajar' })).toHaveProperty('disabled', true)
    await userEvent.click((await panel()).getByRole('button', { name: 'Subir' }))
    expect(await order()).toEqual(['Uno', 'Dos'])
    await userEvent.click((await panel()).getByRole('button', { name: 'Quitar el bloque' }))
    expect(await order()).toEqual(['Dos'])
    await waitFor(async () => expect((await saved()).map((b) => b.id)).toEqual(['dos']))
  })

  it('arrastrando sus seis puntos, un bloque se coloca donde otro', async () => {
    const { saved } = await renderPort([
      { id: 'uno', type: 'text', title: 'Uno', text: '' },
      { id: 'dos', type: 'text', title: 'Dos', text: '' },
      { id: 'tres', type: 'text', title: 'Tres', text: '' }
    ])
    const inside = await panel()
    const grip = inside.getByRole('button', { name: 'Opciones de «Tres»' })
    const target = inside.getByRole('region', { name: 'Uno' })
    fireEvent.dragStart(grip, { dataTransfer: { effectAllowed: 'all' } })
    expect(inside.getByRole('region', { name: 'Tres' }).hasAttribute('data-dragging')).toBe(true)
    fireEvent.dragOver(target)
    expect(target.hasAttribute('data-over')).toBe(true)
    fireEvent.dragLeave(target)
    expect(target.hasAttribute('data-over')).toBe(false)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    fireEvent.dragEnd(grip)
    expect(await order()).toEqual(['Tres', 'Uno', 'Dos'])
    await waitFor(async () => expect((await saved()).map((b) => b.id)).toEqual(['tres', 'uno', 'dos']))
    // Soltar sin arrastrar nada no mueve
    fireEvent.drop(inside.getByRole('region', { name: 'Dos' }))
    expect(await order()).toEqual(['Tres', 'Uno', 'Dos'])
  })

  it('las opciones se cierran con Escape (el foco vuelve a los puntos) y pulsando fuera', async () => {
    await renderPort([{ id: 'uno', type: 'text', title: 'Uno', text: '' }])
    await options('Uno')
    const grip = (await panel()).getByRole('button', { name: 'Opciones de «Uno»' })
    expect(grip.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    expect(grip.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(grip)
    await userEvent.click(grip)
    expect(grip.getAttribute('aria-expanded')).toBe('true')
    // Otra tecla no la cierra
    await userEvent.keyboard('a')
    expect(grip.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(document.body)
    expect(grip.getAttribute('aria-expanded')).toBe('false')
  })

  it('«Añadir bloque» ofrece también las etiquetas y las propiedades de la página', async () => {
    await renderPort()
    const inside = await panel()
    await userEvent.click(inside.getByRole('button', { name: 'Añadir bloque' }))
    for (const name of ['Etiquetas', 'Propiedad', 'Texto', 'Imagen', 'Barra', 'Círculo', 'Estrellas', 'Fichas']) {
      expect(inside.getByRole('button', { name })).toBeDefined()
    }
    // Otra vez el botón, lo cierra
    await userEvent.click(inside.getByRole('button', { name: 'Añadir bloque' }))
    expect(inside.queryByRole('button', { name: 'Fichas' })).toBeNull()
  })

  it('un círculo nuevo empieza vacío, a cero por ciento', async () => {
    await renderPort()
    await add('Círculo')
    const ring = (await block('Círculo')).getByRole('meter', { name: 'Círculo' })
    expect(ring.textContent).toBe('0%')
    await userEvent.click((await block('Círculo')).getByRole('button', { name: 'Más' }))
    expect(ring.textContent).toBe('10%')
  })

  it('si no se puede guardar, lo dice; y al volver a guardar bien, se quita', async () => {
    let fail = true
    await renderPort([], (client) => ({
      ...client,
      call: (name, input) =>
        name === 'setPagePanel' && fail ? Promise.reject(new ApiError('INTERNAL', 500)) : client.call(name, input)
    }))
    await add('Texto')
    expect(await (await panel()).findByRole('alert')).toBeDefined()
    fail = false
    await userEvent.type((await panel()).getByRole('textbox', { name: 'Título' }), 'Rumores{Enter}')
    await waitFor(async () => expect((await panel()).queryByRole('alert')).toBeNull())
  })

  it('al irse de la página, los clics que faltaban por guardar se guardan', async () => {
    const { router, saved } = await renderPort([{ id: 'fama', type: 'rating', title: 'Fama', value: 0, max: 5 }])
    await userEvent.click((await block('Fama')).getByRole('button', { name: '4 de 5 estrellas' }))
    await router.navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: WORLD.id, pageId: DOCKS } })
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ value: 4 }))
  })
})
