import type { Approval, Organization } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced, inMain } from '../testing.ts'

// Ajustes, desde el menú de la cuenta: se abre encima de la página
const openSettings = async () => {
  const account = within(await screen.findByRole('navigation', { name: 'Cuenta' }))
  await userEvent.click(await account.findByRole('button', { name: 'Enrique', expanded: false }))
  await userEvent.click(account.getByRole('button', { name: 'Ajustes' }))
  return within(await screen.findByRole('dialog', { name: 'Ajustes' }))
}

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
  // El tutorial guiado de Mis mundos ya hecho: que no se ponga en medio
  beforeEach(() => localStorage.setItem('crisol.recorridos.e@crisol.test', JSON.stringify({ seen: ['mundos'] })))

  it('el propietario los tiene en Ajustes: la dirección del conector y el modo, copiloto por defecto', async () => {
    const { router } = renderAt('/mundos')
    const settings = await openSettings()
    // Sus cajas, al lado de «Apariencia» (sin otra caja «IA» alrededor)
    expect(await settings.findByRole('heading', { level: 2, name: 'Conectar una IA' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/mundos')
    expect((await settings.findByLabelText<HTMLInputElement>('Dirección del conector')).value).toBe(
      'https://crisol.test/mcp'
    )
    expect(settings.getByRole<HTMLInputElement>('radio', { name: /^Copiloto/ }).checked).toBe(true)
  })

  it('quien no es propietario no los tiene en Ajustes', async () => {
    renderAt('/mundos', { organizations: [{ ...owner, role: 'member' }] })
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    const settings = await openSettings()
    expect(settings.getByRole('heading', { level: 2, name: 'Apariencia' })).toBeDefined()
    expect(settings.queryByRole('heading', { name: 'Conectar una IA' })).toBeNull()
    expect(settings.queryByLabelText('Dirección del conector')).toBeNull()
  })

  it('cambiar el modo se guarda al momento', async () => {
    const { api } = renderAt('/ia')
    await userEvent.click(await screen.findByRole('radio', { name: /^Solo lectura/ }))
    expect(await inMain().findByText('Guardado')).toBeDefined()
    expect(announced()).toBe('Guardado')
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Solo lectura/ }).checked).toBe(true)
    expect(api.calls).toContain('setAiMode')
    expect(await api.client.call('getAiSettings', {})).toMatchObject({ mode: 'readOnly' })
  })

  it('mientras se guarda, las opciones siguen activas y con el foco; otro cambio entretanto se ignora', async () => {
    const { api } = renderAt('/ia')
    const original = api.client.call
    const saving: string[] = []
    let release = () => {}
    api.client.call = async (name, input) => {
      if (name === 'setAiMode') {
        saving.push(String((input as { mode: string }).mode))
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return original(name, input)
    }
    const readOnly = await screen.findByRole<HTMLInputElement>('radio', { name: /^Solo lectura/ })
    await userEvent.click(readOnly)
    expect(readOnly.disabled).toBe(false)
    expect(document.activeElement).toBe(readOnly)
    await userEvent.click(screen.getByRole('radio', { name: /^Asistente/ }))
    expect(saving).toEqual(['readOnly'])
    expect(readOnly.checked).toBe(true)
    act(release)
    expect(await inMain().findByText('Guardado')).toBeDefined()
    expect(readOnly.checked).toBe(true)
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
      expect.stringMatching(/^La IA quiere generar un enlace nuevo para La Marca \(caducado\)/)
    ])
  })

  it('sin peticiones aún, lo dice', async () => {
    renderAt('/ia')
    expect(await screen.findByText('Aún no ha pedido nada que esperase tu aprobación.')).toBeDefined()
  })
})
