import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { signOut } from '../testing.ts'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const campaign: Campaign = { id: crypto.randomUUID(), worldId: world.id, name: 'La Marca', role: 'master', version: 1 }

const renderAt = (path: string) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={fakeApi({ organizations: [ORG], worlds: [world], campaigns: [campaign] }).client}
    />
  )
  return router
}

const h1 = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('el título de cada página', () => {
  it('cada pantalla tiene el suyo en la pestaña', async () => {
    const router = renderAt('/')
    await h1('Crisol')
    await waitFor(() => expect(document.title).toBe('Crisol'))
    for (const [path, title] of [
      ['/mundos', 'Mis mundos · Crisol'],
      [`/mundos/${world.id}`, 'Eana · Crisol'],
      [`/mundos/${world.id}/campanas/${campaign.id}`, 'La Marca · Crisol'],
      ['/historial', 'Historial · Crisol'],
      ['/no-existe', 'Página no encontrada · Crisol']
    ] as const) {
      act(() => router.history.push(path))
      await waitFor(() => expect(document.title).toBe(title))
    }
  })

  it('al cargar la primera página el foco no se mueve; al navegar, va al título de la nueva', async () => {
    renderAt('/mundos')
    await h1('Mis mundos')
    expect(document.activeElement).toBe(document.body)
    await userEvent.click(await screen.findByRole('link', { name: 'Eana' }))
    await waitFor(async () => expect(document.activeElement).toBe(await h1('Eana')))
    // La campaña pinta su título cuando llegan sus datos: el foco va a él en cuanto aparece
    await userEvent.click(await screen.findByRole('link', { name: 'La Marca' }))
    await waitFor(async () => expect(document.activeElement).toBe(await h1('La Marca')))
  })

  it('al salir, el foco va al título de «Entrar»', async () => {
    renderAt('/mundos')
    await signOut()
    await waitFor(async () => expect(document.activeElement).toBe(await h1('Entrar')))
  })
})
