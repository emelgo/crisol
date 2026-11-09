import type { Campaign, ScreenView, TableServerMessage, World } from '@crisol/contracts'
import type { ContentItem, System } from '@crisol/systems'
import { cinco } from '@crisol/systems/fixtures'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import type { DrawToken } from './renderer.ts'
import { cameraTarget } from './screen.tsx'

// El canal y el lienzo, de mentira: lo que llegaría del servidor lo manda la prueba; lo pintado se guarda
const channels = vi.hoisted(() => [] as Array<{ view: string; onMessage: (message: TableServerMessage) => void }>)
const drawn = vi.hoisted(() => ({ tokens: [] as DrawToken[] }))
vi.mock('./channel.ts', () => ({
  connectTable: (options: { view: string }, handlers: { onMessage: (message: TableServerMessage) => void }) => {
    channels.push({ view: options.view, onMessage: handlers.onMessage })
    return { sendViewport: () => {}, sendDrag: () => {}, close: () => {} }
  }
}))
vi.mock('./use-renderer.ts', async () => {
  const { useRef } = await import('react')
  return {
    useTableRenderer: () => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({
        setView: () => {},
        setScene: () => {},
        setFog: () => {},
        setGlow: () => {},
        setShapes: () => {},
        setLabels: () => {},
        setImages: () => {},
        setTokens: (tokens: DrawToken[]) => {
          drawn.tokens = tokens
        }
      })
      return { host, renderer, ready: true, failed: false, size: { width: 800, height: 600 } }
    }
  }
})

const ORG = { id: crypto.randomUUID(), name: 'Mesa', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
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
const EMAIL = 'enrique@crisol.test'

beforeEach(() => {
  channels.length = 0
  drawn.tokens = []
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mesa'] }))
})

/** La mesa con la cripta abierta y dos lobos en juego (sin ficha) */
async function renderTable() {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: [CAMPAIGN],
    systems: [SYSTEM],
    systemContent: { [SYSTEM.id]: [WOLF] },
    pages: [{ id: crypto.randomUUID(), worldId: WORLD.id, title: 'Cripta de Varn' }]
  })
  const page = api.pages[0]?.id ?? ''
  const tab = await api.client.call('createPageTab', { pageId: page, kind: 'scene' })
  const scene = await api.client.call('getScene', { tabId: tab.id })
  await api.client.call('setSceneImage', {
    sceneId: scene.id,
    width: 1200,
    height: 800,
    tiles: { version: crypto.randomUUID(), size: 512, levels: 2 }
  })
  await api.client.call('openScene', { campaignId: CAMPAIGN.id, sceneId: scene.id })
  const wolves = (await api.client.call('putInPlay', { campaignId: CAMPAIGN.id, key: 'lobo', count: 2 })).creatures
  render(
    <App
      router={createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}`] }))}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
      api={api.client}
    />
  )
  /** Lo que llega por el canal: la mesa de ahora en la API falsa */
  const push = async () => {
    await waitFor(() => expect(channels.some((c) => c.view === 'master')).toBe(true))
    const table = await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })
    act(() => channels.find((c) => c.view === 'master')?.onMessage({ type: 'master', table }))
    return table
  }
  await push()
  return { api, scene, wolves, push }
}

const panel = () => within(screen.getByRole('complementary', { name: 'Panel de la mesa' }))
const tokensOf = async (api: ReturnType<typeof fakeApi>) =>
  (await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).tokens

describe('las fichas en la mesa', () => {
  it('las criaturas en juego se ponen desde el panel; la ficha se pinta con su rótulo y su vida', async () => {
    const user = userEvent.setup()
    const { api, push } = await renderTable()
    // Las criaturas de la campaña, en Personajes (como los actores en Foundry)
    await user.click(panel().getByRole('tab', { name: 'Personajes' }))
    const inPlay = within(await panel().findByRole('list', { name: 'Criaturas' }))
    await user.click(inPlay.getByRole('button', { name: 'Poner en la mesa: Lobo 1' }))
    await waitFor(async () => expect(await tokensOf(api)).toHaveLength(1))
    await push()
    await waitFor(() => expect(drawn.tokens).toHaveLength(1))
    expect(drawn.tokens[0]).toMatchObject({ label: 'L1', faction: 'hostile', life: 1, hidden: false })
    // Con ficha ya en la escena, sigue en la campaña (con su ojo), pero ya no se pone otra vez
    const after = within(await panel().findByRole('list', { name: 'Criaturas' }))
    expect(after.getAllByRole('listitem')).toHaveLength(2)
    expect(after.queryByRole('button', { name: 'Poner en la mesa: Lobo 1' })).toBeNull()
    expect(after.getByText(/^En la escena/)).toBeDefined()
  })

  it('su tarjeta: dañar, un estado con rondas, ocultarla, su rótulo; y «Guardar como encuentro»', async () => {
    const user = userEvent.setup()
    const { api, wolves, scene, push } = await renderTable()
    await api.client.call('placeTokens', {
      campaignId: CAMPAIGN.id,
      sceneId: scene.id,
      tokens: [{ creatureId: wolves[0]?.id ?? '', column: 1, row: 1 }]
    })
    await push()
    const list = within(await screen.findByRole('list', { name: 'Fichas' }))
    await user.click(list.getByRole('button', { name: /^L1, Lobo 1/ }))
    const card = within(await screen.findByRole('region', { name: 'Lobo 1' }))
    const max = wolves[0]?.life?.max ?? 0
    await user.type(card.getByLabelText('Cuánto'), '2')
    await user.click(card.getByRole('button', { name: 'Dañar' }))
    await waitFor(async () => expect((await tokensOf(api))[0]?.actor.life?.value).toBe(max - 2))
    await push()
    expect(card.getByText(`${max - 2} / ${max} PG`)).toBeDefined()
    await user.type(card.getByLabelText('Estado'), 'Derribado')
    await user.type(card.getByLabelText('Rondas que dura'), '2')
    await user.click(card.getByRole('button', { name: 'Poner' }))
    await waitFor(async () =>
      expect((await tokensOf(api))[0]?.actor.conditions[0]).toMatchObject({ name: 'Derribado', rounds: 2 })
    )
    await push()
    expect(card.getByRole('list', { name: 'Estados' }).textContent).toContain('2 rondas')
    await user.click(card.getByRole('button', { name: 'Quitar Derribado' }))
    await waitFor(async () => expect((await tokensOf(api))[0]?.actor.conditions).toHaveLength(0))
    // «Abrir hoja»: la de la criatura, en su ventana sobre la Mesa
    await user.click(card.getByRole('button', { name: 'Abrir hoja' }))
    const sheet = await screen.findByRole('dialog', { name: 'Lobo 1' })
    // El título de la ventana y el de la hoja
    expect(await within(sheet).findAllByRole('heading', { name: 'Lobo 1' })).toHaveLength(2)
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar Lobo 1' }))
    expect(screen.queryByRole('dialog', { name: 'Lobo 1' })).toBeNull()
    await user.click(card.getByRole('button', { name: 'Ocultar' }))
    await waitFor(async () => expect((await tokensOf(api))[0]?.hidden).toBe(true))
    await user.click(card.getByRole('button', { name: 'Ajustes de la ficha' }))
    const label = card.getByLabelText('Rótulo')
    await user.clear(label)
    await user.type(label, 'Alfa')
    await user.tab()
    await waitFor(async () => expect((await tokensOf(api))[0]?.label).toBe('Alfa'))
    // Con la ficha elegida, el panel guarda un encuentro con ella
    await user.click(panel().getByRole('tab', { name: 'Escenas' }))
    await user.type(panel().getByLabelText('Guardar como encuentro (la elegida)'), 'Manada')
    await user.click(panel().getByRole('button', { name: 'Guardar' }))
    await waitFor(async () =>
      expect((await api.client.call('listEncounters', { worldId: WORLD.id })).encounters[0]).toMatchObject({
        name: 'Manada',
        systemId: SYSTEM.id,
        members: [{ key: 'lobo', unique: false, at: [{ dx: 0, dy: 0 }] }]
      })
    )
  })

  it('un encuentro del panel se pone con su formación; «Grupo» encuadra en la tele a las fichas del grupo', async () => {
    const user = userEvent.setup()
    const { api, push } = await renderTable()
    await api.client.call('saveEncounter', {
      worldId: WORLD.id,
      systemId: SYSTEM.id,
      name: 'Manada',
      members: [
        {
          key: 'lobo',
          unique: false,
          at: [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0 }
          ]
        }
      ]
    })
    // Escenas ya está abierta (con los encuentros de antes): se vuelve a ella para verlo
    await user.click(panel().getByRole('tab', { name: 'Compendio' }))
    await user.click(panel().getByRole('tab', { name: 'Escenas' }))
    await user.click(await panel().findByRole('button', { name: 'Poner en la mesa: Manada' }))
    await waitFor(async () => expect(await tokensOf(api)).toHaveLength(2))
    const [a, b] = await tokensOf(api)
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBe(100)
    await push()
    await user.click(screen.getByRole('radio', { name: 'Al grupo' }))
    await waitFor(async () =>
      expect((await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).camera).toEqual({ mode: 'group' })
    )
  })
})

describe('la pestaña Escenas', () => {
  it('«En esta escena»: quien está en el mapa, con su vida; se oculta al grupo y se mete en el combate', async () => {
    const user = userEvent.setup()
    const { api, scene, wolves, push } = await renderTable()
    await api.client.call('placeTokens', {
      campaignId: CAMPAIGN.id,
      sceneId: scene.id,
      tokens: wolves.map((wolf, i) => ({ creatureId: wolf.id, x: 100 + i * 100, y: 100 }))
    })
    await push()
    const section = within(await panel().findByRole('region', { name: 'En esta escena' }))
    expect(section.getAllByRole('listitem')).toHaveLength(2)
    const [first] = await tokensOf(api)
    const label = first?.label ?? ''
    await user.click(section.getByRole('button', { name: `Ocultar ${label} al grupo` }))
    await waitFor(async () => expect((await tokensOf(api)).find((t) => t.id === first?.id)?.hidden).toBe(true))
    await push()
    expect(section.getByRole('button', { name: `Ocultar ${label} al grupo` }).getAttribute('aria-pressed')).toBe('true')
    // Sin combate no se mete a nadie; con uno, a quien aún no está
    expect(section.queryByRole('button', { name: `Meter a ${label} en el combate` })).toBeNull()
    await api.client.call('startCombat', { campaignId: CAMPAIGN.id, tokenIds: [(await tokensOf(api))[1]?.id ?? ''] })
    await push()
    await user.click(panel().getByRole('tab', { name: 'Escenas' }))
    const again = within(await panel().findByRole('region', { name: 'En esta escena' }))
    await user.click(again.getByRole('button', { name: `Meter a ${label} en el combate` }))
    await waitFor(async () =>
      expect((await api.client.call('getCombat', { campaignId: CAMPAIGN.id })).combat?.combatants).toHaveLength(2)
    )
  })

  it('«Escena nueva» crea una escena suelta (sin página, ADR-0020) y la abre', async () => {
    const user = userEvent.setup()
    const { api } = await renderTable()
    await user.click(await panel().findByRole('button', { name: 'Escena nueva' }))
    await user.type(panel().getByLabelText('Nombre de la escena'), 'Puerto Gris')
    await user.click(panel().getByRole('button', { name: 'Crear' }))
    await waitFor(async () =>
      expect((await api.client.call('getCampaignTable', { campaignId: CAMPAIGN.id })).open?.name).toBe('Puerto Gris')
    )
    expect(api.pages.map((page) => page.title)).not.toContain('Puerto Gris')
    expect(api.calls).toContain('createScene')
  })
})

describe('la pestaña Compendio', () => {
  it('siempre en carpetas (sin «Todo»); al buscar, en sus carpetas; una entrada se abre en la ventana del compendio', async () => {
    const user = userEvent.setup()
    await renderTable()
    await user.click(panel().getByRole('tab', { name: 'Compendio' }))
    // Las carpetas del compendio, sin una lista de todo
    expect(await panel().findByRole('navigation', { name: 'Biblioteca del compendio' })).toBeDefined()
    expect(panel().queryByRole('button', { name: 'Todo' })).toBeNull()
    await user.type(panel().getByRole('searchbox', { name: 'Buscar en el compendio' }), 'lobo')
    const found = within(await panel().findByRole('navigation', { name: 'Entradas' }))
    await user.click(found.getByRole('button', { name: 'Lobo' }))
    expect(await screen.findByRole('dialog', { name: 'Compendio' })).toBeDefined()
  })

  it('arrastrar una criatura del compendio a Personajes la pone en la campaña', async () => {
    const user = userEvent.setup()
    const { api } = await renderTable()
    await user.click(panel().getByRole('tab', { name: 'Compendio' }))
    await user.type(panel().getByRole('searchbox', { name: 'Buscar en el compendio' }), 'lobo')
    const found = within(await panel().findByRole('navigation', { name: 'Entradas' }))
    const store = new Map<string, string>()
    const dataTransfer = {
      get types() {
        return [...store.keys()]
      },
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
      effectAllowed: 'all',
      dropEffect: 'none'
    }
    fireEvent.dragStart(found.getByRole('button', { name: 'Lobo' }).closest('li') as HTMLElement, { dataTransfer })
    await user.click(panel().getByRole('tab', { name: 'Personajes' }))
    const creatures = (await panel().findByRole('list', { name: 'Criaturas' })).parentElement as HTMLElement
    fireEvent.dragOver(creatures, { dataTransfer })
    fireEvent.drop(creatures, { dataTransfer })
    await waitFor(async () =>
      expect((await api.client.call('listInPlay', { campaignId: CAMPAIGN.id })).creatures).toHaveLength(3)
    )
  })
})

describe('las fichas en la tele', () => {
  const GRID = {
    type: 'square' as const,
    size: 100,
    offsetX: 0,
    offsetY: 0,
    distance: 5,
    units: 'pies',
    diagonals: 'equal' as const,
    visible: true,
    color: '#000000',
    opacity: 0.3
  }
  const token = (patch: Partial<ScreenView['tokens'][number]>): ScreenView['tokens'][number] => ({
    id: crypto.randomUUID(),
    x: 150,
    y: 150,
    size: 1,
    label: 'L1',
    name: 'Lobo 1',
    faction: 'hostile',
    img: null,
    image: null,
    state: 'hurt',
    conditions: [],
    ...patch
  })
  const screenOf = (tokens: ScreenView['tokens'], camera: ScreenView['camera'] = { mode: 'follow' }): ScreenView => ({
    campaignId: CAMPAIGN.id,
    campaignName: 'La Marca',
    scene: {
      id: crypto.randomUUID(),
      image: { width: 1200, height: 800, tiles: { version: crypto.randomUUID(), size: 512, levels: 2 } },
      grid: GRID,
      initialView: null
    },
    hidden: false,
    camera,
    tokens,
    combat: null
  })

  it('«Encuadrar al grupo»: la cámara va a las fichas del grupo', () => {
    const lia = token({ faction: 'group', x: 1000, y: 600, state: null, name: 'Lía' })
    const view = cameraTarget(screenOf([token({}), lia], { mode: 'group' }), null, { width: 1600, height: 900 })
    expect(view).toMatchObject({ x: 1000, y: 600 })
    // Sin fichas del grupo, lo de siempre
    expect(cameraTarget(screenOf([token({})], { mode: 'group' }), { x: 1, y: 2, scale: 1 })).toEqual({
      x: 1,
      y: 2,
      scale: 1
    })
  })

  it('el nombre y el estado en palabras de cada ficha; el arrastre del máster, en vivo', async () => {
    const api = fakeApi({ organizations: [ORG], worlds: [WORLD], campaigns: [CAMPAIGN] })
    render(
      <App
        router={createAppRouter(
          createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/campanas/${CAMPAIGN.id}/pantalla`] })
        )}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
        api={api.client}
      />
    )
    await waitFor(() => expect(channels.some((c) => c.view === 'screen')).toBe(true))
    const channel = channels.find((c) => c.view === 'screen')
    const wolf = token({ conditions: [{ name: 'Derribado' }] })
    act(() =>
      channel?.onMessage({
        type: 'screen',
        screen: screenOf([wolf, token({ name: 'Lía', faction: 'group', state: null })])
      })
    )
    const list = within(await screen.findByRole('list', { name: 'Lo que hay en la mesa' }))
    expect(list.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Lobo 1, Con heridas, Derribado',
      'Lía'
    ])
    await waitFor(() =>
      expect(drawn.tokens[0]).toMatchObject({ label: 'Lobo 1', state: { text: 'Con heridas', tone: 'hurt' } })
    )
    act(() => channel?.onMessage({ type: 'drag', moves: [{ tokenId: wolf.id, x: 400, y: 420 }] }))
    await waitFor(() => expect(drawn.tokens[0]).toMatchObject({ x: 400, y: 420 }))
  })
})
