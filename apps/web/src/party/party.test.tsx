import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
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

// Fronteras con una hoja: cifras (una se tira), sus heridas, monedas, lo que lleva y notas, en pestañas
const SYSTEM: System = (() => {
  const system = { ...structuredClone(fronteras), id: crypto.randomUUID() }
  const personaje = system.types.personaje
  if (!personaje) throw new Error('Sin personaje')
  personaje.fields = {
    ...personaje.fields,
    monedas: {
      kind: 'group',
      label: 'Monedas',
      play: true,
      fields: { oro: { kind: 'number', label: 'Oro', min: 0, integer: true } }
    },
    inspirado: { kind: 'boolean', label: 'Inspirado', play: true },
    notas: { kind: 'text', label: 'Notas', play: true },
    historia: { kind: 'text', label: 'Historia', default: 'Nació en la Marca.' }
  }
  system.rolls = {
    ...system.rolls,
    suerte: {
      label: 'Suerte',
      formula: '2d6',
      modes: [{ key: 'ventaja', label: 'Con ventaja', from: '2d6', to: '3d6kh2' }]
    }
  }
  system.sheet = {
    blocks: [
      { kind: 'header' },
      { kind: 'stats', fields: ['defensa', 'vigor', 'inspirado'], rolls: { defensa: 'suerte' } },
      { kind: 'resource', field: 'heridas' },
      { kind: 'group', field: 'monedas' },
      {
        kind: 'tabs',
        tabs: [
          { label: 'Lleva', blocks: [{ kind: 'items', field: 'lleva', columns: ['peso'] }, { kind: 'uses' }] },
          {
            label: 'Notas',
            blocks: [
              { kind: 'text', field: 'notas' },
              { kind: 'text', field: 'historia' }
            ]
          }
        ]
      }
    ]
  }
  return system
})()
const move = (key: string, name: string): ContentItem => ({
  type: 'movimiento',
  key,
  source: null,
  data: { name, atributo: 'vigor', descripcion: `${name}: haz algo.` }
})
const CONTENT: ContentItem[] = [
  move('cargar', 'Cargar'),
  move('esquivar', 'Esquivar'),
  {
    type: 'objeto',
    key: 'escudo',
    source: null,
    data: { name: 'Escudo', defensa: 1, peso: 3 },
    mechanics: { resources: [{ key: 'cargas', label: 'Cargas', max: '3', recovery: 'long' }] }
  }
]
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

async function setUp(path: (characterId: string) => string, carried: Record<string, unknown> = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT }
  })
  const { character } = await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Thora' })
  // Terminado: se abre en su hoja
  await api.client.call('updateCharacter', {
    characterId: character.id,
    version: character.version,
    build: {
      values: { vigor: 1 },
      picks: [
        { id: 'm1', step: 'movimientos', key: 'cargar' },
        { id: 'm2', step: 'movimientos', key: 'esquivar' }
      ]
    },
    play: carried,
    confirm: 'created'
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path(character.id)] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  const party = async () => (await api.client.call('getParty', { campaignId: CAMPAIGN.id })).party
  const play = async () =>
    (await api.client.call('getCharacter', { characterId: character.id })).character.play as {
      values?: Record<string, unknown>
      items?: { id: string; key: string; quantity?: number }[]
    }
  return { api, party, play, characterId: character.id }
}

describe('el inventario del grupo (docs/specs/grupo.md)', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'mundos', 'campana', 'personajes', 'personaje', 'compendio', 'grupo'] })
    )
  )

  it('«Grupo»: añadir del compendio y a mano, contenedores, mover a un personaje y las monedas', async () => {
    const { api, party, play } = await setUp(() => `/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/grupo`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Grupo' })).toBeDefined()
    expect(await screen.findByText(/El grupo aún no tiene nada/)).toBeDefined()

    // Del compendio: buscarlo, elegirlo, cuántos
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Añadir al grupo' }))
    await userEvent.click(await dialog.findByRole('button', { name: 'Escudo' }))
    const quantity = dialog.getByRole('spinbutton', { name: 'Cantidad' })
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '2')
    await userEvent.click(dialog.getByRole('button', { name: 'Añadir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // A mano, con su nota
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Añadir al grupo' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Escrito a mano' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nombre' }), 'Llave de bronce')
    await userEvent.type(dialog.getByRole('textbox', { name: 'Nota' }), 'De la cripta')
    await userEvent.click(dialog.getByRole('button', { name: 'Añadir' }))
    await waitFor(async () =>
      expect((await party()).items.map((i) => [i.name, i.quantity])).toEqual([
        ['Escudo', 2],
        ['Llave de bronce', 1]
      ])
    )
    expect(await screen.findByText('De la cripta')).toBeDefined()

    // Un contenedor nuevo, y la llave dentro
    await userEvent.click(screen.getByRole('button', { name: 'Contenedor nuevo' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Contenedor nuevo' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'Su nombre' }), 'El carro')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mover «Llave de bronce»' }))
    const menu = within(screen.getByRole('group', { name: 'Mover «Llave de bronce»' }))
    // Lo escrito a mano no va a un personaje
    expect(menu.queryByRole('button', { name: /A Thora/ })).toBeNull()
    await userEvent.click(menu.getByRole('button', { name: 'A El carro' }))
    const carro = within(await screen.findByRole('region', { name: 'El carro' }))
    expect(await carro.findByText('Llave de bronce')).toBeDefined()

    // Un escudo a Thora: sale del grupo y lo lleva ella
    await userEvent.click(screen.getByRole('button', { name: 'Mover «Escudo»' }))
    const shield = within(screen.getByRole('group', { name: 'Mover «Escudo»' }))
    const howMany = shield.getByRole('spinbutton', { name: 'Cuántas' })
    await userEvent.clear(howMany)
    await userEvent.type(howMany, '1')
    await userEvent.click(shield.getByRole('button', { name: /A Thora/ }))
    await waitFor(async () =>
      expect((await play()).items).toEqual([expect.objectContaining({ key: 'escudo', quantity: 1 })])
    )
    expect((await party()).items.find((i) => i.key === 'escudo')?.quantity).toBe(1)
    // Lo cuenta en los movimientos
    const moves = within(screen.getByRole('complementary', { name: 'Movimientos' }))
    expect(await moves.findByText(/pasó 1 × «Escudo» del grupo a/)).toBeDefined()

    // Las monedas: dar a Thora y repartir lo que queda
    const { party: now } = await api.client.call('getParty', { campaignId: CAMPAIGN.id })
    await api.client.call('updateParty', { campaignId: CAMPAIGN.id, version: now.version, coins: { oro: 11 } })
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await screen.findByRole('button', { name: 'Gestionar' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Las monedas' }))
    await userEvent.type(dialog.getByRole('spinbutton', { name: 'Oro' }), '5')
    await userEvent.click(dialog.getByRole('button', { name: 'Dar al personaje' }))
    await waitFor(async () => expect((await play()).values?.monedas).toEqual({ oro: 5 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Gestionar' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Las monedas' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Repartir' }))
    await waitFor(async () => expect((await play()).values?.monedas).toEqual({ oro: 11 }))
    expect((await party()).coins).toEqual({ oro: 0 })
  })

  it('en la hoja: «Mío | Del grupo», y «Mover» devuelve al grupo lo que lleva', async () => {
    const { party, play } = await setUp((id) => `/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/personajes/${id}`, {
      items: [{ id: 'e1', key: 'escudo', quantity: 2 }]
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Thora' })).toBeDefined()
    await userEvent.click(await screen.findByRole('tab', { name: 'Lleva' }))
    // Lo del grupo, en el mismo sitio
    await userEvent.click(await screen.findByRole('button', { name: 'Del grupo' }))
    expect(await screen.findByText(/El grupo aún no tiene nada/)).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Mío' }))
    // Con el teclado: Escape lo cierra y el foco vuelve a «Mover»
    const trigger = await screen.findByRole('button', { name: 'Mover «Escudo»' })
    await userEvent.click(trigger)
    expect(screen.getByRole('group', { name: 'Mover «Escudo»' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Mover «Escudo»' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    await userEvent.click(trigger)
    const menu = within(screen.getByRole('group', { name: 'Mover «Escudo»' }))
    await userEvent.click(menu.getByRole('button', { name: 'Al grupo' }))
    await waitFor(async () =>
      expect((await party()).items).toEqual([expect.objectContaining({ key: 'escudo', quantity: 2 })])
    )
    expect((await play()).items).toEqual([])
  })
})
