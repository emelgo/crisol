import type { World } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { LinkPreview } from './preview.tsx'

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
const MAELA = crypto.randomUUID()

/** La vista previa de Maela Varn, sola, con su API de pruebas y un router para sus enlaces */
function renderPreview(sheet: boolean) {
  const onClose = vi.fn()
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: MAELA, worldId: WORLD.id, title: 'Maela Varn' }]
  })
  const root = createRootRoute({
    component: () => (
      <ApiProvider client={api.client}>
        <LinkPreview
          worldId={WORLD.id}
          pageId={MAELA}
          anchor={null}
          anchorElement={null}
          sheet={sheet}
          onClose={onClose}
        />
      </ApiProvider>
    )
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory() })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { onClose }
}

describe('la vista previa de un enlace', () => {
  it('es un diálogo con el título de la página y «Abrir»; Escape la cierra y devuelve el foco', async () => {
    const { onClose } = renderPreview(false)
    const dialog = await screen.findByRole('dialog', { name: 'Maela Varn' })
    const open = await screen.findByRole('link', { name: 'Abrir' })
    expect(open.getAttribute('href')).toBe(`/mundos/${WORLD.id}/wiki/${MAELA}`)
    open.focus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledWith(true)
    expect(dialog).toBeDefined()
  })

  it('en el móvil, una hoja: el foco va a «Abrir página» y «Cerrar» la cierra', async () => {
    const { onClose } = renderPreview(true)
    await screen.findByRole('dialog', { name: 'Maela Varn' })
    const open = await screen.findByRole('link', { name: 'Abrir página' })
    await vi.waitFor(() => expect(document.activeElement).toBe(open))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledWith(true)
  })
})
