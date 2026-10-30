import type { World } from '@crisol/contracts'
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
const ids = { port: crypto.randomUUID(), velaria: crypto.randomUUID(), maela: crypto.randomUUID() }

const renderAt = (pageId: string) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: ids.port, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { id: ids.velaria, worldId: WORLD.id, title: 'Velaria' },
      { id: ids.maela, worldId: WORLD.id, title: 'Maela Varn' }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${pageId}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}
const tabs = async () => within(await screen.findByRole('navigation', { name: 'Páginas abiertas' }))
/** Abre la página y espera a que esté en las pestañas */
const open = async (router: ReturnType<typeof renderAt>['router'], pageId: string, title: string) => {
  await router.navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: WORLD.id, pageId } })
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined()
  expect(await (await tabs()).findByRole('link', { name: title })).toBeDefined()
}
const opened = async (title: string) => {
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined()
  expect(await (await tabs()).findByRole('link', { name: title })).toBeDefined()
}

describe('las pestañas', () => {
  it('cada página que se abre entra; la abierta va marcada', async () => {
    const { router } = renderAt(ids.port)
    await opened('Puerto Ceniza')
    await open(router, ids.maela, 'Maela Varn')
    await waitFor(async () =>
      expect((await tabs()).getAllByRole('link').map((l) => l.textContent)).toEqual(['Puerto Ceniza', 'Maela Varn'])
    )
    expect((await tabs()).getByRole('link', { name: 'Maela Varn' }).getAttribute('aria-current')).toBe('page')
  })

  it('cerrar la abierta lleva a otra; una fijada va delante y no se cierra', async () => {
    const { router } = renderAt(ids.port)
    await opened('Puerto Ceniza')
    await open(router, ids.velaria, 'Velaria')
    await open(router, ids.maela, 'Maela Varn')
    await userEvent.click((await tabs()).getByRole('button', { name: 'Fijar Velaria' }))
    await waitFor(async () =>
      expect((await tabs()).getAllByRole('link').map((l) => l.textContent)).toEqual([
        'Velaria',
        'Puerto Ceniza',
        'Maela Varn'
      ])
    )
    expect((await tabs()).queryByRole('button', { name: 'Cerrar Velaria' })).toBeNull()
    await userEvent.click((await tabs()).getByRole('button', { name: 'Cerrar Maela Varn' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeDefined()
    expect((await tabs()).queryByRole('link', { name: 'Maela Varn' })).toBeNull()
  })
})

describe('los marcadores', () => {
  it('el primero va de un clic a «Marcadores»; luego se elige grupo o se crea otro; y se quitan', async () => {
    const { router } = renderAt(ids.port)
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar' }))
    // Los marcadores están en su panel: se abre con su botón de la barra de la izquierda
    const sections = within(await screen.findByRole('navigation', { name: 'Secciones' }))
    await userEvent.click(await screen.findByRole('tab', { name: 'Marcadores' }))
    const bookmarks = async () => within(await screen.findByRole('region', { name: 'Marcadores' }))
    expect((await bookmarks()).getByRole('link', { name: 'Puerto Ceniza' })).toBeDefined()
    expect(await screen.findByText('«Puerto Ceniza» está en Marcadores')).toBeDefined()

    await open(router, ids.maela, 'Maela Varn')
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar' }))
    await userEvent.type(screen.getByLabelText('O en un grupo nuevo'), 'Sesión 5')
    await userEvent.click(screen.getByRole('button', { name: 'Marcar' }))
    expect(await (await bookmarks()).findByRole('list', { name: 'Sesión 5' })).toBeDefined()
    expect(within((await bookmarks()).getByRole('list', { name: 'Sesión 5' })).getByText('Maela Varn')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el marcador' }))
    await waitFor(async () => expect((await bookmarks()).queryByText('Maela Varn')).toBeNull())
  })
})

describe('anterior y siguiente', () => {
  it('lleva a las hermanas en el orden del árbol', async () => {
    renderAt(ids.velaria)
    const siblings = within(await screen.findByRole('navigation', { name: 'Páginas hermanas' }))
    expect(siblings.getByRole('link', { name: /Anterior.*Puerto Ceniza/ })).toBeDefined()
    await userEvent.click(siblings.getByRole('link', { name: /Siguiente.*Maela Varn/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Maela Varn' })).toBeDefined()
  })
})
