import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { type FakeInvitation, fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const invitation = (role?: FakeInvitation['role']): FakeInvitation => ({
  campaignName: 'La Marca',
  worldName: 'Eana',
  masterName: 'Enrique',
  worldId: 'w1',
  campaignId: 'c1',
  ...(role ? { role } : {})
})

const renderJoin = (accounts: ReturnType<typeof fakeAccountClient>, secret = 'abc') => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/unirse/${secret}`] }))
  render(<App router={router} accounts={accounts.client} api={fakeApi().client} />)
  return router
}
const fill = async (label: string, value: string) => {
  const input = await screen.findByLabelText(label)
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

describe('unirse con el enlace', () => {
  it('un enlace que no vale lo dice', async () => {
    renderJoin(fakeAccountClient())
    expect(await screen.findByRole('heading', { name: 'Este enlace no vale' })).toBeDefined()
  })

  it('con sesión, enseña la invitación y al confirmar lleva a la campaña', async () => {
    const accounts = fakeAccountClient({
      account: { name: 'Jugadora', email: 'j@crisol.test' },
      invitations: { abc: invitation() }
    })
    const router = renderJoin(accounts)
    expect(await screen.findByRole('heading', { name: 'Te invitan a La Marca' })).toBeDefined()
    expect(screen.getByText('Eana · máster: Enrique')).toBeDefined()
    expect(accounts.calls).not.toContain('join abc')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar en La Marca como jugador' }))
    expect(accounts.calls).toContain('join abc')
    await screen.findByRole('heading', { level: 1 })
    expect(router.state.location.pathname).toBe('/mundos/w1/campanas/c1')
  })

  it('al máster de la campaña se lo dice en vez de unirlo', async () => {
    renderJoin(
      fakeAccountClient({
        account: { name: 'Enrique', email: 'e@crisol.test' },
        invitations: { abc: invitation('master') }
      })
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar en La Marca como jugador' }))
    expect((await screen.findByRole('status')).textContent).toBe('Ya eres el máster de esta campaña.')
  })

  it('sin cuenta, crearla une a la campaña de una vez', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    const router = renderJoin(accounts)
    await fill('Nombre', 'Jugadora')
    await fill('Email', 'nueva@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta y entrar' }))
    await screen.findByRole('heading', { level: 1 })
    expect(router.state.location.pathname).toBe('/mundos/w1/campanas/c1')
  })

  it('sin cuenta, si el email ya tiene una lo dice', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    accounts.passwords.set('nueva@crisol.test', 'otra-clave-larga')
    renderJoin(accounts)
    await fill('Nombre', 'Jugadora')
    await fill('Email', 'nueva@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta y entrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ese email ya tiene cuenta: entra con ella más abajo')
  })

  it('con cuenta pero sin sesión, al entrar vuelve a la confirmación', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    accounts.passwords.set('j@crisol.test', 'una-clave-larga')
    renderJoin(accounts)
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }))
    await fill('Email', 'j@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('button', { name: 'Entrar en La Marca como jugador' })).toBeDefined()
  })
})
