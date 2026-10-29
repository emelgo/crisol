import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const ids = {
  places: crypto.randomUUID(),
  coast: crypto.randomUUID(),
  port: crypto.randomUUID(),
  people: crypto.randomUUID(),
  rules: crypto.randomUUID()
}
/** Lugares > Costa Gris > Puerto Ceniza; Personajes; Reglas de la casa */
const wikiApi = (world: World = WORLD) =>
  fakeApi({
    organizations: [ORG],
    worlds: [world],
    pages: [
      { id: ids.places, worldId: WORLD.id, title: 'Lugares' },
      { id: ids.coast, worldId: WORLD.id, parentId: ids.places, title: 'Costa Gris' },
      { id: ids.port, worldId: WORLD.id, parentId: ids.coast, title: 'Puerto Ceniza' },
      { id: ids.people, worldId: WORLD.id, title: 'Personajes' },
      { id: ids.rules, worldId: WORLD.id, title: 'Reglas de la casa' }
    ]
  })

const renderAt = (path: string, api = wikiApi()) => {
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
const tree = async () => within(await screen.findByRole('tree', { name: 'Páginas' }))
const item = async (name: string) => (await tree()).findByRole('treeitem', { name })

describe('el árbol de la wiki', () => {
  it('desde el mundo se llega a su wiki, con el primer nivel', async () => {
    renderAt(`/mundos/${WORLD.id}`)
    await userEvent.click(await screen.findByRole('link', { name: 'Wiki de Eana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Wiki de Eana' })).toBeDefined()
    const items = (await tree()).getAllByRole('treeitem')
    expect(items.map((i) => i.textContent)).toEqual(['Lugares', 'Personajes', 'Reglas de la casa'])
    expect(items[0]?.getAttribute('aria-level')).toBe('1')
    expect(items[0]?.getAttribute('aria-posinset')).toBe('1')
    expect(items[0]?.getAttribute('aria-setsize')).toBe('3')
    expect(items[0]?.getAttribute('aria-expanded')).toBe('false')
    // Sin subpáginas no se despliega
    expect(items[1]?.hasAttribute('aria-expanded')).toBe(false)
  })

  it('una sola parada del tabulador; las flechas se mueven, despliegan y pliegan', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`)
    const places = await item('Lugares')
    expect((await tree()).getAllByRole('treeitem').filter((i) => i.tabIndex === 0)).toEqual([places])
    places.focus()
    await userEvent.keyboard('{ArrowRight}')
    const coast = await item('Costa Gris')
    expect(places.getAttribute('aria-expanded')).toBe('true')
    expect(coast.getAttribute('aria-level')).toBe('2')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(coast)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('Personajes')
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
    expect(document.activeElement).toBe(places)
    await userEvent.keyboard('{ArrowLeft}')
    expect(places.getAttribute('aria-expanded')).toBe('false')
    await userEvent.keyboard('{End}')
    expect(document.activeElement?.textContent).toBe('Reglas de la casa')
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(places)
  })

  it('la flecha de cada rama la despliega y la pliega sin abrir la página', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    const places = await item('Lugares')
    const arrow = places.querySelector('[data-toggle]')
    if (!arrow) throw new Error('sin flecha')
    await userEvent.click(arrow)
    expect(await item('Costa Gris')).toBeDefined()
    expect(places.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(arrow)
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'Costa Gris' })).toBeNull())
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki`)
  })

  it('al abrir una página, su rama está desplegada y ella marcada', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeDefined()
    const port = await item('Puerto Ceniza')
    expect(port.getAttribute('aria-current')).toBe('page')
    expect(port.getAttribute('aria-level')).toBe('3')
    const crumbs = within(screen.getByRole('navigation', { name: 'Migas de pan' }))
    expect(crumbs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Eana', 'Lugares', 'Costa Gris'])
  })

  it('Alt y las flechas recolocan: abajo entre hermanas y a la derecha dentro de la de encima', async () => {
    const api = wikiApi()
    renderAt(`/mundos/${WORLD.id}/wiki`, api)
    const people = await item('Personajes')
    people.focus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await waitFor(async () =>
      expect((await tree()).getAllByRole('treeitem').map((i) => i.textContent)).toEqual([
        'Lugares',
        'Reglas de la casa',
        'Personajes'
      ])
    )
    expect(await screen.findByText('«Personajes» va ahora en el primer nivel')).toBeDefined()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    expect(await screen.findByText('«Personajes» va ahora dentro de «Reglas de la casa»')).toBeDefined()
    expect((await item('Personajes')).getAttribute('aria-level')).toBe('2')
    expect(api.calls.filter((c) => c === 'movePage')).toHaveLength(2)
  })

  it('una página nueva se abre para ponerle nombre, y sale en el árbol', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    await userEvent.click(await screen.findByRole('button', { name: 'Página nueva' }))
    const title = await screen.findByLabelText('Título de la página')
    expect(document.activeElement).toBe(title)
    // Con todo el título provisional elegido, escribir lo sustituye
    await userEvent.keyboard('Facciones')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Facciones' })).toBeDefined()
    expect(await item('Facciones')).toBeDefined()
    expect(router.state.location.search).toEqual({})
  })

  it('una subpágina se crea desde su madre', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.people}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva subpágina' }))
    const title = await screen.findByLabelText('Título de la página')
    await userEvent.clear(title)
    await userEvent.type(title, 'Maela Varn{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Maela Varn' })).toBeDefined()
    expect((await item('Maela Varn')).getAttribute('aria-level')).toBe('2')
    expect(within(screen.getByRole('navigation', { name: 'Migas de pan' })).getByText('Personajes')).toBeDefined()
  })

  it('renombrar en el sitio; Escape lo deja como estaba', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar' }))
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reglas de la casa' })).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Renombrar' }))
  })

  it('un jugador no tiene wiki', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`, wikiApi({ ...WORLD, role: 'player' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Esta wiki no existe' })).toBeDefined()
    expect(screen.queryByRole('tree')).toBeNull()
  })
})
