import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import type { ApiClient } from '../api/client.ts'
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
  bay: crypto.randomUUID(),
  people: crypto.randomUUID(),
  rules: crypto.randomUUID()
}
/** Lugares > (Costa Gris > Puerto Ceniza, Bahía Azul); Personajes; Reglas de la casa */
const wikiApi = () =>
  fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: ids.places, worldId: WORLD.id, title: 'Lugares' },
      { id: ids.coast, worldId: WORLD.id, parentId: ids.places, title: 'Costa Gris' },
      { id: ids.port, worldId: WORLD.id, parentId: ids.coast, title: 'Puerto Ceniza' },
      { id: ids.bay, worldId: WORLD.id, parentId: ids.places, title: 'Bahía Azul' },
      { id: ids.people, worldId: WORLD.id, title: 'Personajes', icon: '🧙' },
      { id: ids.rules, worldId: WORLD.id, title: 'Reglas de la casa' }
    ]
  })

const renderAt = (path: string, api = wikiApi(), client: ApiClient = api.client) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={client}
    />
  )
  return { router, api }
}
const tree = async () => within(await screen.findByRole('tree', { name: 'Páginas' }))
const item = async (name: string) => (await tree()).findByRole('treeitem', { name })
const titles = async () => (await tree()).getAllByRole('treeitem').map((i) => i.textContent?.replace('🧙', ''))

/** El menú de una fila del árbol, con el botón derecho */
const openMenu = async (name: string) => {
  await userEvent.pointer({ keys: '[MouseRight]', target: await item(name) })
  return within(await screen.findByRole('menu', { name: `Opciones de «${name}»` }))
}

beforeEach(() => {
  // El tutorial guiado del mundo ya hecho: que no se ponga en medio
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
})

describe('el menú de una página en el árbol', () => {
  it('renombrar: el título nuevo se guarda con Intro y sale en el árbol', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Reglas de la casa')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Renombrar' }))
    const input = await screen.findByRole('textbox', { name: 'Nuevo título' })
    await waitFor(() => expect(document.activeElement).toBe(input))
    await userEvent.clear(input)
    await userEvent.type(input, 'Reglas de mesa{Enter}')
    expect(await item('Reglas de mesa')).toBeDefined()
    expect(api.calls).toContain('updatePage')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('renombrar con el mismo título (o vacío) cierra sin guardar; Escape vuelve al menú', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    let menu = await openMenu('Reglas de la casa')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Renombrar' }))
    // Escape en el campo: de vuelta al menú
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nuevo título' }), '{Escape}')
    expect(await screen.findByRole('menuitem', { name: 'Renombrar' })).toBeDefined()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renombrar' }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nuevo título' }), '{Enter}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    menu = await openMenu('Reglas de la casa')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Renombrar' }))
    const input = await screen.findByRole('textbox', { name: 'Nuevo título' })
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(api.calls).not.toContain('updatePage')
    expect(await item('Reglas de la casa')).toBeDefined()
  })

  it('duplicar hace una copia entera (icono, portada, panel y pestañas) justo debajo, y la abre', async () => {
    const api = wikiApi()
    await api.client.call('setPagePanel', {
      pageId: ids.people,
      blocks: [{ id: 'notasdeprueba', type: 'text', title: 'Notas', text: 'Hola' }]
    })
    await api.client.call('createPageTab', { pageId: ids.people, kind: 'map', name: 'Costa' })
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`, api)
    const menu = await openMenu('Personajes')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Duplicar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Personajes (copia)' })).toBeDefined()
    expect(await screen.findByText('«Personajes» duplicada')).toBeDefined()
    await waitFor(async () =>
      expect(await titles()).toEqual(['Lugares', 'Personajes', 'Personajes (copia)', 'Reglas de la casa'])
    )
    const copy = api.pages.find((p) => p.title === 'Personajes (copia)')
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${copy?.id}`)
    // De una vez, en el servidor
    expect(api.calls.filter((call) => call === 'copyPage')).toHaveLength(1)
    expect(api.calls).not.toContain('createPages')
    expect((await api.client.call('getPage', { pageId: copy?.id ?? '' })).panel).toHaveLength(1)
    expect((await api.client.call('listPageTabs', { pageId: copy?.id ?? '' })).tabs.map((t) => t.name)).toEqual([
      'Costa'
    ])
  })

  it('exportar descarga la página y cierra el menú', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Lugares')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Exportar' }))
    await waitFor(() => expect(api.calls).toContain('exportWiki'))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('mover a…: al pasar por encima sale el buscador; se filtra sin tildes y se lleva dentro de otra', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Reglas de la casa')
    await userEvent.hover(menu.getByRole('menuitem', { name: 'Mover a…' }))
    const flyout = within(await screen.findByRole('menu', { name: 'Mover a…' }))
    // Ni ella misma; en el primer nivel no sale «Al primer nivel»
    expect(await flyout.findByRole('menuitem', { name: 'Personajes' })).toBeDefined()
    expect(flyout.queryByRole('menuitem', { name: /Reglas de la casa/ })).toBeNull()
    expect(flyout.queryByRole('menuitem', { name: 'Al primer nivel' })).toBeNull()
    // Con su ruta debajo, si está dentro de otra
    expect(flyout.getByRole('menuitem', { name: 'Puerto Ceniza Lugares / Costa Gris' })).toBeDefined()
    await userEvent.type(flyout.getByRole('textbox', { name: 'Buscar una página' }), 'bahia')
    expect(flyout.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Bahía AzulLugares'])
    await userEvent.click(flyout.getByRole('menuitem', { name: /Bahía Azul/ }))
    expect(await screen.findByText('«Reglas de la casa» movida')).toBeDefined()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    // Al quitar el ratón, el desplegable se cierra
  })

  it('mover al primer nivel una subpágina', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.coast}`)
    const menu = await openMenu('Costa Gris')
    const opener = menu.getByRole('menuitem', { name: 'Mover a…' })
    await userEvent.hover(opener)
    const flyout = within(await screen.findByRole('menu', { name: 'Mover a…' }))
    // Su madre no sale: ya está ahí
    expect(flyout.queryByRole('menuitem', { name: 'Lugares' })).toBeNull()
    await userEvent.unhover(opener.parentElement as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Mover a…' })).toBeNull())
    await userEvent.click(opener)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Al primer nivel' }))
    expect(await screen.findByText('«Costa Gris» movida')).toBeDefined()
    await waitFor(async () => expect((await item('Costa Gris')).getAttribute('aria-level')).toBe('1'))
  })

  it('mover a…: su propia rama no sale (se metería en sí misma)', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Lugares')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Mover a…' }))
    const flyout = within(await screen.findByRole('menu', { name: 'Mover a…' }))
    await waitFor(() =>
      expect(flyout.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Personajes', 'Reglas de la casa'])
    )
  })

  it('si la de destino ya no está, el error sale en el menú, que sigue abierto', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Reglas de la casa')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Mover a…' }))
    const flyout = within(await screen.findByRole('menu', { name: 'Mover a…' }))
    const target = await flyout.findByRole('menuitem', { name: 'Personajes' })
    // Borrada desde otro sitio mientras el menú estaba abierto
    await api.client.call('deletePage', { pageId: ids.people })
    await userEvent.click(target)
    expect(await screen.findByText('Ya no existe')).toBeDefined()
    expect(screen.getByRole('menu', { name: 'Opciones de «Reglas de la casa»' })).toBeDefined()
  })

  it('ordenar subpáginas de la Z a la A y de la A a la Z', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.places}`)
    const arrow = (await item('Lugares')).querySelector('[data-toggle]')
    if (!arrow) throw new Error('sin flecha')
    await userEvent.click(arrow)
    await item('Costa Gris')
    let menu = await openMenu('Lugares')
    await userEvent.hover(menu.getByRole('menuitem', { name: 'Ordenar subpáginas' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'De la Z a la A' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(async () => expect((await titles()).slice(1, 3)).toEqual(['Costa Gris', 'Bahía Azul']))
    menu = await openMenu('Lugares')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Ordenar subpáginas' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'De la A a la Z' }))
    await waitFor(async () => expect((await titles()).slice(1, 3)).toEqual(['Bahía Azul', 'Costa Gris']))
    expect(api.calls.filter((c) => c === 'sortPageChildren')).toHaveLength(2)
  })

  it('una sin subpáginas no se ordena, y la portada del mundo no se mueve ni se borra', async () => {
    // Al entrar en el mundo se crea su portada
    renderAt(`/mundos/${WORLD.id}/wiki`)
    let menu = await openMenu('Reglas de la casa')
    expect(menu.queryByRole('menuitem', { name: 'Ordenar subpáginas' })).toBeNull()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    menu = await openMenu('Eana')
    expect(menu.getByRole('menuitem', { name: 'Renombrar' })).toBeDefined()
    expect(menu.queryByRole('menuitem', { name: 'Mover a…' })).toBeNull()
    expect(menu.queryByRole('menuitem', { name: 'Borrar' })).toBeNull()
  })

  it('con el teclado: las flechas recorren el menú; la derecha abre el desplegable y la izquierda lo cierra', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const row = await item('Lugares')
    row.focus()
    // Mayús+F10, como la tecla de menú
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Lugares»' }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Crear subpágina'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement?.textContent).toBe('Borrar')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('Renombrar')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    const opener = menu.getByRole('menuitem', { name: 'Mover a…' })
    expect(document.activeElement).toBe(opener)
    await userEvent.keyboard('{ArrowRight}')
    const search = await screen.findByRole('textbox', { name: 'Buscar una página' })
    await waitFor(() => expect(document.activeElement).toBe(search))
    expect(opener.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Buscar una página' })).toBeNull())
    expect(document.activeElement).toBe(opener)
    // Escape con el desplegable abierto lo cierra; otra vez, el menú, y el foco vuelve a la fila
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    const sortAsc = await screen.findByRole('menuitem', { name: 'De la A a la Z' })
    await waitFor(() => expect(document.activeElement).toBe(sortAsc))
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('De la Z a la A')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'De la A a la Z' })).toBeNull())
    // Al cerrar el desplegable, el foco vuelve a la opción que lo abrió
    expect(document.activeElement).toBe(menu.getByRole('menuitem', { name: 'Ordenar subpáginas' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(row)
  })

  it('la tecla de menú lo abre también, y un clic fuera lo cierra', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const row = await item('Personajes')
    row.focus()
    fireEvent.keyDown(row, { key: 'ContextMenu' })
    expect(await screen.findByRole('menu', { name: 'Opciones de «Personajes»' })).toBeDefined()
    await userEvent.click(screen.getByRole('heading', { level: 1, name: 'Reglas de la casa' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('borrar la página abierta del primer nivel vuelve a la portada del mundo', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Reglas de la casa')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}`))
    expect(await screen.findByText('«Reglas de la casa» está en la papelera')).toBeDefined()
  })

  it('borrar otra que no está abierta no cambia de página', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const menu = await openMenu('Personajes')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: /Personajes/ })).toBeNull())
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
  })
})

describe('recolocar en el árbol arrastrando', () => {
  // happy-dom no tiene DragEvent (fireEvent no pondría las coordenadas): un MouseEvent con su dataTransfer. Tampoco
  // mide: cada fila mide 0, así que la altura cuenta como 1 y clientY va de 0 (arriba) a 1 (abajo)
  const drag = (type: string, target: Element, clientX = 100, clientY = 0.5) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY })
    Object.defineProperty(event, 'dataTransfer', {
      value: { effectAllowed: 'none', setData: () => {}, getData: () => '' }
    })
    fireEvent(target, event)
  }

  it('soltar en medio de otra la mete dentro; al pasar, la fila lo marca', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const rules = await item('Reglas de la casa')
    const people = await item('Personajes')
    drag('dragstart', rules, 100, 0.5)
    drag('dragover', people, 100, 0.5)
    expect(people.getAttribute('data-drop')).toBe('inside')
    drag('dragover', people, 100, 0)
    expect(people.getAttribute('data-drop')).toBe('before')
    drag('dragleave', people)
    expect(people.hasAttribute('data-drop')).toBe(false)
    drag('dragover', people, 100, 0.5)
    drag('drop', people, 100, 0.5)
    expect(await screen.findByText('«Reglas de la casa» va ahora dentro de «Personajes»')).toBeDefined()
    expect(api.calls).toContain('movePage')
    await waitFor(async () => expect((await item('Reglas de la casa')).getAttribute('aria-level')).toBe('2'))
  })

  it('soltar en el borde de abajo la pone detrás, entre hermanas', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.rules}`)
    const places = await item('Lugares')
    drag('dragstart', places, 100, 0.5)
    const rules = await item('Reglas de la casa')
    drag('dragover', rules, 100, 1)
    expect(rules.getAttribute('data-drop')).toBe('after')
    drag('drop', rules, 100, 1)
    await waitFor(async () => expect(await titles()).toEqual(['Personajes', 'Reglas de la casa', 'Lugares']))
    drag('dragend', places)
  })

  it('no se puede soltar dentro de sí misma ni de sus subpáginas: no marca nada', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const places = await item('Lugares')
    const coast = await item('Costa Gris')
    drag('dragstart', places, 100, 0.5)
    drag('dragover', coast, 100, 0.5)
    expect(coast.hasAttribute('data-drop')).toBe(false)
    // Sobre su propia fila, sin llevarla a la izquierda, tampoco
    drag('dragover', places, 100, 0.5)
    expect(places.hasAttribute('data-drop')).toBe(false)
    drag('drop', places, 100, 0.5)
    drag('dragend', places)
    expect(api.calls).not.toContain('movePage')
  })

  it('llevarla a la izquierda la saca de su madre: sobre su fila, o detrás de la última de la rama', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const port = await item('Puerto Ceniza')
    // Un paso a la izquierda sobre su propia fila: detrás de su madre
    drag('dragstart', port, 200, 0.5)
    drag('dragover', port, 170, 0.5)
    expect(port.getAttribute('data-drop')).toBe('after')
    expect(port.hasAttribute('data-outdent')).toBe(true)
    drag('drop', port, 170, 0.5)
    expect(await screen.findByText('«Puerto Ceniza» va ahora dentro de «Lugares»')).toBeDefined()
    await waitFor(async () => expect((await item('Puerto Ceniza')).getAttribute('aria-level')).toBe('2'))

    // Otra, soltada detrás de la última de la rama y llevada dos pasos a la izquierda: al primer nivel
    const rules = await item('Reglas de la casa')
    const last = await item('Bahía Azul')
    drag('dragstart', rules, 200, 0.5)
    drag('dragover', last, 150, 1)
    expect(last.hasAttribute('data-outdent')).toBe(true)
    drag('drop', last, 150, 1)
    await waitFor(async () =>
      expect(await titles()).toEqual([
        'Lugares',
        'Costa Gris',
        'Puerto Ceniza',
        'Bahía Azul',
        'Reglas de la casa',
        'Personajes'
      ])
    )
  })
})
