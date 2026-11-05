import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
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

async function renderSheet() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT }
  })
  const { character } = await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Thora' })
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
    confirm: 'created'
  })
  const router = createAppRouter(
    createMemoryHistory({
      initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/personajes/${character.id}`]
    })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  expect(await screen.findByRole('heading', { level: 1, name: 'Thora' })).toBeDefined()
  const play = async () =>
    (await api.client.call('getCharacter', { characterId: character.id })).character.play as {
      values?: Record<string, unknown>
      items?: { key: string; equipped?: boolean }[]
      uses?: Record<string, Record<string, number>>
    }
  return { api, play }
}

describe('la hoja en partida', () => {
  beforeEach(() =>
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo', 'mundos'] }))
  )

  it('lo que se cambia jugando se escribe; lo demás, no; dos daños seguidos se suman y el descanso lo llena', async () => {
    const { play } = await renderSheet()
    // Un sí o no y un número de un grupo
    await userEvent.click(screen.getByRole('checkbox', { name: 'Inspirado' }))
    const gold = screen.getByRole('spinbutton', { name: 'Oro' })
    await userEvent.type(gold, '25')
    fireEvent.blur(gold)
    await waitFor(async () => expect((await play()).values).toMatchObject({ inspirado: true, monedas: { oro: 25 } }))
    // Fuera de sus límites, vuelve a lo que había
    await userEvent.clear(gold)
    await userEvent.type(gold, '-3{Enter}')
    await waitFor(() => expect((gold as HTMLInputElement).value).toBe('25'))

    // Dos daños seguidos, sin esperar: se suman
    const wounds = within(screen.getByRole('region', { name: 'Heridas' }))
    const amount = wounds.getByLabelText('Cuánto')
    fireEvent.change(amount, { target: { value: '1' } })
    fireEvent.click(wounds.getByRole('button', { name: 'Daño' }))
    fireEvent.change(amount, { target: { value: '2' } })
    fireEvent.click(wounds.getByRole('button', { name: 'Daño' }))
    await waitFor(async () => expect((await play()).values?.heridas).toEqual({ value: 3, temp: 0 }))
    expect(await wounds.findByText('3')).toBeDefined()
    // El descanso largo lo hace el servidor: las heridas, llenas
    await userEvent.click(screen.getByRole('button', { name: 'Descanso largo' }))
    await waitFor(async () => expect((await play()).values?.heridas).toBeUndefined())
    expect(await wounds.findByText('6')).toBeDefined()

    // Las pestañas, con el teclado; las notas se escriben y la historia (de sus elecciones) solo se lee
    const carried = screen.getByRole('tab', { name: 'Lleva' })
    carried.focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Notas' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Notas' }))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(carried)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Notas' }))
    const notes = screen.getByRole('textbox', { name: 'Notas' })
    await userEvent.type(notes, 'Le debe 10 de oro a Brom')
    fireEvent.blur(notes)
    await waitFor(async () => expect((await play()).values?.notas).toBe('Le debe 10 de oro a Brom'))
    expect(screen.queryByRole('textbox', { name: 'Historia' })).toBeNull()
    expect(screen.getByText('Nació en la Marca.')).toBeDefined()
  })

  it('lo que lleva se añade del compendio y se equipa; se tira con ventaja y para quien se elija', async () => {
    const { api, play } = await renderSheet()
    const defense = screen.getByRole('button', { name: /^Tirar Defensa/ })
    expect(defense.textContent).toBe('8')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el compendio' }), 'escudo')
    await userEvent.click(await screen.findByRole('button', { name: /^Escudo/ }))
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Equipado' }))
    await waitFor(async () => expect((await play()).items).toMatchObject([{ key: 'escudo', equipped: true }]))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Tirar Defensa/ }).textContent).toBe('9'))

    // Sus usos, con su nombre: gastar dos seguidos
    const less = screen.getByRole('button', { name: 'Uno menos de Escudo · Cargas' })
    fireEvent.click(less)
    fireEvent.click(less)
    await waitFor(async () => expect(Object.values((await play()).uses ?? {})).toEqual([{ cargas: 2 }]))
    expect(await screen.findByText('1 de 3')).toBeDefined()

    // Con ventaja y oculta (es el máster)
    await userEvent.click(screen.getByRole('button', { name: 'Con ventaja' }))
    expect(screen.getByRole('button', { name: 'Con ventaja' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Quién la ve' }), 'hidden')
    await userEvent.click(screen.getByRole('button', { name: /^Tirar Defensa/ }))
    expect(await screen.findByText('Thora · Suerte')).toBeDefined()
    const { rolls } = await api.client.call('listRolls', { campaignId: CAMPAIGN.id })
    expect(rolls[0]).toMatchObject({ formula: '3d6kh2', visibility: 'hidden', label: 'Thora · Suerte' })
  })
})
