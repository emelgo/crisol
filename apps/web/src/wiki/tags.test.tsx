import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const tagsApi = () =>
  fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      {
        worldId: WORLD.id,
        title: 'Puerto Ceniza',
        properties: [{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] }]
      }
    ],
    files: [
      { worldId: WORLD.id, name: 'Mapa.png', kind: 'image', tags: ['lugar'] },
      { worldId: WORLD.id, name: 'Bestiario.pdf', kind: 'pdf', mime: 'application/pdf' }
    ]
  })

const renderAt = (path: string, api = tagsApi()) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

/** Las filas del catálogo, con su texto (sin la última, la de «Nueva etiqueta») */
const rows = () =>
  [...screen.getByRole('list', { name: 'Etiquetas' }).querySelectorAll(':scope > li')]
    .map((li) => li.textContent)
    .filter((text) => text !== 'Nueva etiqueta')

beforeEach(() =>
  localStorage.setItem(
    'crisol.recorridos.enrique@crisol.test',
    JSON.stringify({ seen: ['mundos', 'mundo', 'archivos', 'etiquetas'] })
  )
)

describe('las etiquetas de la cuenta', () => {
  it('desde Mis mundos se llega; junta las de las páginas y los archivos, y se crean con color', async () => {
    renderAt('/mundos')
    await userEvent.click(await screen.findByRole('link', { name: 'Etiquetas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Etiquetas' })).toBeDefined()
    await waitFor(() => expect(rows()).toEqual(['lugar1 página · 1 archivo', 'ciudad1 página']))

    // «Nueva etiqueta», una fila más al final de la lista (no un botón arriba)
    const last = screen.getByRole('list', { name: 'Etiquetas' }).querySelector(':scope > li:last-child') as HTMLElement
    await userEvent.click(within(last).getByRole('button', { name: 'Nueva etiqueta' }))
    const create = await screen.findByRole('dialog', { name: 'Nueva etiqueta' })
    await userEvent.type(within(create).getByLabelText('Nombre de la etiqueta'), 'facción')
    await userEvent.click(within(create).getByRole('radio', { name: 'Vino' }))
    await userEvent.click(within(create).getByRole('button', { name: 'Crear la etiqueta' }))
    await waitFor(() => expect(rows()).toContain('facciónSin usar'))
  })

  it('la primera vez sale su guía', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundos'] }))
    renderAt('/etiquetas')
    expect(await screen.findByText('Crea etiquetas.', {}, { timeout: 3000 })).toBeDefined()
  })

  it('renombrar desde su engranaje cambia también sus hijas', async () => {
    renderAt('/etiquetas')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de lugar' }))
    const settings = await screen.findByRole('dialog', { name: 'Ajustes de lugar' })
    const name = within(settings).getByLabelText('Nombre de la etiqueta')
    await userEvent.clear(name)
    await userEvent.type(name, 'sitio')
    await userEvent.click(within(settings).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(rows()).toEqual(['sitio1 página · 1 archivo', 'ciudad1 página']))
  })

  it('se crea dentro de otra eligiendo dónde va, y se cambia de sitio desde su engranaje', async () => {
    renderAt('/etiquetas')
    const list = await screen.findByRole('list', { name: 'Etiquetas' })
    await userEvent.click(within(list).getByRole('button', { name: 'Nueva etiqueta' }))
    const create = await screen.findByRole('dialog', { name: 'Nueva etiqueta' })
    // Sin «/» en el nombre: dónde va se elige en «Dentro de»
    await userEvent.type(within(create).getByLabelText('Nombre de la etiqueta'), 'puerto/viejo')
    expect((within(create).getByLabelText('Nombre de la etiqueta') as HTMLInputElement).value).toBe('puertoviejo')
    await userEvent.selectOptions(within(create).getByLabelText('Dentro de'), 'lugar')
    await userEvent.click(within(create).getByRole('button', { name: 'Crear la etiqueta' }))
    expect(await screen.findByRole('button', { name: 'Ajustes de lugar/puertoviejo' })).toBeDefined()

    // A lo más alto, desde su ventana (sin ella misma ni sus hijas entre las opciones)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes de lugar/ciudad' }))
    const settings = await screen.findByRole('dialog', { name: 'Ajustes de lugar/ciudad' })
    const where = within(settings).getByLabelText('Dentro de') as HTMLSelectElement
    expect([...where.options].map((option) => option.value)).not.toContain('lugar/ciudad')
    await userEvent.selectOptions(where, '')
    await userEvent.click(within(settings).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('button', { name: 'Ajustes de ciudad' })).toBeDefined()
  })

  it('se arrastran como las páginas: una raya delante o detrás para ordenarlas, la fila resaltada para meterla dentro', async () => {
    const api = tagsApi()
    await api.client.call('createTag', { name: 'pnj' })
    renderAt('/etiquetas', api)
    await screen.findByRole('button', { name: 'Ajustes de pnj' })
    const row = (name: string) =>
      screen.getByRole('button', { name: `Ajustes de ${name}` }).closest('li') as HTMLElement
    // Cada fila mide 100 de alto (jsdom no mide): arriba del todo, delante; abajo, detrás; en medio, dentro
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 0, height: 100, left: 0, width: 400, bottom: 100, right: 400, x: 0, y: 0 } as DOMRect)
    const dataTransfer = { setData: () => {}, effectAllowed: '' }
    const at = (target: HTMLElement, type: 'dragOver' | 'drop', y: number) => {
      const event = createEvent[type](target, { dataTransfer })
      Object.defineProperty(event, 'clientY', { value: y })
      Object.defineProperty(event, 'clientX', { value: 200 })
      fireEvent(target, event)
    }
    const drag = (from: string, to: string, y: number) => {
      fireEvent.dragStart(row(from), { dataTransfer, clientX: 200 })
      at(row(to), 'dragOver', y)
      at(row(to), 'drop', y)
    }
    expect(rows()).toEqual(['lugar1 página · 1 archivo', 'ciudad1 página', 'pnjSin usar'])

    // pnj, por encima de lugar: la raya, delante; al soltar, ahí queda
    fireEvent.dragStart(row('pnj'), { dataTransfer, clientX: 200 })
    at(row('lugar'), 'dragOver', 10)
    expect(row('lugar').dataset.drop).toBe('before')
    at(row('lugar'), 'drop', 10)
    await waitFor(() => expect(rows()[0]).toContain('pnj'))
    // ciudad, por debajo de pnj (que está arriba del todo): sale de lugar y queda detrás de pnj
    drag('lugar/ciudad', 'pnj', 90)
    await waitFor(() => expect(rows().map((text) => text?.split(/\d|Sin/)[0])).toEqual(['pnj', 'ciudad', 'lugar']))
    // Y en medio de lugar: dentro, con la fila resaltada
    fireEvent.dragStart(row('ciudad'), { dataTransfer, clientX: 200 })
    at(row('lugar'), 'dragOver', 50)
    expect(row('lugar').dataset.drop).toBe('inside')
    at(row('lugar'), 'drop', 50)
    expect(await screen.findByRole('button', { name: 'Ajustes de lugar/ciudad' })).toBeDefined()
    box.mockRestore()
  })

  it('en los archivos: se ponen desde su ventana y se filtra por ellas', async () => {
    renderAt(`/mundos/${WORLD.id}/archivos`)
    const list = within((await screen.findAllByRole('list', { name: 'Archivos' }))[0] ?? document.body)
    await userEvent.click(await list.findByRole('button', { name: 'Ajustes de Bestiario.pdf' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes de Bestiario.pdf' })
    await userEvent.type(within(dialog).getByLabelText('Etiquetas'), 'lugar/costa{Enter}')
    expect(await within(dialog).findByRole('button', { name: 'Quitar lugar/costa' })).toBeDefined()
    await userEvent.keyboard('{Escape}')

    // Filtrar por «lugar» trae las dos (la madre y la hija); por «costa», solo el bestiario
    const filter = screen.getAllByRole('combobox', { name: 'Etiqueta' })[0] as HTMLSelectElement
    await userEvent.selectOptions(filter, 'lugar')
    await waitFor(() => expect(list.getByRole('link', { name: 'Bestiario.pdf' })).toBeDefined())
    expect(list.getByRole('button', { name: 'Mapa.png' })).toBeDefined()
    await userEvent.selectOptions(filter, 'lugar/costa')
    await waitFor(() => expect(list.queryByRole('button', { name: 'Mapa.png' })).toBeNull())
    expect(list.getByRole('link', { name: 'Bestiario.pdf' })).toBeDefined()
  })
})
