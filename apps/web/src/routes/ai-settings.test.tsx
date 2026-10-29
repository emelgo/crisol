import type { Approval, Organization } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const owner: Organization = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' }

const finished = (overrides: Partial<Approval>): Approval => ({
  id: crypto.randomUUID(),
  tool: 'enlace_invitacion',
  action: 'regenerateInvitation',
  input: { campaignId: crypto.randomUUID() },
  details: { campaign: 'La Marca' },
  status: 'done',
  requestedAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-10-30T12:00:00.000Z',
  decidedAt: '2026-10-29T12:01:00.000Z',
  error: null,
  ...overrides
})

const renderAt = (path: string, options: { organizations?: Organization[]; approvals?: Approval[] } = {}) => {
  const api = fakeApi({ organizations: options.organizations ?? [owner], approvals: options.approvals ?? [] })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('los ajustes de IA', () => {
  it('el propietario llega desde la cabecera: la dirección del conector y el modo, copiloto por defecto', async () => {
    const { router } = renderAt('/mundos')
    await userEvent.click(await screen.findByRole('link', { name: 'IA' }))
    expect(router.state.location.pathname).toBe('/ia')
    expect(await screen.findByRole('heading', { level: 1, name: 'Ajustes de IA' })).toBeDefined()
    expect(screen.getByLabelText<HTMLInputElement>('Dirección del conector').value).toBe('https://crisol.test/mcp')
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Copiloto/ }).checked).toBe(true)
  })

  it('quien no es propietario no ve el enlace', async () => {
    renderAt('/mundos', { organizations: [{ ...owner, role: 'member' }] })
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    expect(screen.queryByRole('link', { name: 'IA' })).toBeNull()
  })

  it('cambiar el modo se guarda al momento', async () => {
    const { api } = renderAt('/ia')
    await userEvent.click(await screen.findByRole('radio', { name: /^Solo lectura/ }))
    expect(await screen.findByText('Guardado')).toBeDefined()
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Solo lectura/ }).checked).toBe(true)
    expect(api.calls).toContain('setAiMode')
    expect(await api.client.call('getAiSettings', {})).toMatchObject({ mode: 'readOnly' })
  })

  it('cuenta cómo acabaron las últimas peticiones', async () => {
    renderAt('/ia', {
      approvals: [
        finished({}),
        finished({ status: 'failed', error: 'NOT_FOUND' }),
        finished({ status: 'rejected', action: 'createWorld', input: { name: 'Otro' }, details: {} }),
        finished({ status: 'expired', decidedAt: null })
      ]
    })
    const list = await screen.findByRole('list', { name: 'Últimas peticiones' })
    expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Hecho: generar un enlace nuevo para La Marca.*enlace_invitacion$/),
      expect.stringMatching(/^No se pudo generar un enlace nuevo para La Marca: Ya no existe/),
      expect.stringMatching(/^Rechazado: crear el mundo «Otro»/),
      expect.stringMatching(/^Claude quiere generar un enlace nuevo para La Marca \(caducado\)/)
    ])
  })

  it('sin peticiones aún, lo dice', async () => {
    renderAt('/ia')
    expect(await screen.findByText('Aún no ha pedido nada que esperase tu aprobación.')).toBeDefined()
  })
})
