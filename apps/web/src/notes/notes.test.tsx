import type { Campaign, Member, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { noteTree } from './notes.tsx'

vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'member' as const }
const world = (role: World['role']): World => ({
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role,
  version: 1
})
const campaignOf = (w: World, role: Campaign['role']): Campaign => ({
  id: crypto.randomUUID(),
  worldId: w.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role,
  version: 1
})
const members: Member[] = [
  { userId: 'u1', name: 'Enrique', role: 'master' },
  { userId: 'ana', name: 'Ana', role: 'player' }
]

/** Los tutoriales que ya se han visto (los demás saldrían y se llevarían el foco) */
const seen = (...ids: string[]) =>
  localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo', ...ids] }))

function renderAt(
  path: (w: World, c: Campaign) => string,
  role: Campaign['role'],
  notes: Omit<NonNullable<NonNullable<Parameters<typeof fakeApi>[0]>['notes']>[number], 'campaignId'>[] = []
) {
  const w = world(role === 'master' ? 'master' : 'player')
  const c = campaignOf(w, role)
  const api = fakeApi({
    organizations: [ORG],
    worlds: [w],
    campaigns: [c],
    members: { [c.id]: members },
    pages: [{ worldId: w.id, title: 'Aldric Varn' }],
    notes: notes.map((n) => ({ ...n, campaignId: c.id }))
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path(w, c)] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router, world: w, campaign: c }
}

/** El móvil: las consultas de pantalla estrecha dicen que sí */
function narrowScreen() {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {}
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('el árbol de las notas', () => {
  it('cada una bajo su madre, en su orden; una sin madre en la lista, arriba', () => {
    const item = (id: string, parentId: string | null) => ({
      id,
      parentId,
      title: id,
      icon: null,
      version: 1,
      updatedAt: '',
      deletedAt: null
    })
    const tree = noteTree([item('a', null), item('b', 'a'), item('c', null), item('d', 'perdida')])
    expect(tree.map((b) => [b.note.id, b.children.map((c) => c.note.id)])).toEqual([
      ['a', ['b']],
      ['c', []],
      ['d', []]
    ])
  })
})

describe('Mis notas', () => {
  it('en la barra de la campaña de quien juega; crea una nota, le pone título y escribe, y se guarda solo', async () => {
    seen('campana', 'notas')
    const { api, campaign } = renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}/notas`, 'player')
    const nav = await screen.findByRole('link', { name: 'Mis notas' })
    expect(nav.getAttribute('href')).toMatch(/\/notas$/)
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis notas' })).toBeDefined()
    expect(await screen.findByText('Aún no tienes notas')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Nueva nota' }))
    const title = await screen.findByRole('textbox', { name: 'Título' })
    await userEvent.type(title, 'Sospechas{Enter}')
    await waitFor(async () => {
      const { notes } = await api.client.call('listPlayerNotes', { campaignId: campaign.id })
      expect(notes.map((n) => n.title)).toEqual(['Sospechas'])
    })
    // El texto, con el editor de la wiki; se guarda un momento después
    const body = screen.getByRole('textbox', { name: 'Texto de «Sospechas»' })
    await userEvent.click(body)
    await userEvent.keyboard('No me fío del posadero')
    await waitFor(
      async () => {
        const [note] = (await api.client.call('listPlayerNotes', { campaignId: campaign.id })).notes
        const full = await api.client.call('getPlayerNote', { id: note?.id ?? '' })
        expect(full.note.markdown).toContain('No me fío del posadero')
      },
      { timeout: 4000 }
    )
    expect(await screen.findByText('Guardado')).toBeDefined()

    // Una subnota, bajo ella
    await userEvent.click(screen.getByRole('button', { name: 'Nueva subnota en «Sospechas»' }))
    await waitFor(async () => {
      const { notes } = await api.client.call('listPlayerNotes', { campaignId: campaign.id })
      expect(notes).toHaveLength(2)
      expect(notes[1]?.parentId).toBe(notes[0]?.id)
    })
  })

  it('borrar la manda a su papelera, de donde vuelve', async () => {
    seen('campana', 'notas')
    renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}/notas`, 'player', [{ title: 'Nombres' }, { title: 'Pistas' }])
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar «Pistas»' }))
    const list = await screen.findByRole('list', { name: 'Notas' })
    await waitFor(() => expect(within(list).queryByText('Pistas')).toBeNull())
    await userEvent.click(await screen.findByText('Papelera (1)'))
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar «Pistas»' }))
    expect(await within(list).findByText('Pistas')).toBeDefined()
  })

  it('su tutorial: la lista y el texto', async () => {
    seen('campana')
    renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}/notas`, 'player', [{ title: 'Nombres' }])
    const bubble = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(within(bubble).getByText(/Tus notas, con subpáginas/)).toBeDefined()
    expect(within(bubble).getByText('1 de 2')).toBeDefined()
    await userEvent.click(within(bubble).getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText(/se guarda solo/)).toBeDefined()
  })

  it('en el móvil, la lista y la nota a pantalla completa, con la vuelta a la lista', async () => {
    seen('campana', 'notas')
    narrowScreen()
    renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}/notas`, 'player', [
      { title: 'Nombres', markdown: 'Hablé con [[Aldric Varn]]' }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nombres' }))
    // Solo la nota: sin la lista
    expect(await screen.findByRole('textbox', { name: 'Título' })).toBeDefined()
    expect(screen.queryByRole('list', { name: 'Notas' })).toBeNull()
    expect(await screen.findByRole('link', { name: 'Aldric Varn' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a las notas' }))
    expect(await screen.findByRole('list', { name: 'Notas' })).toBeDefined()
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull()
  })

  it('en su Mesa: la pestaña Notas de su barra abre cada nota en su ventana', async () => {
    seen('campana', 'notas', 'mesa-jugador')
    renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}/mesa`, 'player', [{ title: 'Pistas', markdown: 'Una llave' }])
    const panel = within(await screen.findByRole('complementary', { name: 'Panel de la mesa' }))
    await userEvent.click(panel.getByRole('tab', { name: 'Notas' }))
    await userEvent.click(await panel.findByRole('button', { name: 'Pistas' }))
    const window = await screen.findByRole('dialog', { name: 'Pistas' })
    expect(await within(window).findByText('Una llave')).toBeDefined()
    expect(within(window).getByRole('textbox', { name: 'Título' })).toBeDefined()
  })

  it('el máster, desde el Inicio, lee las de cada jugador sin poder cambiarlas', async () => {
    seen('campana', 'notas')
    renderAt((w, c) => `/mundos/${w.id}/campanas/${c.id}`, 'master', [
      { title: 'Bruno miente', userId: 'ana', markdown: 'Lo vi en el puerto' }
    ])
    await userEvent.click(await screen.findByRole('link', { name: 'Notas de Ana' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Notas de Ana' })).toBeDefined()
    expect(await screen.findByRole('heading', { level: 2, name: 'Bruno miente' })).toBeDefined()
    expect(await screen.findByText('Lo vi en el puerto')).toBeDefined()
    // Ni título que escribir, ni nota nueva, ni borrar
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nueva nota' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Borrar/ })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Texto de «Bruno miente»' }).getAttribute('contenteditable')).toBe(
      'false'
    )
    // Y no tiene «Mis notas» en su barra
    expect(screen.queryByRole('link', { name: 'Mis notas' })).toBeNull()
  })
})
