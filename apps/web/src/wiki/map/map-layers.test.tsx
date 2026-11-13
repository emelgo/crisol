import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
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
const VARN = crypto.randomUUID()
const EMAIL = 'enrique@crisol.test'
const SQUARE = [
  [0.1, 0.1],
  [0.4, 0.1],
  [0.4, 0.4],
  [0.1, 0.4]
] as [number, number][]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mundo', 'mapa'] }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
})
afterEach(() => vi.restoreAllMocks())

/** Valdren, con su mapa: dos capas (Política, Secretos solo del máster), un reino, un camino y un mar */
async function renderMap() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: PAGE, worldId: WORLD.id, title: 'Valdren' },
      { id: VARN, worldId: WORLD.id, title: 'Reino de Varn' }
    ],
    files: [{ worldId: WORLD.id, name: 'valdren.png', kind: 'image' }]
  })
  const tab = await api.client.call('createPageTab', { pageId: PAGE, kind: 'map', name: 'Mapa' })
  const { id: mapId } = await api.client.call('getMap', { tabId: tab.id })
  const file = api.files[0]
  if (file) await api.client.call('updateMap', { mapId, image: { fileId: file.id, width: 1000, height: 700 } })
  const politica = await api.client.call('createMapLayer', { mapId, name: 'Política' })
  const secretos = await api.client.call('createMapLayer', { mapId, name: 'Secretos', hidden: true })
  await api.client.call('createMapElement', {
    mapId,
    layerId: politica.id,
    kind: 'region',
    geometry: { pieces: [SQUARE] },
    pageId: VARN,
    style: { fill: 'hatch' }
  })
  await api.client.call('createMapElement', {
    mapId,
    layerId: politica.id,
    kind: 'path',
    geometry: { points: SQUARE.slice(0, 2) },
    label: 'Camino real'
  })
  await api.client.call('createMapElement', {
    mapId,
    layerId: secretos.id,
    kind: 'label',
    geometry: { at: [0.5, 0.9], arc: 0.3 },
    label: 'Guarida'
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
  return { api, router, tabId: tab.id, mapId, politica, secretos }
}

const drawn = (kind: string) => document.querySelectorAll(`[data-kind="${kind}"]`)
const openLayers = async () => {
  await screen.findByRole('application', { name: 'Mapa Mapa' })
  await userEvent.click(screen.getByRole('button', { name: 'Capas' }))
  return within(await screen.findByRole('region', { name: 'Capas' }))
}

describe('las capas del mapa (módulo 9)', () => {
  it('pinta lo dibujado sobre la imagen: la región con el nombre de su página, el camino y el texto en arco', async () => {
    await renderMap()
    await screen.findByRole('application', { name: 'Mapa Mapa' })
    await waitFor(() => expect(drawn('region')).toHaveLength(1))
    expect(drawn('path')).toHaveLength(1)
    expect(drawn('label')).toHaveLength(1)
    // El nombre de la región, el de su página; el del camino, a lo largo de él; el texto, en su arco
    expect(drawn('region')[0]?.textContent).toBe('Reino de Varn')
    expect(drawn('path')[0]?.querySelector('textPath')?.textContent).toBe('Camino real')
    expect(drawn('label')[0]?.querySelector('textPath')?.textContent).toBe('Guarida')
    // Rayada: con su patrón
    expect(drawn('region')[0]?.querySelector('path')?.getAttribute('fill')).toMatch(/^url\(#.+-hatch-/)
  })

  it('el panel: de arriba abajo, con «Solo del máster»; el ojo la apaga solo en esta pantalla y se recuerda', async () => {
    const { mapId, secretos } = await renderMap()
    const panel = await openLayers()
    const names = panel.getAllByRole('button', { name: /^Renombrar/ }).map((b) => b.textContent)
    expect(names).toEqual(['Secretos', 'Política'])
    expect(panel.getByText('Solo del máster')).toBeDefined()
    expect(panel.getByText('2 cosas')).toBeDefined()
    await userEvent.click(panel.getByRole('button', { name: 'Ver «Secretos» en tu pantalla' }))
    expect(drawn('label')).toHaveLength(0)
    expect(panel.getByRole('button', { name: 'Ver «Secretos» en tu pantalla' }).getAttribute('aria-pressed')).toBe(
      'false'
    )
    expect(JSON.parse(localStorage.getItem(`crisol.mapa.capas-apagadas.${mapId}`) ?? '[]')).toEqual([secretos.id])
    await userEvent.click(panel.getByRole('button', { name: 'Ver «Secretos» en tu pantalla' }))
    expect(drawn('label')).toHaveLength(1)
  })

  it('el máster: crea una capa y le pone nombre, la deja solo del máster, la sube y la quita con lo suyo', async () => {
    const { api, tabId, politica } = await renderMap()
    const panel = await openLayers()
    await userEvent.click(panel.getByRole('button', { name: 'Capa nueva' }))
    const name = await panel.findByRole('textbox', { name: 'Nombre de la capa' })
    expect(document.activeElement).toBe(name)
    await userEvent.clear(name)
    await userEvent.type(name, 'Rutas{Enter}')
    const layers = async () => (await api.client.call('getMap', { tabId })).layers
    await waitFor(async () => expect((await layers()).map((l) => l.name)).toEqual(['Política', 'Secretos', 'Rutas']))
    // «Política», solo del máster
    await userEvent.click(panel.getByRole('button', { name: 'Solo del máster: «Política»' }))
    await waitFor(async () => expect((await layers()).find((l) => l.id === politica.id)?.hidden).toBe(true))
    // Subirla del todo (de arriba abajo: Rutas, Secretos, Política)
    await userEvent.click(await panel.findByRole('button', { name: 'Subir «Política»' }))
    await waitFor(async () => expect((await layers()).map((l) => l.name)).toEqual(['Secretos', 'Política', 'Rutas']))
    // Quitarla pide confirmarlo y se lleva lo suyo
    await userEvent.click(panel.getByRole('button', { name: 'Quitar «Política»' }))
    expect(panel.getByText('¿Quitarla con 2 cosas?')).toBeDefined()
    await userEvent.click(panel.getByRole('button', { name: 'Quitar' }))
    await waitFor(async () => expect((await layers()).map((l) => l.name)).toEqual(['Secretos', 'Rutas']))
    expect((await api.client.call('getMap', { tabId })).elements).toHaveLength(1)
  })

  it('Alt y las flechas mueven la capa desde su nombre; Escape al renombrar deja el nombre como estaba', async () => {
    const { api, tabId } = await renderMap()
    const panel = await openLayers()
    const politica = panel.getByRole('button', { name: /^Renombrar «Política»/ })
    politica.focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    await waitFor(async () =>
      expect((await api.client.call('getMap', { tabId })).layers.map((l) => l.name)).toEqual(['Secretos', 'Política'])
    )
    await userEvent.click(panel.getByRole('button', { name: /^Renombrar «Secretos»/ }))
    const input = await panel.findByRole('textbox', { name: 'Nombre de la capa' })
    await userEvent.type(input, ' nuevos{Escape}')
    expect((await api.client.call('getMap', { tabId })).layers.map((l) => l.name)).toContain('Secretos')
  })
})
