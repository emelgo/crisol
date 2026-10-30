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
  it('se leen con su tipo: números en español, sí o no, listas y enlaces a páginas', async () => {
    renderPort([
      { name: 'Región', type: 'pages', value: [COAST] },
      { name: 'Población', type: 'number', value: 4200 },
      { name: 'Libre', type: 'boolean', value: true },
      { name: 'alias', type: 'list', value: ['El Puerto', 'La Ceniza'] }
    ])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect(properties.getByText((4200).toLocaleString('es'))).toBeDefined()
    expect(properties.getByText('Sí')).toBeDefined()
    expect(properties.getByText('El Puerto')).toBeDefined()
    expect(await properties.findByRole('link', { name: 'Costa Gris' })).toBeDefined()
  })

  it('se añaden de un clic las reservadas, se ordenan y se guardan', async () => {
    const { api } = renderPort()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir propiedades' }))
    const editor = within(screen.getByRole('form', { name: 'Propiedades' }))
    expect(document.activeElement).toBe(editor.getByRole('button', { name: 'Añadir propiedad' }))
    await userEvent.click(editor.getByRole('button', { name: 'Etiquetas' }))
    await userEvent.type(editor.getByLabelText('Valor de la propiedad 1'), 'lugar/ciudad, costa')
    await userEvent.click(editor.getByRole('button', { name: 'Añadir propiedad' }))
    expect(document.activeElement).toBe(editor.getByLabelText('Nombre de la propiedad 2'))
    await userEvent.keyboard('Población')
    await userEvent.selectOptions(editor.getByLabelText('Tipo de la propiedad 2'), 'Número')
    await userEvent.type(editor.getByLabelText('Valor de la propiedad 2'), '4200')
    await userEvent.click(editor.getByRole('button', { name: 'Subir Población' }))
    await userEvent.click(editor.getByRole('button', { name: 'Guardar' }))

    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect(properties.getAllByRole('term').map((term) => term.textContent)).toEqual(['Población', 'etiquetas'])
    expect(properties.getByText('costa')).toBeDefined()
    expect(api.calls).toContain('setPageProperties')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar propiedades' }))
  })

  it('un número que no lo es no se guarda, y lo dice', async () => {
    const { api } = renderPort([{ name: 'Población', type: 'number', value: 4200 }])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar propiedades' }))
    const value = screen.getByLabelText('Valor de la propiedad 1')
    await userEvent.clear(value)
    await userEvent.type(value, 'muchos')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('«Población» tiene que ser un número')
    expect(api.calls).not.toContain('setPageProperties')
  })

  it('una propiedad de páginas se rellena eligiendo por el título', async () => {
    renderPort()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir propiedades' }))
    await userEvent.click(screen.getByRole('button', { name: 'Añadir propiedad' }))
    await userEvent.keyboard('Región')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de la propiedad 1'), 'Páginas')
    await userEvent.type(screen.getByLabelText('Valor de la propiedad 1'), 'Costa Gris')
    expect(await screen.findByRole('button', { name: 'Quitar Costa Gris' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect(await properties.findByRole('link', { name: 'Costa Gris' })).toBeDefined()
  })
})

describe('el icono de una página', () => {
  it('se elige de los habituales y sale en el árbol; Escape cierra y devuelve el foco', async () => {
    renderPort()
    const trigger = await screen.findByRole('button', { name: 'Añadir icono' })
    await userEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'Usar ⚓' }))
    expect(await screen.findByRole('button', { name: 'Icono ⚓: cambiarlo' })).toBeDefined()
  })

  it('se escribe cualquier otro, y se quita', async () => {
    renderPort([], '⚓')
    await userEvent.click(await screen.findByRole('button', { name: 'Icono ⚓: cambiarlo' }))
    await userEvent.type(screen.getByLabelText('Otro emoji'), '🦑')
    await userEvent.click(screen.getByRole('button', { name: 'Usar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Icono 🦑: cambiarlo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el icono' }))
    expect(await screen.findByRole('button', { name: 'Añadir icono' })).toBeDefined()
  })
})

describe('el panel de etiquetas', () => {
  it('desde la wiki se llega a las etiquetas, con cuántas páginas tiene cada una', async () => {
    renderPort([{ name: 'etiquetas', type: 'list', value: ['lugar/ciudad', 'costa'] }])
    await userEvent.click(await screen.findByRole('link', { name: 'Etiquetas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Etiquetas de Eana' })).toBeDefined()
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
