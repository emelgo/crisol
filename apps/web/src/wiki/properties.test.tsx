import type { PageProperty, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// El tutorial del mundo, ya visto (si no, sale y se lleva el foco)
beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))

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
      },
      { worldId: WORLD.id, title: 'La Raqisa', template: 'faccion' }
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

/** Las etiquetas y las propiedades se añaden desde «Añadir bloque» del panel */
async function addFromPanel(name: 'Etiquetas' | 'Propiedad') {
  const panel = within(await screen.findByRole('complementary', { name: 'Panel de la página' }))
  await userEvent.click(panel.getByRole('button', { name: 'Añadir bloque' }))
  await userEvent.click(panel.getByRole('button', { name }))
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
    await addFromPanel('Etiquetas')
    await userEvent.type(properties.getByLabelText('Valor de la propiedad 2'), 'lugar/ciudad{Enter}')
    await waitFor(async () =>
      expect(await saved(api)).toContainEqual({ name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] })
    )
    // Una nueva: el foco va a su nombre; Intro pasa al valor
    await addFromPanel('Propiedad')
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

  it('al cambiar una, las de plantilla conservan su campo y su forma (opciones, reloj, enlace a una sola página)', async () => {
    const fields: PageProperty[] = [
      { name: 'Población', field: 'poblacion', type: 'number', value: 4200 },
      { name: 'Estado', field: 'estado', type: 'choice', value: 'Vive', options: ['Vive', 'Ha muerto'] },
      { name: 'Reloj', field: 'reloj', type: 'clock', value: 3, segments: 8 },
      { name: 'Región', field: 'region', type: 'pages', single: true, targets: ['lugar'], value: [COAST] }
    ]
    const { api } = renderPort(fields)
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    const value = properties.getByLabelText('Valor de la propiedad 1')
    await userEvent.clear(value)
    await userEvent.type(value, '5000{Enter}')
    await waitFor(async () => expect(await saved(api)).toEqual([{ ...fields[0], value: 5000 }, ...fields.slice(1)]))
  })

  it('unas opciones se eligen en su lista flotante, con el ratón o con el teclado', async () => {
    const estado: PageProperty = {
      name: 'Estado',
      field: 'estado',
      type: 'choice',
      value: 'Vive',
      options: ['Vive', 'Ha muerto', 'No se sabe']
    }
    const { api } = renderPort([estado])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    const button = properties.getByRole('button', { name: /^Valor de la propiedad 1:/ })
    expect(button.textContent).toContain('Vive')
    await userEvent.click(button)
    const list = properties.getByRole('listbox', { name: 'Valor de la propiedad 1' })
    // El foco, en la elegida
    expect(document.activeElement).toBe(within(list).getByRole('option', { name: 'Vive' }))
    await userEvent.click(within(list).getByRole('option', { name: 'Ha muerto' }))
    await waitFor(async () => expect(await saved(api)).toEqual([{ ...estado, value: 'Ha muerto' }]))
    expect(properties.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(button)

    // Con el teclado: flecha abajo abre, flechas mueven, Intro elige y Escape cierra sin cambiar nada
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('No se sabe')
    await userEvent.keyboard('{Enter}')
    await waitFor(async () => expect(await saved(api)).toEqual([{ ...estado, value: 'No se sabe' }]))
    await userEvent.keyboard('{ArrowDown}{Escape}')
    expect(properties.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('un valor que no está entre las opciones se ve marcado y no se pierde', async () => {
    renderPort([{ name: 'Estado', type: 'choice', value: 'Prisionera', options: ['Vive', 'Ha muerto'] }])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    const button = properties.getByRole('button', { name: /^Valor de la propiedad 1:/ })
    expect(button.textContent).toContain('Prisionera')
    expect(button.getAttribute('title')).toBe('No está entre las opciones')
  })

  it('un reloj se marca pulsando sus segmentos, y se desmarca pulsando el último lleno', async () => {
    const reloj: PageProperty = { name: 'Reloj', field: 'reloj', type: 'clock', value: 3, segments: 8 }
    const { api } = renderPort([reloj])
    const clock = within(await screen.findByRole('group', { name: 'Valor de la propiedad 1' }))
    expect(clock.getByText('3 de 8')).toBeDefined()
    expect(clock.getByRole('button', { name: 'Segmento 3 de 8' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(clock.getByRole('button', { name: 'Segmento 5 de 8' }))
    await waitFor(async () => expect(await saved(api)).toEqual([{ ...reloj, value: 5 }]))
    await userEvent.click(clock.getByRole('button', { name: 'Segmento 5 de 8' }))
    await waitFor(async () => expect(await saved(api)).toEqual([{ ...reloj, value: 4 }]))
  })

  it('un enlace a una sola página la cambia al elegir otra', async () => {
    const region: PageProperty = { name: 'Región', field: 'region', type: 'pages', single: true, value: [COAST] }
    const { api } = renderPort([region])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    await properties.findByRole('link', { name: 'Costa Gris' })
    await userEvent.type(properties.getByLabelText('Valor de la propiedad 1'), 'Velaria{Enter}')
    await waitFor(async () => {
      const [property] = await saved(api)
      expect(property).toMatchObject({ field: 'region', single: true })
      expect(property?.type === 'pages' && property.value.length).toBe(1)
      expect(property?.type === 'pages' && property.value[0]).not.toBe(COAST)
    })
  })

  it('un enlace de un tipo busca primero en las páginas de ese tipo, y «Todas las páginas» enseña el resto', async () => {
    renderPort([{ name: 'Facción', field: 'faccion', type: 'pages', single: true, targets: ['faccion'], value: [] }])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    const input = properties.getByLabelText('Valor de la propiedad 1')
    const offered = () =>
      [...(document.getElementById(input.getAttribute('list') ?? '')?.querySelectorAll('option') ?? [])].map(
        (option) => option.value
      )
    await waitFor(() => expect(offered()).toEqual(['La Raqisa']))
    await userEvent.click(properties.getByRole('button', { name: 'Todas las páginas' }))
    expect(offered()).toContain('Costa Gris')
    await userEvent.click(properties.getByRole('button', { name: 'Solo las de su tipo' }))
    expect(offered()).toEqual(['La Raqisa'])
  })

  it('un enlace a una página que está en la papelera sale tachado, sin llevar a ella', async () => {
    const { api } = renderPort([{ name: 'Región', type: 'pages', value: [COAST] }])
    await api.client.call('deletePage', { pageId: COAST })
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    expect(await properties.findByText('Costa Gris, en la papelera')).toBeDefined()
    expect(properties.queryByRole('link', { name: 'Costa Gris' })).toBeNull()
  })

  it('a mano también hay opciones y relojes: el tipo se cambia y su forma se escribe al editarla', async () => {
    const { api } = renderPort([{ name: 'Estado', type: 'text', value: 'Vive' }])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    await userEvent.selectOptions(properties.getByLabelText('Tipo de la propiedad 1'), 'Opciones')
    // Lo escrito pasa a ser su primera opción
    await waitFor(async () =>
      expect(await saved(api)).toEqual([{ name: 'Estado', type: 'choice', value: 'Vive', options: ['Vive'] }])
    )
    await userEvent.click(properties.getByRole('button', { name: /^Valor de la propiedad 1:/ }))
    await userEvent.type(properties.getByLabelText('Opciones de Estado'), 'Ha muerto{Enter}')
    await waitFor(async () =>
      expect(await saved(api)).toEqual([
        { name: 'Estado', type: 'choice', value: 'Vive', options: ['Vive', 'Ha muerto'] }
      ])
    )
    await userEvent.selectOptions(properties.getByLabelText('Tipo de la propiedad 1'), 'Reloj')
    await waitFor(async () =>
      expect(await saved(api)).toEqual([{ name: 'Estado', type: 'clock', value: 0, segments: 4 }])
    )
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
    await addFromPanel('Propiedad')
    await userEvent.keyboard('Región')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de la propiedad 1'), 'Páginas')
    await userEvent.type(screen.getByLabelText('Valor de la propiedad 1'), 'Costa Gris')
    expect(await screen.findByRole('button', { name: 'Quitar Costa Gris' })).toBeDefined()
    await waitFor(async () => expect(await saved(api)).toEqual([{ name: 'Región', type: 'pages', value: [COAST] }]))
  })
})

describe('el icono de una página', () => {
  it('sin icono, el de su tipo se pulsa igual («Cambiar el icono», también con Intro): abre los de la app', async () => {
    const { api } = renderPort()
    await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })
    const choose = screen.getByRole('button', { name: 'Cambiar el icono' })
    expect(choose.getAttribute('aria-expanded')).toBe('false')
    // Delante del título, en su encabezado
    expect(choose.closest('header')?.querySelector('h1')).not.toBeNull()
    choose.focus()
    await userEvent.keyboard('{Enter}')
    expect(choose.getAttribute('aria-expanded')).toBe('true')
    // Sin icono, nada que quitar
    expect(screen.queryByRole('button', { name: 'Quitar el icono' })).toBeNull()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'castillo')
    await userEvent.click(screen.getByRole('button', { name: 'Castillo' }))
    expect(await screen.findByRole('button', { name: 'Icono Castillo: cambiarlo' })).toBeDefined()
    expect(api.calls).toContain('updatePage')
  })

  it('con la página bloqueada, sin icono no hay botón; con uno, solo se ve', async () => {
    const { api } = renderPort([], '⚓')
    await userEvent.click(await screen.findByRole('button', { name: 'Poner en lectura' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Icono ⚓: cambiarlo' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Cambiar el icono' })).toBeNull()
    expect(api.calls).toContain('updatePage')
  })

  it('el que ya tiene se cambia por uno de la app, del buscador de su caja (sin emojis por defecto), o se quita', async () => {
    const { api } = renderPort([], '⚓')
    await userEvent.click(await screen.findByRole('button', { name: 'Icono ⚓: cambiarlo' }))
    expect(screen.queryByLabelText('Otro emoji')).toBeNull()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un icono' }), 'castillo')
    await userEvent.click(screen.getByRole('button', { name: 'Castillo' }))
    expect(api.calls).toContain('updatePage')
    await userEvent.click(await screen.findByRole('button', { name: 'Icono Castillo: cambiarlo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el icono' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Icono/ })).toBeNull())
    // Quitado, el botón sigue (con el de su tipo) y el foco, en él
    const choose = screen.getByRole('button', { name: 'Cambiar el icono' })
    await waitFor(() => expect(document.activeElement).toBe(choose))
  })

  it('se pone en el propio título: un emoji delante, o «:» y su nombre, que propone los de la app', async () => {
    renderPort()
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(title)
    await userEvent.keyboard('{Control>}a{/Control}🏰 Puerto Ceniza{Enter}')
    expect(await screen.findByRole('button', { name: 'Icono 🏰: cambiarlo' })).toBeDefined()
    expect(title.textContent).toBe('Puerto Ceniza')
    // «:» al principio: los de la app; las flechas eligen, Escape los deja sin tocar nada
    await userEvent.click(title)
    await userEvent.keyboard('{Home}:ancla')
    const options = within(await screen.findByRole('listbox', { name: 'Iconos' }))
    expect(options.getAllByRole('option').length).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(title.textContent).toBe(':anclaPuerto Ceniza')
  })

  it('«:» y su nombre: con el ratón, uno de los propuestos, sin salir del título', async () => {
    renderPort([], '🏰')
    const title = await screen.findByRole('textbox', { name: 'Título de la página' })
    await userEvent.click(title)
    await userEvent.keyboard('{Home}:ancla')
    const anchors = within(await screen.findByRole('listbox', { name: 'Iconos' }))
    await userEvent.click(anchors.getByRole('option', { name: 'Ancla' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Icono 🏰: cambiarlo' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Icono Ancla: cambiarlo' })).toBeDefined()
    expect(document.activeElement).toBe(title)
    expect(title.textContent).toBe('Puerto Ceniza')
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
      // La última fila es «Nueva etiqueta»
      expect(
        tags
          .getAllByRole('listitem')
          .map((item) => item.textContent)
          .slice(0, -1)
      ).toEqual(['costa1 página', 'lugar2 páginas', 'ciudad2 páginas'])
    )
  })
})
