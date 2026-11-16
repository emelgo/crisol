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
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
})

describe('el grafo del mundo (módulo 10)', () => {
  it('se abre desde la cabecera del árbol de páginas', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki/${ILSA}`)
    await userEvent.click(await screen.findByRole('link', { name: 'Relaciones del mundo' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/relaciones`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Relaciones' })).toBeDefined()
  })

  it('sin las sueltas de entrada; los filtros quitan relaciones y la enseñan', async () => {
    renderAt(`/mundos/${WORLD.id}/relaciones`)
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
    renderAt(`/mundos/${WORLD.id}/relaciones`)
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar una página' }), 'aldr')
    await userEvent.keyboard('{Enter}')
    const card = within(await screen.findByRole('region', { name: 'Aldren IV' }))
    expect(card.getByText('Hijos')).toBeDefined()
    expect(card.getByRole('button', { name: 'Abrir' })).toBeDefined()
  })
})
