import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { type HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import type { CollabClient } from './collab.tsx'

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
const PORT = crypto.randomUUID()
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
const WOLF: ContentItem = { type: 'personaje', key: 'lobo', source: null, data: { name: { es: 'Lobo', en: 'Wolf' } } }
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}

// La edición en vivo sin servidor (como en editor.test.tsx): un WebSocket que no se conecta
const sockets: HocuspocusProviderWebsocket[] = []
const collab: CollabClient = {
  connect: () => {
    const socket = new HocuspocusProviderWebsocket({ url: 'ws://127.0.0.1:9/api/collab', autoConnect: false })
    sockets.push(socket)
    return socket
  }
}
type Providers = { configuration: { providerMap: Map<string, HocuspocusProvider> } }
const providers = () =>
  sockets.flatMap((socket) => [...(socket as unknown as Providers).configuration.providerMap.values()])

function renderPort() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] },
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' }]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
      collab={collab}
    />
  )
  return { api, router }
}

/** El texto de la página, ya llegado del servidor */
async function synced() {
  await waitFor(() => expect(providers().some((p) => p.configuration.name === `page:${PORT}`)).toBe(true))
  act(() => {
    for (const provider of providers()) provider.synced = true
  })
  const body = await screen.findByRole('textbox', { name: 'Texto de la página' })
  return (body as unknown as { editor: Editor }).editor
}

/** Escribe letra a letra al final, como al teclear (así salta el menú de «[[») */
const type = (editor: Editor, text: string) =>
  act(() => {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    const { view } = editor
    for (const letter of text) {
      const { from, to } = view.state.selection
      const insert = () => view.state.tr.insertText(letter, from, to)
      if (!view.someProp('handleTextInput', (handle) => handle(view, from, to, letter, insert))) view.dispatch(insert())
    }
  })

/** Los nodos de un tipo en el texto, con un atributo */
const nodesOf = (editor: Editor, type: string, attribute: string) => {
  const found: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) found.push(String(node.attrs[attribute]))
  })
  return found
}

beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))
afterEach(() => {
  sockets.length = 0
})

describe('los enlaces del texto de una página', () => {
  it('«[[@» busca en el compendio y, al final, ofrece una entrada nueva: al guardarla en su ventana, queda su enlace', async () => {
    const { api } = renderPort()
    const editor = await synced()
    type(editor, '[[@Grifo')
    const option = await screen.findByRole('option', { name: /Entrada nueva «Grifo»/ })
    act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    // Lo escrito se quita y se abre su ventana, con el nombre
    await waitFor(() => expect(editor.getText()).not.toContain('[[@Grifo'))
    const box = within(await screen.findByRole('dialog', { name: 'Nueva entrada' }))
    const name = await box.findByRole('textbox', { name: 'Nombre' })
    expect(name).toHaveProperty('value', 'Grifo')
    await userEvent.type(name, ' real')
    await userEvent.click(box.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(nodesOf(editor, 'contentLink', 'name')).toEqual(['Grifo real']))
    const { items } = await api.client.call('searchLinkableContent', { worldId: WORLD.id, query: 'Grifo' })
    expect(items.map((each) => each.name)).toContain('Grifo real')
  })

  it('«[[@» con lo que hay en el compendio: elegirlo pone su enlace', async () => {
    renderPort()
    const editor = await synced()
    type(editor, '[[@Lo')
    const option = await screen.findByRole('option', { name: /Lobo/ })
    // Lo encontrado va antes que la entrada nueva
    const options = screen.getAllByRole('option').map((each) => each.textContent)
    expect(options.at(-1)).toContain('Entrada nueva «Lo»')
    act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    await waitFor(() => expect(nodesOf(editor, 'contentLink', 'name')).toEqual(['Lobo']))
  })

  it('«[[» bajo el ratón quieto deja elegida la primera (Intro enlaza, no crea); al moverlo, elige', async () => {
    renderPort()
    const editor = await synced()
    type(editor, '[[Puer')
    const page = await screen.findByRole('option', { name: /Puerto Ceniza/ })
    const create = await screen.findByRole('option', { name: /Crear página «Puer»/ })
    expect(page.getAttribute('aria-selected')).toBe('true')
    // Lo que manda el navegador cuando la lista aparece bajo el ratón: sin moverse
    fireEvent.mouseEnter(create)
    fireEvent.mouseMove(create, { movementX: 0, movementY: 0 })
    expect(page.getAttribute('aria-selected')).toBe('true')
    fireEvent.mouseMove(create, { movementX: 2, movementY: 0 })
    expect(create.getAttribute('aria-selected')).toBe('true')
  })

  it('pulsar el enlace a una página que no existe deja crearla con una plantilla: se crea con ella y se abre', async () => {
    const { api, router } = renderPort()
    const editor = await synced()
    const { templates } = await api.client.call('listTemplates', {})
    const template = templates[0]
    if (!template) throw new Error('sin plantillas')
    act(() => {
      editor
        .chain()
        .focus('end')
        .insertContent({ type: 'pageLink', attrs: { title: 'Faro' } })
        .run()
    })
    await userEvent.click(await screen.findByRole('link', { name: 'Faro: por crear, pulsa para crearla' }))
    const menu = within(await screen.findByRole('menu', { name: 'Crear «Faro»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: template.name }))
    await waitFor(async () => {
      const { pages } = await api.client.call('listPageNames', { worldId: WORLD.id })
      expect(pages.map((page) => page.title)).toContain('Faro')
    })
    const { pages } = await api.client.call('listPageNames', { worldId: WORLD.id })
    const faro = pages.find((page) => page.title === 'Faro')
    expect((await api.client.call('getPage', { pageId: faro?.id ?? '' })).template).toBe(template.id)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${faro?.id}`))
  })
})
