import type { Campaign, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { ContentCard } from './content-embed.tsx'
import { entryHref } from './content-scope.tsx'
import { type PageLinks, PageLinksContext } from './links-context.ts'
import { ReadAsProvider } from './read-as.tsx'

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
const WOLF: ContentItem = { type: 'personaje', key: 'lobo', source: null, data: { name: { es: 'Lobo', en: 'Wolf' } } }
const CAMPAIGN: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1,
  system: { id: SYSTEM.id, name: 'Quinta', defaultRoll: '1d20', critical: 'd20' },
  systemChoices: { sources: [], duplicates: 'both', language: 'es', settings: {} }
}
const LINKS: PageLinks = { worldId: WORLD.id, names: [], byId: new Map(), create: async () => '', files: [] }

/** La ficha, sola, dentro de lo que se le dé (la página del mundo, la campaña con que se lee…) */
function renderCard(card: ReactNode, wrap: (children: ReactNode) => ReactNode = (children) => children) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] }
  })
  const root = createRootRoute({
    component: () => (
      <ApiProvider client={api.client}>
        <section aria-label="Página">{wrap(card)}</section>
      </ApiProvider>
    )
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory() })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const inWorld = (children: ReactNode) => <PageLinksContext.Provider value={LINKS}>{children}</PageLinksContext.Provider>

describe('la ficha de una entrada incrustada', () => {
  it('en la wiki del mundo, sale con su tipo y se abre en el compendio de la campaña que la tiene', async () => {
    renderCard(<ContentCard name="Lobo" system={null} />, inWorld)
    const card = await screen.findByRole('article', { name: 'Lobo' })
    expect(within(card).getByText('Personaje')).toBeDefined()
    expect(within(card).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/compendio?ver=lobo`
    )
  })

  it('leída como jugador, la busca en su campaña', async () => {
    renderCard(<ContentCard name="Lobo" system={null} />, (children) => (
      <ReadAsProvider value={{ campaignId: CAMPAIGN.id }}>{inWorld(children)}</ReadAsProvider>
    ))
    const card = await screen.findByRole('article', { name: 'Lobo' })
    expect(within(card).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/compendio?ver=lobo`
    )
  })

  it('la que no está: quien escribe ve el aviso; quien lee, nada', async () => {
    renderCard(
      <>
        <ContentCard name="Nadie" system={null} editing />
        <ContentCard name="Ninguno" system={null} />
      </>,
      inWorld
    )
    expect(await screen.findByText('Nadie: no está en el compendio')).toBeDefined()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText(/Ninguno/)).toBeNull()
  })

  it('sin desde dónde buscarla (ni mundo ni campaña), no sale', async () => {
    renderCard(<ContentCard name="Lobo" system={null} editing />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Página' })).toBeDefined())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.queryByText(/no está en el compendio/)).toBeNull()
  })
})

describe('adónde lleva «Abrir»', () => {
  const entry = { key: 'lobo gris', campaignId: CAMPAIGN.id, systemId: SYSTEM.id }

  it('en un sistema, a su compendio; con campaña y mundo, al de la campaña', () => {
    expect(entryHref({ kind: 'system', systemId: SYSTEM.id }, entry)).toBe(
      `/sistemas/${SYSTEM.id}/compendio?ver=lobo%20gris`
    )
    expect(entryHref({ kind: 'world', worldId: WORLD.id }, entry)).toBe(
      `/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/compendio?ver=lobo%20gris`
    )
  })

  it('sin campaña o sin mundo, a ninguna parte', () => {
    expect(entryHref({ kind: 'world', worldId: WORLD.id }, { ...entry, campaignId: null })).toBeNull()
    expect(entryHref({ kind: 'campaign', campaignId: CAMPAIGN.id }, entry)).toBeNull()
    expect(entryHref(null, entry)).toBeNull()
  })
})
