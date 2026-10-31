import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })
const eana = () => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Eana',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master' as 'master' | 'player',
  version: 1
})

const renderWorlds = (api = fakeApi({ organizations: [ORG] }), accounts = signedIn()) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
  render(<App router={router} accounts={accounts.client} api={api.client} />)
  return { router, api }
}

describe('mis mundos', () => {
  // El tutorial guiado ya hecho: que no se ponga en medio
  beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundos'] })))

  it('con sesión, la portada lleva directa a mis mundos', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
    render(<App router={router} accounts={signedIn().client} api={fakeApi({ organizations: [ORG] }).client} />)
    expect(await screen.findByRole('heading', { name: 'Mis mundos' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/mundos')
  })

  it('sin mundos lo dice y deja crear el primero', async () => {
    renderWorlds()
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Crear tu primer mundo' }))
    await userEvent.type(
      within(screen.getByRole('dialog', { name: 'Nuevo mundo' })).getByLabelText('Nombre del mundo'),
      'Eana'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Crear el mundo' }))
    const list = await screen.findByRole('list', { name: 'Mundos' })
    expect(within(list).getByText('Eana')).toBeDefined()
    expect(within(list).getByText('Máster')).toBeDefined()
  })

  it('en «Ajustes» se le pone descripción y color, y la tarjeta lo enseña', async () => {
    const world = {
      id: crypto.randomUUID(),
      organizationId: ORG.id,
      name: 'Costa Gris',
      description: '',
      icon: null,
      color: null,
      cover: null,
      role: 'master' as const,
      version: 1
    }
    const { api } = renderWorlds(fakeApi({ organizations: [ORG], worlds: [world] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Costa Gris' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Costa Gris' }))
    await userEvent.type(dialog.getByLabelText('Descripción'), 'Ciudades libres en la niebla')
    await userEvent.click(dialog.getByRole('radio', { name: 'Vino' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    // En su tarjeta (el panel de al lado también lo enseña)
    expect(
      await within(screen.getByRole('list', { name: 'Mundos' })).findByText('Ciudades libres en la niebla')
    ).toBeDefined()
    expect(api.calls).toContain('updateWorld')
  })

  it('el engranaje abre la ventana del mundo, y ahí se cambia el nombre', async () => {
    const { api } = renderWorlds(fakeApi({ organizations: [ORG], worlds: [eana()] }))
    expect(screen.queryByRole('button', { name: 'Renombrar Eana' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    const input = dialog.getByLabelText('Nombre del mundo')
    await userEvent.clear(input)
    await userEvent.type(input, 'Eana (Fateforge)')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect(await within(screen.getByRole('list', { name: 'Mundos' })).findByText('Eana (Fateforge)')).toBeDefined()
    expect(api.calls).toContain('updateWorld')
  })

  it('desde su zona de peligro se borra el mundo, escribiendo su nombre para confirmarlo', async () => {
    const { api } = renderWorlds(fakeApi({ organizations: [ORG], worlds: [eana()] }))
    expect(screen.queryByRole('button', { name: 'Borrar Eana' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    const zone = within(settings.getByRole('region', { name: 'Zona de peligro' }))
    await userEvent.click(zone.getByRole('button', { name: 'Borrar el mundo' }))
    const confirm = within(await screen.findByRole('dialog', { name: '¿Borrar «Eana»?' }))
    // El cursor ya está en el campo del nombre
    expect(document.activeElement).toBe(confirm.getByLabelText('Nombre del mundo'))
    const button = confirm.getByRole<HTMLButtonElement>('button', { name: 'Borrar el mundo' })
    expect(button.disabled).toBe(true)
    await userEvent.type(confirm.getByLabelText('Nombre del mundo'), 'Ean')
    expect(button.disabled).toBe(true)
    await userEvent.type(confirm.getByLabelText('Nombre del mundo'), 'a')
    await userEvent.click(button)
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    expect(api.calls).toContain('deleteWorld')
  })

  it('la ventana del mundo se cierra con la X y al pulsar fuera', async () => {
    renderWorlds(fakeApi({ organizations: [ORG], worlds: [eana()] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes de Eana' })
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' })[0] as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'Ajustes de Eana' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes de Eana' }))
    await userEvent.click(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    expect(screen.queryByRole('dialog', { name: 'Ajustes de Eana' })).toBeNull()
  })

  it('la portada se cambia desde la ventana del mundo, no desde la tarjeta', async () => {
    const world = eana()
    const api = fakeApi({
      organizations: [ORG],
      worlds: [world],
      files: [{ worldId: world.id, name: 'mapa.png', kind: 'image', url: '/archivos/mapa.png' }]
    })
    renderWorlds(api)
    await screen.findByText('Eana')
    expect(screen.queryByRole('button', { name: 'Añadir portada' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes de Eana' }))
    const settings = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    await userEvent.click(settings.getByRole('button', { name: 'Añadir portada' }))
    const cover = within(await screen.findByRole('dialog', { name: 'Portada de Eana' }))
    expect(cover.queryByRole('button', { name: 'Guardar' })).toBeNull()
    await userEvent.click(await cover.findByRole('button', { name: 'mapa.png' }))
    await userEvent.click(cover.getByRole('button', { name: 'Acercar más' }))
    await userEvent.click(cover.getByRole('button', { name: 'Guardar' }))
    // Cerrar la portada no cierra la ventana del mundo
    expect(await settings.findByRole('button', { name: 'Cambiar' })).toBeDefined()
    expect(screen.getByRole('dialog', { name: 'Ajustes de Eana' })).toBeDefined()
    expect(api.calls).toContain('updateWorld')
    // Ver la portada y cerrarla también deja la ventana del mundo abierta
    await userEvent.click(settings.getByRole('button', { name: 'Ver' }))
    const viewer = await screen.findByRole('dialog', { name: 'Portada de Eana' })
    await userEvent.click(within(viewer).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Portada de Eana' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Ajustes de Eana' })).toBeDefined()
  })

  it('en la ventana del mundo, Guardar y Cancelar solo salen con cambios, y Cancelar los deshace', async () => {
    renderWorlds(fakeApi({ organizations: [ORG], worlds: [eana()] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    expect(dialog.queryByRole('button', { name: 'Guardar' })).toBeNull()
    await userEvent.type(dialog.getByLabelText('Descripción'), 'Tierra de dragones')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(dialog.getByLabelText<HTMLInputElement>('Descripción').value).toBe('')
    expect(dialog.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('crear un mundo abre la misma ventana que sus ajustes: color propio (que se recuerda) y portada', async () => {
    // jsdom no tiene URL.createObjectURL: la vista previa de la imagen aún sin subir
    URL.createObjectURL = () => 'blob:portada'
    URL.revokeObjectURL = () => {}
    const api = fakeApi({ organizations: [ORG] })
    renderWorlds(api)
    await userEvent.click(await screen.findByRole('button', { name: 'Crear tu primer mundo' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nuevo mundo' }))
    await userEvent.type(dialog.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.type(dialog.getByLabelText('Descripción'), 'Tierra de dragones')
    expect(dialog.getByRole<HTMLInputElement>('radio', { name: 'Sin color' }).checked).toBe(true)
    expect(dialog.queryByRole('group', { name: 'Icono' })).toBeNull()
    fireEvent.input(dialog.getByLabelText('Color propio'), { target: { value: '#aa3355' } })
    await userEvent.click(dialog.getByRole('button', { name: 'Añadir portada' }))
    const coverDialog = await screen.findByRole('dialog', { name: 'Portada' })
    const cover = within(coverDialog)
    const image = new File(['png'], 'eana.png', { type: 'image/png' })
    await userEvent.upload(coverDialog.querySelector('input[type="file"]') as HTMLInputElement, image)
    await userEvent.click(await cover.findByRole('button', { name: 'Guardar' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Crear el mundo' }))
    expect(await screen.findByText('Tierra de dragones')).toBeDefined()
    expect(api.calls).toEqual(expect.arrayContaining(['createWorld', 'uploadFile', 'updateWorld']))
    expect(localStorage.getItem('crisol.colores.enrique@crisol.test')).toBe('["#aa3355"]')
  })

  it('con mundos, «Nuevo mundo» es un recuadro tras el último', async () => {
    renderWorlds(fakeApi({ organizations: [ORG], worlds: [eana()] }))
    const list = within(await screen.findByRole('list', { name: 'Mundos' }))
    const items = list.getAllByRole('listitem')
    expect(within(items[items.length - 1] as HTMLElement).getByRole('button', { name: 'Nuevo mundo' })).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Nuevo mundo' })).toHaveLength(1)
  })

  it('quien juega en un mundo no tiene su engranaje', async () => {
    renderWorlds(fakeApi({ organizations: [ORG], worlds: [{ ...eana(), role: 'player' as const }] }))
    expect(await screen.findByText('Eana')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Ajustes de Eana' })).toBeNull()
  })

  it('quien no es propietario no ve el formulario de crear', async () => {
    renderWorlds(fakeApi({ organizations: [{ ...ORG, role: 'member' }] }))
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
    expect(screen.queryByLabelText('Nombre del mundo')).toBeNull()
  })

  it('sin sesión lleva a entrar', async () => {
    const { router } = renderWorlds(fakeApi(), fakeAccountClient())
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('si el servidor rechaza crear, lo dice', async () => {
    const api = fakeApi({ organizations: [ORG] })
    const original = api.client.call
    api.client.call = async (name, input) => {
      if (name === 'createWorld') throw new ApiError('FORBIDDEN', 403)
      return original(name, input)
    }
    renderWorlds(api)
    await userEvent.click(await screen.findByRole('button', { name: 'Crear tu primer mundo' }))
    await userEvent.type(screen.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el mundo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No tienes permiso')
  })
})
