import type { Campaign, Organization, World } from '@crisol/contracts'
import type { System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { useNewEntry, WorldWindows } from './new-entry.tsx'

const ORG: Organization = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' }
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
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}

/** Lo que pide una entrada nueva desde la página (aquí, un botón): con el nombre ya escrito */
function Asker({ done }: { done: (saved: string) => void }) {
  const newEntry = useNewEntry()
  return (
    <button type="button" onClick={() => newEntry?.('Grifo', done)}>
      Pedir
    </button>
  )
}

/** Las ventanas del mundo, solas, con su API de pruebas */
function renderWindows(campaigns: Campaign[], organization = ORG) {
  const done = vi.fn()
  const api = fakeApi({
    organizations: [organization],
    worlds: [WORLD],
    campaigns,
    systems: [SYSTEM],
    systemContent: {}
  })
  const root = createRootRoute({
    component: () => (
      <ApiProvider client={api.client}>
        <WorldWindows worldId={WORLD.id}>
          <Asker done={done} />
        </WorldWindows>
      </ApiProvider>
    )
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory() })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { api, done }
}

describe('«Entrada nueva del compendio» desde el mundo (tanda 7)', () => {
  it('se abre en una ventana con el nombre escrito; al guardarla va al compendio del mundo y devuelve su nombre', async () => {
    const { api, done } = renderWindows([CAMPAIGN])
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir' }))
    const box = within(await screen.findByRole('dialog', { name: 'Nueva entrada' }))
    const name = await box.findByRole('textbox', { name: 'Nombre' })
    expect(name).toHaveProperty('value', 'Grifo')
    await userEvent.type(name, ' real')
    await userEvent.click(box.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(done).toHaveBeenCalledWith('Grifo real'))
    // Guardada en el mundo, y la ventana se cierra
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva entrada' })).toBeNull())
    const { items } = await api.client.call('searchLinkableContent', { worldId: WORLD.id, query: 'Grifo' })
    expect(items.map((each) => each.name)).toContain('Grifo real')
  })

  it('sin una campaña con sistema, dice que hace falta', async () => {
    const { done } = renderWindows([{ ...CAMPAIGN, system: null }])
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir' }))
    const box = within(await screen.findByRole('dialog', { name: 'Nueva entrada' }))
    expect(await box.findByText('Para crear entradas del mundo, hace falta una campaña con sistema.')).toBeDefined()
    expect(box.queryByRole('textbox', { name: 'Nombre' })).toBeNull()
    expect(done).not.toHaveBeenCalled()
  })

  it('si no puede escribir en el compendio del mundo, tampoco deja crearla', async () => {
    renderWindows([CAMPAIGN], { ...ORG, role: 'member' })
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir' }))
    const box = within(await screen.findByRole('dialog', { name: 'Nueva entrada' }))
    expect(await box.findByText('Para crear entradas del mundo, hace falta una campaña con sistema.')).toBeDefined()
    expect(box.queryByRole('textbox', { name: 'Nombre' })).toBeNull()
  })
})
