import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { edgesFor, treeFromRelations } from './tree-tab.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const VARN = crypto.randomUUID()
const ILSA = crypto.randomUUID()
const ALDREN = crypto.randomUUID()

const setup = async () => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: VARN, worldId: WORLD.id, title: 'Casa de Varn' },
      { id: ILSA, worldId: WORLD.id, title: 'Ilsa de Varn' },
      { id: ALDREN, worldId: WORLD.id, title: 'Aldren IV' }
    ]
  })
  const tab = await api.client.call('createPageTab', { pageId: VARN, kind: 'tree' })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${VARN}?pestana=${tab.id}`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, tab }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo', 'arbol'] }))
})

describe('las líneas que se añaden desde un nodo', () => {
  it('padre o madre, pareja, miembro y quien dirige; el hijo de alguien con una sola pareja, de los dos', () => {
    const edges = [{ from: 'madre', to: 'padre', type: 'partner' as const }]
    expect(edgesFor('parent', 'ilsa', 'madre', [])).toEqual([{ from: 'madre', to: 'ilsa', type: 'parent' }])
    expect(edgesFor('partner', 'ilsa', 'doran', [])).toEqual([{ from: 'ilsa', to: 'doran', type: 'partner' }])
    expect(edgesFor('member', 'orden', 'varn', [])).toEqual([{ from: 'varn', to: 'orden', type: 'member' }])
    expect(edgesFor('leader', 'orden', 'varn', [])).toEqual([{ from: 'varn', to: 'orden', type: 'leads' }])
    expect(edgesFor('child', 'madre', 'ilsa', edges)).toEqual([
      { from: 'madre', to: 'ilsa', type: 'parent' },
      { from: 'padre', to: 'ilsa', type: 'parent' }
    ])
    expect(edgesFor('first', null, 'ilsa', edges)).toEqual([])
  })

  it('desde los campos con papel: el hijo apunta al padre y el grupo a quien lo dirige, sin repetir la pareja', () => {
    const built = treeFromRelations(
      [
        { id: 'p-ilsa', title: 'Ilsa' },
        { id: 'p-aldren', title: 'Aldren' },
        { id: 'p-mira', title: 'Mira' }
      ],
      [
        { source: 'p-ilsa', target: 'p-aldren', role: 'parent' },
        { source: 'p-aldren', target: 'p-mira', role: 'partner' },
        { source: 'p-mira', target: 'p-aldren', role: 'partner' }
      ]
    )
    const id = (pageId: string) => built.nodes.find((node) => node.pageId === pageId)?.id
    expect(built.nodes.map((node) => node.name)).toEqual(['Ilsa', 'Aldren', 'Mira'])
    expect(built.edges).toEqual([
      { from: id('p-aldren'), to: id('p-ilsa'), type: 'parent' },
      { from: id('p-aldren'), to: id('p-mira'), type: 'partner' }
    ])
  })
})

describe('la pestaña «Árbol genealógico»', () => {
  it('vacía, una sola pieza; se añade alguien con su página o solo con su nombre, y su familia desde su ficha', async () => {
    const { api, tab } = await setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir a alguien' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Añadir al árbol' }))
    await userEvent.type(dialog.getByRole('combobox'), 'ilsa')
    await userEvent.keyboard('{Enter}')
    await waitFor(async () =>
      expect((await api.client.call('getTree', { tabId: tab.id })).nodes).toMatchObject([
        { pageId: ILSA, name: 'Ilsa de Varn' }
      ])
    )
    // Su ficha, abierta: su madre, sin página
    const card = within(await screen.findByRole('region', { name: 'Ilsa de Varn' }))
    await userEvent.click(card.getByRole('button', { name: 'Padre o madre', exact: true }))
    dialog = within(await screen.findByRole('dialog', { name: 'Padre o madre de Ilsa de Varn' }))
    await userEvent.type(dialog.getByRole('combobox'), 'Mira de Varn')
    await userEvent.click(dialog.getByRole('option', { name: 'Añadir «Mira de Varn» sin página' }))
    await waitFor(async () => expect((await api.client.call('getTree', { tabId: tab.id })).edges).toHaveLength(1))
    const tree = await api.client.call('getTree', { tabId: tab.id })
    const mira = tree.nodes.find((node) => node.name === 'Mira de Varn')
    expect(mira?.pageId).toBeNull()
    expect(tree.edges[0]).toMatchObject({ from: mira?.id, type: 'parent' })
  })

  it('«Crear página» convierte un nodo suelto en página, y «Quitar» lo saca con sus líneas', async () => {
    const { api, tab } = await setup()
    await api.client.call('updateTree', {
      tabId: tab.id,
      nodes: [
        { id: 'mira', name: 'Mira de Varn' },
        { id: 'ilsa', pageId: ILSA, name: '' }
      ],
      edges: [{ from: 'mira', to: 'ilsa', type: 'parent' }]
    })
    const node = await screen.findByRole('button', { name: /^Mira de Varn/ })
    node.focus()
    await userEvent.keyboard('{Enter}')
    const card = within(await screen.findByRole('region', { name: 'Mira de Varn' }))
    expect(card.getByText('Padre o madre de Ilsa de Varn')).toBeDefined()
    await userEvent.click(card.getByRole('button', { name: 'Crear página' }))
    await waitFor(() => expect(api.pages.find((page) => page.title === 'Mira de Varn')?.parentId).toBe(VARN))
    await userEvent.click(card.getByRole('button', { name: 'Quitar' }))
    await waitFor(async () => {
      const tree = await api.client.call('getTree', { tabId: tab.id })
      expect(tree.nodes.map((each) => each.id)).toEqual(['ilsa'])
      expect(tree.edges).toEqual([])
    })
  })
})
