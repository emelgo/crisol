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

/** Lo que se hace de vez en cuando con la página está en «Más» */
const openMore = async () => userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))

describe('el árbol de la wiki', () => {
  it('al entrar en el mundo, su portada con el árbol al lado, y en él el primer nivel', async () => {
    // El tutorial guiado del mundo ya hecho: que no se ponga en medio
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    // Sin página, la portada del mundo
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}`))
    await item('Lugares')
    const items = (await tree()).getAllByRole('treeitem')
    // Primero, la portada del mundo, que se creó al entrar en él
    expect(items.map((i) => i.textContent)).toEqual(['Eana', 'Lugares', 'Personajes', 'Reglas de la casa'])
    expect(items[0]?.getAttribute('aria-level')).toBe('1')
    expect(items[0]?.getAttribute('aria-posinset')).toBe('1')
    expect(items[0]?.getAttribute('aria-setsize')).toBe('4')
    expect(items[1]?.getAttribute('aria-expanded')).toBe('false')
    // Sin subpáginas no se despliega
    expect(items[0]?.hasAttribute('aria-expanded')).toBe(false)
  })

  it('una sola parada del tabulador; las flechas se mueven, despliegan y pliegan', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`)
    const places = await item('Lugares')
    // La parada, en la abierta (la portada)
    await waitFor(async () =>
      expect((await tree()).getAllByRole('treeitem').filter((i) => i.tabIndex === 0)).toEqual([await item('Eana')])
    )
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
    expect(document.activeElement?.textContent).toBe('Eana')
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
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}`)
  })

  it('al abrir una página, su rama está desplegada y ella marcada', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeDefined()
    const port = await item('Puerto Ceniza')
    expect(port.getAttribute('aria-current')).toBe('page')
    expect(port.getAttribute('aria-level')).toBe('3')
    // Sobre el título, el mundo en pequeño (como en Everlore)
    expect(screen.getByText('Eana', { selector: 'header span' })).toBeDefined()
  })

  it('Alt y las flechas recolocan: abajo entre hermanas y a la derecha dentro de la de encima', async () => {
    const api = wikiApi()
    renderAt(`/mundos/${WORLD.id}/wiki`, api)
    const people = await item('Personajes')
    people.focus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await waitFor(async () =>
      expect((await tree()).getAllByRole('treeitem').map((i) => i.textContent)).toEqual([
        'Eana',
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
    await userEvent.keyboard('Facciones{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Facciones' })).toBeDefined()
    expect(await item('Facciones')).toBeDefined()
    expect(router.state.location.search).toEqual({})
  })

  it('una subpágina se crea desde su madre, en «⋯»', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.people}`)
    await openMore()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva subpágina' }))
    const title = await screen.findByLabelText('Título de la página')
    await userEvent.clear(title)
    await userEvent.type(title, 'Maela Varn{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Maela Varn' })).toBeDefined()
    expect((await item('Maela Varn')).getAttribute('aria-level')).toBe('2')
  })

  it('el título se cambia en el sitio: Intro lo guarda, Escape lo deja como estaba y vacío vuelve el de antes', async () => {
    const api = wikiApi()
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`, api)
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    expect(title.textContent).toBe('Reglas de la casa')
    // Escape: como estaba, sin guardar
    await userEvent.clear(title)
    await userEvent.type(title, 'Otra cosa{Escape}')
    expect(title.textContent).toBe('Reglas de la casa')
    // Vacío: vuelve el de antes
    await userEvent.clear(title)
    await userEvent.type(title, '{Enter}')
    expect(title.textContent).toBe('Reglas de la casa')
    expect(api.calls).not.toContain('updatePage')
    // Intro: se guarda, y se ve en el árbol
    await userEvent.clear(title)
    await userEvent.type(title, 'Reglas de mesa{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reglas de mesa' })).toBeDefined()
    expect(await item('Reglas de mesa')).toBeDefined()
    // Ya no hay «Renombrar»
    await openMore()
    expect(screen.queryByRole('button', { name: 'Renombrar' })).toBeNull()
  })

  it('borrar pide confirmar, vuelve a la madre y la rama sale una vez en la papelera, de donde se restaura', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki/${ids.coast}`)
    await openMore()
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    expect(
      screen.getByText(
        '¿Borrar «Costa Gris» y sus subpáginas? Irán a la papelera y se pueden restaurar durante 30 días.'
      )
    ).toBeDefined()
    // La confirmación lleva el foco a su botón
    expect(document.activeElement?.textContent).toBe('Borrar')
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Lugares' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.places}`)
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'Costa Gris' })).toBeNull())
    expect(screen.getByText('«Costa Gris» está en la papelera')).toBeDefined()

    await router.navigate({ to: '/mundos/$worldId/papelera', params: { worldId: WORLD.id } })
    const trash = within(await screen.findByRole('list', { name: 'En la papelera' }))
    expect(trash.getByText('Costa Gris')).toBeDefined()
    expect(trash.getByText(/Página de Eana, con 1 subpágina/)).toBeDefined()
    await userEvent.click(trash.getByRole('button', { name: 'Restaurar Costa Gris' }))
    expect(await screen.findByText('La papelera está vacía')).toBeDefined()
  })

  it('cancelar el borrado devuelve el foco a «Borrar»', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    await openMore()
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    expect(
      screen.getByText('¿Borrar «Reglas de la casa»? Irá a la papelera y se puede restaurar durante 30 días.')
    ).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Borrar' }))
  })

  it('el candado pone la página en lectura y se quita', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    await openMore()
    const lock = await screen.findByRole('button', { name: 'Poner en lectura' })
    expect(lock.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(lock)
    const unlock = await screen.findByRole('button', { name: 'Quitar el candado' })
    expect(unlock.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('En lectura: quita el candado para editar.')).toBeDefined()
    await userEvent.click(unlock)
    expect(await screen.findByRole('button', { name: 'Poner en lectura' })).toBeDefined()
  })

  it('un jugador no tiene páginas: va al Inicio del mundo, sin árbol', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki`, wikiApi({ ...WORLD, role: 'player' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Eana' })).toBeDefined()
    expect(screen.queryByRole('tree')).toBeNull()
  })
})
