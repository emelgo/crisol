import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

function renderTemplates() {
  const api = fakeApi({ organizations: [ORG], worlds: [] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/plantillas'] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('la pantalla «Plantillas»', () => {
  // Su tutorial guiado ya visto: si no, sale y se lleva el foco
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['plantillas', 'plantilla'] }))
  )

  it('las tuyas en su árbol (por nombre, sin orden a mano), sin plantillas de serie; al pasar por una, lo que trae', async () => {
    renderTemplates()
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas' })).toBeDefined()
    // La API falsa trae de entrada las de ejemplo, como propias
    const list = within(await screen.findByRole('list', { name: 'Tus plantillas' }))
    expect(list.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Facción',
      'Lugar',
      'Misión',
      'Objeto',
      'PNJ',
      'Sesión'
    ])
    expect(screen.queryByText('De serie')).toBeNull()
    expect(screen.getByRole('button', { name: 'Plantilla nueva' })).toBeDefined()
    await userEvent.hover(list.getByRole('link', { name: 'Facción' }))
    const preview = within(screen.getByRole('complementary', { name: 'Lo que trae' }))
    expect(preview.getByText(/Líder/)).toBeDefined()
    expect(preview.getByText('Sin usar')).toBeDefined()
  })

  it('carpetas: «Nueva carpeta», meter una con su «⋯» → «Mover a…», desplegarla y recolocar con Alt y las flechas', async () => {
    const { api } = renderTemplates()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva carpeta' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Nueva carpeta' }))
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Gente{Enter}')
    const list = within(screen.getByRole('list', { name: 'Tus plantillas' }))
    const folder = await list.findByRole('button', { name: 'Gente' })
    expect(folder.getAttribute('aria-expanded')).toBe('false')
    // PNJ, a «Gente» desde su «⋯» (sin cuadro de ajustes: Enrique, 2026-11-19)
    expect(list.queryByRole('button', { name: 'Ajustes de PNJ' })).toBeNull()
    await userEvent.click(list.getByRole('button', { name: 'Más de «PNJ»' }))
    const menu = within(screen.getByRole('menu', { name: 'Opciones de «PNJ»' }))
    await userEvent.hover(menu.getByRole('menuitem', { name: 'Mover a…' }))
    await userEvent.click(
      within(screen.getByRole('menu', { name: 'Mover a…' })).getByRole('menuitem', { name: 'Gente' })
    )
    await waitFor(async () => {
      const { templates, folders } = await api.client.call('listTemplates', {})
      expect(templates.find((t) => t.name === 'PNJ')?.folderId).toBe(folders[0]?.id)
    })
    // Se abre sola para verla dentro
    expect(await list.findByRole('link', { name: 'PNJ' })).toBeDefined()
    expect(list.getByRole('button', { name: 'Gente' }).getAttribute('aria-expanded')).toBe('true')
    // Con el teclado: Lugar, encima de Facción (Alt + flecha arriba)
    const row = list.getByRole('link', { name: 'Lugar' }).closest('[data-file-card]') as HTMLElement
    row.focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    await waitFor(() =>
      expect(
        list
          .getAllByRole('link')
          .map((link) => link.textContent)
          .slice(1, 3)
      ).toEqual(['Lugar', 'Facción'])
    )
  })

  it('«Plantilla nueva» abre el cuadro de «Página nueva» (tipo y nombre); sin nombre, «Plantilla sin título», que se abre para escribirlo', async () => {
    const { api, router } = renderTemplates()
    await userEvent.click(await screen.findByRole('button', { name: 'Plantilla nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Plantilla nueva' }))
    expect(dialog.getByRole('radio', { name: 'Texto' })).toHaveProperty('checked', true)
    expect(dialog.getByRole('radio', { name: 'Mapa' })).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/plantillas\/[0-9a-f-]{36}$/))
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    expect(title.textContent).toBe('Plantilla sin título')
    await userEvent.keyboard('Frente{Enter}')
    await waitFor(async () =>
      expect((await api.client.call('listTemplates', {})).templates.map((t) => t.name)).toContain('Frente')
    )
    // Otra, desde la ficha de la izquierda: con su nombre y un mapa, que se abre en su pestaña
    await userEvent.click(screen.getByRole('button', { name: 'Plantilla nueva' }))
    const again = within(await screen.findByRole('dialog', { name: 'Plantilla nueva' }))
    await userEvent.click(again.getByRole('radio', { name: 'Mapa' }))
    await userEvent.type(again.getByRole('textbox', { name: 'Nombre' }), 'Puerto')
    await userEvent.click(again.getByRole('button', { name: 'Crear' }))
    await waitFor(async () =>
      expect((await api.client.call('listTemplates', {})).templates.map((t) => t.name)).toContain('Puerto')
    )
    const puerto = (await api.client.call('listTemplates', {})).templates.find((t) => t.name === 'Puerto')
    await waitFor(() => expect(router.state.location.search).toMatchObject({ pestana: expect.any(String) }))
    const tabs = (await api.client.call('listPageTabs', { pageId: puerto?.pageId ?? '' })).tabs
    expect(tabs.map((tab) => tab.kind)).toEqual(['map'])
  })

  it('el botón derecho sobre una tuya, como en las páginas: renombrarla y borrarla', async () => {
    const { api } = renderTemplates()
    await api.client.call('createTemplate', { name: 'Frente', icon: 'hourglass' })
    const mine = within(await screen.findByRole('list', { name: 'Tus plantillas' }))
    await userEvent.pointer({ keys: '[MouseRight]', target: await mine.findByRole('link', { name: 'Frente' }) })
    const menu = within(screen.getByRole('menu', { name: 'Opciones de «Frente»' }))
    await userEvent.click(menu.getByRole('menuitem', { name: 'Renombrar' }))
    const field = menu.getByRole('textbox', { name: 'Nuevo nombre' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Frentes{Enter}')
    expect(await mine.findByRole('link', { name: 'Frentes' })).toBeDefined()
    // Con el teclado: la tecla de menú en su fila
    const row = mine.getByRole('link', { name: 'Frentes' }).closest('[data-file-card]') as HTMLElement
    row.focus()
    await userEvent.keyboard('{ContextMenu}')
    const again = within(screen.getByRole('menu', { name: 'Opciones de «Frentes»' }))
    await userEvent.click(again.getByRole('menuitem', { name: 'Borrar' }))
    await userEvent.click(again.getByRole('menuitem', { name: 'Borrar la plantilla' }))
    await waitFor(() => expect(mine.queryByRole('link', { name: 'Frentes' })).toBeNull())
  })
})
