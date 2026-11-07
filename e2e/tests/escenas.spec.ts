import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, openWiki, png } from './ayudas.ts'

/** Un mapa de 1200 × 800 con una rejilla impresa de 50 px, desplazada 20 y 10 px, sobre losas de dos tonos */
const GRID = { size: 50, x: 20, y: 10 }
const MAP = png(1200, 800, (x, y) => {
  const line = (x - GRID.x + 1000) % GRID.size < 2 || (y - GRID.y + 1000) % GRID.size < 2
  if (line) return [40, 34, 30]
  const tone = (Math.floor((x - GRID.x) / GRID.size) + Math.floor((y - GRID.y) / GRID.size)) % 2 ? 196 : 176
  return [tone, tone - 14, tone - 34]
})

type Seen = { x: number; y: number; scale: number; width: number; height: number }

/** La vista de un lienzo de la mesa (la deja en un atributo): dónde cae el mapa y a qué escala */
async function viewOf(canvas: Locator): Promise<Seen> {
  return JSON.parse((await canvas.getAttribute('data-view')) ?? 'null') as Seen
}

/** El centro de lo que se ve, en píxeles del mapa */
const centerOf = (view: Seen) => ({
  x: (view.width / 2 - view.x) / view.scale,
  y: (view.height / 2 - view.y) / view.scale
})

/** Un punto del mapa de la pestaña, en la pantalla (el escenario lleva su transformación) */
async function onTabMap(page: Page, x: number, y: number) {
  const box = await page.locator('[data-scene-stage]').boundingBox()
  if (!box) throw new Error('sin mapa')
  return { x: box.x + (x * box.width) / 1200, y: box.y + (y * box.height) / 800 }
}

async function axe(page: Page, what: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, `${what}, ${colorScheme}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
  }
  await page.emulateMedia({ colorScheme: 'dark' })
}

test('una escena: su mapa en teselas, la rejilla alineada, la mesa y la tele que la sigue, fija y oculta', async ({
  page
}) => {
  test.setTimeout(150_000)
  await freshOwner(page)
  await createWorld(page, 'Valdren')
  await createCampaign(page, 'La Marca')
  await openWiki(page, 'Valdren')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await page.keyboard.type('Cripta de Varn')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Cripta de Varn' })).toBeVisible()
  const [, , worldId] = new URL(page.url()).pathname.split('/')
  const uploaded = await page.request.post(`/api/files?worldId=${worldId}&name=cripta.png`, {
    data: MAP,
    headers: { 'content-type': 'application/octet-stream' }
  })
  expect(uploaded.status()).toBe(201)

  // «Pestaña nueva» → Escena, con su mapa del mundo: se trocea al abrirla
  await page.getByRole('button', { name: 'Pestaña nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await dialog.getByRole('radio', { name: 'Escena' }).check()
  await expect(dialog.getByRole('radio', { name: /Del mundo/ })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: /UVTT/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'cripta.png' }).click()
  await expect(dialog.getByRole('button', { name: 'cripta.png' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Crear' }).click()
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await expect(tabs.getByRole('link', { name: 'Escena' })).toHaveAttribute('aria-current', 'page')
  const map = page.getByRole('application', { name: 'Escena Escena' })
  await expect(map).toBeVisible({ timeout: 20_000 })
  await expect(map.locator('img').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rejilla' })).toBeVisible()

  // Buscarla: encuentra la rejilla impresa
  await page.getByRole('button', { name: 'Buscarla' }).click()
  await expect(page.getByText('Encaja: casillas de 50 px')).toBeVisible({ timeout: 20_000 })

  // Dos esquinas: se cambia el tamaño a mano y se vuelve a alinear marcando una casilla
  const size = page.getByLabel('Casilla', { exact: true })
  await size.fill('80')
  await expect(size).toHaveValue('80')
  await page.getByRole('button', { name: 'Dos esquinas' }).click()
  await expect(page.getByText('Marca dos esquinas opuestas de una casilla')).toBeVisible()
  const a = await onTabMap(page, GRID.x + 4 * GRID.size, GRID.y + 3 * GRID.size)
  const b = await onTabMap(page, GRID.x + 5 * GRID.size, GRID.y + 4 * GRID.size)
  await page.mouse.click(a.x, a.y)
  await page.mouse.click(b.x, b.y)
  await expect(page.getByText(/Encaja: casillas de (49|50|51) px/)).toBeVisible()
  await expect(size).toHaveValue(/^(49|50|51)(\.\d)?$/)
  await axe(page, 'la pestaña')
  await page.screenshot({ path: '../out/capturas/escenas-pestana.png' })

  // Abrir en la mesa (la única campaña): la mesa con la escena abierta, sin presentar
  await page.getByRole('button', { name: 'Abrir en la mesa' }).click()
  await expect(page).toHaveURL(/\/mesa$/)
  const table = page.getByRole('application', { name: 'Mesa: Escena' })
  await expect(table).toBeVisible()
  const panel = page.getByRole('complementary', { name: 'Panel de la mesa' })
  await expect(panel.getByRole('listitem').filter({ hasText: 'Escena' })).toContainText('Abierta')
  await expect.poll(async () => (await viewOf(table))?.scale ?? 0).toBeGreaterThan(0)

  // La tele, en otra ventana: a oscuras con el nombre de la campaña hasta que se presenta
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Pantalla', exact: true }).click()
  ])
  await expect(tv.locator('[data-dark]')).toContainText('La Marca')
  await page.getByRole('button', { name: 'Presentar' }).click()
  await expect(page.getByText('En la tele').first()).toBeVisible()
  await expect(tv.locator('[data-dark]')).toHaveCount(0)
  const screen = tv.locator('[data-screen]')
  await expect.poll(async () => (await viewOf(screen))?.scale ?? 0).toBeGreaterThan(0)
  await axe(page, 'la mesa')
  await page.screenshot({ path: '../out/capturas/escenas-mesa.png' })
  await tv.screenshot({ path: '../out/capturas/escenas-pantalla.png' })

  // Seguir: el máster se mueve y acerca; la tele va al mismo centro
  await table.focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('+')
  const master = centerOf(await viewOf(table))
  await expect
    .poll(async () => {
      const seen = centerOf(await viewOf(screen))
      return Math.hypot(seen.x - master.x, seen.y - master.y)
    })
    .toBeLessThan(2)

  // Fija: el marco de la tele, que se arrastra; la tele se queda en él aunque el máster se mueva
  // La mesa la cambia el servidor: se ve marcada cuando contesta
  await page.getByRole('radio', { name: 'Fija' }).click()
  await expect(page.getByRole('radio', { name: 'Fija' })).toBeChecked()
  const frame = page.getByRole('region', { name: 'Lo que se ve en la tele' })
  await expect(frame).toBeVisible()
  // Alejada la mesa, el marco se ve entero; se arrastra por su etiqueta
  await table.focus()
  await page.keyboard.press('-')
  await page.keyboard.press('-')
  const box = await frame.boundingBox()
  const tag = await frame.getByText('Tele').boundingBox()
  if (!box || !tag) throw new Error('sin marco')
  await page.mouse.move(tag.x + tag.width / 2, tag.y + tag.height / 2)
  await page.mouse.down()
  await page.mouse.move(tag.x + tag.width / 2 - 60, tag.y + tag.height / 2 - 40, { steps: 5 })
  await page.mouse.up()
  const moved = await viewOf(table)
  const frameCenter = {
    x: (box.x + box.width / 2 - 60 - ((await table.boundingBox())?.x ?? 0) - moved.x) / moved.scale,
    y: (box.y + box.height / 2 - 40 - ((await table.boundingBox())?.y ?? 0) - moved.y) / moved.scale
  }
  await expect
    .poll(async () => {
      const seen = centerOf(await viewOf(screen))
      return Math.hypot(seen.x - frameCenter.x, seen.y - frameCenter.y)
    })
    .toBeLessThan(3)
  const fixed = centerOf(await viewOf(screen))
  await table.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => centerOf(await viewOf(table)).x).not.toBeCloseTo(master.x, 0)
  expect(centerOf(await viewOf(screen))).toEqual(fixed)
  // Alejado, para ver el marco entero
  for (let i = 0; i < 3; i++) await page.keyboard.press('-')
  await page.getByRole('tab', { name: 'Escenas' }).click()
  await page.screenshot({ path: '../out/capturas/escenas-mesa-fija.png' })

  // Ocultar: la tele, a oscuras con el nombre de la campaña
  await page.getByRole('button', { name: 'Ocultar' }).click()
  await expect(tv.locator('[data-dark]')).toContainText('La Marca')
  await expect(page.getByText('Tele a oscuras')).toBeVisible()
  await axe(tv, 'la tele')
  await tv.screenshot({ path: '../out/capturas/escenas-pantalla-oculta.png' })
})

test('un mapa que dibuja la IA (SVG) se trocea al abrir su escena en la mesa', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Valdren')
  await createCampaign(page, 'La Marca')
  const call = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const worldId = (await call('listWorlds', {})).worlds[0].id
  const campaignId = (await call('listCampaigns', { worldId })).campaigns[0].id
  const pageId = (await call('createPage', { worldId, title: 'Torre del faro' })).id
  const tab = await call('createPageTab', { pageId, kind: 'scene' })
  const scene = await call('getScene', { tabId: tab.id })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <filter id="piedra"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3"/><feColorMatrix values="0 0 0 0 0.35 0 0 0 0 0.32 0 0 0 0 0.28 0 0 0 1 0"/></filter>
  <rect width="1400" height="900" filter="url(#piedra)"/>
  <circle cx="700" cy="450" r="300" fill="#6b5a44" stroke="#2a2018" stroke-width="12"/>
</svg>`
  const drawn = await call('drawScene', { sceneId: scene.id, svg, name: 'Faro' })
  expect(drawn.image).toMatchObject({ width: 1400, height: 900, tiles: null })
  await call('openScene', { campaignId, sceneId: scene.id })

  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa`)
  const table = page.getByRole('application', { name: 'Mesa: Escena' })
  await expect(table).toBeVisible()
  // Se prepara solo y queda con sus teselas
  await expect
    .poll(async () => (await call('getScene', { sceneId: scene.id })).image.tiles?.levels ?? 0, { timeout: 30_000 })
    .toBe(2)
  await expect(page.getByRole('status').filter({ hasText: 'Preparando el mapa…' })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Panel de la mesa' }).locator('img').first()).toBeVisible()
})
