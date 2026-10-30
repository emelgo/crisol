import type { HistoryEntry, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { fakeRealtime } from '../realtime/fake.ts'
import { createAppRouter } from '../router.tsx'
import { announced, inMain } from '../testing.ts'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const world: World = {
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
const enrique = { id: 'u1', name: 'Enrique' }

let minute = 0
const entry = (action: string, details: Record<string, unknown>, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: crypto.randomUUID(),
  at: new Date(Date.UTC(2026, 9, 29, 12, 59 - minute++)).toISOString(),
  actor: enrique,
  via: 'ui',
  tool: null,
  action,
  details,
  worldId: world.id,
  undoneBy: null,
  undoes: null,
  ...extra
})

const renderAt = (
  path: string,
  history: HistoryEntry[],
  options: { role?: World['role']; conflicts?: Record<string, HistoryEntry | null> } = {}
) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [{ ...world, role: options.role ?? 'master' }],
    history,
    ...(options.conflicts ? { conflicts: options.conflicts } : {})
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
  return { api, realtime, router }
}

/** Las líneas tachadas (lo deshecho) */
const struck = () =>
  within(screen.getByRole('list', { name: 'Operaciones' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[class*="undone"]')?.textContent)
    .filter(Boolean)

const lines = () =>
  within(screen.getByRole('list', { name: 'Operaciones' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('el historial', () => {
  // Los tutoriales guiados ya hechos: que no se pongan en medio
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.e@crisol.test', JSON.stringify({ seen: ['mundos', 'mundo', 'campanas'] }))
  )

  it('cuenta cada operación en una frase, con quién, cuándo y por dónde', async () => {
    minute = 0
    renderAt(`/mundos/${world.id}/historial`, [
      entry('removeMember', { campaign: 'La Marca', member: 'Pepe' }),
      entry('setInvitationsOpen', { campaign: 'La Marca', open: false }),
      entry('createCampaign', { name: 'La Marca', world: 'Eana' }, { via: 'ai', tool: 'crear_campana' }),
      entry('renameWorld', { from: 'Eana', to: 'Eana (Fateforge)' }),
      entry('joinCampaign', { campaign: 'La Marca', world: 'Eana' }, { actor: { id: 'u2', name: 'Pepe' } }),
      entry('createOrganization', { name: 'Fateforge' }, { actor: null, via: 'system' }),
      entry('algoNuevo', {}, { actor: null }),
      entry('deleteCampaign', { name: 'La Marca', world: 'Eana' }),
      entry('restoreWorld', { name: 'Eana' }),
      entry('deleteWorld', { name: 'Otro' }),
      entry('restoreCampaign', { name: 'La Marca', world: 'Eana' })
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Historial de Eana' })).toBeDefined()
    expect(lines()).toEqual([
      expect.stringMatching(/^Enrique expulsó a Pepe de La Marca.*29 oct 2026.*· web/),
      expect.stringMatching(/^Enrique cerró las invitaciones de La Marca/),
      expect.stringMatching(/^Enrique creó la campaña «La Marca» en Eana.*· IA \(crear_campana\)/),
      expect.stringMatching(/^Enrique renombró el mundo «Eana» a «Eana \(Fateforge\)»/),
      expect.stringMatching(/^Pepe entró en La Marca/),
      expect.stringMatching(/^Crisol creó la organización «Fateforge».*Crisol$/),
      expect.stringMatching(/^Una cuenta borrada hizo un cambio \(algoNuevo\)/),
      expect.stringMatching(/^Enrique borró la campaña «La Marca» de Eana/),
      expect.stringMatching(/^Enrique restauró el mundo «Eana»/),
      expect.stringMatching(/^Enrique borró el mundo «Otro»/),
      expect.stringMatching(/^Enrique restauró la campaña «La Marca» de Eana/)
    ])
  })

  it('va por páginas: «Ver más» trae las siguientes', async () => {
    const history = Array.from({ length: 60 }, (_, i) => entry('createWorld', { name: `Mundo ${i}` }))
    renderAt('/historial', history)
    await screen.findByRole('list', { name: 'Operaciones' })
    expect(lines()).toHaveLength(50)
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(60))
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
  })

  it('sin nada aún, lo dice', async () => {
    renderAt('/historial', [])
    expect(await screen.findByText('Aún no hay nada en el historial')).toBeDefined()
  })

  it('se pone al día cuando algo cambia', async () => {
    const history = [entry('createWorld', { name: 'Eana' })]
    const { api, realtime } = renderAt('/historial', history)
    await screen.findByRole('list', { name: 'Operaciones' })
    api.history.unshift(entry('renameWorld', { from: 'Eana', to: 'Eana 2' }))
    act(() => realtime.emit({ type: 'changed', what: 'worlds' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(2))
  })

  it('a quien no puede verlo se le dice', async () => {
    renderAt(`/mundos/${world.id}/historial`, [], { role: 'player' })
    expect(await screen.findByText('No tienes permiso')).toBeDefined()
  })

  it('se abre desde la barra, encima de la página: dentro del mundo, el suyo (su máster); fuera, el de la cuenta', async () => {
    const { router } = renderAt(`/mundos/${world.id}`, [])
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))
    const inWorld = await screen.findByRole('dialog', { name: 'Historial' })
    expect(await within(inWorld).findByRole('heading', { level: 1, name: 'Historial de Eana' })).toBeDefined()
    expect(router.state.location.pathname).toBe(`/mundos/${world.id}`)
    await userEvent.click(within(inWorld).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Historial' })).toBeNull()

    await router.navigate({ to: '/mundos' })
    await screen.findByRole('heading', { level: 1, name: 'Mis mundos' })
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))
    const outside = await screen.findByRole('dialog', { name: 'Historial' })
    expect(await within(outside).findByRole('heading', { level: 1, name: 'Historial' })).toBeDefined()
    expect(router.state.location.pathname).toBe('/mundos')
  })

  it('deshace una operación: la tacha como deshecha y el deshacer queda arriba, con «Rehacer»', async () => {
    const rename = entry('renameWorld', { from: 'Eana', to: 'Eana 2' })
    const { api } = renderAt('/historial', [rename, entry('createWorld', { name: 'Eana' })])
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: renombró el mundo «Eana» a «Eana 2»' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(3))
    expect(lines()[0]).toMatch(/^Enrique deshizo: renombró el mundo «Eana» a «Eana 2»/)
    expect(lines()[1]).toMatch(/deshecho$/)
    expect(struck()).toEqual(['Enrique renombró el mundo «Eana» a «Eana 2»'])
    expect(screen.queryByRole('button', { name: 'Deshacer: renombró el mundo «Eana» a «Eana 2»' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Rehacer: renombró el mundo «Eana» a «Eana 2»' })).toBeDefined()
    expect(api.calls).toContain('undoOperation')
  })

  it('rehacer: lo de antes vuelve a estar, sin tachar, y se puede volver a deshacer', async () => {
    const rename = entry('renameWorld', { from: 'Eana', to: 'Eana 2' })
    renderAt('/historial', [rename])
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: renombró el mundo «Eana» a «Eana 2»' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rehacer: renombró el mundo «Eana» a «Eana 2»' }))
    await vi.waitFor(() => expect(lines()).toHaveLength(3))
    expect(lines()[0]).toMatch(/^Enrique rehízo: renombró el mundo «Eana» a «Eana 2»/)
    expect(lines()[1]).toMatch(/^Enrique deshizo: .*deshecho$/)
    expect(lines()[2]).not.toMatch(/deshecho/)
    expect(struck()).toEqual(['Enrique deshizo: renombró el mundo «Eana» a «Eana 2»'])
    // Un solo botón, en la última de la cadena
    expect(
      screen.getAllByRole('button', { name: /^(Deshacer|Rehacer):/ }).map((b) => b.getAttribute('aria-label'))
    ).toEqual(['Deshacer: renombró el mundo «Eana» a «Eana 2»'])
  })

  it('si no se puede rehacer, lo dice', async () => {
    const create = entry('createWorld', { name: 'Eana' }, { undoneBy: 'u' })
    const undo = entry('undoOperation', { action: 'createWorld', details: { name: 'Eana' } }, { undoes: create.id })
    const later = entry('createWorld', { name: 'Eana' })
    renderAt('/historial', [{ ...undo, id: 'u' }, create], { conflicts: { u: later } })
    await userEvent.click(await screen.findByRole('button', { name: 'Rehacer: creó el mundo «Eana»' }))
    const text = 'No se puede rehacer: después, Enrique creó el mundo «Eana». Deshaz eso antes.'
    expect(await inMain().findByText(text)).toBeDefined()
    expect(announced()).toBe(text)
  })

  it('si no se puede deshacer, dice qué operación posterior lo impide', async () => {
    const rename = entry('renameWorld', { from: 'Eana 2', to: 'Eana 3' })
    const create = entry('createWorld', { name: 'Eana' })
    renderAt('/historial', [rename, create], { conflicts: { [create.id]: rename } })
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: creó el mundo «Eana»' }))
    const text = 'No se puede deshacer: después, Enrique renombró el mundo «Eana 2» a «Eana 3». Deshaz eso antes.'
    expect(await inMain().findByText(text)).toBeDefined()
    expect(announced()).toBe(text)
  })

  it('si lo de después fue en una página, lleva a ella y a sus versiones', async () => {
    const pageId = crypto.randomUUID()
    const edit = entry('editPage', { title: 'Puerto Ceniza', pageId })
    const create = entry('createWorld', { name: 'Eana' })
    renderAt('/historial', [edit, create], { conflicts: { [create.id]: edit } })
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: creó el mundo «Eana»' }))
    const link = await inMain().findByRole('link', { name: 'Ir a «Puerto Ceniza» y a sus versiones' })
    expect(link.getAttribute('href')).toBe(`/mundos/${world.id}/wiki/${pageId}`)
  })

  it('si no se sabe qué lo impide, lo dice igual', async () => {
    const create = entry('createWorld', { name: 'Eana' })
    renderAt('/historial', [create], { conflicts: { [create.id]: null } })
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer: creó el mundo «Eana»' }))
    const text = 'No se puede deshacer: algo de lo que cambió se ha cambiado después.'
    expect(await inMain().findByText(text)).toBeDefined()
    expect(announced()).toBe(text)
  })

  it('lo ya deshecho y lo del sistema no se ofrecen para deshacer', async () => {
    renderAt('/historial', [
      entry('createWorld', { name: 'Eana' }, { undoneBy: crypto.randomUUID() }),
      entry('createOrganization', { name: 'Fateforge' }, { actor: null, via: 'system' })
    ])
    await screen.findByRole('list', { name: 'Operaciones' })
    expect(screen.queryByRole('button', { name: /^Deshacer/ })).toBeNull()
  })

  it('a un jugador, el historial de la barra no le enseña el del mundo, sino el de su cuenta', async () => {
    renderAt(`/mundos/${world.id}`, [], { role: 'player' })
    await screen.findByRole('heading', { level: 1, name: 'Eana' })
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Historial' }))
    expect(await dialog.findByRole('heading', { level: 1, name: 'Historial' })).toBeDefined()
    expect(dialog.queryByRole('heading', { name: 'Historial de Eana' })).toBeNull()
  })
})
