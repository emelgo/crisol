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

  it('con el teclado, como el árbol de páginas: flechas para moverse y Alt + flechas para recolocarla', async () => {
    const api = tagsApi()
    await api.client.call('createTag', { name: 'pnj' })
    renderAt('/etiquetas', api)
    await screen.findByRole('button', { name: 'Ajustes de pnj' })
    const row = (name: string) =>
      screen.getByRole('button', { name: `Ajustes de ${name}` }).closest('li') as HTMLElement
    const names = () =>
      screen
        .getAllByRole('button', { name: /^Ajustes de / })
        .map((button) => button.getAttribute('aria-label')?.replace('Ajustes de ', ''))
    // Una sola parada del tabulador en la lista: la primera fila
    expect(row('lugar').tabIndex).toBe(0)
    expect(row('pnj').tabIndex).toBe(-1)
    row('lugar').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(row('lugar/ciudad'))
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(row('pnj'))
    expect(row('pnj').tabIndex).toBe(0)
    // Alt + arriba: delante de su hermana de encima; el foco va con ella
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    await waitFor(() => expect(names()).toEqual(['pnj', 'lugar', 'lugar/ciudad']))
    await waitFor(() => expect(document.activeElement).toBe(row('pnj')))
    // Alt + abajo: detrás de la de debajo
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await waitFor(() => expect(names()).toEqual(['lugar', 'lugar/ciudad', 'pnj']))
    // Alt + derecha: dentro de la de encima (al final), con su nombre nuevo
    await waitFor(() => expect(document.activeElement).toBe(row('pnj')))
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(() => expect(names()).toEqual(['lugar', 'lugar/ciudad', 'lugar/pnj']))
    await waitFor(() => expect(document.activeElement).toBe(row('lugar/pnj')))
    // Alt + izquierda: fuera de su madre, detrás de ella
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(() => expect(names()).toEqual(['lugar', 'lugar/ciudad', 'pnj']))
    await waitFor(() => expect(document.activeElement).toBe(row('pnj')))
    expect(await api.client.call('listAccountTags', {})).toMatchObject({
      tags: [{ name: 'lugar' }, { name: 'lugar/ciudad' }, { name: 'pnj' }]
    })
  })

  it('como las carpetas: su flecha (o derecha e izquierda) pliega y despliega sus hijas; pulsar la fila abre su ventana', async () => {
    renderAt('/etiquetas')
    await screen.findByRole('button', { name: 'Ajustes de lugar/ciudad' })
    const row = (name: string) =>
      screen.getByRole('button', { name: `Ajustes de ${name}` }).closest('li') as HTMLElement
    // Con la flecha: plegada, su hija no se ve
    await userEvent.click(screen.getByRole('button', { name: 'Plegar lugar' }))
    expect(screen.queryByRole('button', { name: 'Ajustes de lugar/ciudad' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar lugar' }))
    expect(screen.getByRole('button', { name: 'Ajustes de lugar/ciudad' })).toBeDefined()
    // Con el teclado: izquierda la pliega; derecha la despliega y, otra vez, baja a su hija; desde ella, izquierda sube
    row('lugar').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.queryByRole('button', { name: 'Ajustes de lugar/ciudad' })).toBeNull()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(row('lugar/ciudad'))
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(row('lugar'))
    // Intro (o pulsar su nombre) abre su ventana
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes de lugar' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajustes de lugar' })).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'ciudad' }))
    expect(await screen.findByRole('dialog', { name: 'Ajustes de lugar/ciudad' })).toBeDefined()
  })

  it('al pasar el ratón sale su vista previa, y al irse se quita', async () => {
    renderAt('/etiquetas')
    const row = (await screen.findByRole('button', { name: 'Ajustes de lugar' })).closest('li') as HTMLElement
    fireEvent.pointerEnter(row)
    const preview = await screen.findByRole('complementary', { name: 'Etiqueta elegida' })
    expect(within(preview).getByRole('heading', { name: 'lugar' })).toBeDefined()
    fireEvent.pointerLeave(row)
    await waitFor(() => expect(within(preview).queryByRole('heading')).toBeNull())
  })

  it('en los archivos: se ponen desde su ventana y se filtra por ellas', async () => {
    renderAt(`/mundos/${WORLD.id}/archivos`)
    const list = within((await screen.findAllByRole('list', { name: 'Archivos' }))[0] ?? document.body)
    await userEvent.click(await list.findByRole('button', { name: 'Ajustes de Bestiario.pdf' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes de Bestiario.pdf' })
    await userEvent.type(within(dialog).getByLabelText('Etiquetas'), 'lugar/costa{Enter}')
    expect(await within(dialog).findByRole('button', { name: 'Quitar lugar/costa' })).toBeDefined()
    // Con «Guardar», como el nombre y la carpeta
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Guardar' })).toBeNull())
    await userEvent.keyboard('{Escape}')

    // Buscar «#lugar» trae las dos (la madre y la hija); «#lugar/costa», solo el bestiario (como en las páginas)
    const search = screen.getAllByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })[0] as HTMLElement
    await userEvent.type(search, '#lugar')
    await waitFor(() => expect(list.getByRole('link', { name: 'Bestiario.pdf' })).toBeDefined())
    expect(list.getByRole('button', { name: 'Mapa.png' })).toBeDefined()
    await userEvent.type(search, '/costa')
    await waitFor(() => expect(list.queryByRole('button', { name: 'Mapa.png' })).toBeNull())
    expect(list.getByRole('link', { name: 'Bestiario.pdf' })).toBeDefined()
  })
})
