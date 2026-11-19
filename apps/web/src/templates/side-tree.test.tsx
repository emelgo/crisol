import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

/** El editor de «Frente» (dentro de «Gente») con el árbol de la izquierda */
async function renderSideTree() {
  const api = fakeApi({ organizations: [ORG], worlds: [] })
  const people = await api.client.call('createTemplateFolder', { name: 'Gente' })
  const places = await api.client.call('createTemplateFolder', { name: 'Lugares' })
  const own = await api.client.call('createTemplate', { name: 'Frente', icon: 'hourglass', folderId: people.id })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/plantillas/${own.id}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const side = within(await screen.findByRole('complementary', { name: 'Tus plantillas' }))
  await side.findByRole('link', { name: 'Frente' })
  return { api, router, own, people, places, side }
}

const listed = async (api: ReturnType<typeof fakeApi>) => api.client.call('listTemplates', {})

describe('el árbol de «Tus plantillas» en el editor', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas', 'plantilla'] }))
  )

  it('con el teclado: Mayús+F10 abre el menú, las flechas lo recorren y Escape lo cierra devolviendo el foco', async () => {
    const { side } = await renderSideTree()
    const link = side.getByRole('link', { name: 'Frente' })
    link.focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    const menu = await screen.findByRole('menu', { name: 'Opciones de «Frente»' })
    const items = within(menu).getAllByRole('menuitem')
    // Sin «Ajustes»: su icono va en su título (Enrique, 2026-11-19)
    expect(items.map((item) => item.textContent)).toEqual(['Renombrar', 'Duplicar', 'Mover a…', 'Borrar'])
    items[0]?.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[1])
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(items[3])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[0])
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(items[3])
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(items[0])
    // Escape en el aviso de borrar vuelve al menú; otra vez, lo cierra
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Borrar' }))
    expect(within(menu).getByText(/¿Borrar la plantilla Frente\?/)).toBeDefined()
    within(menu).getByRole('menuitem', { name: 'Borrar la plantilla' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(within(menu).getByRole('menuitem', { name: 'Renombrar' })).toBeDefined()
    within(menu).getByRole('menuitem', { name: 'Duplicar' }).focus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(link)
  })

  it('la tecla de menú en una carpeta, y Tab lo cierra', async () => {
    const { side } = await renderSideTree()
    const folder = side.getByRole('button', { name: 'Gente' })
    folder.focus()
    await userEvent.keyboard('{ContextMenu}')
    const menu = await screen.findByRole('menu', { name: 'Opciones de «Gente»' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Plantilla nueva aquí', 'Carpeta dentro', 'Ajustes de la carpeta', 'Borrar'])
    within(menu).getAllByRole('menuitem')[0]?.focus()
    await userEvent.keyboard('{Tab}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(folder)
  })

  it('«Duplicar» desde el menú hace una copia', async () => {
    const { api, side } = await renderSideTree()
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('link', { name: 'Frente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Frente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Duplicar' }))
    await waitFor(async () =>
      expect((await listed(api)).templates.map((each) => each.name)).toContain('Frente (copia)')
    )
  })

  it('«Mover a…» desde el menú la cambia de carpeta (con el teclado, la flecha derecha abre las carpetas)', async () => {
    const { api, own, places, side } = await renderSideTree()
    side.getByRole('link', { name: 'Frente' }).focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Frente»' }))
    menu.getByRole('menuitem', { name: 'Mover a…' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    const folders = within(await screen.findByRole('menu', { name: 'Mover a…' }))
    // Su carpeta no sale; sí salir de las carpetas
    await waitFor(() =>
      expect(document.activeElement).toBe(folders.getByRole('textbox', { name: 'Buscar una carpeta' }))
    )
    expect(folders.queryByRole('menuitem', { name: 'Gente' })).toBeNull()
    expect(folders.getByRole('menuitem', { name: 'Fuera de las carpetas' })).toBeDefined()
    await userEvent.type(folders.getByRole('textbox', { name: 'Buscar una carpeta' }), 'lug')
    await userEvent.click(folders.getByRole('menuitem', { name: 'Lugares' }))
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.id === own.id)?.folderId).toBe(places.id)
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('«Renombrar» no abre un cuadro: pone en edición el título de su página (abriéndola si no lo está)', async () => {
    const { api, own, router, side } = await renderSideTree()
    // Otra (sale en el árbol al refrescarse la lista, tras renombrar la abierta)
    const other = await api.client.call('createTemplate', { name: 'Taberna' })
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('link', { name: 'Frente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Frente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Renombrar' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Nuevo nombre' })).toBeNull()
    const title = screen.getByRole('textbox', { name: 'Título de la página' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    expect(getSelection()?.toString()).toBe('Frente')
    await userEvent.keyboard('Frente de guerra{Enter}')
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.id === own.id)?.name).toBe('Frente de guerra')
    )
    await side.findByRole('link', { name: 'Frente de guerra' })
    // Otra, sin abrir: se abre con su título ya en edición
    await userEvent.pointer({ keys: '[MouseRight]', target: await side.findByRole('link', { name: 'Taberna' }) })
    const again = within(await screen.findByRole('menu', { name: 'Opciones de «Taberna»' }))
    await userEvent.click(again.getByRole('menuitem', { name: 'Renombrar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/plantillas/${other.id}`))
    await waitFor(() => {
      const opened = screen.getByRole('textbox', { name: 'Título de la página' })
      expect(opened.textContent).toBe('Taberna')
      expect(document.activeElement).toBe(opened)
    })
  })

  it('los ajustes de una carpeta desde el menú la meten en otra', async () => {
    const { api, people, places, side } = await renderSideTree()
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('button', { name: 'Lugares' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Lugares»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Ajustes de la carpeta' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Lugares' }))
    await userEvent.selectOptions(dialog.getByLabelText('Carpeta'), 'Gente')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () =>
      expect((await listed(api)).folders.find((each) => each.id === places.id)?.parentId).toBe(people.id)
    )
  })

  it('una carpeta dentro de otra desde el menú, y en el hueco, una carpeta nueva arriba', async () => {
    const { api, people, side } = await renderSideTree()
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('button', { name: 'Gente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Gente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Carpeta dentro' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva carpeta en Gente' }))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Nobles{Enter}')
    await waitFor(async () =>
      expect((await listed(api)).folders.find((each) => each.name === 'Nobles')?.parentId).toBe(people.id)
    )
    // El hueco: lo de crear en lo más alto
    const tree = side.getByRole('link', { name: 'Frente' }).closest('ul')?.parentElement as HTMLElement
    await userEvent.pointer({ keys: '[MouseRight]', target: tree })
    const empty = within(await screen.findByRole('menu', { name: 'Tus plantillas' }))
    expect(empty.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Plantilla nueva', 'Nueva carpeta'])
  })

  it('borrar la carpeta que tiene la abierta lleva a la lista', async () => {
    const { api, router, people, side } = await renderSideTree()
    await userEvent.pointer({ keys: '[MouseRight]', target: side.getByRole('button', { name: 'Gente' }) })
    const menu = within(await screen.findByRole('menu', { name: 'Opciones de «Gente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Borrar la carpeta' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantillas'))
    expect((await listed(api)).folders.map((each) => each.id)).not.toContain(people.id)
  })
})
