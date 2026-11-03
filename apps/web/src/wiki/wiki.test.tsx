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
    // Sin el mundo sobre el título: el título, donde el de Archivos
    expect(screen.queryByText('Eana', { selector: 'header span' })).toBeNull()
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

  it('una página nueva: su cuadro pide el tipo y el título, y sale en el árbol', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    await userEvent.click(await screen.findByRole('button', { name: 'Página nueva' }))
    const dialog = await screen.findByRole('dialog', { name: 'Página nueva' })
    expect(within(dialog).getByRole('radio', { name: 'Texto' })).toHaveProperty('checked', true)
    const title = within(dialog).getByLabelText('Título')
    await waitFor(() => expect(document.activeElement).toBe(title))
    await userEvent.keyboard('Facciones{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Facciones' })).toBeDefined()
    expect(await item('Facciones')).toBeDefined()
    expect(router.state.location.search).toEqual({})
  })

  it('desde plantilla: se elige en su lista (con buscador) y la página nace con sus campos y su marca', async () => {
    const api = wikiApi()
    renderAt(`/mundos/${WORLD.id}/wiki`, api)
    await userEvent.click(await screen.findByRole('button', { name: 'Página nueva' }))
    const dialog = await screen.findByRole('dialog', { name: 'Página nueva' })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Desde plantilla' }))
    const list = within(await within(dialog).findByRole('group', { name: 'Plantilla' }))
    // La primera, elegida; las de serie, todas
    expect(list.getByRole('radio', { name: /^PNJ/ })).toHaveProperty('checked', true)
    expect(list.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      'pnj',
      'lugar',
      'faccion',
      'objeto',
      'mision',
      'sesion'
    ])
    // El buscador, sin mirar tildes
    await userEvent.type(within(dialog).getByLabelText('Buscar plantilla'), 'faccion')
    expect(list.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['faccion'])
    await userEvent.click(list.getByRole('radio', { name: /^Facción/ }))
    await userEvent.type(within(dialog).getByLabelText('Título'), 'La Raqisa{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'La Raqisa' })).toBeDefined()
    expect(screen.getByTitle('Hecha con la plantilla Facción')).toBeDefined()
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect(properties.getByLabelText('Nombre de la propiedad 2')).toHaveProperty('value', 'Líder')
  })

  it('una subpágina se crea desde su madre, con el botón derecho en el árbol', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.people}`)
    await userEvent.pointer({ keys: '[MouseRight]', target: await item('Personajes') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Crear subpágina' }))
    const dialog = await screen.findByRole('dialog', { name: /^Subpágina de/ })
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Maela Varn{Enter}')
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
    await userEvent.pointer({ keys: '[MouseRight]', target: await item('Costa Gris') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    expect(
      screen.getByText(
        '¿Borrar «Costa Gris» y sus subpáginas? Irán a la papelera y se pueden restaurar durante 30 días.'
      )
    ).toBeDefined()
    // La confirmación lleva el foco a su botón
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Borrar'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
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

  it('cancelar el borrado con Escape vuelve al menú, y otra vez Escape, a la fila del árbol', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const row = await item('Reglas de la casa')
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    expect(
      screen.getByText('¿Borrar «Reglas de la casa»? Irá a la papelera y se puede restaurar durante 30 días.')
    ).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByRole('menuitem', { name: 'Crear subpágina' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(row)
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
