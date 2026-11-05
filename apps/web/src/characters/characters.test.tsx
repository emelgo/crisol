import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
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
const SYSTEM = { ...structuredClone(fronteras), id: crypto.randomUUID() }
const move = (key: string, name: string): ContentItem => ({
  type: 'movimiento',
  key,
  source: null,
  data: { name, atributo: 'vigor', descripcion: `${name}: haz algo.` }
})
const CONTENT = [move('cargar', 'Cargar'), move('esquivar', 'Esquivar'), move('enganar', 'Engañar')]
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Fronteras', defaultRoll: '2d6', critical: 'none' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}

function renderAt(path: string) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT }
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('los personajes de una campaña', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'mundos', 'campana', 'personajes', 'personaje', 'compendio', 'tabla'] })
    )
  )

  it('«Personaje nuevo»: se crea y se abre en el creador; sus pasos con lo que falta y terminarlo', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/personajes`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Personajes' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Personaje nuevo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Personaje nuevo' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre' }), 'Brisa')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear el personaje' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/personajes\/[0-9a-f-]{36}$/))
    expect(await screen.findByRole('heading', { level: 1, name: 'Brisa' })).toBeDefined()

    // Los pasos del sistema: lo que falta, marcado
    const steps = within(screen.getByRole('navigation', { name: 'Pasos' }))
    expect(steps.getAllByRole('button').map((b) => b.textContent)).toEqual(['Atributos', 'Movimientos!', 'Resumen'])
    const finish = screen.getByRole('button', { name: 'Terminar' })
    expect((finish as HTMLButtonElement).disabled).toBe(true)

    // Los atributos, a mano
    await userEvent.click(steps.getByRole('button', { name: 'Atributos' }))
    const vigor = screen.getByRole('spinbutton', { name: 'Vigor' })
    await userEvent.type(vigor, '2')
    await userEvent.tab()

    // Dos movimientos: se añaden hasta el máximo
    await userEvent.click(steps.getByRole('button', { name: /Movimientos/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Cargar' })).toBeDefined()
    await userEvent.click(await screen.findByRole('button', { name: 'Esquivar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Esquivar' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Engañar' })).toBeNull()

    // Ya tiene lo que pide su sistema: se termina, y su ficha lo dice
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Terminar' }) as HTMLButtonElement).disabled).toBe(false)
    )
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ficha' }))
    const values = within(await screen.findByRole('list', { name: 'Sus valores' }))
    expect(values.getByText('Defensa').parentElement?.textContent).toBe('Defensa9')
    const versions = within(screen.getByRole('complementary', { name: 'Versiones' }))
    expect(await versions.findByText('Creado · Nivel 0')).toBeDefined()
  })

  it('la lista: su tarjeta (en creación, con quién lo juega), su vista previa y su ventana, donde se borra', async () => {
    const lisandro = {
      id: crypto.randomUUID(),
      campaignId: CAMPAIGN.id,
      owner: { id: 'ana', name: 'Ana' },
      name: 'Lisandro',
      system: SYSTEM.id,
      status: 'creating' as const,
      summary: { line: 'Cargar', stats: [{ key: 'defensa', label: 'Defensa', value: '8' }] },
      version: 1,
      updatedAt: new Date().toISOString(),
      build: {},
      play: {}
    }
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      campaigns: [CAMPAIGN],
      systems: [SYSTEM],
      systemContent: { [SYSTEM.id]: CONTENT },
      characters: [lisandro]
    })
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/personajes`] })
    )
    render(
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
        api={api.client}
      />
    )
    const list = within(await screen.findByRole('list', { name: 'Personajes' }))
    const card = within(list.getByRole('link', { name: 'Lisandro' }).closest('li') as HTMLElement)
    expect(card.getByText('En creación')).toBeDefined()
    expect(card.getByText('Ana')).toBeDefined()
    expect(card.getByText('Cargar')).toBeDefined()
    fireEvent.pointerEnter(list.getByRole('link', { name: 'Lisandro' }).closest('li') as HTMLElement)
    const preview = within(screen.getByRole('complementary', { name: 'Vista previa' }))
    expect(preview.getByText('8')).toBeDefined()
    await userEvent.click(card.getByRole('button', { name: 'Ajustes de Lisandro' }))
    const window = within(screen.getByRole('dialog', { name: 'Ajustes de Lisandro' }))
    await userEvent.click(window.getByRole('button', { name: 'Borrar el personaje' }))
    const confirm = within(screen.getByRole('dialog', { name: '¿Borrar «Lisandro»?' }))
    await userEvent.type(confirm.getByRole('textbox', { name: 'Nombre' }), 'Lisandro')
    await userEvent.click(confirm.getByRole('button', { name: 'Borrar el personaje' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Lisandro' })).toBeNull())
  })
})
