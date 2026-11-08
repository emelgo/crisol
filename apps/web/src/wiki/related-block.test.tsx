import type { PageProperty, PanelBlock, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// El tutorial del mundo, ya visto (si no, sale y se lleva el foco)
beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))

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
const RAQISA = crypto.randomUUID()
const CITY = crypto.randomUUID()

const member = (faction: string, rol: string, estado: string): PageProperty[] => [
  { name: 'Rol', field: 'rol', type: 'text', value: rol },
  { name: 'Facción', field: 'faccion', type: 'pages', single: true, targets: ['faccion'], value: [faction] },
  { name: 'Lugar', field: 'lugar', type: 'pages', single: true, targets: ['lugar'], value: [CITY] },
  { name: 'Estado', field: 'estado', type: 'choice', value: estado, options: ['Vive', 'Ha muerto'] }
]
const MEMBERS: PanelBlock = {
  id: 'miembros',
  type: 'related',
  title: 'Miembros',
  template: 'pnj',
  field: 'faccion',
  columns: ['rol', 'estado'],
  sort: 'title'
}

/** La Raqisa, con su tabla de miembros, y sus PNJ (uno de otra facción) */
async function renderRaqisa(panel: PanelBlock[] = [MEMBERS]) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: RAQISA, worldId: WORLD.id, title: 'La Raqisa', template: 'faccion' },
      { id: CITY, worldId: WORLD.id, title: 'Ciudad Libre', template: 'lugar' },
      { worldId: WORLD.id, title: 'Mamá Gris', template: 'pnj', properties: member(RAQISA, 'Jefa', 'Vive') },
      { worldId: WORLD.id, title: 'Tarrin Seda', template: 'pnj', properties: member(RAQISA, 'Contable', 'Ha muerto') },
      { worldId: WORLD.id, title: 'Lord Vellard', template: 'pnj', properties: member(CITY, 'Señor', 'Vive') }
    ]
  })
  await api.client.call('setPagePanel', { pageId: RAQISA, blocks: panel })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${RAQISA}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const saved = async () => (await api.client.call('getPage', { pageId: RAQISA })).panel
  return { api, saved }
}

const panel = async () => within(await screen.findByRole('complementary', { name: 'Panel de la página' }))

describe('«Tabla de páginas» en el panel', () => {
  it('«Miembros» enseña los PNJ de la facción, con sus columnas y enlaces a ellos', async () => {
    await renderRaqisa()
    const members = within((await panel()).getByRole('region', { name: 'Miembros' }))
    const table = within(await members.findByRole('table'))
    expect(table.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Página', 'Rol', 'Estado'])
    const rows = table.getAllByRole('row').slice(1)
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((td) => td.textContent)
      )
    ).toEqual([
      ['Mamá Gris', 'Jefa', 'Vive'],
      ['Tarrin Seda', 'Contable', 'Ha muerto']
    ])
    expect(table.getByRole('link', { name: 'Mamá Gris' })).toBeDefined()
  })

  it('una columna de enlace enseña el título de la página', async () => {
    await renderRaqisa([{ ...MEMBERS, columns: ['lugar'] }])
    const members = within((await panel()).getByRole('region', { name: 'Miembros' }))
    expect(await members.findAllByText('Ciudad Libre')).toHaveLength(2)
  })

  it('sin páginas que la apunten, una línea; con su campo fuera de la plantilla, lo dice y lleva a sus opciones', async () => {
    await renderRaqisa([
      { ...MEMBERS, id: 'vacia01', title: 'Habitantes', field: 'lugar' },
      { ...MEMBERS, id: 'rota001', title: 'Rota', field: 'frentes', columns: [] }
    ])
    const inside = await panel()
    expect(
      await within(inside.getByRole('region', { name: 'Habitantes' })).findByText('Ninguna página todavía.')
    ).toBeDefined()
    const broken = within(inside.getByRole('region', { name: 'Rota' }))
    expect(await broken.findByText('Su campo ya no está en la plantilla.')).toBeDefined()
    await userEvent.click(broken.getByRole('button', { name: 'Elegir otro' }))
    expect(broken.getByLabelText('cuyo')).toBeDefined()
  })

  it('se añade desde «Añadir bloque» y se configura con desplegables: plantilla, campo, columnas y orden', async () => {
    const { saved } = await renderRaqisa([])
    const inside = await panel()
    await userEvent.click(inside.getByRole('button', { name: 'Añadir bloque' }))
    await userEvent.click(inside.getByRole('button', { name: 'Tabla de páginas' }))
    await userEvent.keyboard('Equipo{Enter}')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ type: 'related', title: 'Equipo' }))
    await userEvent.click(inside.getByRole('button', { name: 'Opciones de «Equipo»' }))
    // Otra plantilla: su primer campo de enlace y dos columnas
    await userEvent.selectOptions(inside.getByLabelText('Páginas de'), 'Objeto')
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({ template: 'objeto', field: 'portador', columns: ['tipo', 'rareza'] })
    )
    await userEvent.selectOptions(inside.getByLabelText('Páginas de'), 'PNJ')
    await userEvent.selectOptions(inside.getByLabelText('cuyo'), 'Facción')
    await userEvent.click(inside.getByRole('button', { name: 'Quitar la columna Rol' }))
    await userEvent.selectOptions(inside.getByLabelText('Columna…'), 'Estado')
    await userEvent.selectOptions(inside.getByLabelText('Orden'), 'Estado')
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({
        template: 'pnj',
        field: 'faccion',
        columns: ['especie', 'estado'],
        sort: 'estado'
      })
    )
  })
})
