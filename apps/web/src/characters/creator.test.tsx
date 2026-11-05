import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { FORMAT } from '@crisol/systems'
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

/** Un juego pequeño con clases por niveles: dos características, dos habilidades y una mejora a nivel 2 */
const SYSTEM: System = {
  format: FORMAT,
  id: crypto.randomUUID(),
  name: 'Pequeño',
  version: '1',
  languages: ['es'],
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        nivel: { kind: 'derived', label: 'Nivel', formula: 'max(1, sum(@clases.nivel))' },
        caracteristicas: {
          kind: 'set',
          label: 'Características',
          elements: [
            { key: 'fue', label: 'Fuerza' },
            { key: 'des', label: 'Destreza' }
          ],
          fields: { puntuacion: { kind: 'number', label: 'Puntuación' } }
        },
        habilidades: {
          kind: 'set',
          label: 'Habilidades',
          elements: [
            { key: 'atletismo', label: 'Atletismo' },
            { key: 'sigilo', label: 'Sigilo' }
          ],
          fields: { grado: { kind: 'number', label: 'Grado' } }
        },
        clases: { kind: 'items', label: 'Clases', of: ['clase'] },
        rasgos: { kind: 'items', label: 'Rasgos', of: ['rasgo'] }
      }
    },
    clase: {
      document: 'item',
      label: 'Clase',
      fields: {
        nivel: { kind: 'number', label: 'Nivel' },
        inicial: { kind: 'boolean', label: 'Inicial' }
      }
    },
    rasgo: { document: 'item', label: 'Rasgo', fields: { descripcion: { kind: 'text', label: 'Texto', lines: 4 } } }
  },
  card: ['nivel'],
  creation: [
    { key: 'clase', kind: 'content', type: 'clase', label: 'Clase', levels: true },
    {
      key: 'puntuaciones',
      kind: 'scores',
      label: 'Puntuaciones',
      set: 'caracteristicas',
      field: 'puntuacion',
      methods: [
        { key: 'matriz', kind: 'array', label: 'Matriz', values: [15, 12] },
        { key: 'compra', kind: 'pointbuy', label: 'Compra', budget: 5, costs: { '8': 0, '10': 2, '12': 4 } },
        { key: 'mano', kind: 'manual', label: 'A mano', min: 3, max: 18 }
      ]
    },
    { key: 'resumen', kind: 'summary', label: 'Resumen' }
  ]
} as System

const klass = (key: string, name: string): ContentItem => ({
  type: 'clase',
  key,
  source: null,
  data: { name },
  mechanics: {
    grants: [
      { choose: { key: 'habilidades', label: 'Habilidades', count: '1', set: 'habilidades', when: '@este.inicial' } },
      { level: 1, concept: `${key}_golpe`, type: 'rasgo' },
      {
        level: 2,
        choose: {
          key: 'mejora',
          label: 'Mejora',
          count: '2',
          set: 'caracteristicas',
          field: 'puntuacion',
          op: 'add',
          value: '1',
          repeat: true,
          most: 2
        }
      }
    ]
  }
})
const CONTENT: ContentItem[] = [
  klass('luchador', 'Luchador'),
  klass('ladron', 'Ladrón'),
  {
    type: 'rasgo',
    key: 'luchador_golpe',
    concept: 'luchador_golpe',
    source: null,
    data: { name: 'Golpe', descripcion: 'Golpeas **fuerte**.' }
  },
  {
    type: 'rasgo',
    key: 'ladron_golpe',
    concept: 'ladron_golpe',
    source: null,
    data: { name: 'Puñal', descripcion: '' }
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
  system: { id: SYSTEM.id, name: 'Pequeño', defaultRoll: '1d20', critical: 'none' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}

async function renderCreator() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT }
  })
  const { character } = await api.client.call('createCharacter', { campaignId: CAMPAIGN.id, name: 'Ivo' })
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
  return { api, character }
}

describe('el creador, con clases por niveles', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundo', 'mundos', 'campana', 'personajes', 'personaje', 'compendio', 'tabla'] })
    )
  )

  it('la clase, su nivel, lo que concede y elegir en el panel (una y «+1 y +1»); añadir otra y quitarla', async () => {
    const { api, character } = await renderCreator()
    await userEvent.click(await screen.findByRole('button', { name: 'Luchador' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Luchador' })).toBeDefined()
    // Lo que concede: su rasgo, que se despliega con su texto del compendio
    await userEvent.click(await screen.findByRole('button', { name: 'Más de Golpe' }))
    expect((await screen.findByText('fuerte')).tagName).toBe('STRONG')
    // Las habilidades, en el panel
    await userEvent.click(screen.getByRole('button', { name: /1 elección/ }))
    const panel = within(screen.getByRole('complementary', { name: 'Habilidades' }))
    await userEvent.click(panel.getByRole('radio', { name: 'Sigilo' }))
    await waitFor(() => expect(panel.getByText('1 de 1')).toBeDefined())
    await userEvent.click(panel.getByRole('button', { name: 'Cerrar' }))
    // Nivel 2: la mejora, con «+»
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Nivel' }), '2')
    await userEvent.click(await screen.findByRole('button', { name: /2 elecciones/ }))
    const mejora = within(screen.getByRole('complementary', { name: 'Mejora' }))
    await userEvent.click(mejora.getByRole('button', { name: 'Uno más a Fuerza' }))
    await userEvent.click(mejora.getByRole('button', { name: 'Uno más a Fuerza' }))
    await waitFor(() => expect(mejora.getByText('+2')).toBeDefined())
    expect((mejora.getByRole('button', { name: 'Uno más a Destreza' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(mejora.getByRole('button', { name: 'Uno menos a Fuerza' }))
    await waitFor(() => expect(mejora.getByText('+1')).toBeDefined())
    await userEvent.click(mejora.getByRole('button', { name: 'Cerrar' }))
    // Otra clase, y quitarla
    await userEvent.click(screen.getByRole('button', { name: 'Añadir otra' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ladrón' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ladrón' })).toBeDefined()
    expect(screen.getByText('Multiclase')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Ladrón' }))
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Ladrón' })).toBeNull())
    await waitFor(async () => {
      const saved = (await api.client.call('getCharacter', { characterId: character.id })).character
      expect(saved.summary.line).toBe('Luchador 2')
    })
  })

  it('las puntuaciones: la matriz reparte una vez cada valor; la compra, con su presupuesto; a mano, con su número', async () => {
    await renderCreator()
    const steps = within(await screen.findByRole('navigation', { name: 'Pasos' }))
    await userEvent.click(steps.getByRole('button', { name: /Puntuaciones/ }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fuerza' }), '15')
    await waitFor(() =>
      expect(
        within(screen.getByRole('combobox', { name: 'Destreza' })).queryByRole('option', { name: '15' })
      ).toBeNull()
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Compra' }))
    expect(await screen.findByText('Te quedan 5 de 5 puntos')).toBeDefined()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fuerza' }), '12')
    expect(await screen.findByText('Te quedan 1 de 5 puntos')).toBeDefined()
    await userEvent.click(screen.getByRole('radio', { name: 'A mano' }))
    // A mano se guarda al acabar (con Intro o al salir del campo), no con cada tecla
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Fuerza' }), '9{Enter}')
    await waitFor(() => expect(screen.getByRole('row', { name: /Fuerza/ }).textContent).toContain('9'))
    await userEvent.click(steps.getByRole('button', { name: 'Resumen' }))
    expect(await screen.findByText('Sin clase')).toBeDefined()
    expect(screen.getAllByText('Elige: Clase').length).toBeGreaterThan(0)
  })
})
