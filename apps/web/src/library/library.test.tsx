import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// La biblioteca va en la Mesa (Compendio › Libros, y el libro en su ventana): su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

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

  it('la dirección vieja lleva a la Mesa; en Libros, cada uno se abre en su ventana, donde se busca y se lee', {
    timeout: 20_000
  }, async () => {
    const { router } = renderLibrary()
    const user = userEvent.setup()
    // Con todas las pruebas a la vez la máquina va cargada: el visor de PDF tarda en montarse
    const slow = { timeout: 8000 }
    await waitFor(() => expect(router.state.location.search).toMatchObject({ panel: 'compendio' }))
    const panel = within(await screen.findByRole('complementary', { name: 'Panel de la mesa' }))
    // Los libros, una carpeta más del compendio (sin sistema, la única)
    await user.click(await panel.findByRole('button', { name: /^Libros/ }, slow))
    expect(panel.queryByText('Mapa.png')).toBeNull()
    await user.click(panel.getByRole('button', { name: /Guía de Valdren\.pdf/ }))
    const window = within(await screen.findByRole('dialog', { name: 'Guía de Valdren.pdf' }, slow))
    const books = within(window.getByRole('region', { name: 'Libros' }))
    expect(
      books.getByRole('button', { name: /Guía de Valdren\.pdf.*2 páginas · del mundo · Se puede buscar/ })
    ).toBeDefined()
    expect(books.getByRole('button', { name: /Reglas\.pdf.*comunes · En cola/ })).toBeDefined()

    await user.type(window.getByRole('searchbox', { name: 'Buscar en los libros' }), 'guardia')
    const results = within(await window.findByRole('region', { name: 'Lo encontrado' }, slow))
    const hit = await results.findByRole('button', { name: /Página 2/ }, slow)
    // También en las páginas de la wiki, con su enlace
    expect(results.getByRole('link', { name: 'La guardia de Puertoceniza' })).toBeDefined()
    await user.click(hit)
    // El libro, abierto al lado (y su grupo de resultados)
    await waitFor(() => expect(window.getAllByRole('region', { name: 'Guía de Valdren.pdf' })).toHaveLength(2), slow)

    // Lo que no está: lo dice
    await user.clear(window.getByRole('searchbox', { name: 'Buscar en los libros' }))
    await user.type(window.getByRole('searchbox', { name: 'Buscar en los libros' }), 'dragones')
    expect(await window.findByText('Nada en los libros.', {}, slow)).toBeDefined()
  })
})
