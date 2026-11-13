import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'

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

/** Puerto Ceniza, con las pestañas que se le pidan ya añadidas (de texto) */
const setup = async (tabs: string[] = [], locked = false) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza' }]
  })
  const created = []
  for (const name of tabs) created.push(await api.client.call('createPageTab', { pageId: PORT, kind: 'text', name }))
  if (locked) await api.client.call('updatePage', { pageId: PORT, locked: true })
  return { api, tabs: created }
}

const renderAt = (api: ReturnType<typeof fakeApi>, search = '') => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}${search}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return router
}
const bar = async () => within(await screen.findByRole('navigation', { name: 'Pestañas de la página' }))
const names = async () => (await bar()).getAllByRole('link').map((link) => link.textContent)
const listed = async (api: ReturnType<typeof fakeApi>) =>
  (await api.client.call('listPageTabs', { pageId: PORT })).tabs.map((tab) => tab.name)

beforeEach(() => {
  // El tutorial guiado del mundo ya hecho: que no se ponga en medio
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
})

describe('las pestañas de una página', () => {
  it('«Texto» va primero y es la elegida si no se pide otra', async () => {
    const { api } = await setup(['Notas'])
    renderAt(api)
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Notas']))
    expect((await bar()).getByRole('link', { name: 'Texto' }).getAttribute('aria-current')).toBe('page')
    // El menú solo lo lleva la elegida
    expect((await bar()).queryByRole('button', { name: 'Opciones de la pestaña Notas' })).toBeNull()
  })

  it('«Pestaña nueva» no ofrece «Desde plantilla»: la plantilla, solo al crear una página', async () => {
    const { api } = await setup(['Notas'])
    await api.client.call('createTemplate', { name: 'Puerto' })
    renderAt(api)
    await userEvent.click((await bar()).getByRole('button', { name: 'Pestaña nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    expect(dialog.getByRole('radio', { name: 'Texto' })).toBeDefined()
    expect(dialog.queryByRole('button', { name: 'Desde plantilla' })).toBeNull()
  })

  it('una pestaña nueva de texto, sin nombre: se llama como su tipo, va al final y se abre', async () => {
    const { api } = await setup()
    const router = renderAt(api)
    await userEvent.click((await bar()).getByRole('button', { name: 'Pestaña nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    expect(dialog.getByRole('radio', { name: 'Texto' })).toHaveProperty('checked', true)
    // Las que vienen, aún no
    expect(dialog.getByRole('radio', { name: /Línea temporal/ })).toHaveProperty('disabled', true)
    expect(dialog.getAllByText('Pronto')).toHaveLength(2)
    await userEvent.click(dialog.getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await names()).toEqual(['Texto', 'Texto 2'])
    const [tab] = (await api.client.call('listPageTabs', { pageId: PORT })).tabs
    await waitFor(() => expect(router.state.location.search).toEqual({ pestana: tab?.id }))
    expect((await bar()).getByRole('link', { name: 'Texto 2' }).getAttribute('aria-current')).toBe('page')
  })

  it('una pestaña nueva de mapa, con su nombre', async () => {
    const { api } = await setup()
    renderAt(api)
    await userEvent.click((await bar()).getByRole('button', { name: 'Pestaña nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Mapa' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre de la pestaña' }), '  Costa  {Enter}')
    expect(await (await bar()).findByRole('link', { name: 'Costa' })).toBeDefined()
    const [tab] = (await api.client.call('listPageTabs', { pageId: PORT })).tabs
    expect(tab).toMatchObject({ kind: 'map', name: 'Costa' })
  })

  it('cerrar el cuadro sin crear lo deja como estaba la próxima vez', async () => {
    const { api } = await setup()
    renderAt(api)
    const add = (await bar()).getByRole('button', { name: 'Pestaña nueva' })
    await userEvent.click(add)
    let dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Mapa' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre de la pestaña' }), 'Borrador')
    await userEvent.click(dialog.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(add))
    await userEvent.click(add)
    dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    expect(dialog.getByRole('radio', { name: 'Texto' })).toHaveProperty('checked', true)
    expect(dialog.getByRole('textbox', { name: 'Nombre de la pestaña' })).toHaveProperty('value', '')
    expect(await listed(api)).toEqual([])
  })

  it('el menú de la elegida le cambia el nombre (Intro) y el color', async () => {
    const { api, tabs } = await setup(['Notas'])
    renderAt(api, `?pestana=${tabs[0]?.id}`)
    await userEvent.click(await (await bar()).findByRole('button', { name: 'Opciones de la pestaña Notas' }))
    const name = await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })
    await waitFor(() => expect(document.activeElement).toBe(name))
    await userEvent.clear(name)
    await userEvent.type(name, 'Apuntes{Enter}')
    expect(await (await bar()).findByRole('link', { name: 'Apuntes' })).toBeDefined()
    expect(await listed(api)).toEqual(['Apuntes'])
    await userEvent.click(screen.getByRole('radio', { name: 'Mar' }))
    await waitFor(async () =>
      expect((await api.client.call('listPageTabs', { pageId: PORT })).tabs[0]?.color).toBe('sea')
    )
    expect((await bar()).getByRole('link', { name: 'Apuntes' }).hasAttribute('data-color')).toBe(true)
  })

  it('un nombre vacío vuelve al de antes, sin guardar', async () => {
    const { api, tabs } = await setup(['Notas'])
    renderAt(api, `?pestana=${tabs[0]?.id}`)
    await userEvent.click(await (await bar()).findByRole('button', { name: 'Opciones de la pestaña Notas' }))
    const name = await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })
    await userEvent.clear(name)
    await userEvent.type(name, '   {Enter}')
    expect(name).toHaveProperty('value', 'Notas')
    expect(api.calls).not.toContain('updatePageTab')
  })

  it('Escape cierra el menú, el foco vuelve a su botón y el nombre escrito se guarda', async () => {
    const { api, tabs } = await setup(['Notas'])
    renderAt(api, `?pestana=${tabs[0]?.id}`)
    const button = await (await bar()).findByRole('button', { name: 'Opciones de la pestaña Notas' })
    await userEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const name = await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Diario')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre de la pestaña' })).toBeNull())
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Opciones de la pestaña/)
    await waitFor(async () => expect(await listed(api)).toEqual(['Diario']))
  })

  it('pulsar fuera cierra el menú; su botón lo abre y lo cierra', async () => {
    const { api, tabs } = await setup(['Notas'])
    renderAt(api, `?pestana=${tabs[0]?.id}`)
    const button = await (await bar()).findByRole('button', { name: 'Opciones de la pestaña Notas' })
    await userEvent.click(button)
    await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })
    await userEvent.click(button)
    expect(screen.queryByRole('textbox', { name: 'Nombre de la pestaña' })).toBeNull()
    await userEvent.click(button)
    await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })
    await userEvent.click(screen.getByRole('heading', { level: 1, name: 'Puerto Ceniza' }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre de la pestaña' })).toBeNull())
    expect(api.calls).not.toContain('updatePageTab')
  })

  it('eliminar pide confirmar; «Cancelar» lo deja, y confirmar la quita y vuelve al texto', async () => {
    const { api, tabs } = await setup(['Notas', 'Mapa'])
    const router = renderAt(api, `?pestana=${tabs[0]?.id}`)
    await userEvent.click(await (await bar()).findByRole('button', { name: 'Opciones de la pestaña Notas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar pestaña' }))
    expect(screen.getByText('¿Eliminar «Notas» y lo que tiene? Se puede deshacer en el historial.')).toBeDefined()
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Eliminar'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/¿Eliminar «Notas»/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar pestaña' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('Pestaña «Notas» quitada')).toBeDefined()
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Mapa']))
    expect(await listed(api)).toEqual(['Mapa'])
  })

  it('con el botón derecho, otra pestaña se elige y se abre su menú', async () => {
    const { api, tabs } = await setup(['Notas', 'Diario'])
    const router = renderAt(api)
    await userEvent.pointer({
      keys: '[MouseRight]',
      target: await (await bar()).findByRole('link', { name: 'Diario' })
    })
    await waitFor(() => expect(router.state.location.search).toEqual({ pestana: tabs[1]?.id }))
    expect(await screen.findByRole('textbox', { name: 'Nombre de la pestaña' })).toHaveProperty('value', 'Diario')
  })

  it('Alt y las flechas recolocan la pestaña (sin pasar de los bordes)', async () => {
    const { api } = await setup(['Uno', 'Dos', 'Tres'])
    renderAt(api)
    const one = await (await bar()).findByRole('link', { name: 'Uno' })
    one.focus()
    // Al principio no va más a la izquierda
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    // Sin Alt, nada
    await userEvent.keyboard('{ArrowRight}')
    expect(api.calls).not.toContain('updatePageTab')
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Dos', 'Uno', 'Tres']))
    expect(await listed(api)).toEqual(['Dos', 'Uno', 'Tres'])
    const three = (await bar()).getByRole('link', { name: 'Tres' })
    three.focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Dos', 'Tres', 'Uno']))
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Tres', 'Dos', 'Uno']))
  })

  it('arrastrando, la pestaña va delante de la que se suelta', async () => {
    const { api } = await setup(['Uno', 'Dos', 'Tres'])
    renderAt(api)
    const item = async (name: string) => (await (await bar()).findByRole('link', { name })).closest('li') as HTMLElement
    const transfer = { dataTransfer: { effectAllowed: 'none', setData: () => {} } }
    const three = await item('Tres')
    const one = await item('Uno')
    // Pasar por encima sin arrastrar una pestaña no marca nada
    fireEvent.dragOver(one, transfer)
    expect(one.hasAttribute('data-over')).toBe(false)
    fireEvent.dragStart(three, transfer)
    expect(three.getAttribute('data-dragging')).toBe('true')
    fireEvent.dragOver(one, transfer)
    expect(one.getAttribute('data-over')).toBe('true')
    fireEvent.drop(one, transfer)
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Tres', 'Uno', 'Dos']))
    // Soltar en otra que no es la primera: detrás de la anterior a ella
    fireEvent.dragStart(await item('Tres'), transfer)
    fireEvent.drop(await item('Dos'), transfer)
    await waitFor(async () => expect(await names()).toEqual(['Texto', 'Uno', 'Tres', 'Dos']))
    // Soltarla sobre sí misma no la mueve
    const moves = api.calls.filter((c) => c === 'updatePageTab').length
    fireEvent.dragStart(await item('Dos'), transfer)
    fireEvent.drop(await item('Dos'), transfer)
    fireEvent.dragEnd(await item('Dos'))
    expect(api.calls.filter((c) => c === 'updatePageTab')).toHaveLength(moves)
  })

  it('con la página en lectura: sin «+», sin menú y sin recolocar', async () => {
    const { api, tabs } = await setup(['Uno', 'Dos'], true)
    renderAt(api, `?pestana=${tabs[0]?.id}`)
    const one = await (await bar()).findByRole('link', { name: 'Uno' })
    expect((await bar()).queryByRole('button', { name: 'Pestaña nueva' })).toBeNull()
    expect((await bar()).queryByRole('button', { name: 'Opciones de la pestaña Uno' })).toBeNull()
    one.focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await userEvent.pointer({ keys: '[MouseRight]', target: await (await bar()).findByRole('link', { name: 'Dos' }) })
    expect(api.calls).not.toContain('updatePageTab')
    expect(screen.queryByRole('textbox', { name: 'Nombre de la pestaña' })).toBeNull()
  })
})
