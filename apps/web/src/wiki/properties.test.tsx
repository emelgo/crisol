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

const renderPort = (properties: PageProperty[] = [], icon: string | null = null) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: COAST, worldId: WORLD.id, title: 'Costa Gris' },
      { id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza', icon, properties },
      {
        worldId: WORLD.id,
        title: 'Velaria',
        properties: [{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] }]
      }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('las propiedades de una página', () => {
  const saved = async (api: ReturnType<typeof renderPort>['api']) =>
    (await api.client.call('getPage', { pageId: PORT })).properties

  it('se ven con su valor ya editable: números, sí o no, listas y enlaces a páginas', async () => {
    renderPort([
      { name: 'Región', type: 'pages', value: [COAST] },
      { name: 'Población', type: 'number', value: 4200 },
      { name: 'Libre', type: 'boolean', value: true },
      { name: 'alias', type: 'list', value: ['El Puerto', 'La Ceniza'] }
    ])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect((properties.getByLabelText('Valor de la propiedad 2') as HTMLInputElement).value).toBe('4200')
    expect((properties.getByLabelText('Valor de la propiedad 3') as HTMLInputElement).checked).toBe(true)
    expect(properties.getByText('El Puerto')).toBeDefined()
    expect(await properties.findByRole('link', { name: 'Costa Gris' })).toBeDefined()
    // Sin «Guardar» ni «Cancelar»
    expect(properties.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('se cambian en el sitio: Intro guarda, Escape deshace; las reservadas, de un clic', async () => {
    const { api } = renderPort([{ name: 'Población', type: 'number', value: 4200 }])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    const value = properties.getByLabelText('Valor de la propiedad 1')
    await userEvent.clear(value)
    await userEvent.type(value, '5000{Escape}')
    expect((value as HTMLInputElement).value).toBe('4200')
    await userEvent.clear(value)
    await userEvent.type(value, '5000{Enter}')
    await waitFor(async () => expect(await saved(api)).toEqual([{ name: 'Población', type: 'number', value: 5000 }]))

    // Las etiquetas: se escribe y se pone con Intro; se guarda ya
    await userEvent.click(properties.getByRole('button', { name: 'Etiquetas' }))
    await userEvent.type(properties.getByLabelText('Valor de la propiedad 2'), 'lugar/ciudad{Enter}')
    await waitFor(async () =>
      expect(await saved(api)).toContainEqual({ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] })
    )
    // Una nueva: el foco va a su nombre; Intro pasa al valor
    await userEvent.click(properties.getByRole('button', { name: '+ Propiedad' }))
    expect(document.activeElement).toBe(properties.getByLabelText('Nombre de la propiedad 3'))
    await userEvent.keyboard('Clima{Enter}')
    expect(document.activeElement).toBe(properties.getByLabelText('Valor de la propiedad 3'))
    await userEvent.keyboard('Ceniza y niebla{Enter}')
    await waitFor(async () =>
      expect(await saved(api)).toContainEqual({ name: 'Clima', type: 'text', value: 'Ceniza y niebla' })
    )
    // Quitar
    await userEvent.click(properties.getByRole('button', { name: 'Quitar Clima' }))
    await waitFor(async () => expect((await saved(api)).map((p) => p.name)).toEqual(['Población', 'etiquetas']))
  })

  it('un número que no lo es no se guarda, y lo dice', async () => {
    const { api } = renderPort([{ name: 'Población', type: 'number', value: 4200 }])
    const value = await screen.findByLabelText('Valor de la propiedad 1')
    await userEvent.clear(value)
    await userEvent.type(value, 'muchos{Enter}')
    expect((await screen.findByRole('alert')).textContent).toBe('«Población» tiene que ser un número')
    expect(api.calls).not.toContain('setPageProperties')
  })

  it('una propiedad de páginas se rellena eligiendo por el título', async () => {
    const { api } = renderPort()
    await userEvent.click(await screen.findByRole('button', { name: '+ Propiedad' }))
    await userEvent.keyboard('Región')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de la propiedad 1'), 'Páginas')
    await userEvent.type(screen.getByLabelText('Valor de la propiedad 1'), 'Costa Gris')
    expect(await screen.findByRole('button', { name: 'Quitar Costa Gris' })).toBeDefined()
    await waitFor(async () => expect(await saved(api)).toEqual([{ name: 'Región', type: 'pages', value: [COAST] }]))
  })
})

describe('el icono de una página', () => {
  it('sin icono no hay botón para ponerlo: si se quiere, va en el propio título', async () => {
    renderPort()
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    expect(screen.queryByRole('button', { name: 'Añadir icono' })).toBeNull()
  })

  it('el que ya tiene se cambia por cualquier otro, o se quita', async () => {
    renderPort([], '⚓')
    await userEvent.click(await screen.findByRole('button', { name: 'Icono ⚓: cambiarlo' }))
    await userEvent.type(screen.getByLabelText('Otro emoji'), '🦑')
    await userEvent.click(screen.getByRole('button', { name: 'Usar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Icono 🦑: cambiarlo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el icono' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Icono/ })).toBeNull())
  })
})

describe('las etiquetas de la cuenta', () => {
  it('las de las páginas salen en Etiquetas, en árbol y con cuántas páginas tiene cada una', async () => {
    const { router } = renderPort([{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad', 'costa'] }])
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    await router.navigate({ to: '/etiquetas' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Etiquetas' })).toBeDefined()
    const tags = within(screen.getByRole('list', { name: 'Etiquetas' }))
    await waitFor(() =>
      expect(tags.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'costa1 página',
        'lugar2 páginas',
        'ciudad2 páginas'
      ])
    )
  })
})
