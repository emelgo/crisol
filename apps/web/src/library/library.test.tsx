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
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: null,
  systemChoices: null
}
const GUIA = '00000000-0000-4000-8000-000000000101'
const REGLAS = '00000000-0000-4000-8000-000000000102'

function renderLibrary() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    files: [
      { id: GUIA, worldId: WORLD.id, name: 'Guía de Valdren.pdf', kind: 'pdf', mime: 'application/pdf' },
      { id: REGLAS, worldId: null, name: 'Reglas.pdf', kind: 'pdf', mime: 'application/pdf' },
      { worldId: WORLD.id, name: 'Mapa.png' }
    ],
    bookPages: { [GUIA]: ['Guía de Valdren', 'La guardia de la ciudad viste capas grises.'] },
    pages: [{ worldId: WORLD.id, title: 'La guardia de Puertoceniza' }]
  })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/biblioteca`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { router }
}

describe('la biblioteca (docs/specs/biblioteca.md)', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'mundos', 'campana', 'biblioteca'] })
    )
  )

  it('los libros con su estado; buscar da el libro y su página, que se abre', async () => {
    const { router } = renderLibrary()
    expect(await screen.findByRole('heading', { level: 1, name: 'Biblioteca' })).toBeDefined()
    const books = within(screen.getByRole('region', { name: 'Libros' }))
    expect(
      books.getByRole('button', { name: /Guía de Valdren\.pdf.*2 páginas · del mundo · Se puede buscar/ })
    ).toBeDefined()
    expect(books.getByRole('button', { name: /Reglas\.pdf.*comunes · En cola/ })).toBeDefined()
    expect(books.queryByText('Mapa.png')).toBeNull()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en los libros' }), 'guardia')
    const results = within(await screen.findByRole('region', { name: 'Lo encontrado' }))
    const hit = await results.findByRole('button', { name: /Página 2/ })
    // También en las páginas de la wiki, con su enlace
    expect(results.getByRole('link', { name: 'La guardia de Puertoceniza' })).toBeDefined()
    await userEvent.click(hit)
    await waitFor(() => expect(router.state.location.search).toMatchObject({ libro: GUIA, pagina: 2, q: 'guardia' }))
    // El libro, abierto al lado (y su grupo de resultados)
    expect(screen.getAllByRole('region', { name: 'Guía de Valdren.pdf' })).toHaveLength(2)

    // Lo que no está: lo dice
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar en los libros' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en los libros' }), 'dragones')
    expect(await screen.findByText('Nada en los libros.')).toBeDefined()
  })
})
