import type { Campaign, World } from '@crisol/contracts'
import { type HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import type { CollabClient } from './collab.tsx'

// Sin WebGL: la escena apunta lo que cae
const played: unknown[][] = []
vi.mock('../dice/3d/scene.ts', () => ({
  createScene: () => ({ play: (dice: unknown[]) => played.push([...dice]), dispose: () => {} })
}))

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
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const PORT = crypto.randomUUID()

/** La edición en vivo sin servidor, como en editor.test.tsx */
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

function renderPort({ campaigns = [CAMPAIGN], failing = false } = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns,
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' }]
  })
  const calls: string[] = []
  const call = ((name: string, input: unknown) => {
    calls.push(name)
    if (failing && name === 'rollDice') return Promise.reject(new ApiError('TOO_MANY_ROLLS', 429))
    return (api.client.call as (name: string, input: unknown) => Promise<unknown>)(name, input)
  }) as typeof api.client.call
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={{ ...api.client, call }}
      collab={collab}
    />
  )
  return { api, calls }
}

/** El texto ya llegó, con una tirada escrita */
async function withRoll(formula: string, label: string | null) {
  await waitFor(() => expect(providers().some((p) => p.configuration.name === `page:${PORT}`)).toBe(true))
  act(() => {
    for (const provider of providers()) provider.synced = true
  })
  const body = await screen.findByRole('textbox', { name: 'Texto de la página' })
  const editor = (body as unknown as { editor: Editor }).editor
  act(() => {
    editor.commands.insertContent([
      { type: 'text', text: 'Ataca ' },
      { type: 'diceRoll', attrs: { formula, label } }
    ])
  })
  return editor
}

const announced = () => screen.getAllByRole('status').map((status) => status.textContent ?? '')
const rollOf = (editor: Editor) => {
  let attrs: Record<string, unknown> | null = null
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'diceRoll') attrs = node.attrs
  })
  return attrs
}

afterEach(() => {
  sockets.length = 0
  played.length = 0
  localStorage.clear()
})

describe('la tirada escrita en una página', () => {
  it('pulsarla tira en la campaña, caen los dados y se dice el resultado', async () => {
    const { calls } = renderPort()
    await withRoll('1d20+5', 'Ataque')
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar 1d20+5 · Ataque' }))
    await waitFor(() => expect(announced().some((text) => /^Ataque: \d+$/.test(text))).toBe(true))
    expect(calls).toContain('rollDice')
    expect(played).toHaveLength(1)
  })

  it('sin campañas, tira sin apuntar y lo dice', async () => {
    const { calls } = renderPort({ campaigns: [] })
    await withRoll('2d6', null)
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar 2d6' }))
    await waitFor(() =>
      expect(announced().some((text) => /^2d6: \d+ \(sin campaña: no se apunta\)$/.test(text))).toBe(true)
    )
    expect(calls).toContain('tryDice')
    expect(calls).not.toContain('rollDice')
  })

  it('si no se puede tirar (demasiadas seguidas), lo dice', async () => {
    renderPort({ failing: true })
    await withRoll('1d20', null)
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar 1d20' }))
    await waitFor(() => expect(announced()).toContain('Demasiadas tiradas seguidas: espera un poco'))
    expect(played).toHaveLength(0)
  })

  it('una que no se entiende sale marcada, dice por qué y no tira', async () => {
    const { calls } = renderPort()
    await withRoll('1d20+', null)
    const chip = await screen.findByRole('button', { name: /^1d20\+: Esta tirada no se entiende/ })
    expect(chip.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(chip)
    expect(calls).not.toContain('rollDice')
  })

  it('el lápiz abre su cuadro: se cambian la tirada y su nombre, que se explica; Intro lo cierra', async () => {
    renderPort()
    const editor = await withRoll('1d20', null)
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar la tirada' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'La tirada' }))
    const formula = dialog.getByRole('textbox', { name: 'Tirada' })
    await userEvent.clear(formula)
    await userEvent.type(formula, '2d20kh1+3')
    expect(dialog.getByText('Ventaja (2d20, se queda el mayor) + 3')).toBeDefined()
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre' }), 'Sigilo')
    expect(rollOf(editor)).toMatchObject({ formula: '2d20kh1+3', label: 'Sigilo' })
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('dialog', { name: 'La tirada' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tirar 2d20kh1+3 · Sigilo' })).toBeDefined()
  })

  it('elegida con el teclado se abre su cuadro; Escape lo cierra', async () => {
    renderPort()
    const editor = await withRoll('1d8', null)
    act(() => {
      let at = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'diceRoll') at = pos
      })
      editor.commands.setNodeSelection(at)
    })
    const dialog = within(await screen.findByRole('dialog', { name: 'La tirada' }))
    await userEvent.click(dialog.getByRole('textbox', { name: 'Tirada' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'La tirada' })).toBeNull())
  })
})
