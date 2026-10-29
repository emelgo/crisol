import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const CLAUDE = 'https://claude.ai/oauth/mcp-client-metadata'
const path = `/oauth/consentimiento?client_id=${encodeURIComponent(CLAUDE)}&scope=openid%20profile&sig=x`
const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }

const renderConsent = (
  role: 'owner' | 'member' = 'owner',
  clients: Record<string, string> = { [CLAUDE]: 'Claude' }
) => {
  const accounts = fakeAccountClient({
    account: { name: 'Enrique', email: 'enrique@crisol.test' },
    oauthClients: clients
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={accounts.client} api={fakeApi({ organizations: [{ ...ORG, role }] }).client} />)
  return accounts
}

describe('consentimiento OAuth', () => {
  it('dice qué aplicación quiere conectarse, con su dominio, y deja permitirlo', async () => {
    const accounts = renderConsent()
    expect(await screen.findByRole('heading', { name: 'Conectar Claude (claude.ai)' })).toBeDefined()
    expect(screen.getByText(/^Claude \(claude\.ai\) quiere usar tu cuenta de Crisol/)).toBeDefined()
    expect(document.title).toBe('Conectar Claude (claude.ai) · Crisol')
    await userEvent.click(screen.getByRole('button', { name: 'Permitir' }))
    expect(accounts.calls).toContain('consent true')
  })

  it('deja no permitirlo', async () => {
    const accounts = renderConsent()
    await userEvent.click(await screen.findByRole('button', { name: 'No permitir' }))
    expect(accounts.calls).toContain('consent false')
  })

  it('un nombre que se hace pasar por otro no oculta de dónde viene', async () => {
    const impostor = 'https://claude.ai.example.net/oauth/metadata'
    const accounts = fakeAccountClient({
      account: { name: 'Enrique', email: 'enrique@crisol.test' },
      oauthClients: { [impostor]: 'Claude' }
    })
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/oauth/consentimiento?client_id=${encodeURIComponent(impostor)}`] })
    )
    render(<App router={router} accounts={accounts.client} api={fakeApi({ organizations: [ORG] }).client} />)
    expect(await screen.findByRole('heading', { name: 'Conectar Claude (claude.ai.example.net)' })).toBeDefined()
  })

  it('si el nombre es el dominio, no lo repite', async () => {
    renderConsent('owner', { [CLAUDE]: 'claude.ai' })
    expect(await screen.findByRole('heading', { name: 'Conectar claude.ai' })).toBeDefined()
  })

  it('sin nombre conocido, enseña el dominio del cliente', async () => {
    renderConsent('owner', {})
    expect(await screen.findByRole('heading', { name: 'Conectar claude.ai' })).toBeDefined()
  })

  it('si el cliente no es una URL (lo registró el propietario), su nombre o, sin él, el identificador tal cual', async () => {
    const accounts = fakeAccountClient({
      account: { name: 'Enrique', email: 'enrique@crisol.test' },
      oauthClients: { def456: 'Claude de pruebas' }
    })
    const at = (clientId: string) =>
      createAppRouter(createMemoryHistory({ initialEntries: [`/oauth/consentimiento?client_id=${clientId}`] }))
    const api = fakeApi({ organizations: [ORG] }).client
    const first = render(<App router={at('abc123')} accounts={accounts.client} api={api} />)
    expect(await screen.findByRole('heading', { name: 'Conectar abc123' })).toBeDefined()
    first.unmount()
    render(<App router={at('def456')} accounts={accounts.client} api={api} />)
    expect(await screen.findByRole('heading', { name: 'Conectar Claude de pruebas' })).toBeDefined()
  })

  it('sin sesión dice que ha caducado y que hay que volver a conectar', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
    render(<App router={router} accounts={fakeAccountClient().client} api={fakeApi().client} />)
    expect(await screen.findByRole('heading', { name: 'Tu sesión ha caducado' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Permitir' })).toBeNull()
  })

  it('quien no es propietario no puede permitirlo (módulo 0)', async () => {
    renderConsent('member')
    expect((await screen.findByRole('alert')).textContent).toBe('De momento solo el propietario puede conectar Claude.')
    expect(screen.queryByRole('button', { name: 'Permitir' })).toBeNull()
    expect(screen.getByRole('button', { name: 'No permitir' })).toBeDefined()
  })
})
