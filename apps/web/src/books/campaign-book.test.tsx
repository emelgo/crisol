import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { ApiError } from '../api/client.ts'
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
const SYSTEM: System = { ...structuredClone(cinco), id: crypto.randomUUID(), name: 'Quinta' }
// Una criatura con lo que hace en juego: su ficha incrustada deja tirar su mordisco
const WOLF: ContentItem = {
  type: 'personaje',
  key: 'lobo',
  source: null,
  data: { name: { es: 'Lobo', en: 'Wolf' } },
  mechanics: {
    actions: [
      { key: 'mordisco', label: { es: 'Mordisco', en: 'Bite' }, activation: 'action', damage: [{ formula: '2d4' }] }
    ]
  }
}
const campaignAs = (role: Campaign['role']): Campaign => ({
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role,
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: ['srd51'], duplicates: 'both', language: 'es', settings: {} }
})

const COMBATE = `En la linde del bosque:

![[@Lobo]]

> [!secreto]
> Es una trampa.`

/** El libro «SRD 5.1» de la campaña, con dos capítulos, abierto por quien juega o quien dirige */
async function renderBook(role: Campaign['role'], book = 'srd51', { compendiumFails = false } = {}) {
  const campaign = campaignAs(role)
  const api = fakeApi({
    organizations: [ORG],
    worlds: [{ ...WORLD, role }],
    campaigns: [campaign],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] }
  })
  await api.client.call('saveChapter', { systemId: SYSTEM.id, source: 'srd51', title: 'El combate', markdown: COMBATE })
  const second = await api.client.call('saveChapter', {
    systemId: SYSTEM.id,
    source: 'srd51',
    title: 'La magia',
    markdown: 'Espacios de conjuro.'
  })
  // El compendio de la campaña no llega la primera vez (el servidor lo rechaza)
  let fails = compendiumFails ? 1 : 0
  const client = {
    ...api.client,
    call: ((name, input) => {
      if (name !== 'getCampaignCompendium' || fails <= 0) return api.client.call(name, input)
      fails -= 1
      return Promise.reject(new ApiError('BAD_REQUEST', 400))
    }) as typeof api.client.call
  }
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${campaign.id}/libros/${book}`] })
  )
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Ana', email: 'ana@crisol.test' } }).client}
      api={client}
    />
  )
  return { api, router, campaign, second }
}

describe('un libro de la campaña (ADR-0025)', () => {
  beforeEach(() =>
    localStorage.setItem(
      'crisol.recorridos.ana@crisol.test',
      JSON.stringify({ seen: ['mundo', 'campana', 'compendio', 'compendio-campana'] })
    )
  )

  it('quien juega lo lee sin los secretos ni editarlo; «Compendio» vuelve al de su campaña', async () => {
    const { campaign } = await renderBook('player')
    expect(await screen.findByRole('heading', { level: 2, name: 'El combate' })).toBeDefined()
    expect(await screen.findByText('En la linde del bosque:')).toBeDefined()
    expect(screen.queryByText('Es una trampa.')).toBeNull()
    expect(screen.queryByLabelText('Título del capítulo')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Más acciones del capítulo' })).toBeNull()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Compendio' }).getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/campanas/${campaign.id}/compendio`
    )
  })

  it('«Siguiente» abre el otro capítulo en la dirección del libro', async () => {
    const { router, campaign, second } = await renderBook('player')
    const pager = within(await screen.findByRole('navigation', { name: 'Anterior y siguiente' }))
    const next = pager.getByRole('link', { name: /Siguiente/ })
    expect(next.getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/campanas/${campaign.id}/libros/srd51?capitulo=${second.id}`
    )
    await userEvent.click(next)
    expect(await screen.findByRole('heading', { level: 2, name: 'La magia' })).toBeDefined()
    expect(router.state.location.search).toMatchObject({ capitulo: second.id })
  })

  it('la ficha incrustada se abre en el compendio de la campaña y deja tirar lo que hace en juego', async () => {
    const { api, campaign } = await renderBook('master')
    const card = await screen.findByRole('article', { name: 'Lobo' })
    expect(within(card).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/campanas/${campaign.id}/compendio?ver=lobo`
    )
    const name = await within(card).findByRole('button', { name: 'Lobo' })
    expect(name.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(name)
    expect(name.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(await within(card).findByRole('button', { name: 'Tirar el daño de Mordisco' }))
    await waitFor(async () => {
      const { rolls } = await api.client.call('listRolls', { campaignId: campaign.id })
      expect(rolls.map((r) => r.label)).toContain('Lobo · Mordisco · daño')
    })
  })

  it('si no llega su compendio, lo dice y deja reintentarlo', async () => {
    await renderBook('player', 'srd51', { compendiumFails: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'El combate' })).toBeDefined()
  })

  it('un libro que la campaña no tiene lo dice', async () => {
    await renderBook('player', 'otro')
    expect(await screen.findByText('Este libro aún no tiene capítulos.')).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Capítulos' })).toBeNull()
  })
})
