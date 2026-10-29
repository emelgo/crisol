import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced, inMain, signOut } from '../testing.ts'
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

describe('entrar', () => {
  it('con email y contraseña correctos entra y vuelve a la portada', async () => {
    const fake = fakeAccountClient()
    fake.passwords.set('enrique@crisol.test', 'una-clave-larga')
    const { router } = renderAt('/entrar', fake)
    await fill('Email', 'enrique@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Hola, Enrique')).toBeDefined()
    expect(router.state.location.pathname).toBe('/')
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
    expect(await screen.findByText('Crisol de Enrique')).toBeDefined()
    await fill('Nombre', 'Enrique')
    await fill('Email', 'enrique@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect(await screen.findByText('Hola, Enrique')).toBeDefined()
    expect(fake.passwords.get('enrique@crisol.test')).toBe('una-clave-larga')
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
    await fill('Nombre', 'Enrique')
    await fill('Email', 'enrique@crisol.test')
    await fill('Contraseña', 'una-clave-larga')
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ese email ya tiene cuenta')
  })
})

describe('perfil y salir', () => {
  const signedIn = () => fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } })

  it('cambia el nombre visible', async () => {
    renderAt('/perfil', signedIn())
    await fill('Nombre', 'Enrique M.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await inMain().findByText('Guardado')).toBeDefined()
    expect(announced()).toBe('Guardado')
    // El nombre nuevo, en el menú de la cuenta
    expect(screen.getByRole('button', { name: 'Enrique M.', expanded: false })).toBeDefined()
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
