import type { HistoryEntry, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const enrique = { id: 'u1', name: 'Enrique' }

let minute = 0
const entry = (action: string, details: Record<string, unknown>, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: crypto.randomUUID(),
  at: new Date(Date.UTC(2026, 9, 29, 12, 59 - minute++)).toISOString(),
  actor: enrique,
  via: 'ui',
  tool: null,
  action,
  details,
  worldId: world.id,
  ...extra
})

const renderAt = (path: string, history: HistoryEntry[], options: { role?: World['role'] } = {}) => {
  const api = fakeApi({ organizations: [ORG], worlds: [{ ...world, role: options.role ?? 'master' }], history })
  const realtime = fakeRealtime()
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { api, realtime, router }
}

const lines = () =>
  within(screen.getByRole('list', { name: 'Operaciones' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('el historial', () => {
  it('cuenta cada operación en una frase, con quién, cuándo y por dónde', async () => {
    minute = 0
    renderAt(`/mundos/${world.id}/historial`, [
      entry('removeMember', { campaign: 'La Marca', member: 'Pepe' }),
      entry('setInvitationsOpen', { campaign: 'La Marca', open: false }),
      entry('createCampaign', { name: 'La Marca', world: 'Eana' }, { via: 'ai', tool: 'crear_campana' }),
      entry('renameWorld', { from: 'Eana', to: 'Eana (Fateforge)' }),
      entry('joinCampaign', { campaign: 'La Marca', world: 'Eana' }, { actor: { id: 'u2', name: 'Pepe' } }),
      entry('createOrganization', { name: 'Fateforge' }, { actor: null, via: 'system' }),
      entry('algoNuevo', {}, { actor: null })
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Historial de Eana' })).toBeDefined()
    expect(lines()).toEqual([
      expect.stringMatching(/^Enrique expulsó a Pepe de La Marca.*29 oct 2026.*web$/),
      expect.stringMatching(/^Enrique cerró las invitaciones de La Marca/),
      expect.stringMatching(/^Enrique creó la campaña «La Marca» en Eana.*Claude \(crear_campana\)$/),
      expect.stringMatching(/^Enrique renombró el mundo «Eana» a «Eana \(Fateforge\)»/),
      expect.stringMatching(/^Pepe entró en La Marca/),
      expect.stringMatching(/^Crisol creó la organización «Fateforge».*Crisol$/),
      expect.stringMatching(/^Una cuenta borrada hizo un cambio \(algoNuevo\)/)
    ])
  })

  it('va por páginas: «Ver más» trae las siguientes', async () => {
    const history = Array.from({ length: 60 }, (_, i) => entry('createWorld', { name: `Mundo ${i}` }))
    renderAt('/historial', history)
    await screen.findByRole('list', { name: 'Operaciones' })
    expect(lines()).toHaveLength(50)
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(60))
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
  })

  it('sin nada aún, lo dice', async () => {
    renderAt('/historial', [])
    expect(await screen.findByText('Aún no hay nada en el historial')).toBeDefined()
  })

  it('se pone al día cuando algo cambia', async () => {
    const history = [entry('createWorld', { name: 'Eana' })]
    const { api, realtime } = renderAt('/historial', history)
    await screen.findByRole('list', { name: 'Operaciones' })
    api.history.unshift(entry('renameWorld', { from: 'Eana', to: 'Eana 2' }))
    act(() => realtime.emit({ type: 'changed', what: 'worlds' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(2))
  })

  it('a quien no puede verlo se le dice', async () => {
    renderAt(`/mundos/${world.id}/historial`, [], { role: 'player' })
    expect(await screen.findByText('No tienes permiso')).toBeDefined()
  })

  it('se llega desde el mundo (su máster) y desde «Mis mundos» (el propietario)', async () => {
    const { router } = renderAt(`/mundos/${world.id}`, [])
    await userEvent.click(await screen.findByRole('link', { name: 'Historial' }))
    expect(router.state.location.pathname).toBe(`/mundos/${world.id}/historial`)
    await router.navigate({ to: '/mundos' })
    await userEvent.click(await screen.findByRole('link', { name: 'Historial de la organización' }))
    expect(router.state.location.pathname).toBe('/historial')
  })

  it('un jugador no ve el enlace al historial del mundo', async () => {
    renderAt(`/mundos/${world.id}`, [], { role: 'player' })
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    expect(screen.queryByRole('link', { name: 'Historial' })).toBeNull()
  })
})
