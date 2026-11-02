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
const port = crypto.randomUUID()

const renderAt = (path: string) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [
      { worldId: WORLD.id, title: 'Lugares' },
      { id: port, worldId: WORLD.id, title: 'Puerto Ceniza' },
      { worldId: WORLD.id, title: 'Personajes' }
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

describe('el selector rápido', () => {
  it('Ctrl+K lo abre con el foco en el campo; busca con erratas, se elige con las flechas y abre la página', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    await screen.findByRole('heading', { level: 1, name: 'Páginas de Eana' })
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Ir a una página' })
    const field = within(dialog).getByRole('combobox', { name: 'Página u orden' })
    expect(document.activeElement).toBe(field)
    await userEvent.type(field, 'puerto cenisa')
    const list = within(dialog).getByRole('listbox', { name: 'Páginas' })
    await waitFor(() => expect(within(list).getByRole('option', { name: /Puerto Ceniza/ })).toBeDefined())
    // La primera, elegida; al final, «Ver todos»
    expect(within(list).getAllByRole('option').at(-1)?.textContent).toBe('Ver todos los resultados de «puerto cenisa»')
    expect(field.getAttribute('aria-activedescendant')).toBe(within(list).getAllByRole('option')[0]?.id)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${port}`))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con «>», las órdenes; Escape lo cierra y el foco vuelve a donde estaba', async () => {
    const router = renderAt(`/mundos/${WORLD.id}/wiki`)
    const box = await screen.findByRole('button', { name: 'Página nueva' })
    box.focus()
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Ir a una página' })
    await userEvent.type(within(dialog).getByRole('combobox'), '>arch')
    expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Archivos'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(box)
    await userEvent.keyboard('{Control>}k{/Control}')
    await userEvent.type(await screen.findByRole('combobox'), '>etiq{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/etiquetas'))
  })
})
