import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

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
const ILSA = crypto.randomUUID()
const ALDREN = crypto.randomUUID()
const PUERTO = crypto.randomUUID()
const SUELTA = crypto.randomUUID()

const renderAt = (path: string) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      {
        id: ILSA,
        worldId: WORLD.id,
        title: 'Ilsa de Varn',
        properties: [
          { name: 'Padres', field: 'padres', type: 'pages', value: [ALDREN], role: 'parent', inverseName: 'Hijos' },
          { name: 'Lugar', field: 'lugar', type: 'pages', value: [PUERTO], single: true }
        ]
      },
      { id: ALDREN, worldId: WORLD.id, title: 'Aldren IV' },
      { id: PUERTO, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: SUELTA, worldId: WORLD.id, title: 'Notas sueltas' }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return router
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'crisol.recorridos.enrique@crisol.test',
    JSON.stringify({ seen: ['mundo', 'relaciones', 'grafo-mundo'] })
  )
})

describe('el grafo del mundo, en su ventana (?grafo=)', () => {
  it('se abre desde la cabecera del árbol de páginas, sin cambiar de vista; Escape la cierra', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki/${ILSA}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Relaciones del mundo' }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ grafo: 'mundo' }))
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ILSA}`)
    const dialog = await screen.findByRole('dialog', { name: 'Relaciones del mundo' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Relaciones del mundo' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Relaciones del mundo' })).toBeNull())
    expect((router.state.location.search as Record<string, unknown>).grafo).toBeUndefined()
  })

  it('la dirección de antes lleva a las páginas con el grafo abierto', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/relaciones`)
    await waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`/mundos/${WORLD.id}/wiki/`)))
    expect(router.state.location.search).toMatchObject({ grafo: 'mundo' })
    expect(await screen.findByRole('dialog', { name: 'Relaciones del mundo' })).toBeDefined()
  })

  it('sin las sueltas de entrada; los filtros quitan relaciones y la enseñan', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ILSA}?grafo=mundo`)
    const filters = within(await screen.findByRole('complementary', { name: 'Filtros' }))
    expect(await screen.findByText('3 páginas · 2 relaciones · 1 suelta oculta', { exact: false })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ilsa de Varn' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Notas sueltas' })).toBeNull()
    // Sin «Lugar», Puerto Ceniza queda suelta
    await userEvent.click(filters.getByRole('checkbox', { name: /Lugar/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Puerto Ceniza' })).toBeNull())
    await userEvent.click(filters.getByRole('switch', { name: 'Páginas sueltas' }))
    expect(await screen.findByRole('button', { name: 'Notas sueltas' })).toBeDefined()
  })

  it('buscar una página la elige y saca su ficha', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ILSA}?grafo=mundo`)
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar una página' }), 'aldr')
    await userEvent.keyboard('{Enter}')
    const card = within(await screen.findByRole('region', { name: 'Aldren IV' }))
    expect(card.getByText('Hijos')).toBeDefined()
    expect(card.getByRole('button', { name: 'Abrir' })).toBeDefined()
  })
})

describe('el grafo de una página, desde «Mencionado en»', () => {
  it('centrado en ella, con su alcance y lo que menciona el texto encendido; «Centrar aquí» lo rehace desde otra', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki/${ILSA}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Ver sus relaciones' }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ grafo: ILSA }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Relaciones de Ilsa de Varn' }))
    expect(dialog.getByRole('button', { name: 'directas' }).getAttribute('aria-pressed')).toBe('true')
    expect(dialog.getByRole('switch', { name: 'Con lo que menciona el texto' })).toHaveProperty('checked', true)
    // Con el teclado (el ratón sobre el SVG necesita lo que jsdom no tiene)
    dialog.getByRole('button', { name: 'Aldren IV' }).focus()
    await userEvent.keyboard('{Enter}')
    const card = within(await dialog.findByRole('region', { name: 'Aldren IV' }))
    await userEvent.click(card.getByRole('button', { name: 'Centrar aquí' }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ grafo: ALDREN }))
    expect(await screen.findByRole('dialog', { name: 'Relaciones de Aldren IV' })).toBeDefined()
  })
})
