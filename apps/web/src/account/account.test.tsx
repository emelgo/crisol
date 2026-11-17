import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { inMain, signOut } from '../testing.ts'
import { fakeAccountClient } from './fake.ts'

const renderAt = (path: string, fake = fakeAccountClient()) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(<App router={router} accounts={fake.client} api={fakeApi().client} />)
  return { router, fake }
}
const fill = async (label: string, value: string) => {
  const input = await screen.findByLabelText(label)
  await userEvent.clear(input)
  await userEvent.type(input, value)
}
// Una cuenta nueva: nombre y apellido(s), el nombre de usuario (el que se ve), el email y la contraseña dos veces
const fillNewAccount = async (username: string, email: string, password: string, confirm = password) => {
  await fill('Nombre', 'Enrique')
  await fill('Apellido(s)', 'Mellado')
  await fill('Nombre de usuario', username)
  await fill('Email', email)
  await fill('Contraseña', password)
  await fill('Repite la contraseña', confirm)
}
// La región viva, fuera de la página (el perfil enseña «Guardado» con su propio role="status")
const liveRegion = () => screen.getAllByRole('status').filter((status) => !status.closest('main'))

// El tutorial guiado de Mis mundos ya hecho: que no se ponga en medio
beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundos'] })))

describe('entrar', () => {
  it('con email y contraseña correctos entra y vuelve a la portada', async () => {
    const fake = fakeAccountClient()
    fake.passwords.set('enrique@crisol.test', 'una-clave-larga')
    const { router } = renderAt('/entrar', fake)
    await fill('Email', 'enrique@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/mundos')
  })

  it('con datos incorrectos lo dice sin decir cuál falla', async () => {
    renderAt('/entrar')
    await fill('Email', 'nadie@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Email o contraseña incorrectos')
  })
})

describe('arranque', () => {
  it('con un enlace válido crea la cuenta del propietario', async () => {
    const { fake } = renderAt('/arranque/abc', fakeAccountClient({ bootstrap: { abc: 'Crisol de Enrique' } }))
    expect(await screen.findByText(/Crisol de Enrique/)).toBeDefined()
    await fillNewAccount('Quique', 'enrique@crisol.test', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })).toBeDefined()
    expect(fake.passwords.get('enrique@crisol.test')).toBe('una-clave-larga')
    // En la app se le ve por su nombre de usuario
    expect(screen.getByRole('button', { name: 'Quique', expanded: false })).toBeDefined()
  })

  it('no deja una contraseña fácil de adivinar ni una repetida que no coincide', async () => {
    const fake = fakeAccountClient({ bootstrap: { abc: 'Crisol de Enrique' } })
    renderAt('/arranque/abc', fake)
    await fillNewAccount('Quique', 'enrique@crisol.test', 'contraseña123', 'contraseña123')
    expect(screen.getByText('Seguridad: débil')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect(screen.getByText('Es fácil de adivinar: alárgala o mezcla letras, números y signos')).toBeDefined()
    await fill('Contraseña', 'una-clave-larga')
    await fill('Repite la contraseña', 'una-clave-larg')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect(screen.getByText('No coincide con la contraseña.')).toBeDefined()
    expect(fake.passwords.has('enrique@crisol.test')).toBe(false)
  })

  it('con un enlace que no vale lo dice y no enseña el formulario', async () => {
    renderAt('/arranque/no-vale')
    expect(await screen.findByRole('heading', { name: 'Este enlace no vale' })).toBeDefined()
    expect(screen.queryByLabelText('Contraseña')).toBeNull()
  })

  it('avisa si el email ya tiene cuenta', async () => {
    const fake = fakeAccountClient({ bootstrap: { abc: 'Crisol de Enrique' } })
    fake.passwords.set('enrique@crisol.test', 'otra-clave-larga')
    renderAt('/arranque/abc', fake)
    await fillNewAccount('Quique', 'enrique@crisol.test', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ese email ya tiene cuenta')
  })
})

describe('perfil y salir', () => {
  const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })

  it('cambia el nombre visible', async () => {
    renderAt('/perfil', signedIn())
    await fill('Nombre de usuario', 'Enrique M.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await inMain().findByText('Guardado')).toBeDefined()
    expect(liveRegion().map((status) => status.textContent)).toEqual(['Guardado'])
    // El nombre nuevo, en el menú de la cuenta
    expect(screen.getByRole('button', { name: 'Enrique M.', expanded: false })).toBeDefined()
  })

  it('el color de tus dados: se elige en Ajustes › Jugabilidad, se guarda al momento y se queda', async () => {
    const fake = signedIn()
    renderAt('/ajustes', fake)
    const colors = within(await screen.findByRole('radiogroup', { name: 'El color de tus dados' }))
    expect((colors.getByRole('radio', { name: 'Automático' }) as HTMLInputElement).checked).toBe(true)
    await userEvent.click(colors.getByRole('radio', { name: 'Verde azulado' }))
    await waitFor(() => expect(fake.calls.some((call) => call.startsWith('updateDice #'))).toBe(true))
    cleanup()
    renderAt('/ajustes', fake)
    const again = within(await screen.findByRole('radiogroup', { name: 'El color de tus dados' }))
    expect((again.getByRole('radio', { name: 'Verde azulado' }) as HTMLInputElement).checked).toBe(true)
    // En el perfil ya no está
    cleanup()
    renderAt('/perfil', fake)
    await screen.findByRole('heading', { name: 'Tus datos' })
    expect(screen.queryByRole('radiogroup', { name: 'El color de tus dados' })).toBeNull()
  })

  it('salir cierra la sesión y lleva a entrar', async () => {
    const { router, fake } = renderAt('/', signedIn())
    await signOut()
    expect(fake.calls).toContain('signOut')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('si la API dice que ya no hay sesión, la vuelve a pedir y, sin ella, lleva a entrar', async () => {
    const fake = signedIn()
    const api = fakeApi()
    api.client.call = async () => {
      fake.endSession()
      throw new ApiError('UNAUTHENTICATED', 401)
    }
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
    render(<App router={router} accounts={fake.client} api={api.client} />)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(fake.calls).toContain('refreshSession')
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('un 401 al hacer algo lo dice y vuelve a pedir la sesión', async () => {
    const fake = signedIn()
    const api = fakeApi({ organizations: [{ id: 'o1', name: 'Fateforge', role: 'owner' }] })
    const original = api.client.call
    api.client.call = async (name, input) => {
      if (name === 'createWorld') throw new ApiError('UNAUTHENTICATED', 401)
      return original(name, input)
    }
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/mundos'] }))
    render(<App router={router} accounts={fake.client} api={api.client} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Crear tu primer mundo' }))
    await fill('Nombre del mundo', 'Eana')
    await userEvent.click(screen.getByRole('button', { name: 'Crear el mundo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Tu sesión ha acabado. Vuelve a entrar.')
    expect(fake.calls).toContain('refreshSession')
  })

  it('el perfil sin sesión lleva a entrar', async () => {
    const { router } = renderAt('/perfil')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })
})
