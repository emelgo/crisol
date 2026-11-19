import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { edgeFor, treeFromRelations } from './tree-tab.tsx'

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
  it('cada relación, una sola línea en su sentido; no se deduce nada (el hijo de una pareja no lo es de los dos)', () => {
    expect(edgeFor('parent', 'ilsa', 'madre')).toEqual({ from: 'madre', to: 'ilsa', type: 'parent' })
    expect(edgeFor('child', 'madre', 'ilsa')).toEqual({ from: 'madre', to: 'ilsa', type: 'parent' })
    expect(edgeFor('partner', 'ilsa', 'doran')).toEqual({ from: 'ilsa', to: 'doran', type: 'partner' })
    expect(edgeFor('stepchild', 'doran', 'kael')).toEqual({ from: 'doran', to: 'kael', type: 'stepparent' })
    expect(edgeFor('adopter', 'kael', 'mira')).toEqual({ from: 'mira', to: 'kael', type: 'adoptive' })
    expect(edgeFor('member', 'orden', 'varn')).toEqual({ from: 'varn', to: 'orden', type: 'member' })
    expect(edgeFor('group', 'varn', 'orden')).toEqual({ from: 'varn', to: 'orden', type: 'member' })
    expect(edgeFor('leader', 'orden', 'varn')).toEqual({ from: 'varn', to: 'orden', type: 'leads' })
    expect(edgeFor('other', 'ilsa', 'aldo', { label: 'Padrino', place: 'above' })).toEqual({
      from: 'aldo',
      to: 'ilsa',
      type: 'other',
      label: 'Padrino'
    })
    expect(edgeFor('other', 'ilsa', 'kord', { label: 'Rival', place: 'beside' })).toEqual({
      from: 'ilsa',
      to: 'kord',
      type: 'other',
      label: 'Rival',
      beside: true
    })
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

describe('la pestaña «Árbol»', () => {
  it('vacía, una sola pieza; se añade alguien con su página o solo con su nombre, y su familia desde su ficha', async () => {
    const { api, tab } = await setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir a alguien' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Añadir persona' }))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Busca una página o escribe un nombre' }), 'ilsa')
    await userEvent.keyboard('{Enter}')
    await waitFor(async () =>
      expect((await api.client.call('getTree', { tabId: tab.id })).nodes).toMatchObject([
        { pageId: ILSA, name: 'Ilsa de Varn' }
      ])
    )
    // Su ficha, abierta: su madre, sin página
    const card = within(await screen.findByRole('region', { name: 'Ilsa de Varn' }))
    await userEvent.click(card.getByRole('button', { name: 'Padre o madre' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Padre o madre de Ilsa de Varn' }))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Busca una página o escribe un nombre' }), 'Mira de Varn')
    await userEvent.click(dialog.getByRole('option', { name: 'Añadir «Mira de Varn» sin página' }))
    await waitFor(async () => expect((await api.client.call('getTree', { tabId: tab.id })).edges).toHaveLength(1))
    const tree = await api.client.call('getTree', { tabId: tab.id })
    const mira = tree.nodes.find((node) => node.name === 'Mira de Varn')
    expect(mira?.pageId).toBeNull()
    expect(tree.edges[0]).toMatchObject({ from: mira?.id, type: 'parent' })
  })

  it('«Otra relación» elige cualquiera (hijastro, una libre con su nombre) y solo añade esa línea', async () => {
    const { api, tab } = await setup()
    await api.client.call('updateTree', {
      tabId: tab.id,
      nodes: [
        { id: 'mira', name: 'Mira' },
        { id: 'doran', name: 'Doran' }
      ],
      edges: [{ from: 'mira', to: 'doran', type: 'partner' }]
    })
    const node = await screen.findByRole('button', { name: /^Mira/ })
    node.focus()
    await userEvent.keyboard('{Enter}')
    let card = within(await screen.findByRole('region', { name: 'Mira' }))
    await userEvent.click(card.getByRole('button', { name: 'Otra relación' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Otra relación con Mira' }))
    await userEvent.selectOptions(dialog.getByLabelText('Relación'), 'stepchild')
    expect(dialog.getByRole('heading', { name: 'Hijastro o hijastra de Mira' })).toBeDefined()
    await userEvent.type(dialog.getByRole('combobox', { name: 'Busca una página o escribe un nombre' }), 'Kael')
    await userEvent.click(dialog.getByRole('option', { name: 'Añadir «Kael» sin página' }))
    await waitFor(async () => expect((await api.client.call('getTree', { tabId: tab.id })).edges).toHaveLength(2))
    let tree = await api.client.call('getTree', { tabId: tab.id })
    const kael = tree.nodes.find((each) => each.name === 'Kael')
    // Solo la de Mira: Doran, su pareja, no pasa a ser nada de Kael
    expect(tree.edges[1]).toEqual({ from: 'mira', to: kael?.id, type: 'stepparent' })
    card = within(await screen.findByRole('region', { name: 'Kael' }))
    expect(card.getByText('Hijastro o hijastra de Mira')).toBeDefined()
    // Una libre: su nombre y dónde va; sin nombre no se puede añadir
    await userEvent.click(card.getByRole('button', { name: 'Otra relación' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Otra relación con Kael' }))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Busca una página o escribe un nombre' }), 'Doran')
    expect(dialog.getByRole('button', { name: 'Añadir' })).toHaveProperty('disabled', true)
    await userEvent.type(dialog.getByLabelText('Cuál'), 'Mentor')
    await userEvent.click(dialog.getByRole('option', { name: /^Doran/ }))
    await waitFor(async () => expect((await api.client.call('getTree', { tabId: tab.id })).edges).toHaveLength(3))
    tree = await api.client.call('getTree', { tabId: tab.id })
    expect(tree.edges[2]).toEqual({ from: 'doran', to: kael?.id, type: 'other', label: 'Mentor' })
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
