import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

/** La pantalla con una carpeta «Gente» (con PNJ dentro) y otra «Lugares» vacía */
async function renderWithFolders() {
  const api = fakeApi({ organizations: [ORG], worlds: [] })
  const people = await api.client.call('createTemplateFolder', { name: 'Gente' })
  const places = await api.client.call('createTemplateFolder', { name: 'Lugares' })
  const { templates } = await api.client.call('listTemplates', {})
  const id = (name: string) => templates.find((each) => each.name === name)?.id ?? ''
  await api.client.call('moveTemplate', { templateId: id('PNJ'), folderId: people.id })
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/plantillas'] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const list = within(await screen.findByRole('list', { name: 'Tus plantillas' }))
  await list.findByRole('button', { name: 'Gente' })
  return { api, router, list, people, places, id }
}

const listed = async (api: ReturnType<typeof fakeApi>) => api.client.call('listTemplates', {})
const rowOf = (element: HTMLElement) => element.closest('[data-file-card]') as HTMLElement
/** Un arrastre con su transferencia de datos (happy-dom no la trae) */
const transfer = () => ({ dataTransfer: { setData: () => undefined, effectAllowed: '', dropEffect: '' } })

describe('las carpetas de «Plantillas»', () => {
  // Su tutorial guiado ya visto: si no, sale y se lleva el foco
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas', 'plantilla'] }))
  )

  it('buscar por nombre, sin tildes, enseña lo encontrado dentro de su carpeta, abierta, y dónde está', async () => {
    const { list } = await renderWithFolders()
    expect(list.queryByRole('link', { name: 'PNJ' })).toBeNull()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar plantilla' }), 'pnj')
    const found = await list.findByRole('link', { name: 'PNJ' })
    expect(list.getByRole('button', { name: 'Gente' })).toBeDefined()
    expect(list.queryByRole('button', { name: 'Lugares' })).toBeNull()
    expect(list.queryByRole('link', { name: 'Lugar' })).toBeNull()
    expect(rowOf(found).textContent).toContain('Gente')
    // Una con tilde, sin escribirla
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar plantilla' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar plantilla' }), 'faccion')
    expect(await list.findByRole('link', { name: 'Facción' })).toBeDefined()
    expect(list.queryByRole('button', { name: 'Gente' })).toBeNull()
  })

  it('la ventana de una carpeta: renombrarla, deshacer lo escrito y meterla en otra', async () => {
    const { api, list, places } = await renderWithFolders()
    await userEvent.click(list.getByRole('button', { name: 'Ajustes de Gente' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Gente' }))
    // Cancelar devuelve lo escrito como estaba
    await userEvent.type(dialog.getByLabelText('Nombre'), ' mala')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(dialog.getByLabelText('Nombre')).toHaveProperty('value', 'Gente')
    await userEvent.clear(dialog.getByLabelText('Nombre'))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Personas')
    await userEvent.selectOptions(dialog.getByLabelText('Carpeta'), 'Lugares')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const folder = (await listed(api)).folders.find((each) => each.name === 'Personas')
      expect(folder?.parentId).toBe(places.id)
    })
    // Se abre el camino para verla dentro
    expect(await list.findByRole('button', { name: 'Personas' })).toBeDefined()
    expect(list.getByRole('button', { name: 'Lugares' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('borrar una carpeta desde su ventana se lleva sus plantillas', async () => {
    const { api, list } = await renderWithFolders()
    await userEvent.click(list.getByRole('button', { name: 'Ajustes de Gente' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ajustes de Gente' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Borrar la carpeta' }))
    const confirm = within(screen.getByRole('dialog', { name: '¿Borrar la carpeta Gente?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar la carpeta' }))
    await waitFor(() => expect(list.queryByRole('button', { name: 'Gente' })).toBeNull())
    const after = await listed(api)
    expect(after.templates.map((each) => each.name)).not.toContain('PNJ')
    expect(after.folders.map((each) => each.name)).toEqual(['Lugares'])
  })

  it('con el teclado: recorrer con las flechas, abrir y cerrar carpetas, y meter y sacar con Alt', async () => {
    const { api, list, places, id } = await renderWithFolders()
    const gente = rowOf(list.getByRole('button', { name: 'Gente' }))
    gente.focus()
    // Derecha abre; Intro cierra; Inicio y Fin van a la primera y a la última fila
    await userEvent.keyboard('{ArrowRight}')
    expect(await list.findByRole('link', { name: 'PNJ' })).toBeDefined()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(list.queryByRole('link', { name: 'PNJ' })).toBeNull())
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(rowOf(list.getByRole('link', { name: 'Sesión' })))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(gente)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rowOf(list.getByRole('button', { name: 'Lugares' })))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(gente)

    // Alt y derecha: una plantilla suelta entra en la última carpeta de encima (Lugares)
    rowOf(list.getByRole('link', { name: 'Lugar' })).focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.id === id('Lugar'))?.folderId).toBe(places.id)
    )
    await waitFor(() => expect(document.activeElement).toBe(rowOf(list.getByRole('link', { name: 'Lugar' }))))
    // Izquierda vuelve a la carpeta; Alt e izquierda la saca
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(rowOf(list.getByRole('button', { name: 'Lugares' })))
    rowOf(list.getByRole('link', { name: 'Lugar' })).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.id === id('Lugar'))?.folderId).toBeNull()
    )
  })

  it('con el teclado, una carpeta entra en la de encima y sale detrás de ella', async () => {
    const { api, list, people, places } = await renderWithFolders()
    rowOf(list.getByRole('button', { name: 'Lugares' })).focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(async () =>
      expect((await listed(api)).folders.find((each) => each.id === places.id)?.parentId).toBe(people.id)
    )
    await waitFor(() => expect(document.activeElement).toBe(rowOf(list.getByRole('button', { name: 'Lugares' }))))
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () =>
      expect((await listed(api)).folders.find((each) => each.id === places.id)?.parentId).toBeNull()
    )
    // Gente quedó abierta al meterla: izquierda la cierra y derecha la abre
    const gente = rowOf(list.getByRole('button', { name: 'Gente' }))
    gente.focus()
    expect(list.getByRole('button', { name: 'Gente' }).getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{ArrowLeft}')
    expect(list.getByRole('button', { name: 'Gente' }).getAttribute('aria-expanded')).toBe('false')
    await userEvent.keyboard('{ArrowRight}')
    expect(list.getByRole('button', { name: 'Gente' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('arrastrar una plantilla al centro de una carpeta la mete dentro', async () => {
    const { api, list, places, id } = await renderWithFolders()
    const lugar = rowOf(list.getByRole('link', { name: 'Lugar' }))
    const target = rowOf(list.getByRole('button', { name: 'Lugares' }))
    fireEvent.dragStart(lugar, transfer())
    // Sin medidas (happy-dom), la altura cuenta como 1: a media altura, dentro
    fireEvent.dragEnter(target, { ...transfer(), clientY: 0.5 })
    fireEvent.dragOver(target, { ...transfer(), clientY: 0.5 })
    expect(target.getAttribute('data-drop')).toBe('inside')
    fireEvent.drop(target, { ...transfer(), clientY: 0.5 })
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.id === id('Lugar'))?.folderId).toBe(places.id)
    )
    expect(await list.findByRole('link', { name: 'Lugar' })).toBeDefined()
  })

  it('arrastrar una carpeta dentro de sí misma no se deja', async () => {
    const { api, list, people } = await renderWithFolders()
    const gente = rowOf(list.getByRole('button', { name: 'Gente' }))
    fireEvent.dragStart(gente, transfer())
    fireEvent.dragOver(gente, { ...transfer(), clientY: 0.5 })
    expect(gente.getAttribute('data-drop')).toBeNull()
    fireEvent.drop(gente, { ...transfer(), clientY: 0.5 })
    fireEvent.dragLeave(gente, transfer())
    fireEvent.dragEnd(gente, transfer())
    expect((await listed(api)).folders.find((each) => each.id === people.id)?.parentId).toBeNull()
  })

  it('desde una carpeta: plantilla nueva y carpeta nueva dentro', async () => {
    const { api, list, people } = await renderWithFolders()
    await userEvent.click(list.getByRole('button', { name: 'Nueva carpeta en Gente' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Nueva carpeta en Gente' }))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Nobles{Enter}')
    await waitFor(async () =>
      expect((await listed(api)).folders.find((each) => each.name === 'Nobles')?.parentId).toBe(people.id)
    )
    await userEvent.click(list.getByRole('button', { name: 'Plantilla nueva en Gente' }))
    const creating = within(await screen.findByRole('dialog', { name: 'Plantilla nueva' }))
    await userEvent.type(creating.getByRole('textbox', { name: 'Nombre' }), 'Noble')
    await userEvent.click(creating.getByRole('button', { name: 'Crear' }))
    await waitFor(async () =>
      expect((await listed(api)).templates.find((each) => each.name === 'Noble')?.folderId).toBe(people.id)
    )
  })
})
