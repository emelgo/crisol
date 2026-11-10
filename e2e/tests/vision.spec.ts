import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { freshOwner, import5e, watchNetwork } from './ayudas.ts'

/**
 * La visión (docs/specs/vision.md) con la cripta de Varn del lienzo «Crisol: la mesa», a 3000 × 2000 (casillas de
 * 100 px): sus muros y sus puertas los dibuja la IA con el mapa; el máster dibuja en la mesa la puerta secreta de la
 * cripta. La tele no ve la sala de detrás de la puerta; el grupo entra por la puerta normal y la sala se descubre; el
 * máster abre la secreta y se ve el hueco; destapa a mano la cueva. Deja las capturas en out/capturas/vision-*.png, en
 * oscuro y a 1440 × 900, como los tableros Visión y Pantalla
 */
const CRIPTA = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'), 'utf8')
const SIZE = { width: 1440, height: 900 }

type Point = { x: number; y: number }
const p = (x: number, y: number): Point => ({ x, y })
/** Los muros del lienzo (en píxeles de la cripta): la sala de la entrada, el pasillo, la sala del altar y la cripta */
const WALLS = [
  [p(900, 900), p(900, 700), p(200, 700), p(200, 1300), p(900, 1300), p(900, 1100)],
  [p(900, 900), p(1400, 900), p(1400, 400), p(2200, 400), p(2200, 680)],
  [p(2200, 910), p(2200, 1200), p(1850, 1200)],
  [p(1750, 1200), p(1400, 1200), p(1400, 1100), p(900, 1100)],
  [
    p(1750, 1200),
    p(1750, 1300),
    p(1500, 1300),
    p(1500, 1800),
    p(2100, 1800),
    p(2100, 1300),
    p(1850, 1300),
    p(1850, 1200)
  ]
]
/** La puerta de la entrada y la de la cueva */
const PORTALS = [
  { a: p(900, 900), b: p(900, 1100), closed: true, window: false },
  { a: p(2200, 680), b: p(2200, 910), closed: true, window: false }
]
/** Las antorchas del altar y la de la entrada (para la foto de las luces y de la tele) */
const LIGHTS = [p(1520, 424), p(2080, 424), p(1800, 690), p(224, 1000)]

test.use({ viewport: SIZE, colorScheme: 'dark' })

type Seen = { x: number; y: number; scale: number }

/** Un punto del mapa en la página, con la vista que deja el lienzo en su atributo */
async function onMap(stage: Locator, at: Point) {
  const view = JSON.parse((await stage.getAttribute('data-view')) ?? '{}') as Seen
  const box = await stage.boundingBox()
  if (!box) throw new Error('sin mesa')
  return { x: box.x + view.x + at.x * view.scale, y: box.y + view.y + at.y * view.scale }
}

async function axe(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${what}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
}

test('la visión: la cripta con su puerta secreta, el grupo que entra, la secreta que se abre y la niebla a mano', async ({
  page
}) => {
  test.setTimeout(240_000)
  await freshOwner(page)
  const call = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const systemId = await import5e(page)
  const worldId = (await call('createWorld', { name: 'Valdren' })).id
  const campaignId = (await call('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
  const pageId = (await call('createPage', { worldId, title: 'Cripta de Varn' })).id
  const tab = await call('createPageTab', { pageId, kind: 'scene', name: 'Cripta de Varn' })
  const sceneId = (await call('getScene', { tabId: tab.id })).id
  // La IA dibuja el mapa con sus muros y sus puertas: se ponen en juego y la niebla pasa a automática
  await call('drawScene', { sceneId, svg: CRIPTA, name: 'Cripta de Varn', walls: WALLS, portals: PORTALS })
  await call('updateScene', {
    sceneId,
    grid: { size: 100, offsetX: 0, offsetY: 0, opacity: 0.14, color: '#f1e8d8' },
    initialView: { x: 1451, y: 1036, scale: 0.98 }
  })
  const characters: Record<string, string> = {}
  for (const name of ['Lía', 'Bram', 'Sela'])
    characters[name] = (await call('createCharacter', { campaignId, name })).character.id
  await call('openScene', { campaignId, sceneId })
  await call('presentScene', { campaignId })
  // Abrir y presentar la ponen en pausa: el grupo va a jugar (y su franja no tapa el mapa)
  await call('setTableControls', { campaignId, paused: false })
  const party = (
    await call('placeTokens', {
      campaignId,
      sceneId,
      tokens: [
        { characterId: characters.Lía, x: 500, y: 1000 },
        { characterId: characters.Bram, x: 400, y: 850 },
        { characterId: characters.Sela, x: 400, y: 1150 }
      ]
    })
  ).tokens as Array<{ id: string }>
  // Un goblin en la sala del altar y su jefe en la cripta
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [{ content: { key: 'guerrero_goblin_2014', count: 1 }, x: 1950, y: 650 }]
  })
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [{ content: { key: 'jefe_goblin_2024', unique: true }, x: 1800, y: 1600 }]
  })
  await call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view: { x: 1500, y: 1050, scale: 0.75 } } })
  const vision = async () =>
    (await call('getSceneVision', { sceneId, campaignId })) as {
      walls: Array<{ id: string; door: string | null }>
      automaticVision: boolean
    }
  expect((await vision()).automaticVision).toBe(true)
  /** Si el grupo ve la casilla (columna, fila) */
  const sees = async (column: number, row: number) => {
    const seen = (await call('viewAsParty', { campaignId })) as {
      visibleCells: Array<{ row: number; from: number; to: number }>
    }
    return seen.visibleCells.some((run) => run.row === row && run.from <= column && column <= run.to)
  }

  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa`)
  const stage = page.getByRole('application', { name: 'Mesa: Cripta de Varn' })
  await expect(stage).toBeVisible()
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)
  const net = watchNetwork(page)
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Vista de jugadores', exact: true }).click()
  ])
  const tvNet = watchNetwork(tv)
  await tv.setViewportSize(SIZE)
  await tv.emulateMedia({ colorScheme: 'dark' })
  const onTv = tv.getByRole('list', { name: 'Lo que hay en la mesa' }).getByRole('listitem')
  const settled = () => net.quiet()

  // La tele solo ve la sala de la entrada: ni el goblin ni su jefe
  await expect(onTv).toHaveCount(3)
  expect(await sees(5, 10)).toBe(true)
  expect(await sees(18, 7)).toBe(false)

  // El máster dibuja la puerta secreta de la cripta: un tramo entre las dos esquinas del hueco, acabado con doble clic
  await page.keyboard.press('m')
  const walls = page.getByRole('complementary', { name: 'Muros y puertas' })
  await expect(walls).toBeVisible()
  await walls.getByRole('button', { name: 'Puerta secreta' }).click()
  const from = await onMap(stage, p(1750, 1200))
  const to = await onMap(stage, p(1850, 1200))
  await page.mouse.click(from.x, from.y)
  await page.mouse.dblclick(to.x, to.y)
  await expect.poll(async () => (await vision()).walls.filter((w) => w.door === 'secret').length).toBe(1)
  await expect(walls.getByText(/muros, 3 puertas$/)).toBeVisible()
  // Elegida, con su estado en la campaña (la foto del editor, como el tablero Visión)
  const middle = await onMap(stage, p(1800, 1200))
  await page.mouse.click(middle.x, middle.y)
  await expect(walls.getByRole('region', { name: 'Puerta secreta' })).toBeVisible()
  await axe(page, 'el editor de muros')
  await settled()
  await page.screenshot({ path: '../out/capturas/vision-muros.png' })

  // Las luces: las antorchas (las pone la IA) y una elegida en el mapa
  await call('changeWalls', {
    sceneId,
    lights: { add: LIGHTS.map((light) => ({ ...light, bright: 20, dim: 40, color: '#ffb04a' })) }
  })
  await page.keyboard.press('l')
  const lights = page.getByRole('complementary', { name: 'Luces' })
  await expect(lights).toBeVisible()
  await expect(page.getByRole('button', { name: 'Luz 2' })).toBeAttached()
  const torch = await onMap(stage, LIGHTS[0] as Point)
  await page.mouse.click(torch.x, torch.y)
  await expect(lights.getByRole('region', { name: /^Luz \d$/ })).toBeVisible()
  await settled()
  await page.screenshot({ path: '../out/capturas/vision-luces.png' })

  // En juego: la puerta de la entrada se abre con un clic y el grupo entra hasta la sala del altar
  await page.keyboard.press('v')
  await page.getByRole('button', { name: 'Puerta, Cerrada' }).first().click()
  await expect(page.getByRole('button', { name: 'Puerta, Abierta' }).first()).toBeVisible()
  await call('moveTokens', { campaignId, moves: [{ tokenId: party[0]?.id, x: 1800, y: 1000 }] })
  await expect(onTv.filter({ hasText: /Goblin/ })).toHaveCount(1)
  await expect.poll(() => sees(18, 7)).toBe(true)
  // La cripta, tras la puerta secreta: ni la ve ni ve a su jefe
  expect(await sees(18, 15)).toBe(false)
  await expect(onTv.filter({ hasText: /Jefe/ })).toHaveCount(0)
  // El máster abre la secreta: se ve el hueco y lo de detrás
  await page.getByRole('button', { name: 'Puerta secreta, Cerrada' }).click()
  await expect(onTv.filter({ hasText: /Jefe/ })).toHaveCount(1)
  await expect.poll(() => sees(18, 15)).toBe(true)

  // La niebla a mano: destapar con un rectángulo la cueva, que nadie ve
  expect(await sees(26, 10)).toBe(false)
  await page.keyboard.press('n')
  const fog = page.getByRole('complementary', { name: 'Niebla' })
  await expect(fog).toBeVisible()
  await expect(fog.getByRole('switch', { name: 'Visión automática' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('toolbar', { name: 'Niebla' }).getByRole('radio', { name: 'Rectángulo' }).check()
  const a = await onMap(stage, p(2300, 350))
  const b = await onMap(stage, p(2420, 1700))
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => sees(23, 10)).toBe(true)
  await axe(page, 'la niebla')
  await settled()
  await page.screenshot({ path: '../out/capturas/vision-niebla.png' })

  // Ver como el grupo: lo que ve la tele y lo que no (la secreta ya está abierta: Bram, oculto, no se ve)
  await call('updateToken', { tokenId: party[1]?.id, hidden: true })
  await fog.getByRole('button', { name: 'Ver como el grupo' }).click()
  const group = page.getByRole('complementary', { name: 'Lo que ve el grupo' })
  await expect(group.getByText('Bram, oculta')).toBeVisible()
  await expect(page.getByText('Viendo como el grupo')).toBeVisible()
  await axe(page, 'ver como el grupo')
  await settled()
  await page.screenshot({ path: '../out/capturas/vision-grupo.png' })
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(fog).toBeVisible()

  // La tele de noche, con las antorchas: lo no explorado negro, lo explorado en gris y lo visible con su luz
  await call('updateSceneVision', { sceneId, darkness: 0.55 })
  await expect.poll(async () => (await call('getCampaignTable', { campaignId })).vision.darkness).toBe(0.55)
  await tvNet.quiet()
  await axe(tv, 'la tele')
  await tv.screenshot({ path: '../out/capturas/vision-tele.png' })

  // Reiniciar la niebla pide confirmarlo
  await fog.getByRole('button', { name: 'Reiniciar la niebla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reiniciar la niebla' })
  await dialog.getByRole('button', { name: 'Reiniciar' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => sees(23, 10)).toBe(false)
})
