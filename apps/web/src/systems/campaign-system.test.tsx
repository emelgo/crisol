import type { Campaign, World } from '@crisol/contracts'
import { cinco, fronteras } from '@crisol/systems/fixtures'
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
const CINCO = { ...structuredClone(cinco), id: crypto.randomUUID() }
const FRONTERAS = { ...structuredClone(fronteras), id: crypto.randomUUID() }
/** Un 5e con sus dos ediciones (cada fuente con la suya y su fecha), unas reglas que cambian y contenido de las dos */
const EDICIONES = {
  ...structuredClone(cinco),
  id: crypto.randomUUID(),
  name: 'Dos ediciones',
  sources: [
    {
      key: 'srd51',
      name: 'SRD 5.1',
      license: 'CC BY 4.0',
      attribution: 'A',
      edition: '2014',
      publisher: 'Wizards of the Coast',
      released: '2023-01-27'
    },
    {
      key: 'srd521',
      name: 'SRD 5.2.1',
      license: 'CC BY 4.0',
      attribution: 'B',
      edition: '2024',
      publisher: 'Wizards of the Coast',
      released: '2025-04-22'
    }
  ],
  settings: {
    reglas: {
      label: 'Reglas generales',
      help: 'El cansancio y lo demás que cambió.',
      kind: 'choice',
      options: [
        { value: 'e2024', label: '2024' },
        { value: 'e2014', label: '2014' }
      ],
      default: 'e2024'
    }
  }
} as typeof cinco
const contentOf = (key: string, source: string, concept: string, name: string) => ({
  type: 'objeto',
  key,
  source,
  concept,
  data: { name: { es: name, en: name } }
})
const CONTENIDO = [
  contentOf('anillo_2014', 'srd51', 'anillo', 'Anillo'),
  contentOf('anillo_2024', 'srd521', 'anillo', 'Anillo'),
  contentOf('cuerda_2014', 'srd51', 'cuerda', 'Cuerda')
]
const MARCA: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: null,
  systemChoices: null
}

function renderCampaigns(path = `/mundos/${WORLD.id}/campanas`) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [structuredClone(MARCA)],
    systems: [CINCO, FRONTERAS, EDICIONES],
    systemContent: { [EDICIONES.id]: CONTENIDO }
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

const settingsOf = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name: `Ajustes de ${name}` }))
  return within(await screen.findByRole('dialog', { name: `Ajustes de ${name}` }))
}

describe('el sistema de una campaña', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.enrique@crisol.test',
      JSON.stringify({ seen: ['mundos', 'mundo', 'campanas', 'dados', 'campana'] })
    )
  )

  it('en su ventana: sin sistema, los dados de siempre; con uno, sus fuentes, su idioma y sus ajustes', async () => {
    const { api } = renderCampaigns()
    const dialog = await settingsOf('La Marca')
    const select = dialog.getByRole<HTMLSelectElement>('combobox', { name: 'Sistema' })
    expect(select.value).toBe('')
    expect(dialog.getByText('Sin reglas de ningún juego.')).toBeDefined()
    // Sin cambios, ni «Guardar»
    expect(dialog.queryByRole('button', { name: 'Guardar' })).toBeNull()
    await userEvent.selectOptions(select, CINCO.id)
    const sources = within(await dialog.findByRole('group', { name: 'Fuentes' }))
    expect(sources.getByRole<HTMLInputElement>('checkbox', { name: /SRD 5\.1/ }).checked).toBe(true)
    await userEvent.click(sources.getByRole('checkbox', { name: /SRD 5\.2/ }))
    await userEvent.click(
      within(dialog.getByRole('group', { name: 'Idioma del contenido' })).getByRole('radio', { name: 'English' })
    )
    const settings = within(dialog.getByRole('group', { name: 'Ajustes de 5e de prueba' }))
    expect(settings.getByRole<HTMLInputElement>('checkbox', { name: 'Compra por puntos' }).checked).toBe(true)
    await userEvent.click(settings.getByRole('checkbox', { name: 'Tiradas' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    // Guardado, ya no hay cambios: «Guardar» se va
    await waitFor(() => expect(dialog.queryByRole('button', { name: 'Guardar' })).toBeNull())
    await waitFor(async () => {
      const { campaigns } = await api.client.call('listCampaigns', { worldId: WORLD.id })
      expect(campaigns[0]).toMatchObject({
        system: { id: CINCO.id, name: '5e de prueba', defaultRoll: '1d20', critical: 'd20' },
        systemChoices: { sources: ['srd51'], language: 'en', settings: { metodos: ['estandar', 'compra', 'tiradas'] } }
      })
    })
  })

  it('un sistema con ediciones: cuáles, lo que está en las dos, sus reglas y cómo se ve; sin ninguna, no se guarda', async () => {
    const { api } = renderCampaigns()
    const dialog = await settingsOf('La Marca')
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Sistema' }), EDICIONES.id)
    const editions = within(await dialog.findByRole('group', { name: 'Ediciones' }))
    expect(editions.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual([
      '2024SRD 5.2.1 · CC BY 4.0',
      '2014SRD 5.1 · CC BY 4.0'
    ])
    // Con las dos, lo que está en las dos: por defecto, solo lo más nuevo
    const repeated = within(dialog.getByRole('group', { name: 'Lo que está en las dos' }))
    expect(repeated.getByRole<HTMLInputElement>('radio', { name: /Solo la versión de 2024/ }).checked).toBe(true)
    const look = within(await dialog.findByRole('region', { name: 'Así se ve al elegir' }))
    expect(look.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Anillo · Objeto2024'])
    await userEvent.click(repeated.getByRole('radio', { name: /Las dos versiones/ }))
    expect(look.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Anillo · Objeto2024',
      'Anillo · Objeto2014 · Legado'
    ])
    // Las reglas, en botones juntos, con su ayuda
    const rules = within(dialog.getByRole('group', { name: 'Reglas generales' }))
    await userEvent.click(rules.getByRole('radio', { name: '2014' }))
    expect(rules.getByText('El cansancio y lo demás que cambió.')).toBeDefined()
    expect(
      dialog.getByText('Contiene material de SRD 5.1 y SRD 5.2.1 de Wizards of the Coast, con licencia CC BY 4.0.')
    ).toBeDefined()
    // Solo 2014: ni lo repetido ni «Legado»
    await userEvent.click(editions.getByRole('checkbox', { name: /^2024/ }))
    expect(dialog.queryByRole('group', { name: 'Lo que está en las dos' })).toBeNull()
    expect(look.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Anillo · Objeto2014'])
    // Sin ninguna: lo dice y no se guarda
    await userEvent.click(editions.getByRole('checkbox', { name: /^2014/ }))
    expect(editions.getByRole('alert').textContent).toBe('Activa al menos una edición')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    expect((await api.client.call('listCampaigns', { worldId: WORLD.id })).campaigns[0]?.system).toBeNull()
    // Con 2024, se guarda con lo elegido
    await userEvent.click(editions.getByRole('checkbox', { name: /^2024/ }))
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const { campaigns } = await api.client.call('listCampaigns', { worldId: WORLD.id })
      expect(campaigns[0]?.systemChoices).toMatchObject({
        sources: ['srd521'],
        duplicates: 'both',
        settings: { reglas: 'e2014' }
      })
    })
  })

  it('«Cancelar» deja lo que había; quitarlo deja la campaña sin sistema', async () => {
    const { api } = renderCampaigns()
    await api.client.call('updateCampaign', { campaignId: MARCA.id, system: FRONTERAS.id })
    const dialog = await settingsOf('La Marca')
    const select = dialog.getByRole<HTMLSelectElement>('combobox', { name: 'Sistema' })
    expect(select.value).toBe(FRONTERAS.id)
    expect(await dialog.findByRole('spinbutton', { name: 'Marcas de experiencia para avanzar' })).toBeDefined()
    await userEvent.selectOptions(select, '')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(select.value).toBe(FRONTERAS.id)
    await userEvent.selectOptions(select, '')
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const { campaigns } = await api.client.call('listCampaigns', { worldId: WORLD.id })
      expect(campaigns[0]).toMatchObject({ system: null, systemChoices: null })
    })
  })

  it('al crear una campaña, con su sistema', async () => {
    const { api } = renderCampaigns()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva campaña' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva campaña' }))
    await userEvent.type(dialog.getByLabelText('Nombre de la campaña'), 'Los páramos')
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Sistema' }), FRONTERAS.id)
    await userEvent.click(dialog.getByRole('button', { name: 'Crear la campaña' }))
    await waitFor(async () => {
      const { campaigns } = await api.client.call('listCampaigns', { worldId: WORLD.id })
      expect(campaigns.find((c) => c.name === 'Los páramos')?.system?.id).toBe(FRONTERAS.id)
    })
  })

  it('la ficha de dados propone la tirada por defecto de su sistema', async () => {
    const { api } = renderCampaigns(`/mundos/${WORLD.id}/campanas/${MARCA.id}`)
    await api.client.call('updateCampaign', { campaignId: MARCA.id, system: FRONTERAS.id })
    await userEvent.click(await screen.findByRole('button', { name: 'Dados' }))
    const dice = within(await screen.findByRole('complementary', { name: 'Dados' }))
    expect(await dice.findByDisplayValue('2d6')).toBeDefined()
  })
})
