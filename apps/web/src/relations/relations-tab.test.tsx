import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const ILSA = crypto.randomUUID()
const ALDREN = crypto.randomUUID()
const ORDEN = crypto.randomUUID()
const PUERTO = crypto.randomUUID()
const SUELTA = crypto.randomUUID()

const setup = () =>
  fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      {
        id: ILSA,
        worldId: WORLD.id,
        title: 'Ilsa de Varn',
        properties: [
          { name: 'Rol', type: 'text', value: 'Princesa de Altamar' },
          { name: 'Padres', field: 'padres', type: 'pages', value: [ALDREN], role: 'parent', inverseName: 'Hijos' },
          { name: 'Facción', field: 'faccion', type: 'pages', value: [ORDEN], role: 'member-of', single: true },
          { name: 'Lugar', field: 'lugar', type: 'pages', value: [PUERTO], single: true }
        ]
      },
      { id: ALDREN, worldId: WORLD.id, title: 'Aldren IV' },
      { id: ORDEN, worldId: WORLD.id, title: 'La Orden del Alba' },
      { id: PUERTO, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: SUELTA, worldId: WORLD.id, title: 'Notas sueltas' }
    ]
  })

const renderAt = (api: ReturnType<typeof fakeApi>, pageId: string, search = '') => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${pageId}${search}`] })
  )
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
const modes = async () => within(await screen.findByRole('toolbar', { name: 'Modo' }))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
})

describe('la pestaña «Relaciones» (módulo 10)', () => {
  it('sale, tras las demás, en una página con relaciones; en una suelta, no', async () => {
    const api = setup()
    renderAt(api, ILSA)
    expect(await (await bar()).findByRole('link', { name: 'Relaciones' })).toBeDefined()
    const api2 = setup()
    renderAt(api2, SUELTA)
    await screen.findAllByRole('link', { name: 'Texto' })
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Pestañas de la página' })).toHaveLength(2))
    const tabs = screen.getAllByRole('navigation', { name: 'Pestañas de la página' })[1] as HTMLElement
    expect(within(tabs).queryByRole('link', { name: 'Relaciones' })).toBeNull()
  })

  it('se abre en Familia si la página la tiene, con sus tarjetas; el modo elegido se recuerda', async () => {
    const api = setup()
    renderAt(api, ILSA, '?pestana=relaciones')
    const pill = await modes()
    await waitFor(() => expect(pill.getByRole('button', { name: 'Familia' }).getAttribute('aria-pressed')).toBe('true'))
    expect(pill.getByRole('button', { name: 'Organigrama' })).toBeDefined()
    // Bajo el nombre, su primer campo de texto
    expect(await screen.findByRole('button', { name: 'Ilsa de Varn, Princesa de Altamar' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Aldren IV' })).toBeDefined()
    await userEvent.click(pill.getByRole('button', { name: 'Enlaces' }))
    expect(localStorage.getItem('crisol.relaciones.modo.sin-plantilla')).toBe('links')
    // En Enlaces: la profundidad y «Solo campos», a la derecha de las pestañas, y la leyenda
    expect(await screen.findByRole('toolbar', { name: 'Profundidad' })).toBeDefined()
    expect(screen.getByRole('switch', { name: 'Solo campos' })).toBeDefined()
    expect(screen.getByRole('list', { name: 'Leyenda' })).toBeDefined()
  })

  it('Enlaces: pulsar una página saca su ficha; «Centrar aquí» rehace el grafo y «Volver a…» vuelve', async () => {
    localStorage.setItem('crisol.relaciones.modo.sin-plantilla', 'links')
    const api = setup()
    renderAt(api, ILSA, '?pestana=relaciones')
    // Sin pulsar el ratón (fireEvent): mover y acercar (d3-zoom) necesita lo que happy-dom no tiene
    fireEvent.click(await screen.findByRole('button', { name: 'Puerto Ceniza' }))
    const card = within(await screen.findByRole('region', { name: 'Puerto Ceniza' }))
    // Se lee desde ella: el campo de Ilsa, al revés («Lugar de»)
    expect(card.getByText('Lugar de')).toBeDefined()
    await userEvent.click(card.getByRole('button', { name: 'Centrar aquí' }))
    const back = await screen.findByRole('button', { name: 'Volver a Ilsa de Varn' })
    expect(screen.queryByRole('region', { name: 'Puerto Ceniza' })).toBeNull()
    await userEvent.click(back)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Volver a Ilsa de Varn' })).toBeNull())
  })

  it('el doble clic abre la página', async () => {
    localStorage.setItem('crisol.relaciones.modo.sin-plantilla', 'links')
    const api = setup()
    const router = renderAt(api, ILSA, '?pestana=relaciones')
    fireEvent.doubleClick(await screen.findByRole('button', { name: 'Aldren IV' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${ALDREN}`))
  })
})
