import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world = (role: World['role'] = 'master', extra: Partial<World> = {}): World => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1,
  ...extra
})
const campaign = (w: World, name: string): Campaign => ({
  id: crypto.randomUUID(),
  worldId: w.id,
  name,
  description: '',
  color: null,
  cover: null,
  role: w.role,
  version: 1
})
const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })

const renderAt = (path: string, api: ReturnType<typeof fakeApi>) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={signedIn().client} api={api.client} />)
  return router
}

/** La barra de la izquierda */
const ribbon = () => within(screen.getByRole('navigation', { name: 'Secciones' }))

describe('el Inicio de un mundo', () => {
  // Los tutoriales guiados ya hechos: que no se pongan en medio
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundos', 'mundo', 'campanas'] })
    )
  )

  it('desde mis mundos se entra en un mundo', async () => {
    const w = world()
    const router = renderAt('/mundos', fakeApi({ organizations: [ORG], worlds: [w] }))
    await userEvent.click(await screen.findByRole('link', { name: 'Eana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}`)
  })

  it('la cabecera lleva su nombre, su descripción, el papel y, para su máster, el engranaje', async () => {
    const w = world('master', { description: 'Tierra de dragones' })
    renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(screen.getByText('Tierra de dragones')).toBeDefined()
    expect(screen.getByText('Máster')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ajustes de Eana' })).toBeDefined()
  })

  it('desde el engranaje de la cabecera se cambia el nombre del mundo', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG], worlds: [w] })
    renderAt(`/mundos/${w.id}`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    const input = dialog.getByLabelText('Nombre del mundo')
    await userEvent.clear(input)
    await userEvent.type(input, 'Eana (Fateforge)')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana (Fateforge)' })).toBeDefined()
    expect(api.calls).toContain('updateWorld')
  })

  it('borrado desde su cabecera, vuelve a mis mundos', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG], worlds: [w] })
    const router = renderAt(`/mundos/${w.id}`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    const zone = within(settings.getByRole('region', { name: 'Zona de peligro' }))
    await userEvent.click(zone.getByRole('button', { name: 'Borrar el mundo' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar «Eana»?' }))
    await userEvent.type(confirm.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar el mundo' }))
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    expect(router.state.location.pathname).toBe('/mundos')
    expect(api.calls).toContain('deleteWorld')
  })

  it('lo último de la wiki: lo más reciente primero, con su camino, y cada página lleva a ella', async () => {
    const w = world()
    const ids = { places: crypto.randomUUID(), coast: crypto.randomUUID(), port: crypto.randomUUID() }
    const api = fakeApi({
      organizations: [ORG],
      worlds: [w],
      pages: [
        { id: ids.places, worldId: w.id, title: 'Lugares' },
        { id: ids.coast, worldId: w.id, parentId: ids.places, title: 'Costa Gris' },
        { id: ids.port, worldId: w.id, parentId: ids.coast, title: 'Puerto Ceniza' }
      ]
    })
    const router = renderAt(`/mundos/${w.id}`, api)
    expect(await screen.findByRole('heading', { level: 2, name: 'Últimos artículos' })).toBeDefined()
    const list = within(await screen.findByRole('list', { name: 'Páginas cambiadas hace poco' }))
    expect(list.getAllByRole('link').map((link) => link.textContent)).toEqual([
      expect.stringMatching(/^Puerto Ceniza/),
      expect.stringMatching(/^Costa Gris/),
      expect.stringMatching(/^Lugares/)
    ])
    const port = list.getByRole('link', { name: /^Puerto Ceniza/ })
    expect(within(port).getByText('Lugares › Costa Gris')).toBeDefined()
    await userEvent.click(port)
    expect(await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}/wiki/${ids.port}`)
    expect(api.calls).toContain('listRecentPages')
  })

  it('sin páginas, lo dice (a la wiki se va por la barra)', async () => {
    const w = world()
    renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    expect(await screen.findByText('Aún no hay artículos.')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Abrir la wiki' })).toBeNull()
  })

  it('quien juega ve sus campañas, sin engranaje ni lo de la wiki', async () => {
    const w = world('player')
    const marca = campaign(w, 'La Marca')
    renderAt(
      `/mundos/${w.id}`,
      fakeApi({ organizations: [{ ...ORG, role: 'member' }], worlds: [w], campaigns: [marca] })
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    const list = within(await screen.findByRole('list', { name: 'Tus campañas' }))
    const link = list.getByRole('link', { name: 'La Marca' })
    expect(link.getAttribute('href')).toBe(`/mundos/${w.id}/campanas/${marca.id}`)
    expect(list.getByText('Jugador')).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Ajustes de/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Últimos artículos' })).toBeNull()
    // En la barra, Inicio y Campañas, pero no la wiki
    expect(await ribbon().findByRole('link', { name: 'Inicio' })).toBeDefined()
    expect(ribbon().getByRole('link', { name: 'Campañas' })).toBeDefined()
    expect(ribbon().queryByRole('button', { name: 'Wiki' })).toBeNull()
  })

  it('dentro de un mundo, la barra empieza por Inicio y Campañas, y siguen los de su wiki', async () => {
    const w = world()
    const router = renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    const home = await ribbon().findByRole('link', { name: 'Inicio' })
    expect(home.getAttribute('aria-current')).toBe('page')
    const items = [...screen.getByRole('navigation', { name: 'Secciones' }).querySelectorAll('a, button')]
      .map((item) => item.textContent)
      .filter(Boolean)
    // La llama, delante; «Más», detrás (solo se ve en el móvil)
    expect(items).toEqual(['Crisol', 'Inicio', 'Campañas', 'Wiki', 'Etiquetas', 'Archivos', 'Más'])

    await userEvent.click(ribbon().getByRole('link', { name: 'Campañas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Campañas' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}/campanas`)
    expect(ribbon().getByRole('link', { name: 'Campañas' }).getAttribute('aria-current')).toBe('page')
    await userEvent.click(ribbon().getByRole('link', { name: 'Inicio' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
  })

  it('un mundo que no está en la lista no existe', async () => {
    renderAt(`/mundos/${crypto.randomUUID()}`, fakeApi({ organizations: [ORG] }))
    expect(await screen.findByRole('heading', { name: 'Este mundo no existe' })).toBeDefined()
  })
})
