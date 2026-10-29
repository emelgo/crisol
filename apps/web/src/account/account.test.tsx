import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
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
    expect(await screen.findByText('Guardado')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Enrique M.' })).toBeDefined()
  })

  it('salir cierra la sesión y lleva a entrar', async () => {
    const { router, fake } = renderAt('/', signedIn())
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    expect(fake.calls).toContain('signOut')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('el perfil sin sesión lleva a entrar', async () => {
    const { router } = renderAt('/perfil')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/entrar')
  })
})
