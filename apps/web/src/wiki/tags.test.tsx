import type { World } from '@crisol/contracts'
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

/** Las filas del catálogo, con su texto */
const rows = () =>
  [...screen.getByRole('list', { name: 'Etiquetas' }).querySelectorAll(':scope > li')].map((li) => li.textContent)

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

    await userEvent.click(screen.getByRole('button', { name: 'Nueva etiqueta' }))
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
