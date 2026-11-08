import type { Approval, Campaign, HistoryEntry, Member, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

// El máster abre la campaña en la Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world = (name: string, role: World['role'] = 'master'): World => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name,
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1
})
const eana = world('Eana')
const otro = world('Otro')
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
const members: Member[] = [
  { userId: 'u1', name: 'Enrique', role: 'master' },
  { userId: 'u2', name: 'Ana', role: 'player' },
  { userId: 'u3', name: 'Bea', role: 'player' }
]
const request = (campaign: string): Approval => ({
  id: crypto.randomUUID(),
  tool: 'enlace_invitacion',
  action: 'regenerateInvitation',
  input: { campaignId: marca.id },
  details: { campaign },
  status: 'pending',
  requestedAt: '2026-10-29T12:00:00.000Z',
  expiresAt: '2026-10-30T12:00:00.000Z',
  decidedAt: null,
  error: null
})

function renderAt(path: string, options: Parameters<typeof fakeApi>[0] = {}, role: Campaign['role'] = 'master') {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [{ ...eana, role }, otro],
    campaigns: [{ ...marca, role }],
    members: { [marca.id]: members },
    ...options
  })
  const realtime = fakeRealtime()
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'e@crisol.test' } }).client}
      api={api.client}
      realtime={realtime.client}
    />
  )
  return { api, realtime }
}

const button = (name: string) => screen.getByRole('button', { name })
/** Lo que el lector de pantalla lee como descripción de un elemento */
const description = (element: Element) =>
  document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent
const expectFocus = (element: () => Element) => waitFor(() => expect(document.activeElement).toBe(element()))
// El máster, en los Ajustes de la Mesa (miembros e invitación)
const campaignPath = `/mundos/${eana.id}/campanas/${marca.id}?panel=ajustes`

/** Abre la ventana de un mundo por su engranaje y, en su zona de peligro, la confirmación de borrarlo */
async function openDelete(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Ajustes de ${name}` }))
  const settings = within(await screen.findByRole('dialog', { name: `Ajustes de ${name}` }))
  const zone = within(settings.getByRole('region', { name: 'Zona de peligro' }))
  await userEvent.click(zone.getByRole('button', { name: 'Borrar el mundo' }))
  return within(await screen.findByRole('dialog', { name: `¿Borrar «${name}»?` }))
}

describe('el foco en las confirmaciones', () => {
  // El tutorial guiado ya hecho: que no se lleve el foco
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.e@crisol.test', JSON.stringify({ seen: ['mundos', 'campana'] }))
  )

  it('borrar: va al campo del nombre, junto al aviso; cancelar lo devuelve; borrado, va al siguiente', async () => {
    renderAt('/mundos')
    const confirm = await openDelete('Eana')
    expect(document.activeElement).toBe(confirm.getByLabelText('Nombre del mundo'))
    expect(
      confirm.getByText('Irá a la papelera, con sus campañas y sus páginas, y se podrá recuperar durante 30 días.')
    ).toBeDefined()
    const settings = () => within(screen.getByRole('dialog', { name: 'Ajustes de Eana' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancelar' }))
    await expectFocus(() => settings().getByRole('button', { name: 'Borrar el mundo' }))

    await userEvent.click(settings().getByRole('button', { name: 'Borrar el mundo' }))
    const again = within(await screen.findByRole('dialog', { name: '¿Borrar «Eana»?' }))
    await userEvent.type(again.getByLabelText('Nombre del mundo'), 'Eana')
    await userEvent.click(again.getByRole('button', { name: 'Borrar el mundo' }))
    await expectFocus(() => screen.getByRole('link', { name: 'Otro' }))
    // El último: no queda otro, el foco va al título de la página
    const last = await openDelete('Otro')
    await userEvent.type(last.getByLabelText('Nombre del mundo'), 'Otro')
    await userEvent.click(last.getByRole('button', { name: 'Borrar el mundo' }))
    await expectFocus(() => screen.getByRole('heading', { level: 1, name: 'Mis mundos' }))
  })

  it('ajustes: al cerrar su ventana, el foco vuelve al engranaje, también tras cambiar el nombre', async () => {
    renderAt('/mundos')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes de Eana' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes de Eana' })
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' })[0] as HTMLElement)
    await expectFocus(() => button('Ajustes de Eana'))

    await userEvent.click(button('Ajustes de Eana'))
    const again = within(await screen.findByRole('dialog', { name: 'Ajustes de Eana' }))
    await userEvent.type(again.getByLabelText('Nombre del mundo'), ' 2')
    await userEvent.click(again.getByRole('button', { name: 'Guardar' }))
    const renamed = await screen.findByRole('dialog', { name: 'Ajustes de Eana 2' })
    await userEvent.click(within(renamed).getAllByRole('button', { name: 'Cerrar' })[0] as HTMLElement)
    await expectFocus(() => button('Ajustes de Eana 2'))
  })

  it('expulsar: va a «Expulsar», con el aviso; cancelar lo devuelve; expulsada, va al siguiente', async () => {
    renderAt(campaignPath)
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Ana' }))
    expect(document.activeElement).toBe(button('Expulsar'))
    expect(description(button('Expulsar'))).toBe('Con el enlace actual, Ana podría volver a entrar.')
    expect(description(button('Expulsar y cambiar el enlace'))).toBe(
      'Con el enlace actual, Ana podría volver a entrar.'
    )
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Expulsar a Ana'))
    await userEvent.click(button('Expulsar a Ana'))
    await userEvent.click(button('Expulsar'))
    await expectFocus(() => button('Expulsar a Bea'))
  })

  it('«Nuevo enlace»: va a confirmar, con el aviso; al cancelar o generarlo, vuelve a «Nuevo enlace»', async () => {
    renderAt(campaignPath)
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo enlace' }))
    expect(document.activeElement).toBe(button('Generar el nuevo'))
    expect(description(button('Generar el nuevo'))).toBe('Quien aún no haya entrado necesitará el nuevo.')
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Nuevo enlace'))
    await userEvent.click(button('Nuevo enlace'))
    await userEvent.click(button('Generar el nuevo'))
    await expectFocus(() => button('Nuevo enlace'))
  })

  it('dejar la campaña: va a «Dejarla», con el aviso; cancelar lo devuelve', async () => {
    renderAt(campaignPath, {}, 'player')
    await userEvent.click(await screen.findByRole('button', { name: 'Dejar la campaña' }))
    expect(document.activeElement).toBe(button('Dejarla'))
    expect(description(button('Dejarla'))).toBe('Para volver, el máster tendrá que pasarte el enlace.')
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Dejar la campaña'))
  })

  it('en un aviso: expulsar lleva a su «Cerrar»; cerrarlo, al título de la página', async () => {
    const { realtime } = renderAt('/mundos')
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    act(() =>
      realtime.emit({
        type: 'joined',
        worldId: eana.id,
        campaignId: marca.id,
        campaign: 'La Marca',
        member: { userId: 'u2', name: 'Ana' }
      })
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Expulsar a Ana' }))
    expect(document.activeElement).toBe(button('Expulsar'))
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Expulsar a Ana'))
    await userEvent.click(button('Expulsar a Ana'))
    await userEvent.click(button('Expulsar'))
    await expectFocus(() => button('Cerrar el aviso de Ana'))
    await userEvent.click(button('Cerrar el aviso de Ana'))
    await expectFocus(() => screen.getByRole('heading', { level: 1, name: 'Mis mundos' }))
  })
})

describe('el foco cuando desaparece un elemento', () => {
  it('en la cola: al aprobar, a la siguiente petición; con la última, al título de la página', async () => {
    renderAt('/mundos', { approvals: [request('La Marca'), request('Las Islas')] })
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' }))
    await expectFocus(() => button('Aprobar: generar un enlace nuevo para Las Islas'))
    await userEvent.click(button('Rechazar: generar un enlace nuevo para Las Islas'))
    await expectFocus(() => screen.getByRole('heading', { level: 1, name: 'Mis mundos' }))
  })

  it('en la papelera: al restaurar, al siguiente; con el último, al título de la página', async () => {
    const { api } = renderAt('/papelera')
    await screen.findByText('La papelera está vacía')
    await api.client.call('deleteCampaign', { campaignId: marca.id })
    await api.client.call('deleteWorld', { worldId: otro.id })
    window.dispatchEvent(new Event('focus'))
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar Otro' }))
    await expectFocus(() => button('Restaurar La Marca'))
    await userEvent.click(button('Restaurar La Marca'))
    await expectFocus(() => screen.getByRole('heading', { level: 1, name: 'Papelera' }))
  })

  it('en el historial: al deshacer, a «Rehacer» de la operación nueva', async () => {
    const rename: HistoryEntry = {
      id: crypto.randomUUID(),
      at: '2026-10-29T12:00:00.000Z',
      actor: { id: 'u1', name: 'Enrique' },
      via: 'ui',
      tool: null,
      action: 'renameWorld',
      details: { from: 'Eana', to: 'Eana 2' },
      worldId: eana.id,
      undoneBy: null,
      undoes: null
    }
    renderAt('/historial', { history: [rename] })
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: renombró el mundo «Eana» a «Eana 2»' }))
    await expectFocus(() => button('Rehacer: renombró el mundo «Eana» a «Eana 2»'))
  })
})
