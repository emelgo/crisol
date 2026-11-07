/** Las salas de la mesa con una mesa de mentira: lo que llega a la pantalla mientras la sala se pone al día */
import type { CampaignTableView, SceneView, ScreenView, TableServerMessage, TokenView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { createTableRooms, type LoadTable, type TableSocket } from './rooms.ts'

const CAMPAIGN = '00000000-0000-4000-8000-000000000001'
const grid: SceneView['grid'] = {
  type: 'square',
  size: 100,
  offsetX: 0,
  offsetY: 0,
  distance: 5,
  units: 'pies',
  diagonals: 'equal',
  visible: true,
  color: '#000000',
  opacity: 0.3
}
const scene = (id: string): SceneView => ({
  id,
  tabId: id,
  pageId: id,
  pageTitle: 'Cripta',
  name: 'Escena',
  image: null,
  grid,
  initialView: null,
  hasImported: false
})
const token = (id: string, sceneId: string): TokenView => ({
  id,
  sceneId,
  x: 0,
  y: 0,
  size: 1,
  label: 'G1',
  faction: 'hostile',
  hidden: false,
  image: null,
  actor: { kind: 'creature', id, name: 'Goblin', img: null, version: 1, life: null, stats: [], conditions: [] }
})

/** Una mesa: la escena abierta, la presentada y si la pantalla ve la ficha (y todo el mapa) */
function tableOf(open: string, presented: string, seen: boolean) {
  const goblin = token('00000000-0000-4000-8000-0000000000aa', open)
  const master: CampaignTableView = {
    campaignId: CAMPAIGN,
    open: scene(open),
    presented: scene(presented),
    screenHidden: false,
    camera: { mode: 'follow' },
    tokens: [goblin],
    combat: null
  }
  const screen: ScreenView = {
    campaignId: CAMPAIGN,
    campaignName: 'La Marca',
    scene: { id: presented, image: null, grid, initialView: null },
    hidden: false,
    camera: { mode: 'follow' },
    tokens: seen
      ? [
          {
            id: goblin.id,
            x: 0,
            y: 0,
            size: 1,
            label: 'G1',
            name: 'Goblin',
            faction: 'hostile',
            img: null,
            image: null,
            state: null,
            conditions: []
          }
        ]
      : [],
    combat: null
  }
  return { master, screen, screenVisible: { hasPoint: () => true } }
}

function socket() {
  const got: TableServerMessage[] = []
  const s: TableSocket & { got: TableServerMessage[] } = { got, send: (data) => got.push(JSON.parse(data)) }
  return s
}

describe('las salas de la mesa', () => {
  it('mientras se pone al día tras un cambio, el arrastre no llega a la pantalla (la ficha pudo dejar de verse)', async () => {
    let next = tableOf('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', true)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let slow = false
    const load: LoadTable = async () => {
      const table = next
      if (slow) await gate
      return table
    }
    const rooms = createTableRooms(load)
    const master = socket()
    const screen = socket()
    await rooms.join(CAMPAIGN, 'master', master)
    await rooms.join(CAMPAIGN, 'screen', screen)
    const goblin = next.master.tokens[0]?.id ?? ''
    rooms.drag(CAMPAIGN, [{ tokenId: goblin, x: 10, y: 10 }], master)
    expect(screen.got.filter((m) => m.type === 'drag')).toHaveLength(1)
    // Se oculta: hasta que la sala lo sepa, nada del arrastre a la pantalla
    next = tableOf('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', false)
    slow = true
    rooms.changed(CAMPAIGN)
    rooms.drag(CAMPAIGN, [{ tokenId: goblin, x: 20, y: 20 }], master)
    release()
    await rooms.idle()
    rooms.drag(CAMPAIGN, [{ tokenId: goblin, x: 30, y: 30 }], master)
    expect(screen.got.filter((m) => m.type === 'drag')).toHaveLength(1)
  })

  it('el encuadre del máster solo sigue a la pantalla si mira la escena presentada', async () => {
    const open = 'b0000000-0000-4000-8000-000000000001'
    const presented = 'b0000000-0000-4000-8000-000000000002'
    const rooms = createTableRooms(async () => tableOf(open, presented, true))
    const master = socket()
    const screen = socket()
    await rooms.join(CAMPAIGN, 'master', master)
    await rooms.join(CAMPAIGN, 'screen', screen)
    rooms.viewport(CAMPAIGN, { x: 100, y: 100, scale: 1 })
    expect(screen.got.filter((m) => m.type === 'viewport')).toEqual([])
  })
})
