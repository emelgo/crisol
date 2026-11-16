import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { type ApiClient, ApiError } from '../api/client.ts'
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
const ids = { port: crypto.randomUUID(), velaria: crypto.randomUUID() }

const renderAt = (path: string, wrap?: (client: ApiClient) => ApiClient) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: ids.port, worldId: WORLD.id, title: 'Puerto Ceniza' },
      {
        id: ids.velaria,
        worldId: WORLD.id,
        title: 'Velaria',
        properties: [{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] }]
      }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={wrap ? wrap(api.client) : api.client}
    />
  )
  return { api, router }
}
const title = () => screen.findByRole('textbox', { name: 'Título de la página' })

describe('el título de la página', () => {
  it('recién creada, el foco va al título con todo elegido; al ponerle nombre, la dirección deja de decir «nuevo»', async () => {
    const { router, api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}?nuevo=true`)
    const box = await title()
    await waitFor(() => expect(document.activeElement).toBe(box))
    expect(getSelection()?.toString()).toBe('Puerto Ceniza')
    await userEvent.keyboard('Puerto Gris{Enter}')
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    expect(api.calls).toContain('updatePage')
  })

  it('sin poder guardarlo, lo dice y el foco se queda en el título', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`, (client) => ({
      ...client,
      call: (name, input) =>
        name === 'updatePage' ? Promise.reject(new ApiError('INTERNAL', 500)) : client.call(name, input)
    }))
    const box = await title()
    await userEvent.clear(box)
    await userEvent.type(box, 'Puerto Gris{Enter}')
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(box.getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(box))
  })

  it('solo texto: Ctrl+B no pone negrita', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const box = await title()
    await userEvent.click(box)
    await userEvent.keyboard('{Control>}b{/Control}')
    expect(box.querySelector('b, strong')).toBeNull()
    expect(box.textContent).toBe('Puerto Ceniza')
  })

  it('la flecha abajo al final del título lo guarda', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const box = await title()
    await userEvent.click(box)
    // El cursor, al final
    const range = document.createRange()
    range.selectNodeContents(box)
    range.collapse(false)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
    await userEvent.keyboard(' Norte{ArrowDown}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza Norte' })).toBeDefined()
  })

  it('la flecha abajo en medio del título no lo guarda', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const box = await title()
    box.focus()
    const range = document.createRange()
    range.setStart(box.firstChild as Node, 2)
    range.collapse(true)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
    await userEvent.keyboard('{ArrowDown}')
    expect(api.calls).not.toContain('updatePage')
  })
})

describe('pegar en el título', () => {
  it('pega solo el texto, en una línea', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const box = await title()
    await userEvent.click(box)
    // happy-dom no tiene execCommand: se pone uno que solo apunta lo que le piden
    const insert = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: insert, configurable: true })
    try {
      await userEvent.paste('Puerto\n  Gris')
      expect(insert).toHaveBeenCalledWith('insertText', false, 'Puerto Gris')
    } finally {
      Reflect.deleteProperty(document, 'execCommand')
    }
  })
})

describe('el candado con el teclado', () => {
  it('Ctrl+E pone la página en lectura y otra vez la quita', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await title()
    await userEvent.keyboard('{Control>}e{/Control}')
    expect(await screen.findByText('En lectura: quita el candado para editar.')).toBeDefined()
    await userEvent.keyboard('{Control>}e{/Control}')
    await waitFor(() => expect(screen.queryByText('En lectura: quita el candado para editar.')).toBeNull())
  })
})

describe('el buscador del árbol', () => {
  it('con #, por etiqueta (y sus hijas); Escape lo vacía y vuelve el árbol', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const filter = await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await userEvent.type(filter, '#lugar')
    const results = within(await screen.findByRole('list', { name: /./ }))
    expect(await results.findByText('Velaria')).toBeDefined()
    expect(results.queryByText('Puerto Ceniza')).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect((filter as HTMLInputElement).value).toBe('')
    expect(await screen.findByRole('tree', { name: 'Páginas' })).toBeDefined()
  })

  it('una página que no coincide no sale', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const filter = await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await userEvent.type(filter, '#reino')
    expect(await screen.findByText('Ninguna página coincide.')).toBeDefined()
  })

  it('Intro busca dentro del texto de todas las páginas; con #, no', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const filter = await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await userEvent.type(filter, '#lugar{Enter}')
    expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await userEvent.clear(filter)
    await userEvent.type(filter, ' faro {Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/buscar`))
    expect(router.state.location.search).toEqual({ q: 'faro' })
  })

  it('pulsar una de las encontradas la abre', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const filter = await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await userEvent.type(filter, 'vel')
    await userEvent.click(await screen.findByRole('link', { name: /Velaria/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.velaria}`))
  })
})

describe('el cajón de las páginas, en lo estrecho', () => {
  /** En lo estrecho, el panel es un cajón que se abre con el botón del mundo de la barra */
  const narrow = () =>
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined
        }) as unknown as MediaQueryList
    )
  const drawer = () => screen.getByRole('tree', { name: 'Páginas' }).closest('aside') as HTMLElement
  const openDrawer = async () => {
    await screen.findByRole('tree', { name: 'Páginas' })
    const trigger = screen.getByRole('button', { name: 'Eana' })
    await userEvent.click(trigger)
    await waitFor(() => expect(drawer().hasAttribute('data-open')).toBe(true))
    return trigger
  }
  afterEach(() => vi.restoreAllMocks())

  it('«Cerrar» lo cierra y el foco vuelve al botón que lo abrió', async () => {
    narrow()
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    const trigger = await openDrawer()
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Cerrar'))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(drawer().hasAttribute('data-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('abrir una página del árbol lo cierra', async () => {
    narrow()
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await openDrawer()
    await userEvent.click(
      within(screen.getByRole('tree', { name: 'Páginas' })).getByRole('treeitem', { name: 'Velaria' })
    )
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.velaria}`))
    expect(drawer().hasAttribute('data-open')).toBe(false)
  })

  it('abrir una de las encontradas también lo cierra', async () => {
    narrow()
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await openDrawer()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' }), 'vel')
    await userEvent.click(await screen.findByRole('link', { name: /Velaria/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.velaria}`))
    expect(screen.getByRole('searchbox').closest('aside')?.hasAttribute('data-open')).toBe(false)
  })

  it('Ctrl+K lo abre con el foco en el buscador (uno solo, Enrique, 2026-11-16)', async () => {
    narrow()
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await screen.findByRole('tree', { name: 'Páginas' })
    expect(drawer().hasAttribute('data-open')).toBe(false)
    await userEvent.keyboard('{Control>}k{/Control}')
    await waitFor(() => expect(drawer().hasAttribute('data-open')).toBe(true))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' }))
    )
  })

  it('un marcador también lo cierra', async () => {
    narrow()
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.velaria}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar' }))
    await router.navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: WORLD.id, pageId: ids.port } })
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await openDrawer()
    const bookmarks = within(await screen.findByRole('region', { name: 'Marcadores' }))
    await userEvent.click(bookmarks.getByRole('link', { name: 'Velaria' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ids.velaria}`))
    expect(drawer().hasAttribute('data-open')).toBe(false)
  })
})

describe('un solo buscador (Enrique, 2026-11-16)', () => {
  it('Ctrl+K enfoca el de la ficha del árbol, sin abrir otro cuadro', async () => {
    renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}`)
    await title()
    await userEvent.keyboard('{Control>}k{/Control}')
    const filter = await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
    await waitFor(() => expect(document.activeElement).toBe(filter))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('las pestañas de una página', () => {
  it('una pestaña que ya no está lleva al texto', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/wiki/${ids.port}?pestana=${crypto.randomUUID()}`)
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await waitFor(() => expect(router.state.location.search).toEqual({}))
  })
})
