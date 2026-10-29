import type { Campaign, Member, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced, inMain } from '../testing.ts'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = { id: crypto.randomUUID(), organizationId: ORG.id, name: 'Eana', role: 'master', version: 1 }
const campaign = (role: Campaign['role'] = 'master'): Campaign => ({
  id: crypto.randomUUID(),
  worldId: world.id,
  name: 'La Marca',
  role,
  version: 1
})

const members: Member[] = [
  { userId: 'u1', name: 'Enrique', role: 'master' },
  { userId: 'u2', name: 'Ana', role: 'player' },
  { userId: 'u3', name: 'Jugadora', role: 'player' }
]

const renderCampaign = (c: Campaign, w: World = world) => {
  const api = fakeApi({ organizations: [ORG], worlds: [w], campaigns: [c], members: { [c.id]: members } })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${w.id}/campanas/${c.id}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('una campaña y su enlace de invitación', () => {
  it('desde el mundo se entra en la campaña', async () => {
    const c = campaign()
    const api = fakeApi({ organizations: [ORG], worlds: [world], campaigns: [c] })
    const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${world.id}`] }))
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'E', email: 'e@x.es' } }).client}
        api={api.client}
      />
    )
    await userEvent.click(await screen.findByRole('link', { name: 'La Marca' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
  })

  it('el máster ve el enlace, la fecha y cuántos han entrado, y lo copia', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const c = campaign()
    renderCampaign(c)
    const link = await screen.findByLabelText('Enlace de invitación')
    expect((link as HTMLInputElement).value).toMatch(/\/unirse\//)
    expect(screen.getByText('Han entrado 0 con este enlace')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(writeText).toHaveBeenCalledWith((link as HTMLInputElement).value)
    expect(await inMain().findByText('Copiado')).toBeDefined()
    expect(announced()).toBe('Copiado')
    // Otra vez: el mismo texto, en un nodo nuevo, para que se vuelva a leer
    const first = screen.getByRole('status').firstElementChild
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await vi.waitFor(() => expect(screen.getByRole('status').firstElementChild).not.toBe(first))
    expect(announced()).toBe('Copiado')
  })

  it('si no se puede copiar, deja el enlace seleccionado y dice que hay que copiarlo a mano', async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException('Sin permiso', 'NotAllowedError')
    })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderCampaign(campaign())
    const link = await screen.findByLabelText<HTMLInputElement>('Enlace de invitación')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    const text = 'No se ha podido copiar: está seleccionado, cópialo a mano.'
    expect(await inMain().findByText(text)).toBeDefined()
    expect(announced()).toBe(text)
    expect(document.activeElement).toBe(link)
    expect([link.selectionStart, link.selectionEnd]).toEqual([0, link.value.length])
    expect(inMain().queryByText('Copiado')).toBeNull()
  })

  it('sin portapapeles (fuera de HTTPS), lo mismo', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    renderCampaign(campaign())
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))
    expect(await inMain().findByText('No se ha podido copiar: está seleccionado, cópialo a mano.')).toBeDefined()
  })

  it('«Nuevo enlace» avisa antes y cambia el enlace', async () => {
    renderCampaign(campaign())
    const before = ((await screen.findByLabelText('Enlace de invitación')) as HTMLInputElement).value
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo enlace' }))
    expect(screen.getByText('Quien aún no haya entrado necesitará el nuevo.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Generar el nuevo' }))
    await vi.waitFor(() =>
      expect((screen.getByLabelText('Enlace de invitación') as HTMLInputElement).value).not.toBe(before)
    )
  })

  it('se pueden cerrar y volver a abrir las invitaciones', async () => {
    renderCampaign(campaign())
    const toggle = await screen.findByRole('checkbox', { name: 'Invitaciones abiertas' })
    expect((toggle as HTMLInputElement).checked).toBe(true)
    await userEvent.click(toggle)
    await vi.waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(false))
    expect(screen.getByText('Ahora nadie puede entrar con el enlace.')).toBeDefined()
  })

  it('si el servidor no deja cerrar las invitaciones, la casilla vuelve a como estaba y lo dice', async () => {
    const c = campaign()
    const { api } = renderCampaign(c)
    const original = api.client.call
    api.client.call = async (name, input) => {
      if (name === 'setInvitationsOpen') throw new ApiError('FORBIDDEN', 403)
      return original(name, input)
    }
    const toggle = await screen.findByRole('checkbox', { name: 'Invitaciones abiertas' })
    await userEvent.click(toggle)
    expect((await screen.findByRole('alert')).textContent).toBe('No tienes permiso')
    expect((toggle as HTMLInputElement).checked).toBe(true)
  })

  it('mientras se guarda, la casilla sigue activa y con el foco; otro clic entretanto se ignora', async () => {
    const { api } = renderCampaign(campaign())
    const original = api.client.call
    const saving: boolean[] = []
    let release = () => {}
    api.client.call = async (name, input) => {
      if (name === 'setInvitationsOpen') {
        saving.push((input as { open: boolean }).open)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return original(name, input)
    }
    const toggle = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Invitaciones abiertas' })
    await userEvent.click(toggle)
    expect(toggle.disabled).toBe(false)
    expect(document.activeElement).toBe(toggle)
    await userEvent.click(toggle)
    expect(saving).toEqual([false])
    expect(toggle.checked).toBe(false)
    act(release)
    expect(await inMain().findByText('Ahora nadie puede entrar con el enlace.')).toBeDefined()
  })

  it('sin enlace, «Generar enlace» lo genera una sola vez aunque se pulse de nuevo, y no pierde el foco', async () => {
    const { api } = renderCampaign(campaign())
    const original = api.client.call
    let generated = 0
    let release = () => {}
    api.client.call = async (name, input) => {
      if (name === 'getInvitation' && generated === 0) {
        return { ...(await original(name, input)), url: null, issuedAt: null } as never
      }
      if (name === 'regenerateInvitation') {
        generated++
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return original(name, input)
    }
    const create = await screen.findByRole('button', { name: 'Generar enlace' })
    expect(screen.getByText('Aún no hay enlace.')).toBeDefined()
    await userEvent.click(create)
    expect(create.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(create)
    expect(generated).toBe(1)
    act(release)
    expect(await screen.findByLabelText('Enlace de invitación')).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nuevo enlace' }))
  })

  // Una casilla de la franja: su número, por su rótulo
  const stat = (label: string) => screen.queryByText(label, { selector: 'dt' })?.nextElementSibling?.textContent

  it('la franja dice de qué mundo es, que eres su máster, cuántos juegan y cuántos han entrado con el enlace', async () => {
    renderCampaign(campaign())
    expect(await screen.findByText('Campaña de Eana. Eres su máster.')).toBeDefined()
    await screen.findByText('Jugadores', { selector: 'dt' })
    expect(stat('Jugadores')).toBe('2')
    expect(await screen.findByText('Han entrado', { selector: 'dt' })).toBeDefined()
    expect(stat('Han entrado')).toBe('0')
  })

  it('a un jugador la franja le dice que juega en ella, sin lo del enlace', async () => {
    renderCampaign(campaign('player'), { ...world, role: 'player' })
    expect(await screen.findByText('Campaña de Eana. Juegas en ella.')).toBeDefined()
    await screen.findByText('Jugadores', { selector: 'dt' })
    expect(stat('Jugadores')).toBe('2')
    expect(stat('Han entrado')).toBeUndefined()
  })

  it('un jugador ve su campaña pero no el enlace', async () => {
    renderCampaign(campaign('player'), { ...world, role: 'player' })
    expect(await screen.findByRole('heading', { level: 1, name: 'La Marca' })).toBeDefined()
    expect(screen.queryByLabelText('Enlace de invitación')).toBeNull()
  })

  it('una campaña que no está en el mundo no existe', async () => {
    const c = campaign()
    renderCampaign(c)
    await screen.findByRole('heading', { level: 1, name: 'La Marca' })
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/mundos/${world.id}/campanas/${crypto.randomUUID()}`] })
    )
    const view = render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'E', email: 'e@x.es' } }).client}
        api={fakeApi({ organizations: [ORG], worlds: [world] }).client}
      />
    )
    expect(await within(view.container).findByRole('heading', { name: 'Esta campaña no existe' })).toBeDefined()
  })
})

describe('los miembros de una campaña', () => {
  const memberNames = () =>
    within(screen.getByRole('list', { name: 'Miembros' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent)

  it('el máster ve quién está, con su rol, y expulsa a un jugador tras avisar de que el enlace aún le vale', async () => {
    const { api } = renderCampaign(campaign())
    await screen.findByRole('list', { name: 'Miembros' })
    expect(memberNames()[0]).toContain('Enrique')
    expect(memberNames()[0]).toContain('Máster')
    expect(screen.queryByRole('button', { name: 'Expulsar a Enrique' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Expulsar a Jugadora' }))
    expect(screen.getByText('Con el enlace actual, Jugadora podría volver a entrar.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Expulsar' }))
    expect(await inMain().findByText('Jugadora ya no está en la campaña.')).toBeDefined()
    expect(announced()).toBe('Jugadora ya no está en la campaña.')
    expect(memberNames()).toHaveLength(2)
    expect(api.calls).not.toContain('regenerateInvitation')
  })

  it('el máster puede expulsar y cambiar el enlace a la vez', async () => {
    const { api } = renderCampaign(campaign())
    const before = ((await screen.findByLabelText('Enlace de invitación')) as HTMLInputElement).value
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Ana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expulsar y cambiar el enlace' }))
    expect(await inMain().findByText('Ana ya no está en la campaña.')).toBeDefined()
    expect(api.calls).toContain('regenerateInvitation')
    expect((screen.getByLabelText('Enlace de invitación') as HTMLInputElement).value).not.toBe(before)
  })

  it('si la expulsa pero el enlace no cambia, lo dice: ya no está, pero el enlace es el de antes', async () => {
    const { api } = renderCampaign(campaign())
    const original = api.client.call
    api.client.call = async (name, input) => {
      if (name === 'regenerateInvitation') throw new ApiError('UNKNOWN', 500)
      return original(name, input)
    }
    const before = ((await screen.findByLabelText('Enlace de invitación')) as HTMLInputElement).value
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Ana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expulsar y cambiar el enlace' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ana ya no está en la campaña, pero el enlace no ha cambiado. Genera uno nuevo.'
    )
    expect(memberNames()).toHaveLength(2)
    expect((screen.getByLabelText('Enlace de invitación') as HTMLInputElement).value).toBe(before)
  })

  it('cancelar no expulsa a nadie', async () => {
    const { api } = renderCampaign(campaign())
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Ana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(memberNames()).toHaveLength(3)
    expect(api.calls).not.toContain('removeMember')
  })

  it('un jugador ve a sus compañeros, no expulsa y puede dejar la campaña', async () => {
    const c = campaign('player')
    const { api, router } = renderCampaign(c, { ...world, role: 'player' })
    await screen.findByRole('list', { name: 'Miembros' })
    expect(memberNames()).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /^Expulsar/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Dejar la campaña' }))
    expect(screen.getByText('Para volver, el máster tendrá que pasarte el enlace.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Dejarla' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/mundos'))
    expect(api.calls).toContain('leaveCampaign')
  })

  it('al dejar su única campaña del mundo, va a sus mundos sin esperar a que falle la campaña', async () => {
    const c = campaign('player')
    const { api, router } = renderCampaign(c, { ...world, role: 'player' })
    // Como el servidor: después de salir, ni el mundo ni sus campañas existen para ella
    const original = api.client.call
    let left = false
    api.client.call = async (name, input) => {
      if (left && name === 'listWorlds') return { worlds: [] } as never
      if (left && name === 'listCampaigns') throw new ApiError('NOT_FOUND', 404)
      const result = await original(name, input)
      if (name === 'leaveCampaign') left = true
      return result
    }
    await userEvent.click(await screen.findByRole('button', { name: 'Dejar la campaña' }))
    await userEvent.click(screen.getByRole('button', { name: 'Dejarla' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/mundos'), { timeout: 500 })
    expect(await screen.findByText('Aún no tienes mundos')).toBeDefined()
  })

  it('el máster no ve «Dejar la campaña»', async () => {
    renderCampaign(campaign())
    await screen.findByRole('list', { name: 'Miembros' })
    expect(screen.queryByRole('button', { name: 'Dejar la campaña' })).toBeNull()
  })
})
