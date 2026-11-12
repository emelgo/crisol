import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { announced } from '../testing.ts'

// El máster abre el compendio desde su Mesa: su canal y su lienzo, de mentira
vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())
vi.mock('../tabletop/use-renderer.ts', async () => (await import('../tabletop/fakes.ts')).blindRenderer())

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
          options: [
            { value: 'evocacion', label: { es: 'Evocación', en: 'Evocation' } },
            { value: 'adivinacion', label: { es: 'Adivinación', en: 'Divination' } }
          ]
        },
        ritual: { kind: 'boolean', label: { es: 'Ritual', en: 'Ritual' } },
        preparado: { kind: 'boolean', label: { es: 'Preparado', en: 'Prepared' } },
        descripcion: { kind: 'text', label: { es: 'Descripción', en: 'Description' }, lines: 8 }
      }
    },
    clase: { document: 'item', label: { es: 'Clase', en: 'Class' }, fields: {} },
    rasgo: { document: 'item', label: { es: 'Rasgo', en: 'Feature' }, fields: {} }
  },
  // Los conjuros, con un filtro por su escuela
  compendium: {
    sections: [{ key: 'conjuros', label: { es: 'Conjuros', en: 'Spells' }, types: ['conjuro'] }],
    types: { conjuro: { filters: [{ field: 'escuela' }] } }
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
  },
  mechanics: {
    actions: [
      {
        key: 'lanzar',
        label: { es: 'Bola de fuego', en: 'Fireball' },
        activation: 'action',
        damage: [{ formula: '8d6' }]
      }
    ],
    scaling: { mode: 'slot', base: 3, per: '1d6' },
    automation: 'partial'
  }
})
const CONTENT: ContentItem[] = [
  spell('viejo', '2014'),
  spell('nuevo', '2024'),
  {
    type: 'conjuro',
    key: 'confusion_2024',
    source: 'nuevo',
    concept: 'confusion',
    data: {
      name: { es: 'Confusión', en: 'Confusion' },
      nivel: 4,
      escuela: 'evocacion',
      descripcion: {
        es: 'Tira en la tabla.\n\n| 1d4 | Comportamiento |\n| --- | --- |\n| 1–2 | Se queda quieto |\n| 3–4 | Ataca |',
        en: 'Roll.'
      }
    }
  },
  {
    type: 'conjuro',
    key: 'detectar_magia_2024',
    source: 'nuevo',
    concept: 'detectar_magia',
    data: { name: { es: 'Detectar magia', en: 'Detect Magic' }, nivel: 1, escuela: 'adivinacion' }
  },
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

function renderCompendium(
  campaign: Campaign = CAMPAIGN,
  worldContent: NonNullable<Parameters<typeof fakeApi>[0]>['worldContent'] = []
) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [campaign],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: CONTENT },
    worldContent
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

  it('la biblioteca: por edición, sus secciones y lo suyo; al abrirlo, sus datos, su texto y su otra versión', async () => {
    renderCompendium()
    expect(await screen.findByRole('heading', { level: 1, name: 'Compendio' })).toBeDefined()
    expect(screen.getByText('Quinta · 2014 y 2024')).toBeDefined()
    expect(screen.getByText('Abre algo del compendio para leerlo.')).toBeDefined()
    const library = within(screen.getByRole('navigation', { name: 'Biblioteca del compendio' }))
    expect(library.getAllByRole('button').map((b) => b.textContent)).toEqual(['20245', '2014 · Legado1'])
    await userEvent.click(library.getByRole('button', { name: /^2024/ }))
    // Las secciones del sistema y, detrás, una por cada tipo que no nombra
    expect(library.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '20245',
      'Conjuros3',
      'Clase1',
      'Rasgo1',
      '2014 · Legado1'
    ])
    await userEvent.click(library.getByRole('button', { name: /^Conjuros/ }))
    // Sus filtros: por su escuela
    await userEvent.click(await library.findByRole('button', { name: 'Filtrar' }))
    await userEvent.selectOptions(library.getByRole('combobox', { name: 'Escuela' }), 'adivinacion')
    expect(library.queryByRole('button', { name: 'Bola de fuego' })).toBeNull()
    expect(library.getByRole('button', { name: 'Detectar magia' })).toBeDefined()
    await userEvent.click(library.getByRole('button', { name: 'Quitar los filtros' }))
    await userEvent.click(await library.findByRole('button', { name: 'Bola de fuego' }))
    const article = within(await screen.findByRole('article', { name: 'Bola de fuego' }))
    expect(await article.findByText('Evocación')).toBeDefined()
    expect(article.getByText('3')).toBeDefined()
    expect(article.queryByText('Ritual')).toBeNull()
    expect(article.getByText('explosión').tagName).toBe('STRONG')
    // Su mecánica, en palabras
    const play = within(article.getByRole('region', { name: 'En juego' }))
    expect(play.getByText('Crisol calcula una parte')).toBeDefined()
    expect(play.getByText('Acción · 8d6')).toBeDefined()
    expect(play.getByText('Con un espacio de más nivel que el 3: +1d6 por cada nivel de más')).toBeDefined()
    expect(library.getByRole('button', { name: 'Bola de fuego' }).getAttribute('aria-current')).toBe('true')
    const about = within(screen.getByRole('complementary', { name: 'Sobre este documento' }))
    expect(about.getByText('2024 · Nuevo')).toBeDefined()
    expect(about.getByText('Fireball')).toBeDefined()
    expect(about.getByText('Material del Nuevo')).toBeDefined()
    await userEvent.click(about.getByRole('button', { name: '2014 · Legado' }))
    expect(await screen.findByText(/de 2014\./)).toBeDefined()
    expect(
      within(screen.getByRole('complementary', { name: 'Sobre este documento' })).getByText('2014 · Viejo')
    ).toBeDefined()
    // Cerrar una carpeta la cierra
    await userEvent.click(library.getByRole('button', { name: /^2024/ }))
    expect(library.queryByRole('button', { name: /^Conjuros/ })).toBeNull()
  })

  it('buscar por el nombre en inglés; sin nada, lo dice; una clase, con lo que concede por nivel', async () => {
    renderCompendium()
    const search = await screen.findByRole('searchbox', { name: 'Buscar en el compendio' })
    await userEvent.type(search, 'fireball')
    const list = within(await screen.findByRole('list', { name: 'Resultados' }))
    await waitFor(() => expect(list.getAllByRole('button')).toHaveLength(2))
    // Cada una dice su tipo y su libro (ADR-0021)
    expect(list.getAllByRole('button')[0]?.textContent).toBe('Bola de fuegoConjuro · Nuevo2024')
    expect(list.getAllByRole('button')[1]?.textContent).toMatch(/^Bola de fuegoConjuro · \S+2014 · Legado$/)
    await userEvent.type(search, 'xyz')
    expect(await list.findByText('Nada con ese nombre')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar la búsqueda' }))
    const library = within(await screen.findByRole('navigation', { name: 'Biblioteca del compendio' }))
    await userEvent.click(library.getByRole('button', { name: /^2024/ }))
    await userEvent.click(library.getByRole('button', { name: /^Clase/ }))
    await userEvent.click(await library.findByRole('button', { name: 'Bárbaro' }))
    const article = within(await screen.findByRole('article', { name: 'Bárbaro' }))
    const levels = within(await article.findByRole('region', { name: 'Por nivel' }))
    expect(levels.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Nivel 1Furia',
      'Nivel 3Subclase: elige 1'
    ])
    await userEvent.click(levels.getByRole('button', { name: 'Furia' }))
    expect(await screen.findByRole('article', { name: 'Furia' })).toBeDefined()
  })

  it('una tabla de su texto se tira en la campaña: lo que sale, marcado, anunciado y en el registro', async () => {
    const { api } = renderCompendium()
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar en el compendio' }), 'confusion')
    await userEvent.click(
      await within(await screen.findByRole('list', { name: 'Resultados' })).findByRole('button', { name: /^Confusión/ })
    )
    const article = within(await screen.findByRole('article', { name: 'Confusión' }))
    await userEvent.click(await article.findByRole('button', { name: 'Tirar 1d4 en «Comportamiento»' }))
    await waitFor(() => expect(announced()).toMatch(/^Salió [1-4]: (Se queda quieto|Ataca)$/))
    const { rolls } = await api.client.call('listRolls', { campaignId: CAMPAIGN.id })
    expect(rolls[0]).toMatchObject({ formula: '1d4', label: 'Confusión' })
    const marked = article.getAllByRole('cell').filter((cell) => cell.className.includes('hit'))
    expect(marked.length).toBe(2)
  })

  it('su propietario lo cambia en la app: una entrada nueva, editarla y borrarla', async () => {
    const { api } = renderCompendium()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entrada' }))
    const created = within(await screen.findByRole('dialog', { name: 'Nueva entrada' }))
    await userEvent.selectOptions(created.getByRole('combobox', { name: 'Tipo' }), 'conjuro')
    await userEvent.type(created.getByRole('textbox', { name: 'Nombre' }), 'Rayo de luna')
    await userEvent.type(created.getByRole('spinbutton', { name: 'Nivel' }), '2')
    await userEvent.selectOptions(created.getByRole('combobox', { name: 'Escuela' }), 'evocacion')
    await userEvent.click(created.getByRole('checkbox', { name: 'Ritual' }))
    await userEvent.type(created.getByRole('textbox', { name: 'Texto' }), 'Un haz de luz plateada.')
    await userEvent.click(created.getByRole('button', { name: 'Guardar' }))
    const article = within(await screen.findByRole('article', { name: 'Rayo de luna' }))
    expect(article.getByText('Evocación')).toBeDefined()
    expect(article.getByText('Un haz de luz plateada.')).toBeDefined()

    await userEvent.click(article.getByRole('button', { name: 'Editar' }))
    const edit = within(await screen.findByRole('dialog', { name: 'Editar «Rayo de luna»' }))
    expect(edit.getByRole<HTMLInputElement>('spinbutton', { name: 'Nivel' }).value).toBe('2')
    await userEvent.clear(edit.getByRole('textbox', { name: 'Nombre' }))
    await userEvent.type(edit.getByRole('textbox', { name: 'Nombre' }), 'Rayo lunar')
    await userEvent.click(edit.getByRole('button', { name: 'Guardar' }))
    const renamed = within(await screen.findByRole('article', { name: 'Rayo lunar' }))
    const { items } = await api.client.call('searchCampaignContent', { campaignId: CAMPAIGN.id, query: 'rayo' })
    expect(items).toEqual([expect.objectContaining({ name: 'Rayo lunar', type: 'conjuro' })])

    await userEvent.click(renamed.getByRole('button', { name: 'Borrar' }))
    const ask = within(await screen.findByRole('dialog', { name: '¿Borrar «Rayo lunar»?' }))
    await userEvent.click(ask.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Rayo lunar' })).toBeNull())
    const after = await api.client.call('searchCampaignContent', { campaignId: CAMPAIGN.id, query: 'rayo' })
    expect(after.total).toBe(0)
  })

  it('sin sistema, lo dice', async () => {
    renderCompendium({ ...CAMPAIGN, system: null, systemChoices: null })
    expect(
      await screen.findByText('Esta campaña aún no tiene sistema: el máster lo elige en sus ajustes.')
    ).toBeDefined()
  })

  it('lo del mundo: marcado y en su estante; copiar al mundo, y el aviso cuando cambia el original', async () => {
    const original = CONTENT.find((c) => c.key === 'detectar_magia_2024')
    if (!original) throw new Error('sin original')
    const copy: ContentItem = {
      ...structuredClone(original),
      key: 'detectar_magia_del_valle',
      source: null,
      data: { ...original.data, name: { es: 'Detectar magia del valle' } }
    }
    // Su original ya no es como cuando se copió: la copia lo avisa
    const then: ContentItem = { ...original, data: { ...original.data, nivel: 2 } }
    renderCompendium(CAMPAIGN, [{ worldId: WORLD.id, systemId: SYSTEM.id, item: copy, copyOf: then }])
    const layers = await screen.findByRole('group', { name: 'Qué enseñar' })
    await userEvent.click(within(layers).getByRole('radio', { name: 'Del mundo' }))
    const library = within(screen.getByRole('navigation', { name: 'Biblioteca del compendio' }))
    await userEvent.click(library.getByRole('button', { name: /^Conjuros/ }))
    await userEvent.click(await library.findByRole('button', { name: 'Detectar magia del valle' }))
    const article = await screen.findByRole('article', { name: 'Detectar magia del valle' })
    expect(within(article).getByText('Del mundo')).toBeDefined()
    expect(within(article).getByRole('status').textContent).toContain('El original ha cambiado.')
    await userEvent.click(within(article).getByRole('button', { name: 'Ver cambios' }))
    const changes = await screen.findByRole('dialog', { name: 'Cambios del original' })
    const row = within(changes).getByRole('row', { name: /Nivel/ })
    expect(row.textContent).toContain('1')
    await userEvent.click(within(changes).getByRole('button', { name: 'Traer 1' }))
    await waitFor(() => expect(screen.queryByText('El original ha cambiado.')).toBeNull())

    // Copiar al mundo algo del sistema: se abre para cambiarlo
    await userEvent.click(within(layers).getByRole('radio', { name: 'Todo' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el compendio' }), 'confusion')
    await userEvent.click(await screen.findByRole('button', { name: /^Confusión/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar al mundo' }))
    const editor = await screen.findByRole('dialog', { name: 'Editar «Confusión (copia)»' })
    expect(within(editor).getByLabelText('Nombre')).toBeDefined()
  })
  it('el máster oculta un tipo a los jugadores en los ajustes del compendio', async () => {
    const user = userEvent.setup()
    const { api } = renderCompendium({ ...CAMPAIGN, role: 'master' })
    // El máster lo tiene en la sección Compendio de la campaña (ADR-0021), con sus ajustes
    await user.click(await screen.findByRole('button', { name: 'Ajustes del compendio' }))
    const settings = await screen.findByRole('dialog', { name: 'Ajustes del compendio' })
    expect(within(settings).getByText(/Quinta · Viejo y Nuevo/)).toBeDefined()
    const spells = within(settings).getByRole('switch', { name: 'Conjuros' })
    expect(spells.getAttribute('aria-checked')).toBe('true')
    await user.click(spells)
    await waitFor(() =>
      expect(within(settings).getByRole('switch', { name: 'Conjuros' }).getAttribute('aria-checked')).toBe('false')
    )
    const campaign = (await api.client.call('getCampaign', { campaignId: CAMPAIGN.id })).campaign
    expect(campaign.hiddenTypes).toEqual(['conjuro'])
  })

  it('el del sistema, sin campaña: se recorre por secciones y se lee lo de dentro', async () => {
    localStorage.setItem(
      'crisol.recorridos.ana@crisol.test',
      JSON.stringify({ seen: ['sistemas', 'sistema', 'compendio'] })
    )
    const api = fakeApi({
      organizations: [ORG],
      worlds: [WORLD],
      systems: [SYSTEM],
      systemContent: { [SYSTEM.id]: CONTENT }
    })
    render(
      <App
        router={createAppRouter(createMemoryHistory({ initialEntries: [`/sistemas/${SYSTEM.id}/compendio`] }))}
        accounts={fakeAccountClient({ account: { name: 'Ana', email: 'ana@crisol.test' } }).client}
        api={api.client}
      />
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Compendio' })).toBeDefined()
    const library = within(screen.getByRole('navigation', { name: 'Biblioteca del compendio' }))
    await userEvent.click(await library.findByRole('button', { name: /^2024/ }))
    await userEvent.click(library.getByRole('button', { name: /^Conjuros/ }))
    await userEvent.click(await library.findByRole('button', { name: 'Bola de fuego' }))
    const article = within(await screen.findByRole('article', { name: 'Bola de fuego' }))
    expect(await article.findByText('Evocación')).toBeDefined()
    expect(api.calls).toContain('browseSystemCompendium')
    expect(api.calls).toContain('readSystemCompendium')
  })
})
