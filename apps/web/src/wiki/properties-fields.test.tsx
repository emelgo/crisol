import type { PageProperty, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
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
const PORT = crypto.randomUUID()
const COAST = crypto.randomUUID()

async function renderPort(properties: PageProperty[] = [], locked = false) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: COAST, worldId: WORLD.id, title: 'Costa Gris' },
      { id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza', properties }
    ]
  })
  if (locked) await api.client.call('updatePage', { pageId: PORT, locked: true })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const saved = async () => (await api.client.call('getPage', { pageId: PORT })).properties
  return { api, saved }
}

const properties = async () => within(await screen.findByRole('region', { name: 'Propiedades' }))

describe('las propiedades, campo a campo', () => {
  it('en una página en lectura se ven sin poder cambiarlas', async () => {
    await renderPort([{ name: 'Población', type: 'number', value: 4200 }], true)
    const list = await properties()
    expect(list.getByText('Población')).toBeDefined()
    expect(list.getByText('4200')).toBeDefined()
    expect(list.queryByRole('textbox')).toBeNull()
    expect(list.queryByRole('spinbutton')).toBeNull()
  })

  it('en lectura y sin propiedades, no sale nada', async () => {
    await renderPort([], true)
    await screen.findByText('En lectura: quita el candado para editar.')
    expect(screen.queryByRole('region', { name: 'Propiedades' })).toBeNull()
  })

  it('Alt y las flechas cambian el orden; la primera no sube', async () => {
    const { saved, api } = await renderPort([
      { name: 'Clima', type: 'text', value: 'Niebla' },
      { name: 'Población', type: 'number', value: 4200 }
    ])
    const name = (await properties()).getByLabelText('Nombre de la propiedad 1')
    name.focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(api.calls).not.toContain('setPageProperties')
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await waitFor(async () => expect((await saved()).map((p) => p.name)).toEqual(['Población', 'Clima']))
    // Y la última no baja
    ;(await properties()).getByLabelText('Nombre de la propiedad 2').focus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect((await saved()).map((p) => p.name)).toEqual(['Población', 'Clima'])
  })

  it('sí o no se guarda al marcarlo', async () => {
    const { saved } = await renderPort([{ name: 'Libre', type: 'boolean', value: false }])
    const check = (await properties()).getByLabelText('Valor de la propiedad 1')
    await userEvent.click(check)
    await waitFor(async () => expect(await saved()).toEqual([{ name: 'Libre', type: 'boolean', value: true }]))
    expect((await properties()).getByText('Sí')).toBeDefined()
  })

  it('una página enlazada se quita con su ×', async () => {
    const { saved } = await renderPort([{ name: 'Región', type: 'pages', value: [COAST] }])
    await userEvent.click(await (await properties()).findByRole('button', { name: 'Quitar Costa Gris' }))
    await waitFor(async () => expect(await saved()).toEqual([{ name: 'Región', type: 'pages', value: [] }]))
  })

  it('una lista: comas o Intro añaden (sin repetir), × quita uno y el borrado en vacío, el último', async () => {
    const { saved } = await renderPort([{ name: 'alias', type: 'list', value: ['El Puerto'] }])
    // Al guardar desde fuera del campo, la fila se vuelve a pintar: se busca cada vez
    const field = async () => (await properties()).getByLabelText('Valor de la propiedad 1')
    await userEvent.type(await field(), 'La Ceniza, El Puerto{Enter}')
    await waitFor(async () =>
      expect(await saved()).toEqual([{ name: 'alias', type: 'list', value: ['El Puerto', 'La Ceniza'] }])
    )
    await userEvent.type(await field(), 'Cenizas,')
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({ value: ['El Puerto', 'La Ceniza', 'Cenizas'] })
    )
    // Con la caja vacía, el borrado quita el último
    await userEvent.type(await field(), '{Backspace}')
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ value: ['El Puerto', 'La Ceniza'] }))
    await userEvent.click((await properties()).getByRole('button', { name: 'Quitar El Puerto' }))
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ value: ['La Ceniza'] }))
    // Lo escrito se añade también al salir; solo espacios, no
    await userEvent.type(await field(), 'Puerto Gris')
    await userEvent.tab()
    await waitFor(async () => expect((await saved())[0]).toMatchObject({ value: ['La Ceniza', 'Puerto Gris'] }))
    await userEvent.type(await field(), '   ')
    await userEvent.tab()
    expect((await saved())[0]).toMatchObject({ value: ['La Ceniza', 'Puerto Gris'] })
  })

  it('el resumen se escribe en un cuadro de varias líneas', async () => {
    const { saved } = await renderPort([{ name: 'resumen', type: 'text', value: '' }])
    const field = (await properties()).getByLabelText('Valor de la propiedad 1')
    expect(field.tagName.toLowerCase()).toBe('textarea')
    await userEvent.type(field, 'Un puerto de pescadores')
    await userEvent.tab()
    await waitFor(async () =>
      expect(await saved()).toEqual([{ name: 'resumen', type: 'text', value: 'Un puerto de pescadores' }])
    )
  })

  it('una propiedad se quita con su ×', async () => {
    const { saved } = await renderPort([
      { name: 'Clima', type: 'text', value: 'Niebla' },
      { name: 'Población', type: 'number', value: 4200 }
    ])
    await userEvent.click((await properties()).getByRole('button', { name: 'Quitar Clima' }))
    await waitFor(async () => expect((await saved()).map((p) => p.name)).toEqual(['Población']))
  })
})
