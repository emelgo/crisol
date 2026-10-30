import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
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
// Crear la cuenta: nombre y apellido(s), el nombre de usuario, el email y la contraseña dos veces
const fillNewAccount = async (email: string, password: string) => {
  await fill('Nombre', 'Ana')
  await fill('Apellido(s)', 'Ruiz')
  await fill('Nombre de usuario', 'Jugadora')
  await fill('Email', email)
  await fill('Contraseña', password)
  await fill('Repite la contraseña', password)
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
    expect(screen.getByText('Eana')).toBeDefined()
    expect(screen.getByText('Máster: Enrique')).toBeDefined()
    expect(accounts.calls).not.toContain('join abc')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar en La Marca como jugador' }))
    expect(accounts.calls).toContain('join abc')
    await screen.findByRole('heading', { level: 1 })
    expect(router.state.location.pathname).toBe('/mundos/w1/campanas/c1')
  })

  it('si el enlace deja de valer con la página abierta, al volver a la ventana lo dice', async () => {
    const invitations: Record<string, FakeInvitation> = { abc: invitation() }
    renderJoin(fakeAccountClient({ account: { name: 'Jugadora', email: 'j@crisol.test' }, invitations }))
    await screen.findByRole('heading', { name: 'Te invitan a La Marca' })
    delete invitations.abc
    // Pasar de una ventana a otra que ya estaba a la vista: no cambia la visibilidad, pero sí el foco
    window.dispatchEvent(new Event('focus'))
    expect(await screen.findByRole('heading', { name: 'Este enlace no vale' })).toBeDefined()
  })

  it('si al entrar el enlace ya no vale, la página lo dice en vez de seguir ofreciéndolo', async () => {
    const invitations: Record<string, FakeInvitation> = { abc: invitation() }
    renderJoin(fakeAccountClient({ account: { name: 'Jugadora', email: 'j@crisol.test' }, invitations }))
    await screen.findByRole('heading', { name: 'Te invitan a La Marca' })
    delete invitations.abc
    await userEvent.click(screen.getByRole('button', { name: 'Entrar en La Marca como jugador' }))
    expect(await screen.findByRole('heading', { name: 'Este enlace no vale' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Entrar en La Marca como jugador' })).toBeNull()
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
    await fillNewAccount('nueva@crisol.test', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta y entrar' }))
    await screen.findByRole('heading', { level: 1 })
    expect(router.state.location.pathname).toBe('/mundos/w1/campanas/c1')
  })

  it('sin cuenta, si el email ya tiene una lo dice', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    accounts.passwords.set('nueva@crisol.test', 'otra-clave-larga')
    renderJoin(accounts)
    await fillNewAccount('nueva@crisol.test', 'una-clave-larga')
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

  it('con sesión, dice con qué cuenta entra; «Usar otra cuenta» sale y se queda en el enlace', async () => {
    const accounts = fakeAccountClient({
      account: { name: 'Jugadora', email: 'j@crisol.test' },
      invitations: { abc: invitation() }
    })
    const router = renderJoin(accounts)
    expect(await screen.findByText('Entras como Jugadora (j@crisol.test).')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Usar otra cuenta' }))
    expect(accounts.calls).toContain('signOut')
    expect(await screen.findByRole('button', { name: 'Crear la cuenta y entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/unirse/abc')
    expect(accounts.calls).not.toContain('join abc')
  })

  it('al pasar a «Ya tengo cuenta», el error del alta se va y el foco va al email del formulario nuevo', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    accounts.passwords.set('j@crisol.test', 'una-clave-larga')
    renderJoin(accounts)
    await fillNewAccount('j@crisol.test', 'otra-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta y entrar' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Ya tengo cuenta' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    expect(screen.getByRole('form', { name: 'Entra con tu cuenta' })).toBeDefined()
  })

  it('mientras entra con su cuenta, «Entrar» no hace nada', async () => {
    const accounts = fakeAccountClient({ invitations: { abc: invitation() } })
    accounts.passwords.set('j@crisol.test', 'una-clave-larga')
    const original = accounts.client.signIn
    let release = () => {}
    let attempts = 0
    accounts.client.signIn = async (email, password) => {
      attempts++
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return original(email, password)
    }
    renderJoin(accounts)
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }))
    await fill('Email', 'j@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    const signIn = screen.getByRole('button', { name: 'Entrar' })
    await userEvent.click(signIn)
    expect(signIn.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(signIn)
    act(release)
    expect(await screen.findByRole('button', { name: 'Entrar en La Marca como jugador' })).toBeDefined()
    expect(attempts).toBe(1)
  })
})
