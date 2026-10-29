import type { Approval, Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const campaign: Campaign = { id: crypto.randomUUID(), worldId: world.id, name: 'La Marca', role: 'master', version: 1 }

/** Lo que pide Claude: por defecto, regenerar el enlace de La Marca */
const request = (overrides: Partial<Approval> = {}): Approval => ({
  id: crypto.randomUUID(),
  tool: 'enlace_invitacion',
  action: 'regenerateInvitation',
  input: { campaignId: campaign.id },
  details: { campaign: 'La Marca' },
  status: 'pending',
  requestedAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-10-30T12:00:00.000Z',
  decidedAt: null,
  error: null,
  ...overrides
})

const renderAt = (path: string, approvals: Approval[] = []) => {
  const api = fakeApi({ organizations: [ORG], worlds: [world], campaigns: [campaign], approvals })
  const realtime = fakeRealtime()
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { api, realtime }
}

const queue = () => screen.queryByRole('heading', { name: 'Claude espera tu aprobación' })

describe('la cola de aprobación', () => {
  it('sin nada pendiente, no se ve', async () => {
    renderAt('/mundos')
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    expect(queue()).toBeNull()
  })

  it('aparece sin recargar cuando el canal avisa, en cualquier página, con la frase y el detalle', async () => {
    const { api, realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    api.approvals.push(request())
    act(() => realtime.emit({ type: 'changed', what: 'approvals' }))
    expect(await screen.findByRole('heading', { name: 'Claude espera tu aprobación' })).toBeDefined()
    expect(screen.getByText('Claude quiere generar un enlace nuevo para La Marca')).toBeDefined()
    await userEvent.click(screen.getByText('Detalle'))
    expect(screen.getByText('Herramienta: enlace_invitacion')).toBeDefined()
    expect(screen.getByText(/Lo pidió el 29 oct 2026.*Caduca el 30 oct 2026/)).toBeDefined()
    expect(screen.getByText(new RegExp(campaign.id))).toBeDefined()
  })

  it('aprobar: se hace, lo dice y la cola desaparece', async () => {
    const { api } = renderAt(`/mundos/${world.id}`, [request()])
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' }))
    expect(await screen.findByText('Hecho: generar un enlace nuevo para La Marca')).toBeDefined()
    await vi.waitFor(() => expect(queue()).toBeNull())
    expect(api.calls).toContain('approve')
  })

  it('rechazar: no se hace y lo dice', async () => {
    const { api } = renderAt('/mundos', [request({ action: 'createWorld', input: { name: 'Otro' }, details: {} })])
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar: crear el mundo «Otro»' }))
    expect(await screen.findByText('Rechazado: crear el mundo «Otro»')).toBeDefined()
    expect(api.approvals[0]?.status).toBe('rejected')
  })

  it('al pedir deshacer, dice qué deshace', async () => {
    renderAt('/mundos', [
      request({
        tool: 'deshacer',
        action: 'undoOperation',
        input: { operationId: crypto.randomUUID() },
        details: { operation: { action: 'createCampaign', details: { name: 'La Marca', world: 'Eana' } } }
      })
    ])
    expect(await screen.findByText('Claude quiere deshacer: creó la campaña «La Marca» en Eana')).toBeDefined()
  })

  it('si ya se decidió en otra pestaña, la cola se pone al día', async () => {
    const { api } = renderAt('/mundos', [request()])
    const approve = await screen.findByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' })
    Object.assign(api.approvals[0] ?? {}, { status: 'done' })
    await userEvent.click(approve)
    await vi.waitFor(() => expect(queue()).toBeNull())
  })
})
