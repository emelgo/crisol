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
      JSON.stringify({ seen: ['mundos', 'mundo', 'campanas', 'campana'] })
    )
  )

  it('desde mis mundos se entra en un mundo', async () => {
    const w = world()
    const router = renderAt('/mundos', fakeApi({ organizations: [ORG], worlds: [w] }))
    await userEvent.click(await screen.findByRole('link', { name: 'Eana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${w.id}`)
  })

  it('su cabecera, como portada de su página de portada, lleva el engranaje para su máster (sin papel)', async () => {
    const w = world('master', { description: 'Tierra de dragones' })
    renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(screen.queryByText('Máster')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ajustes de Eana' })).toBeDefined()
  })

  it('desde el engranaje de la cabecera se cambia el nombre del mundo', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG], worlds: [w] })
    renderAt(`/mundos/${w.id}`, api)
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    const input = dialog.getByLabelText('Nombre del mundo')
    await userEvent.clear(input)
    await userEvent.type(input, 'Eana (Fateforge)')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    // Sobre el título de su portada, el mundo con su nombre nuevo
    expect((await screen.findAllByText('Eana (Fateforge)')).length).toBeGreaterThan(0)
    expect(api.calls).toContain('updateWorld')
  })

  it('borrado desde su cabecera, vuelve a mis mundos', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG], worlds: [w] })
    const router = renderAt(`/mundos/${w.id}`, api)
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
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

  it('el Inicio abre la portada del mundo (como en Everlore): se crea sola con su nombre, la primera del árbol', async () => {
    const w = world()
    const api = fakeApi({ organizations: [ORG], worlds: [w], pages: [{ worldId: w.id, title: 'Lugares' }] })
    renderAt(`/mundos/${w.id}`, api)
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(api.calls).toContain('ensureWorldHome')
    const tree = within(await screen.findByRole('tree', { name: 'Páginas' }))
    await waitFor(() =>
      expect(tree.getAllByRole('treeitem').map((item) => item.textContent)).toEqual(['Eana', 'Lugares'])
    )
    expect(tree.getByRole('treeitem', { name: 'Eana' }).getAttribute('aria-current')).toBe('page')
    // No se borra: en «⋯» no está «Borrar»
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
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

  it('dentro de un mundo que se dirige, a pantalla completa: Páginas y Archivos a la izquierda, y «Ver todos» en el centro (ADR-0027)', async () => {
    const w = world()
    const router = renderAt(`/mundos/${w.id}`, fakeApi({ organizations: [ORG], worlds: [w] }))
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    await screen.findByRole('tree', { name: 'Páginas' })
    // Sin la barra de la app
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull()
    const tabs = screen.getByRole('tablist', { name: 'Barra del mundo' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Páginas', 'Archivos'])
    // La pantalla grande de Archivos, «Ver todos», dentro del centro: la barra sigue
    await userEvent.click(within(tabs).getByRole('tab', { name: 'Archivos' }))
    await userEvent.click(screen.getByRole('link', { name: 'Ver todos' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${w.id}/archivos`))
    expect(screen.getByRole('tablist', { name: 'Barra del mundo' })).toBeDefined()
    // De vuelta a la portada, desde el árbol
    await userEvent.click(within(tabs).getByRole('tab', { name: 'Páginas' }))
    await userEvent.click(await screen.findByRole('treeitem', { name: 'Eana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
  })

  it('un mundo que no está en la lista no existe', async () => {
    renderAt(`/mundos/${crypto.randomUUID()}`, fakeApi({ organizations: [ORG] }))
    expect(await screen.findByRole('heading', { name: 'Este mundo no existe' })).toBeDefined()
  })
})
