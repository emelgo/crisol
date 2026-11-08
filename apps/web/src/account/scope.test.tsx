import type { Approval, Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'
import { signOut } from '../testing.ts'
import { fakeAccountClient } from './fake.ts'

// El máster abre la campaña en la Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const eana: World = {
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
const otro: World = { ...eana, id: crypto.randomUUID(), name: 'Otro' }
const marca: Campaign = {
  id: crypto.randomUUID(),
  worldId: eana.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}
const request: Approval = {
  id: crypto.randomUUID(),
  tool: 'enlace_invitacion',
  action: 'regenerateInvitation',
  input: { campaignId: marca.id },
  details: { campaign: 'La Marca' },
  status: 'pending',
  requestedAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-10-30T12:00:00.000Z',
  decidedAt: null,
  error: null
}

/**
 * El máster (con dos mundos, uno solo suyo, y una petición de Claude) y una jugadora de La Marca, en la misma pestaña.
 * La API contesta según quién ha entrado; lo de la jugadora espera a `release` para ver qué se pinta mientras tanto
 */
function setup(path: string) {
  const master = fakeApi({
    organizations: [ORG],
    worlds: [eana, otro],
    campaigns: [marca],
    approvals: [{ ...request }],
    members: { [marca.id]: [{ userId: 'u1', name: 'Enrique', role: 'master' }] }
  })
  const player = fakeApi({
    organizations: [{ ...ORG, role: 'member' }],
    worlds: [{ ...eana, role: 'player' }],
    campaigns: [{ ...marca, role: 'player' }],
    members: { [marca.id]: [{ userId: 'u2', name: 'Jugadora', role: 'player' }] }
  })
  const accounts = fakeAccountClient({
    account: { name: 'Enrique', email: 'e@crisol.test' },
    names: { 'j@crisol.test': 'Jugadora' }
  })
  accounts.passwords.set('j@crisol.test', 'una-clave-larga')
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let asPlayer = false
  const api: ApiClient = {
    async call(name, input) {
      if (!asPlayer) return master.client.call(name, input)
      await held
      return player.client.call(name, input)
    },
    exportWiki: (input) => master.client.exportWiki(input),
    uploadFile: (target, file, onProgress) => master.client.uploadFile(target, file, onProgress),
    downloadPdf: (pageId, secrets) => master.client.downloadPdf(pageId, secrets)
  }
  const realtime = fakeRealtime()
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={accounts.client} api={api} realtime={realtime.client} />)
  const signInAsPlayer = async () => {
    asPlayer = true
    await userEvent.type(await screen.findByLabelText('Email'), 'j@crisol.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
  }
  return { accounts, realtime, router, signInAsPlayer, release: () => act(release) }
}

// Lo del propietario en la barra: el historial y la papelera de toda la cuenta
const ownerButtons = () => [
  screen.queryByRole('button', { name: 'Historial' }),
  screen.queryByRole('button', { name: 'Papelera' })
]

describe('al cambiar de cuenta en la misma pestaña', () => {
  // Los tutoriales guiados de Mis mundos ya hechos: que no se pongan en medio
  beforeEach(() => {
    for (const email of ['e@crisol.test', 'j@crisol.test']) {
      localStorage.setItem(`crisol.recorridos.${email}`, JSON.stringify({ seen: ['mundos', 'campana'] }))
    }
  })

  it('al salir no queda nada del máster, y la jugadora que entra después no ve nada suyo', async () => {
    const { realtime, signInAsPlayer, release } = setup('/mundos')
    await screen.findByRole('link', { name: 'Otro' })
    expect(await screen.findByRole('button', { name: 'Papelera' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' }))
    await within(screen.getByRole('main')).findByText('Hecho: generar un enlace nuevo para La Marca')
    act(() =>
      realtime.emit({
        type: 'joined',
        worldId: eana.id,
        campaignId: marca.id,
        campaign: 'La Marca',
        member: { userId: 'u3', name: 'Bea' }
      })
    )
    await within(screen.getByRole('main')).findByText('Bea ha entrado en La Marca.')

    await signOut()
    await screen.findByRole('heading', { level: 1, name: 'Entrar' })
    expect(screen.queryByText(/Hecho:/)).toBeNull()
    expect(screen.queryByText(/Bea/)).toBeNull()
    expect(ownerButtons()).toEqual([null, null])

    // Mientras llega lo suyo, nada de lo del máster: ni sus mundos, ni su historial, ni su papelera
    await signInAsPlayer()
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    expect(screen.queryByText('Eana')).toBeNull()
    expect(screen.queryByText('Otro')).toBeNull()
    expect(ownerButtons()).toEqual([null, null])

    release()
    const list = await screen.findByRole('list', { name: 'Mundos' })
    // Sin su papel: eso es de las campañas, no de los mundos
    expect(within(list).queryByText('Jugador')).toBeNull()
    expect(screen.queryByText('Otro')).toBeNull()
    expect(ownerButtons()).toEqual([null, null])
  })

  it('en la campaña, la jugadora no ve el enlace de invitación del máster', async () => {
    const path = `/mundos/${eana.id}/campanas/${marca.id}`
    const { router, signInAsPlayer, release } = setup(`${path}?panel=ajustes`)
    // El máster ve el enlace en los Ajustes de su Mesa; la jugadora, no
    await screen.findByLabelText('Enlace de invitación')
    await signOut()
    await signInAsPlayer()
    await act(() => router.navigate({ to: path }))
    expect(screen.queryByLabelText('Enlace de invitación')).toBeNull()
    expect(screen.queryByText('Enrique')).toBeNull()

    release()
    await screen.findByRole('heading', { level: 1, name: 'La Marca' })
    // Su nombre, en los miembros (y en su menú de la cuenta)
    expect((await screen.findAllByText('Jugadora')).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Enlace de invitación')).toBeNull()
  })

  it('si sale desde otra pestaña, esta deja de enseñar lo suyo y lleva a entrar', async () => {
    const { accounts, router } = setup('/mundos')
    await screen.findByRole('link', { name: 'Otro' })
    // Como el cliente de cuentas al enterarse de que otra pestaña ha salido
    await act(() => accounts.client.signOut())
    await screen.findByRole('heading', { level: 1, name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.queryByText('Otro')).toBeNull()
  })
})
