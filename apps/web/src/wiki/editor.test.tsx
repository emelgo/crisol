import type { World } from '@crisol/contracts'
import { type HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
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

/** La edición en vivo sin servidor: un WebSocket que no se conecta; lo de «conectado» o «sin conexión» se dice a mano */
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

const renderPort = () => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' }]
  })
  // Un archivo que no se puede subir
  const client = {
    ...api.client,
    uploadFile: (...args: Parameters<typeof api.client.uploadFile>) =>
      'name' in args[0] && args[0].name === 'roto.png'
        ? Promise.reject(new ApiError('TOO_LARGE', 413))
        : api.client.uploadFile(...args)
  }
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={client}
      collab={collab}
    />
  )
  return api
}

/** El texto de la página ya llegó del servidor */
async function synced() {
  await waitFor(() => expect(providers().some((p) => p.configuration.name === `page:${PORT}`)).toBe(true))
  act(() => {
    for (const provider of providers()) provider.synced = true
  })
  const body = await screen.findByRole('textbox', { name: 'Texto de la página' })
  return (body as unknown as { editor: Editor }).editor
}

/** Escribe letra a letra al final, como al teclear (con los atajos del texto, como «[!aviso] ») */
const type = (editor: Editor, text: string, here = false) =>
  act(() => {
    if (!here) editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    const { view } = editor
    for (const letter of text) {
      const { from, to } = view.state.selection
      const insert = () => view.state.tr.insertText(letter, from, to)
      if (!view.someProp('handleTextInput', (handle) => handle(view, from, to, letter, insert))) view.dispatch(insert())
    }
  })

/** El selector de archivos del texto (no los del panel ni la portada) */
const filePicker = (editor: Editor) => {
  const picker = editor.view.dom.closest('[aria-busy]')?.querySelector<HTMLInputElement>(':scope > input[type="file"]')
  if (!picker) throw new Error('sin selector de archivos')
  return picker
}

const announced = () => screen.getAllByRole('status').map((status) => status.textContent)

afterEach(() => {
  sockets.length = 0
})

describe('el texto de una página', () => {
  it('mientras no llega el texto no hay editor; al llegar, vacío dice qué hacer', async () => {
    renderPort()
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    expect(screen.queryByRole('textbox', { name: 'Texto de la página' })).toBeNull()
    const editor = await synced()
    const first = editor.view.dom.firstElementChild
    expect(first?.getAttribute('data-placeholder')).toBe(
      'Escribe, o pulsa «/» para insertar y «@» para enlazar una página'
    )
    // Al escribir, el aviso se va
    type(editor, 'Hola')
    expect(editor.view.dom.firstElementChild?.hasAttribute('data-placeholder')).toBe(false)
  })

  it('sin conexión se sigue escribiendo, y lo dice', async () => {
    renderPort()
    await waitFor(() => expect(sockets.length).toBeGreaterThan(0))
    act(() => {
      // Como lo dice el WebSocket al perder la conexión
      for (const socket of sockets)
        (socket as unknown as { emit: (event: string, data: unknown) => void }).emit('status', {
          status: 'disconnected'
        })
    })
    expect(await screen.findByText('Sin conexión: se guardará al volver.')).toBeDefined()
    const body = await screen.findByRole('textbox', { name: 'Texto de la página' })
    expect(body.closest('[aria-busy]')?.getAttribute('aria-busy')).toBe('true')
  })

  it('«[!aviso] » al empezar una línea pone su recuadro; un nombre que no es de recuadro se queda como texto', async () => {
    renderPort()
    const editor = await synced()
    type(editor, '[!aviso] ')
    const first = editor.state.doc.firstChild
    expect(first?.type.name).toBe('callout')
    expect(first?.attrs.kind).toBe('warning')
    expect(first?.textContent).toBe('')

    act(() => void editor.commands.setContent('<p></p>'))
    type(editor, '[!cosa] ')
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.firstChild?.textContent).toBe('[!cosa] ')
  })

  it('«> [!consejo] » hace el recuadro fuera de la cita', async () => {
    renderPort()
    const editor = await synced()
    type(editor, '> ')
    expect(editor.state.doc.firstChild?.type.name).toBe('blockquote')
    type(editor, '[!consejo] ', true)
    expect(editor.state.doc.firstChild?.type.name).toBe('callout')
    expect(editor.state.doc.firstChild?.attrs.kind).toBe('tip')
  })

  it('«[!secreto] » crea un secreto, con su documento aparte', async () => {
    const api = renderPort()
    const editor = await synced()
    type(editor, '[!secreto] ')
    await waitFor(() => expect(api.calls).toContain('createPageDocument'))
    await waitFor(() => expect(editor.state.doc.firstChild?.type.name).toBe('secret'))
  })

  it('Ctrl+Alt+B abre el menú del bloque del cursor; Escape lo cierra y vuelve al texto', async () => {
    renderPort()
    const editor = await synced()
    type(editor, 'Uno')
    // Sin Ctrl, nada
    fireEvent.keyDown(editor.view.dom, { code: 'KeyB', altKey: true })
    expect(screen.queryByRole('menu', { name: 'Bloque' })).toBeNull()
    fireEvent.keyDown(editor.view.dom, { code: 'KeyB', ctrlKey: true, altKey: true })
    const menu = await screen.findByRole('menu', { name: 'Bloque' })
    expect(within(menu).getByRole('group', { name: 'Convertir en' })).toBeDefined()
    fireEvent.keyDown(within(menu).getAllByRole('menuitem')[0] as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Bloque' })).toBeNull())
  })

  it('«Imagen o archivo» elige uno del equipo, lo sube al mundo y lo pone en el texto', async () => {
    const api = renderPort()
    const editor = await synced()
    const picker = filePicker(editor)
    // Sin elegir antes el bloque, no se pone nada
    await userEvent.upload(picker, new File(['x'], 'suelto.png', { type: 'image/png' }))
    expect(api.calls).not.toContain('uploadFile')

    type(editor, '/imagen')
    await screen.findByRole('option', { name: 'Imagen o archivo' })
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      editor.view.someProp('handleKeyDown', (handle) => handle(editor.view, event))
    })
    await userEvent.upload(picker, new File(['x'], 'mapa.png', { type: 'image/png' }))
    await waitFor(() => expect(api.calls).toContain('uploadFile'))
    await waitFor(() => {
      const embeds: string[] = []
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'fileEmbed') embeds.push(String(node.attrs.name))
      })
      expect(embeds).toEqual(['mapa.png'])
    })
    await waitFor(() => expect(announced()).toContain('«mapa.png» subido'))
  })

  it('si no se puede subir, lo anuncia', async () => {
    renderPort()
    const editor = await synced()
    type(editor, '/imagen')
    await screen.findByRole('option', { name: 'Imagen o archivo' })
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      editor.view.someProp('handleKeyDown', (handle) => handle(editor.view, event))
    })
    const picker = filePicker(editor)
    await userEvent.upload(picker, new File(['x'], 'roto.png', { type: 'image/png' }))
    await waitFor(() => expect(announced().some((text) => text?.startsWith('No se pudo subir «roto.png»'))).toBe(true))
  })

  it('con el candado, el texto queda en lectura', async () => {
    renderPort()
    const editor = await synced()
    expect(editor.isEditable).toBe(true)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Poner en lectura' }))
    await waitFor(() => expect(editor.isEditable).toBe(false))
    expect(editor.view.dom.getAttribute('contenteditable')).toBe('false')
  })
})
