import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'
import { freshOwner, png } from './ayudas.ts'

type Seen = { x: number; y: number; scale: number; width: number; height: number }

/** La vista de un lienzo de la mesa (la deja en un atributo): dónde cae el mapa y a qué escala */
async function viewOf(canvas: Locator): Promise<Seen> {
  return JSON.parse((await canvas.getAttribute('data-view')) ?? 'null') as Seen
}

async function axe(page: Page, what: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const results = await new AxeBuilder({ page }).include('dialog').analyze()
    expect(results.violations, `${what}, ${colorScheme}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
  }
  await page.emulateMedia({ colorScheme: 'dark' })
}

/** Un mapa de 1200 × 800: una sala clara sobre roca oscura, con su rejilla de 100 px */
const MAP = png(1200, 800, (x, y) => {
  if (x % 100 < 2 || y % 100 < 2) return [60, 52, 44]
  const inside = x > 100 && x < 1100 && y > 100 && y < 700
  return inside ? [190, 176, 150] : [92, 84, 76]
})
const THUMB = png(120, 80, (x, y) => (x > 10 && x < 110 && y > 10 && y < 70 ? [190, 176, 150] : [92, 84, 76]))

/**
 * Un módulo escrito a mano: un bestiario con un lobo y un paquete de escenas (NeDB, de la v10) con la cripta: la sala
 * con sus muros y una puerta, una luz y el lobo. El lienzo de Foundry lleva un margen de 0,25: 300 × 200 px
 */
function module() {
  const manifest = {
    id: 'cripta',
    title: 'La cripta de Varn',
    version: '1.0.0',
    packs: [
      { name: 'bestias', label: 'Bestias', type: 'Actor', path: 'packs/bestias.db' },
      { name: 'escenas', label: 'Escenas', type: 'Scene', path: 'packs/escenas.db' }
    ]
  }
  const wolf = { _id: 'lobo000000000001', name: 'Lobo', type: 'npc', system: { hp: 11 } }
  const at = (x: number, y: number) => [x + 300, y + 200]
  const scene = {
    _id: 'cripta0000000001',
    name: 'Cripta',
    width: 1200,
    height: 800,
    padding: 0.25,
    grid: { type: 1, size: 100, distance: 5, units: 'ft', color: '#000000', alpha: 0.3 },
    background: { src: 'modules/cripta/maps/cripta.png', offsetX: 0, offsetY: 0 },
    thumb: 'modules/cripta/thumbs/cripta.png',
    tokenVision: true,
    darkness: 0.3,
    walls: [
      { _id: 'm1', c: [...at(100, 100), ...at(1100, 100)], move: 20, sight: 20, light: 20, sound: 20 },
      { _id: 'm2', c: [...at(1100, 100), ...at(1100, 700)], move: 20, sight: 20, light: 20, sound: 20 },
      { _id: 'm3', c: [...at(1100, 700), ...at(100, 700)], move: 20, sight: 20, light: 20, sound: 20 },
      { _id: 'm4', c: [...at(100, 700), ...at(100, 450)], move: 20, sight: 20, light: 20, sound: 20 },
      { _id: 'm5', c: [...at(100, 450), ...at(100, 350)], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 },
      { _id: 'm6', c: [...at(100, 350), ...at(100, 100)], move: 20, sight: 20, light: 20, sound: 20 }
    ],
    lights: [{ _id: 'l1', x: 600 + 300, y: 400 + 200, config: { bright: 15, dim: 30, color: '#ffaa55', alpha: 0.4 } }],
    tokens: [{ _id: 't1', name: 'Lobo', actorId: wolf._id, x: 700 + 300, y: 300 + 200, width: 1, height: 1 }],
    notes: [],
    _stats: { coreVersion: '10.291' }
  }
  return Buffer.from(
    zipSync({
      'cripta/module.json': strToU8(JSON.stringify(manifest)),
      'cripta/packs/bestias.db': strToU8(JSON.stringify(wolf)),
      'cripta/packs/escenas.db': strToU8(JSON.stringify(scene)),
      'cripta/maps/cripta.png': new Uint8Array(MAP),
      'cripta/thumbs/cripta.png': new Uint8Array(THUMB)
    })
  )
}

test('traer las escenas de un zip: elegir dónde, su mapa troceado, y abrirla en la mesa con sus muros y su lobo', async ({
  page
}) => {
  test.setTimeout(150_000)
  await freshOwner(page)
  const call = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const worldId = (await call('createWorld', { name: 'Valdren' })).id as string
  const campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).id as string
  await call('createPage', { worldId, title: 'Lugares' })

  // «Sistema nuevo» con el zip: sus compendios, para el sistema, y sus escenas, para un mundo
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sistemas' }).click()
  await page.getByRole('button', { name: 'Sistema nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await dialog
    .getByLabel('Elegir el archivo')
    .setInputFiles({ name: 'cripta.zip', mimeType: 'application/zip', buffer: module() })
  await expect(dialog.getByRole('group', { name: 'Compendios que se traen' })).toContainText('Bestias')
  const scenes = dialog.getByRole('group', { name: 'Escenas que se traen' })
  await expect(scenes).toContainText('Cripta')
  await expect(scenes).toContainText('Cuadrada · 5 muros · una puerta · una luz · una ficha')

  // Primero el bestiario: el sistema, en el que se buscarán sus criaturas; el cuadro sigue con las escenas
  await dialog.getByRole('button', { name: 'Traer de Foundry' }).click()
  await expect(dialog.getByText('Sistema «La cripta de Varn» creado')).toBeVisible()
  const { systems } = await call('listSystems', {})
  const systemId = systems.find((s: { name: string }) => s.name === 'La cripta de Varn').id as string
  await call('updateCampaign', { campaignId, system: systemId })

  // Dónde: el mundo y bajo «Lugares»; la miniatura, sacada del zip
  await expect(dialog.getByLabel('Mundo')).toHaveValue(worldId)
  await dialog.getByLabel('Bajo la página').selectOption({ label: 'Lugares' })
  await expect.poll(() => scenes.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(120)
  await axe(page, 'las escenas del zip')
  await dialog.screenshot({ path: '../out/capturas/foundry-escenas.png' })
  await dialog.getByRole('button', { name: 'Traer una escena' }).click()
  await expect(dialog.getByText('Traída una escena')).toBeVisible({ timeout: 60_000 })
  await expect(dialog).toContainText('Nueva · una criatura preparada')
  await axe(page, 'lo traído')
  await dialog.screenshot({ path: '../out/capturas/foundry-traida.png' })

  // La escena, en la wiki: una página nueva bajo «Lugares» con su pestaña «Escena», su mapa en teselas y su rejilla
  const [scene] = (await call('listScenes', { worldId })).scenes
  expect(scene).toMatchObject({
    pageTitle: 'Cripta',
    name: 'Escena',
    image: { width: 1200, height: 800 },
    grid: { type: 'square', size: 100, offsetX: 0, offsetY: 0 },
    prepared: [{ name: 'Lobo', unique: false, hidden: false }]
  })
  expect(scene.image.tiles.levels).toBeGreaterThan(0)
  const vision = await call('getSceneVision', { sceneId: scene.id })
  expect(vision.walls).toHaveLength(6)
  expect(vision.walls.filter((w: { door: string | null }) => w.door === 'door')).toHaveLength(1)
  expect(vision).toMatchObject({ darkness: 0.3, automaticVision: true })
  await dialog.getByRole('link', { name: 'Cripta' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Cripta' })).toBeVisible()
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await tabs.getByRole('link', { name: 'Escena' }).click()
  await expect(page.getByRole('application', { name: 'Escena Escena' }).locator('img').first()).toBeVisible({
    timeout: 20_000
  })

  // En la mesa: al abrirla la campaña por primera vez, el lobo sale en juego y en el mapa, donde estaba
  await page.getByRole('button', { name: 'Abrir en la mesa' }).click()
  await expect(page).toHaveURL(/\/mesa$/)
  const table = page.getByRole('application', { name: 'Mesa: Escena' })
  await expect(table).toBeVisible()
  await expect.poll(async () => (await viewOf(table))?.scale ?? 0).toBeGreaterThan(0)
  const { tokens } = await call('getCampaignTable', { campaignId })
  expect(tokens).toEqual([
    expect.objectContaining({
      x: 750,
      y: 350,
      size: 1,
      hidden: false,
      actor: expect.objectContaining({ name: 'Lobo 1' })
    })
  ])
  await page.waitForTimeout(500)
  await page.screenshot({ path: '../out/capturas/foundry-mesa.png' })
})
