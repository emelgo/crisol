import type { AiConnection, Approval, Campaign, Organization, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const _finished = (overrides: Partial<Approval>): Approval => ({
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

const renderAt = (
  path: string,
  options: {
    organizations?: Organization[]
    approvals?: Approval[]
    aiConnections?: AiConnection[]
    worlds?: World[]
    campaigns?: Campaign[]
  } = {}
) => {
  const api = fakeApi({
    organizations: options.organizations ?? [owner],
    approvals: options.approvals ?? [],
    aiConnections: options.aiConnections ?? [],
    worlds: options.worlds ?? [],
    campaigns: options.campaigns ?? []
  })
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

  it('quien no es propietario ni está en ninguna campaña no los tiene en Ajustes', async () => {
    renderAt('/mundos', { organizations: [{ ...owner, role: 'member' }] })
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    const settings = await openSettings()
    expect(settings.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeDefined()
    expect(settings.queryByRole('heading', { name: 'Conectar una IA' })).toBeNull()
    expect(settings.queryByLabelText('Dirección del conector')).toBeNull()
  })

  it('tus conexiones: a qué conector, qué app y cuándo; «Quitar» pide confirmarlo y la quita al momento', async () => {
    const campaignId = crypto.randomUUID()
    const app = { clientId: 'https://ia.example/cliente', clientName: 'Mi IA' }
    const recently = new Date(Date.now() - 5 * 60_000).toISOString()
    const { api } = renderAt('/ajustes', {
      aiConnections: [
        {
          ...app,
          url: 'https://crisol.test/mcp',
          connector: { kind: 'worlds' },
          lastUsedAt: '2026-01-02T10:00:00.000Z'
        },
        {
          ...app,
          url: `https://crisol.test/mcp/campanas/${campaignId}`,
          connector: { kind: 'campaign', campaignId, campaign: { name: 'La Marca', worldId: crypto.randomUUID() } },
          lastUsedAt: recently
        }
      ]
    })
    const section = within(await screen.findByRole('region', { name: 'Tus conexiones' }))
    const list = within(await section.findByRole('list'))
    expect(list.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Crisol · Mundos'),
      expect.stringContaining('Crisol · La Marca')
    ])
    expect(list.getByText('Mi IA (ia.example) · hace 5 minutos')).toBeDefined()
    // Pide confirmarlo en la fila, con el foco en «Quitar»; cancelar no quita nada
    await userEvent.click(
      list.getByRole('button', { name: 'Quitar la conexión de Mi IA (ia.example) a Crisol · La Marca' })
    )
    expect(
      list.getByText('Mi IA (ia.example) dejará de entrar en Crisol · La Marca hasta que la conectes otra vez.')
    ).toBeDefined()
    expect(document.activeElement?.textContent).toBe('Quitar')
    await userEvent.click(list.getByRole('button', { name: 'Cancelar' }))
    expect(api.calls).not.toContain('removeAiConnection')
    await userEvent.click(
      list.getByRole('button', { name: 'Quitar la conexión de Mi IA (ia.example) a Crisol · La Marca' })
    )
    await userEvent.click(list.getByRole('button', { name: 'Quitar' }))
    await vi.waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(1))
    expect(announced()).toBe('Conexión de Mi IA (ia.example) quitada')
    expect(api.calls).toContain('removeAiConnection')
    // El foco, en la que queda
    await vi.waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Quitar la conexión de Mi IA (ia.example) a Crisol · Mundos'
      )
    )
  })

  it('quien solo juega: sin la dirección de Mundos ni el modo; el conector, en cada campaña, y sus conexiones', async () => {
    const world: World = {
      id: crypto.randomUUID(),
      organizationId: owner.id,
      name: 'Eana',
      description: '',
      icon: null,
      color: null,
      cover: null,
      role: 'player',
      version: 1
    }
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      worldId: world.id,
      name: 'La Marca',
      description: '',
      color: null,
      cover: null,
      role: 'player',
      version: 1
    }
    renderAt('/ajustes', { organizations: [{ ...owner, role: 'member' }], worlds: [world], campaigns: [campaign] })
    expect(await screen.findByText('Cada campaña tiene su propio conector, en su Inicio:')).toBeDefined()
    expect(screen.getByRole('link', { name: 'La Marca' }).getAttribute('href')).toBe(
      `/mundos/${world.id}/campanas/${campaign.id}`
    )
    expect(screen.queryByLabelText('Dirección del conector')).toBeNull()
    expect(screen.queryByRole('radio', { name: /^Copiloto/ })).toBeNull()
    expect(await screen.findByText('Ninguna IA conectada.')).toBeDefined()
  })

  it('cambiar el modo se guarda al momento', async () => {
    const { api } = renderAt('/ajustes')
    await userEvent.click(await screen.findByRole('radio', { name: /^Solo lectura/ }))
    expect(await inMain().findByText('Guardado')).toBeDefined()
    expect(announced()).toBe('Guardado')
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Solo lectura/ }).checked).toBe(true)
    expect(api.calls).toContain('setAiMode')
    expect(await api.client.call('getAiSettings', {})).toMatchObject({ mode: 'readOnly' })
  })

  it('mientras se guarda, las opciones siguen activas y con el foco; otro cambio entretanto se ignora', async () => {
    const { api } = renderAt('/ajustes')
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
})
