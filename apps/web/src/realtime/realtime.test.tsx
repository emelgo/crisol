import type { Campaign, Member, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced, inMain } from '../testing.ts'
import { fakeRealtime } from './fake.ts'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const campaign: Campaign = { id: crypto.randomUUID(), worldId: world.id, name: 'La Marca', role: 'master', version: 1 }
const members: Member[] = [
  { userId: 'u1', name: 'Enrique', role: 'master' },
  { userId: 'u2', name: 'Jugadora', role: 'player' }
]
const joined = {
  type: 'joined' as const,
  worldId: world.id,
  campaignId: campaign.id,
  campaign: 'La Marca',
  member: { userId: 'u2', name: 'Jugadora' }
}

function renderAt(path: string, options: { role?: Campaign['role'] } = {}) {
  const role = options.role ?? 'master'
  const api = fakeApi({
    organizations: [ORG],
    worlds: [{ ...world, role }],
    campaigns: [{ ...campaign, role }],
    members: { [campaign.id]: members }
  })
  const accounts = fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } })
  const realtime = fakeRealtime()
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={accounts.client} api={api.client} realtime={realtime.client} />)
  // Lo que se pide a la API desde aquí
  const callsFrom = () => {
    const start = api.calls.length
    return () => api.calls.slice(start)
  }
  return { api, accounts, realtime, router, callsFrom }
}

const campaignPath = `/mundos/${world.id}/campanas/${campaign.id}`

describe('el canal en tiempo real en la web', () => {
  it('se abre con la sesión y se cierra al salir', async () => {
    const { realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { name: 'Mis mundos' })
    expect(realtime.connections()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await vi.waitFor(() => expect(realtime.connections()).toBe(0))
  })

  it('el máster ve el aviso de entrada y expulsa desde él', async () => {
    const { api, realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { name: 'Mis mundos' })
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull()
    act(() => realtime.emit(joined))
    expect(await inMain().findByText('Jugadora ha entrado en La Marca.')).toBeDefined()
    expect(announced()).toBe('Jugadora ha entrado en La Marca.')
    expect(screen.getByRole('region', { name: 'Avisos' }).closest('[aria-live]')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Expulsar a Jugadora' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expulsar' }))
    expect(await inMain().findByText('Jugadora ya no está en la campaña.')).toBeDefined()
    expect(announced()).toBe('Jugadora ya no está en la campaña.')
    expect(api.calls).toContain('removeMember')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso de Jugadora' }))
    expect(inMain().queryByText('Jugadora ya no está en la campaña.')).toBeNull()
  })

  it('cancelar en el aviso no expulsa; cerrarlo sin más tampoco', async () => {
    const { api, realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { name: 'Mis mundos' })
    act(() => realtime.emit(joined))
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Jugadora' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso de Jugadora' }))
    expect(inMain().queryByText('Jugadora ha entrado en La Marca.')).toBeNull()
    expect(api.calls).not.toContain('removeMember')
  })

  it('cada aviso vuelve a pedir lo que ha cambiado', async () => {
    const { realtime, callsFrom } = renderAt(campaignPath)
    await screen.findByRole('list', { name: 'Miembros' })
    const sequence = [
      [{ type: 'changed', what: 'members', campaignId: campaign.id }, 'listMembers'],
      [{ type: 'changed', what: 'invitation', campaignId: campaign.id }, 'getInvitation'],
      [{ type: 'changed', what: 'campaigns', worldId: world.id }, 'listCampaigns'],
      [{ type: 'changed', what: 'worlds' }, 'listWorlds'],
      [joined, 'listMembers']
    ] as const
    for (const [message, refetched] of sequence) {
      const calls = callsFrom()
      act(() => realtime.emit(message))
      await vi.waitFor(() => expect(calls()).toContain(refetched))
    }
  })

  it('tras un corte vuelve a pedir lo que está a la vista', async () => {
    const { realtime, callsFrom } = renderAt(campaignPath)
    await screen.findByRole('list', { name: 'Miembros' })
    const calls = callsFrom()
    act(() => realtime.reconnect())
    await vi.waitFor(() => expect(calls()).toEqual(expect.arrayContaining(['listWorlds', 'listMembers'])))
  })

  it('si hay una versión nueva de la web, lo avisa y ofrece recargar', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const { realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { name: 'Mis mundos' })
    expect(screen.queryByText('Hay una versión nueva de Crisol.')).toBeNull()
    act(() => realtime.newVersion())
    expect(await inMain().findByText('Hay una versión nueva de Crisol.')).toBeDefined()
    expect(announced()).toBe('Hay una versión nueva de Crisol.')
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(reload).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('si la expulsan con la campaña abierta, deja de verla', async () => {
    const { api, realtime } = renderAt(campaignPath, { role: 'player' })
    await screen.findByRole('list', { name: 'Miembros' })
    api.campaigns.splice(0)
    act(() => realtime.emit({ type: 'revoked', worldId: world.id, campaignId: campaign.id }))
    expect(await screen.findByRole('heading', { name: 'Esta campaña no existe' })).toBeDefined()
  })

  it('si la sesión acaba con la pestaña abierta, la vuelve a pedir y, sin ella, lleva a entrar', async () => {
    const { accounts, realtime, router } = renderAt(campaignPath)
    await screen.findByRole('list', { name: 'Miembros' })
    accounts.endSession()
    act(() => realtime.sessionEnded())
    expect(accounts.calls).toContain('refreshSession')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.queryByText('La Marca')).toBeNull()
  })
})
