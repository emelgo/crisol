import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
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
const places = crypto.randomUUID()

const renderAt = (path: string) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { id: places, worldId: WORLD.id, title: 'Lugares' },
      { worldId: WORLD.id, parentId: places, title: 'Dragón rojo' },
      { worldId: WORLD.id, title: 'Puerto Ceniza' }
    ]
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return router
}

describe('buscar en la wiki', () => {
  it('desde el filtro del panel, con Intro: lo buscado va en la dirección, con los resultados, su ruta y lo encontrado', async () => {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    // El filtro del panel de las páginas: al escribir filtra el árbol; con Intro, busca en el texto de todas
    await screen.findByRole('treeitem', { name: 'Eana' })
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' }),
      'dragon{Enter}'
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Buscar en Eana' })).toBeDefined()
    expect(router.state.location.search).toMatchObject({ q: 'dragon' })
    expect(await screen.findByText('1 página coincide con «dragon».')).toBeDefined()
    const results = within(screen.getByRole('list', { name: 'Resultados' }))
    expect(results.getByRole('link', { name: 'Dragón rojo' })).toBeDefined()
    expect(results.getByText('Lugares')).toBeDefined()
    expect(results.getByText('Dragón rojo', { selector: 'mark' })).toBeDefined()
  })

  it('sin nada que coincida lo dice; en una rama, se puede volver a toda la wiki', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/buscar?q=xyz&rama=${places}`)
    expect(await screen.findByText('Nada coincide con «xyz».')).toBeDefined()
    expect(await screen.findByText('Solo en «Lugares» y sus subpáginas.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Buscar en todas las páginas' }))
    expect(router.state.location.search).toEqual({ q: 'xyz' })
  })
})
