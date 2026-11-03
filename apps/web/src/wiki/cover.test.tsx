import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

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
const IMAGE = crypto.randomUUID()

beforeEach(() => {
  // happy-dom no captura el puntero
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => undefined
})

async function renderPort({ locked = false, fileId = IMAGE } = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' }],
    files: [{ id: IMAGE, worldId: WORLD.id, name: 'faro.png' }]
  })
  await api.client.call('updatePage', { pageId: PORT, cover: { fileId, x: 50, y: 50 }, ...(locked ? { locked } : {}) })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  const { container } = render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const saved = async () => (await api.client.call('getPage', { pageId: PORT })).cover
  /** La imagen de cabecera, cuando ya está */
  const image = async () =>
    waitFor(() => {
      const found = container.querySelector<HTMLImageElement>('[data-cover-image] img')
      if (!found) throw new Error('sin portada')
      return found
    })
  return { api, saved, image, container }
}

describe('la portada de una página', () => {
  it('sale la imagen de cabecera, que se ve en grande y se cierra', async () => {
    const { image } = await renderPort()
    expect((await image()).getAttribute('src')).toBe(`/api/files/${IMAGE}`)
    expect(screen.getByText('Arrastra para encuadrar')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }))
    const viewer = await screen.findByRole('dialog', { name: 'Puerto Ceniza' })
    await userEvent.click(within(viewer).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Puerto Ceniza' })).toBeNull())
  })

  it('arrastrarla arriba o abajo la encuadra, y se guarda al soltar', async () => {
    const { image, saved } = await renderPort()
    const img = await image()
    vi.spyOn(img, 'clientHeight', 'get').mockReturnValue(200)
    fireEvent.pointerDown(img, { pointerId: 1, clientY: 100 })
    expect(img.closest('[data-cover-image]')?.hasAttribute('data-dragging')).toBe(true)
    // Bajar el ratón un cuarto del alto enseña lo de arriba: del 50 % al 25 %
    fireEvent.pointerMove(img, { pointerId: 1, clientY: 150 })
    fireEvent.pointerUp(img, { pointerId: 1 })
    await waitFor(async () => expect(await saved()).toEqual({ fileId: IMAGE, x: 50, y: 25 }))
    // Sin pasar de los bordes
    fireEvent.pointerDown(img, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(img, { pointerId: 1, clientY: -900 })
    fireEvent.pointerUp(img, { pointerId: 1 })
    await waitFor(async () => expect(await saved()).toMatchObject({ y: 100 }))
  })

  it('pulsarla sin moverla no la guarda, y moverse sin pulsar no hace nada', async () => {
    const { image, api } = await renderPort()
    const img = await image()
    fireEvent.pointerMove(img, { pointerId: 1, clientY: 150 })
    fireEvent.pointerDown(img, { pointerId: 1, clientY: 100 })
    fireEvent.pointerUp(img, { pointerId: 1 })
    expect(api.calls.filter((call) => call === 'updatePage')).toHaveLength(1)
  })

  it('en una página en lectura se ve, pero ni se encuadra ni se cambia', async () => {
    const { image, api } = await renderPort({ locked: true })
    const img = await image()
    expect(screen.queryByText('Arrastra para encuadrar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cambiar' })).toBeNull()
    fireEvent.pointerDown(img, { pointerId: 1, clientY: 100 })
    expect(img.closest('[data-cover-image]')?.hasAttribute('data-dragging')).toBe(false)
    fireEvent.pointerUp(img, { pointerId: 1 })
    expect(api.calls.filter((call) => call === 'updatePage')).toHaveLength(1)
  })

  it('si su archivo ya no está, no sale nada', async () => {
    const { container } = await renderPort({ fileId: crypto.randomUUID() })
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await waitFor(() => expect(screen.queryByText('Cargando…')).toBeNull())
    expect(container.querySelector('[data-cover-image]')).toBeNull()
  })
})
