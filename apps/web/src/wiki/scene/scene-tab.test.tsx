import type { Campaign, World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAccountClient } from '../../account/fake.ts'
import { fakeApi } from '../../api/fake.ts'
import { App } from '../../app.tsx'
import { createAppRouter } from '../../router.tsx'
import type { PrepareSource } from '../../tabletop/prepare.ts'
import { PreparerContext, type ScenePreparer } from '../../tabletop/preparer.ts'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
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
const campaign = (name: string): Campaign => ({
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name,
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
})
const CRYPT = crypto.randomUUID()
const EMAIL = 'enrique@crisol.test'

/** Un preparador sin hilos ni lienzos: dice lo que mide y acaba al momento (o cuando se le diga) */
function fakePreparer(options: { uvtt?: boolean; detected?: boolean; hold?: boolean } = {}) {
  const sources: PrepareSource[] = []
  let release: () => void = () => {}
  const preparer: ScenePreparer = {
    prepare(_sceneId, source, events = {}) {
      sources.push(source)
      let cancel: () => void = () => {}
      const done = new Promise<Awaited<ReturnType<ScenePreparer['prepare']>['done']>>((resolve, reject) => {
        cancel = () => reject(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }))
        const finish = () => {
          events.onProgress?.(7, 7)
          resolve({
            width: 1200,
            height: 800,
            tiles: { version: crypto.randomUUID(), size: 512, levels: 2 },
            uvtt: options.uvtt
              ? {
                  grid: { type: 'square', size: 140, offsetX: 12, offsetY: 0 },
                  imported: {
                    source: 'uvtt',
                    walls: [],
                    objects: [],
                    portals: [],
                    lights: [],
                    ambientLight: null,
                    bakedLighting: false
                  }
                }
              : null
          })
        }
        events.onImage?.({ width: 1200, height: 800, preview: null, total: 7 })
        events.onProgress?.(3, 7)
        if (options.hold) release = finish
        else setTimeout(finish)
      })
      return { done, cancel: () => cancel() }
    },
    detect: async () => (options.detected ? { type: 'square', size: 50, offsetX: 20, offsetY: 10 } : null)
  }
  return { preparer, sources, release: () => release() }
}

beforeEach(() => {
  localStorage.setItem(`crisol.recorridos.${EMAIL}`, JSON.stringify({ seen: ['mundo', 'escena'] }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
  // Las imágenes del mundo se bajan para trocearlas: aquí, un PNG cualquiera
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob(['png'], { type: 'image/png' })))
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Api = ReturnType<typeof fakeApi>

async function renderPage(
  options: {
    campaigns?: Campaign[]
    preparer?: ReturnType<typeof fakePreparer>
    tab?: 'scene' | null
    /** Lo que se hace con la escena antes de abrir la página */
    before?: (api: Api, sceneId: string) => Promise<unknown>
  } = {}
) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    campaigns: options.campaigns ?? [campaign('La Marca')],
    pages: [{ id: CRYPT, worldId: WORLD.id, title: 'Cripta de Varn' }],
    files: [
      { worldId: WORLD.id, name: 'cripta.png', kind: 'image', mime: 'image/png' },
      { worldId: WORLD.id, name: 'notas.pdf', kind: 'pdf', mime: 'application/pdf' }
    ]
  })
  const tab = options.tab === 'scene' ? await api.client.call('createPageTab', { pageId: CRYPT, kind: 'scene' }) : null
  const scene = tab ? await api.client.call('getScene', { tabId: tab.id }) : null
  if (scene) await options.before?.(api, scene.id)
  const prepared = options.preparer ?? fakePreparer()
  const router = createAppRouter(
    createMemoryHistory({
      initialEntries: [`/mundos/${WORLD.id}/wiki/${CRYPT}${tab ? `?pestana=${tab.id}` : ''}`]
    })
  )
  const view = (
    <PreparerContext.Provider value={prepared.preparer}>
      <App
        router={router}
        accounts={fakeAccountClient({ account: { name: 'Enrique', email: EMAIL } }).client}
        api={api.client}
      />
    </PreparerContext.Provider>
  )
  render(view)
  return { api, router, tab, scene, prepared }
}

/** Pulsar sin moverse en un punto del visor */
function tap(target: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}

const stored = async (api: ReturnType<typeof fakeApi>, tabId: string) => api.client.call('getScene', { tabId })

describe('la pestaña «Escena»', () => {
  it('nace desde «Pestaña nueva» con una imagen del mundo: se trocea, se le pone y se ve', async () => {
    const user = userEvent.setup()
    const { api, prepared } = await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pestaña nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    await user.click(dialog.getByRole('radio', { name: 'Escena' }))
    // Del mundo, solo sus imágenes
    expect(dialog.getByRole('radio', { name: /Del mundo/ })).toHaveProperty('checked', true)
    expect(dialog.queryByRole('button', { name: 'notas.pdf' })).toBeNull()
    await user.click(dialog.getByRole('button', { name: 'cripta.png' }))
    await user.click(dialog.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByRole('application', { name: 'Escena Escena' })).toBeDefined()
    expect(prepared.sources[0]?.kind).toBe('image')
    const tabs = await api.client.call('listPageTabs', { pageId: CRYPT })
    const scene = await stored(api, tabs.tabs[0]?.id ?? '')
    expect(scene.image).toMatchObject({ width: 1200, height: 800, tiles: { size: 512, levels: 2 } })
    expect(scene.image?.fileId).toBe(api.files.find((file) => file.name === 'cripta.png')?.id)
    expect(api.calls).toContain('setSceneImage')
  })

  it('sin mapa lo pide; mientras se trocea dice cuántas partes van y se puede cancelar', async () => {
    const user = userEvent.setup()
    const prepared = fakePreparer({ hold: true })
    const { api, tab } = await renderPage({ tab: 'scene', preparer: prepared })
    expect(await screen.findByText('Esta escena aún no tiene mapa.')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'cripta.png' }))
    expect(await screen.findByText('Preparando el mapa…')).toBeDefined()
    expect(await screen.findByText('3 de 7 partes')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Esta escena aún no tiene mapa.')).toBeDefined()
    expect((await stored(api, tab?.id ?? '')).image).toBeNull()
  })

  it('un UVTT trae su rejilla y lo que pondrá en juego la visión', async () => {
    const user = userEvent.setup()
    const prepared = fakePreparer({ uvtt: true })
    const { api, tab } = await renderPage({ tab: 'scene', preparer: prepared })
    await user.click(await screen.findByRole('radio', { name: /UVTT/ }))
    expect(screen.getByText(/Suelta aquí el archivo \.dd2vtt/)).toBeDefined()
    const input = document.querySelector('input[type="file"][accept=".dd2vtt,.uvtt,.df2vtt"]') as HTMLInputElement
    await user.upload(input, new File(['{}'], 'cripta.dd2vtt'))
    expect(await screen.findByRole('application', { name: 'Escena Escena' })).toBeDefined()
    expect(prepared.sources[0]?.kind).toBe('uvtt')
    const scene = await stored(api, tab?.id ?? '')
    expect(scene.grid).toMatchObject({ type: 'square', size: 140, offsetX: 12 })
    expect(scene.hasImported).toBe(true)
  })

  describe('con mapa', () => {
    const withMap = (options: Parameters<typeof renderPage>[0] = {}) =>
      renderPage({
        tab: 'scene',
        before: (api, sceneId) =>
          api.client.call('setSceneImage', {
            sceneId,
            width: 1200,
            height: 800,
            tiles: { version: crypto.randomUUID(), size: 512, levels: 2 }
          }),
        ...options
      })

    it('la rejilla: su tipo, su forma hexagonal, su tamaño, lo que mide y si se ve; todo se guarda', async () => {
      const user = userEvent.setup()
      const { api, tab } = await withMap()
      await screen.findByRole('application', { name: 'Escena Escena' })
      const side = within(screen.getByRole('region', { name: 'Rejilla' }))
      await user.click(side.getByRole('radio', { name: 'Hexagonal' }))
      await user.selectOptions(side.getByLabelText('Forma'), 'hex-columns')
      await user.selectOptions(side.getByLabelText('Unidad'), 'millas')
      await user.selectOptions(side.getByLabelText('Diagonales'), 'alternate')
      await user.click(side.getByRole('switch', { name: 'Se ve en la mesa' }))
      await waitFor(async () =>
        expect((await stored(api, tab?.id ?? '')).grid).toMatchObject({
          type: 'hex-columns',
          units: 'millas',
          diagonals: 'alternate',
          visible: false
        })
      )
      // Sin rejilla, no hay nada que alinear
      await user.click(side.getByRole('radio', { name: 'Sin rejilla' }))
      expect(side.queryByRole('button', { name: 'Buscarla' })).toBeNull()
    })

    it('«Dos esquinas»: dos esquinas opuestas de una casilla dan su tamaño y su desplazamiento', async () => {
      const user = userEvent.setup()
      const { api, tab } = await withMap()
      const map = await screen.findByRole('application', { name: 'Escena Escena' })
      await user.click(screen.getByRole('button', { name: 'Dos esquinas' }))
      expect(screen.getByText('Marca dos esquinas opuestas de una casilla')).toBeDefined()
      // La vista: el mapa encuadrado en el visor de 800 × 600; se lee de su escenario
      const stage = map.querySelector('[data-scene-stage]') as HTMLElement
      const [, x, y, k] = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(stage.style.transform) ?? []
      const at = (px: number, py: number) => [Number(x) + px * Number(k), Number(y) + py * Number(k)] as const
      tap(map, ...at(70, 60))
      tap(map, ...at(120, 110))
      expect(await screen.findByText('Encaja: casillas de 50 px')).toBeDefined()
      await waitFor(async () => {
        const { grid } = await stored(api, tab?.id ?? '')
        expect(grid.size).toBeCloseTo(50, 1)
        expect(grid.offsetX).toBeCloseTo(20, 1)
        expect(grid.offsetY).toBeCloseTo(10, 1)
      })
    })

    it('«Buscarla» pone la rejilla que encuentra (o dice que no ve ninguna)', async () => {
      const user = userEvent.setup()
      const { api, tab } = await withMap({ preparer: fakePreparer({ detected: true }) })
      await screen.findByRole('application', { name: 'Escena Escena' })
      await user.click(screen.getByRole('button', { name: 'Buscarla' }))
      expect(await screen.findByText('Encaja: casillas de 50 px')).toBeDefined()
      await waitFor(async () =>
        expect((await stored(api, tab?.id ?? '')).grid).toMatchObject({ size: 50, offsetX: 20 })
      )
    })

    it('«Usar este encuadre» guarda la vista inicial', async () => {
      const user = userEvent.setup()
      const { api, tab } = await withMap()
      await screen.findByRole('application', { name: 'Escena Escena' })
      await user.click(screen.getByRole('button', { name: 'Usar este encuadre' }))
      await waitFor(async () => expect((await stored(api, tab?.id ?? '')).initialView).not.toBeNull())
    })

    it('«Abrir en la mesa» con la campaña elegida la abre en ella y lleva a su mesa', async () => {
      const user = userEvent.setup()
      const north = campaign('Los del norte')
      const { api, router, scene } = await withMap({ campaigns: [campaign('La Marca'), north] })
      await screen.findByRole('application', { name: 'Escena Escena' })
      await user.selectOptions(await screen.findByLabelText('Campaña'), 'Los del norte')
      await user.click(screen.getByRole('button', { name: 'Abrir en la mesa' }))
      await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/campanas/${north.id}/mesa`))
      expect((await api.client.call('getCampaignTable', { campaignId: north.id })).open?.id).toBe(scene?.id)
    })
  })

  it('una escena que creó la IA con un archivo del mundo se trocea al abrir su pestaña', async () => {
    const prepared = fakePreparer()
    const { api, tab } = await renderPage({
      tab: 'scene',
      preparer: prepared,
      before: (api, sceneId) =>
        api.client.call('setSceneImage', { sceneId, fileId: api.files.find((f) => f.name === 'cripta.png')?.id ?? '' })
    })
    expect(await screen.findByRole('application', { name: 'Escena Escena' })).toBeDefined()
    expect(prepared.sources[0]?.kind).toBe('image')
    const scene = await stored(api, tab?.id ?? '')
    // Se queda con su archivo y ya con sus teselas
    expect(scene.image?.tiles?.levels).toBe(2)
    expect(scene.image?.fileId).toBe(api.files.find((f) => f.name === 'cripta.png')?.id)
  })
})
