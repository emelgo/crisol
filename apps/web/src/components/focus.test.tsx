import type { Approval, Campaign, HistoryEntry, Member, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'

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
const campaignPath = `/mundos/${eana.id}/campanas/${marca.id}`

describe('el foco en las confirmaciones', () => {
  it('borrar: va al botón de confirmar, que lleva el aviso; cancelar lo devuelve; borrado, va al siguiente', async () => {
    renderAt('/mundos')
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar Eana' }))
    expect(document.activeElement).toBe(button('Borrar'))
    expect(description(button('Borrar'))).toBe('¿Borrar Eana? Irá a la papelera: se puede restaurar durante 30 días.')
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Borrar Eana'))

    await userEvent.click(button('Borrar Eana'))
    await userEvent.click(button('Borrar'))
    await expectFocus(() => screen.getByRole('link', { name: 'Otro' }))
    // El último: no queda otro, el foco va al título de la página
    await userEvent.click(button('Borrar Otro'))
    await userEvent.click(button('Borrar'))
    await expectFocus(() => screen.getByRole('heading', { level: 1, name: 'Mis mundos' }))
  })

  it('renombrar: va al campo; al cancelar o guardar, vuelve a «Renombrar»', async () => {
    renderAt('/mundos')
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Eana' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Nuevo nombre de Eana'))
    await userEvent.click(button('Cancelar'))
    await expectFocus(() => button('Renombrar Eana'))
    await userEvent.click(button('Renombrar Eana'))
    await userEvent.type(screen.getByLabelText('Nuevo nombre de Eana'), ' 2')
    await userEvent.click(button('Guardar'))
    await expectFocus(() => button('Renombrar Eana 2'))
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
