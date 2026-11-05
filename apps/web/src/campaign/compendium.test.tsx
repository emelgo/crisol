import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
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
  role: 'player',
  version: 1
}

/** Un sistema con dos ediciones, conjuros y una clase que concede un rasgo y una elección */
const SYSTEM: System = {
  ...structuredClone(cinco),
  id: crypto.randomUUID(),
  name: 'Quinta',
  sources: [
    {
      key: 'viejo',
      name: 'Viejo',
      license: 'CC BY 4.0',
      attribution: 'Material del Viejo',
      edition: '2014',
      released: '2014-01-01'
    },
    {
      key: 'nuevo',
      name: 'Nuevo',
      license: 'CC BY 4.0',
      attribution: 'Material del Nuevo',
      edition: '2024',
      released: '2024-01-01'
    }
  ],
  types: {
    ...structuredClone(cinco.types),
    conjuro: {
      document: 'item',
      label: { es: 'Conjuro', en: 'Spell' },
      fields: {
        nivel: { kind: 'number', label: { es: 'Nivel', en: 'Level' } },
        escuela: {
          kind: 'choice',
          label: { es: 'Escuela', en: 'School' },
          options: [{ value: 'evocacion', label: { es: 'Evocación', en: 'Evocation' } }]
        },
        ritual: { kind: 'boolean', label: { es: 'Ritual', en: 'Ritual' } },
        preparado: { kind: 'boolean', label: { es: 'Preparado', en: 'Prepared' } },
        descripcion: { kind: 'text', label: { es: 'Descripción', en: 'Description' }, lines: 8 }
      }
    },
    clase: { document: 'item', label: { es: 'Clase', en: 'Class' }, fields: {} },
    rasgo: { document: 'item', label: { es: 'Rasgo', en: 'Feature' }, fields: {} }
  }
}
const spell = (source: string, edition: string): ContentItem => ({
  type: 'conjuro',
  key: `bola_de_fuego_${edition}`,
  source,
  concept: 'bola_de_fuego',
  data: {
    name: { es: 'Bola de fuego', en: 'Fireball' },
    nivel: 3,
    escuela: 'evocacion',
    ritual: false,
    descripcion: { es: `Una **explosión** de ${edition}.`, en: 'A blast.' }
  }
})
const CONTENT: ContentItem[] = [
  spell('viejo', '2014'),
  spell('nuevo', '2024'),
  {
    type: 'clase',
    key: 'barbaro_2024',
    source: 'nuevo',
    concept: 'barbaro',
    data: { name: { es: 'Bárbaro', en: 'Barbarian' } },
    mechanics: {
      grants: [
        { level: 3, choose: { key: 'subclase', label: { es: 'Subclase', en: 'Subclass' }, count: '1', type: 'clase' } },
        { level: 1, concept: 'barbaro_furia', type: 'rasgo' }
      ]
    }
  },
  {
    type: 'rasgo',
    key: 'barbaro_furia_2024',
    source: 'nuevo',
    concept: 'barbaro_furia',
    data: { name: { es: 'Furia', en: 'Rage' } }
  }
]
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'player',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: ['viejo', 'nuevo'], duplicates: 'both', language: 'es', settings: {} }
}

function renderCompendium(campaign: Campaign = CAMPAIGN) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [campaign],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT }
  })
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${campaign.id}/compendio`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Ana', email: 'ana@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

describe('el compendio de una campaña', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.ana@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campana', 'personajes', 'personaje', 'compendio', 'tabla'] })
    )
  )

  it('sus tipos, la lista con sus ediciones y, en el centro, el primero con sus datos y su texto', async () => {
    renderCompendium()
    expect(await screen.findByRole('heading', { level: 1, name: 'Compendio' })).toBeDefined()
    expect(screen.getByText('Quinta · 2014 y 2024')).toBeDefined()
    const types = within(screen.getByRole('group', { name: 'Tipos' }))
    expect(types.getAllByRole('button').map((b) => b.textContent)).toEqual(['Todo', 'Conjuro', 'Clase', 'Rasgo'])
    const list = within(await screen.findByRole('list', { name: 'Resultados' }))
    await waitFor(() => expect(list.getAllByRole('button')).toHaveLength(4))
    expect(list.getAllByRole('button')[1]?.textContent).toBe('Bola de fuegoConjuro2024')
    expect(list.getAllByRole('button')[2]?.textContent).toBe('Bola de fuegoConjuro2014 · Legado')
    // Abre la de 2024: sus datos (sin «no» ni lo de la partida), su texto y, al lado, la otra versión
    await userEvent.click(list.getAllByRole('button')[1] as HTMLElement)
    const article = within(await screen.findByRole('article', { name: 'Bola de fuego' }))
    expect(await article.findByText('Evocación')).toBeDefined()
    expect(article.getByText('3')).toBeDefined()
    expect(article.queryByText('Ritual')).toBeNull()
    expect(article.getByText('explosión').tagName).toBe('STRONG')
    const about = within(screen.getByRole('complementary', { name: 'Sobre este documento' }))
    expect(about.getByText('2024 · Nuevo')).toBeDefined()
    expect(about.getByText('Fireball')).toBeDefined()
    expect(about.getByText('Material del Nuevo')).toBeDefined()
    await userEvent.click(about.getByRole('button', { name: '2014 · Legado' }))
    expect(await screen.findByText('Una', { exact: false })).toBeDefined()
    expect(
      within(screen.getByRole('complementary', { name: 'Sobre este documento' })).getByText('2014 · Viejo')
    ).toBeDefined()
  })

  it('buscar por el nombre en inglés y filtrar por tipo; una clase, con lo que concede por nivel', async () => {
    renderCompendium()
    const search = await screen.findByRole('searchbox', { name: 'Buscar en el compendio' })
    await userEvent.type(search, 'fireball')
    const list = within(screen.getByRole('list', { name: 'Resultados' }))
    await waitFor(() => expect(list.getAllByRole('button')).toHaveLength(2))
    await userEvent.type(search, 'xyz')
    expect(await list.findByText('Nada con ese nombre')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar la búsqueda' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Tipos' })).getByRole('button', { name: 'Clase' }))
    await waitFor(() => expect(list.getAllByRole('button').map((b) => b.textContent)).toEqual(['BárbaroClase2024']))
    const article = within(await screen.findByRole('article', { name: 'Bárbaro' }))
    const levels = within(await article.findByRole('region', { name: 'Por nivel' }))
    expect(levels.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Nivel 1Furia',
      'Nivel 3Subclase: elige 1'
    ])
    await userEvent.click(levels.getByRole('button', { name: 'Furia' }))
    expect(await screen.findByRole('article', { name: 'Furia' })).toBeDefined()
  })

  it('sin sistema, lo dice', async () => {
    renderCompendium({ ...CAMPAIGN, system: null, systemChoices: null })
    expect(
      await screen.findByText('Esta campaña aún no tiene sistema: el máster lo elige en sus ajustes.')
    ).toBeDefined()
  })
})
