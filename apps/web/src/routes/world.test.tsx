import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('el mundo abre en su página de portada (sin elegir, la primera del árbol), bajo su cabecera', async () => {
    const w = world()
    const ids = { places: crypto.randomUUID(), coast: crypto.randomUUID() }
    const api = fakeApi({
      organizations: [ORG],
      worlds: [w],
      pages: [
        { id: ids.places, worldId: w.id, title: 'Lugares' },
        { id: ids.coast, worldId: w.id, parentId: ids.places, title: 'Costa Gris' }
      ]
    })
    renderAt(`/mundos/${w.id}`, api)
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(await screen.findByRole('heading', { level: 1, name: 'Lugares' })).toBeDefined()
    expect(screen.getByRole('navigation', { name: 'Pestañas de la página' })).toBeDefined()
    expect(api.calls).toContain('getWorldHome')
  })

  it('sin páginas, lo dice y deja crear la primera', async () => {
    const w = world()
    const router = renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    expect(await screen.findByText('Este mundo aún no tiene páginas.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Crear la primera página' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`^/mundos/${w.id}/wiki/`)))
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
    // En la barra, Inicio, pero no las páginas del mundo
    expect(await ribbon().findByRole('link', { name: 'Inicio' })).toBeDefined()
    expect(ribbon().queryByRole('button', { name: 'Páginas' })).toBeNull()
  })

  it('dentro de un mundo, la barra empieza por Inicio, y siguen Buscar, Marcadores, Páginas y Archivos', async () => {
    const w = world()
    const router = renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    const home = await ribbon().findByRole('link', { name: 'Inicio' })
    expect(home.getAttribute('aria-current')).toBe('page')
    const items = [...screen.getByRole('navigation', { name: 'Secciones' }).querySelectorAll('a, button')]
      .map((item) => item.textContent)
      .filter(Boolean)
    // La llama no tiene texto (lleva su nombre como etiqueta)
    expect(items).toEqual(['Inicio', 'Buscar', 'Marcadores', 'Páginas', 'Archivos'])

    await userEvent.click(ribbon().getByRole('link', { name: 'Archivos' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${w.id}/archivos`))
    expect(ribbon().getByRole('link', { name: 'Archivos' }).getAttribute('aria-current')).toBe('page')
    await userEvent.click(ribbon().getByRole('link', { name: 'Inicio' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
  })

  it('un mundo que no está en la lista no existe', async () => {
    renderAt(`/mundos/${crypto.randomUUID()}`, fakeApi({ organizations: [ORG] }))
    expect(await screen.findByRole('heading', { name: 'Este mundo no existe' })).toBeDefined()
  })
})
