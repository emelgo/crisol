import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

/**
 * La página del mundo, como la de Everlore (Enrique, 2026-11-16): toda la columna se desplaza; al bajar, el título y las
 * pestañas se quedan arriba en una barra pequeña; el panel se pliega desde la cabecera de la página; el mapa y la
 * pizarra van a sangre, con sus herramientas en una píldora pegada abajo de lo que se ve
 */

// El máster trabaja en un PC (a 1280, Excalidraw se pone en su modo de móvil)
test.use({ viewport: { width: 1600, height: 1000 } })

const MAP = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#3a5463"/><circle cx="800" cy="500" r="300" fill="#d8c7a0"/></svg>`
)

async function setUp(page: Page) {
  await freshOwner(page)
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const world = await api('createWorld', { name: 'Eana' })
  const long = Array.from({ length: 40 }, (_, i) => `Párrafo ${i + 1} de lo que pasó la noche del eclipse.`).join(
    '\n\n'
  )
  const created = await api('createPages', {
    worldId: world.id,
    parentId: null,
    pages: [{ key: 'r', title: 'El robo del relicario', markdown: `## El encargo\n\n${long}` }]
  })
  const pageId = created.pages[0].id as string
  const uploaded = await page.request.post(`/api/files?worldId=${world.id}&name=Valdren.svg`, {
    data: MAP,
    headers: { 'content-type': 'application/octet-stream' }
  })
  const file = await uploaded.json()
  const map = await api('createPageTab', { pageId, kind: 'map', name: 'Mapa' })
  const view = await api('getMap', { tabId: map.id })
  await api('updateMap', { mapId: view.id, image: { fileId: file.id, width: 1600, height: 1000 } })
  await api('updateMap', { mapId: view.id, scale: { length: 100, value: 2, unit: 'millas' } })
  const board = await api('createPageTab', { pageId, kind: 'board', name: 'Pizarra' })
  return { url: `/mundos/${world.id}/wiki/${pageId}`, mapId: map.id as string, boardId: board.id as string }
}

/** Baja la columna del centro hasta el final (o lo que se diga) */
const scrollColumn = (page: Page, to?: number) =>
  page.locator('[data-page-scroll]').evaluate((el, y) => el.scrollTo(0, y ?? el.scrollHeight), to)

test('el texto: al bajar, el título y las pestañas se quedan arriba en pequeño; el panel se pliega desde la cabecera', async ({
  page
}) => {
  const { url } = await setUp(page)
  await page.goto(url)
  const title = page.getByRole('heading', { level: 1, name: 'El robo del relicario' })
  await expect(title).toBeVisible()
  const head = page.locator('header').filter({ has: title })
  await expect(head).not.toHaveAttribute('data-compact')
  // Arriba la portada (sin ella, su hueco) y debajo el título: la portada empieza arriba de la columna
  const column = await page.locator('[data-page-scroll]').boundingBox()
  const titleBox = await title.boundingBox()
  expect((titleBox?.y ?? 0) - (column?.y ?? 0)).toBeGreaterThan(150)

  // Al bajar: pegada arriba, encogida, con las pestañas dentro
  await scrollColumn(page, 900)
  await expect(head).toHaveAttribute('data-compact')
  // (al pegarse, entra con un desliz corto)
  await expect.poll(async () => Math.round((await head.boundingBox())?.y ?? -1)).toBe(Math.round(column?.y ?? 0))
  expect((await head.boundingBox())?.height ?? 0).toBeLessThan(60)
  await expect(head.getByRole('navigation', { name: 'Pestañas de la página' })).toBeVisible()
  // Desde la barra pequeña se cambia de pestaña
  await head.getByRole('link', { name: 'Mapa' }).click()
  await expect(page.getByRole('application', { name: 'Mapa', exact: true })).toBeVisible()
  await page.goto(url)
  await expect(title).toBeVisible()

  // El panel: su botón, en la cabecera; se desliza fuera y el centro se ensancha
  const panel = page.getByRole('complementary', { name: 'Panel de la página' })
  await expect(panel).toBeVisible()
  const before = (await page.locator('[data-page-scroll]').boundingBox())?.width ?? 0
  await head.getByRole('button', { name: 'Plegar el panel' }).click()
  await expect(panel).toBeHidden()
  await expect
    .poll(async () => (await page.locator('[data-page-scroll]').boundingBox())?.width ?? 0)
    .toBeGreaterThan(before + 250)
  // Se recuerda
  await page.reload()
  await expect(page.getByRole('button', { name: 'Desplegar el panel' })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Desplegar el panel' }).click()
  await expect(panel).toBeVisible()
})

test('el mapa a sangre: al bajar del todo ocupa todo lo de debajo de la barra; sus herramientas, abajo de lo que se ve', async ({
  page
}) => {
  const { url, mapId } = await setUp(page)
  await page.goto(`${url}?pestana=${mapId}`)
  const viewer = page.getByRole('application', { name: 'Mapa', exact: true })
  await expect(viewer).toBeVisible()
  const tools = page.getByRole('toolbar', { name: 'Herramientas del mapa' })
  const zoom = page.getByRole('toolbar', { name: 'Acercar y alejar el mapa' })
  // Sin haber bajado, el mapa sigue más abajo, pero sus herramientas se ven, pegadas abajo
  const height = page.viewportSize()?.height ?? 0
  const pill = await tools.boundingBox()
  expect((pill?.y ?? 0) + (pill?.height ?? 0)).toBeGreaterThan(height - 40)
  expect((pill?.y ?? 0) + (pill?.height ?? 0)).toBeLessThanOrEqual(height)
  await expect(zoom.getByRole('button', { name: 'Acercar' })).toBeVisible()
  await expect(page.getByText('2 millas')).toBeVisible()

  // Al bajar del todo: del borde de la barra pegada al final de la ventana, de lado a lado de la columna
  await scrollColumn(page)
  const head = page.locator('header[data-compact]')
  await expect(head).toBeVisible()
  const column = await page.locator('[data-page-scroll]').boundingBox()
  await expect.poll(async () => Math.round((await head.boundingBox())?.y ?? -1)).toBe(Math.round(column?.y ?? 0))
  const stuck = await head.boundingBox()
  await expect
    .poll(async () => {
      const box = await viewer.boundingBox()
      return [Math.round(box?.y ?? 0), Math.round((box?.y ?? 0) + (box?.height ?? 0)), Math.round(box?.width ?? 0)]
    })
    .toEqual([
      Math.round((stuck?.y ?? 0) + (stuck?.height ?? 0)),
      Math.round((column?.y ?? 0) + (column?.height ?? 0)),
      Math.round(column?.width ?? 0)
    ])
  // Sin fondo propio
  expect(await viewer.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // Las herramientas siguen funcionando: una herramienta elegida, marcada
  await tools.getByRole('button', { name: 'Medir' }).click()
  await expect(tools.getByRole('button', { name: 'Medir' })).toHaveAttribute('aria-pressed', 'true')
})

test('la pizarra: transparente, a sangre y con nuestra píldora; elegir, dibujar, deshacer y el zoom; sin «Ampliar»', async ({
  page
}) => {
  const { url, boardId } = await setUp(page)
  await page.goto(`${url}?pestana=${boardId}`)
  const board = page.getByRole('region', { name: 'Pizarra', exact: true })
  await expect(board.locator('.excalidraw')).toBeVisible()
  // Sin «Ampliar» en el mundo; su barra de formas, su menú y su pie, escondidos
  await expect(page.getByRole('button', { name: 'Ampliar la pizarra' })).toHaveCount(0)
  await expect(board.locator('.shapes-section')).toBeHidden()
  await expect(board.locator('.main-menu-trigger')).toBeHidden()
  const pill = page.getByRole('toolbar', { name: 'Herramientas de la pizarra' })
  for (const name of ['Elegir', 'Mover el lienzo', 'Rectángulo', 'Rombo', 'Elipse', 'Flecha', 'Línea', 'Dibujar']) {
    await expect(pill.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(pill.getByRole('button', { name: 'Elegir' })).toHaveAttribute('aria-pressed', 'true')
  await expect(pill.getByRole('button', { name: 'Rectángulo' })).toHaveAttribute('title', 'Rectángulo (R)')

  // Al bajar del todo, a sangre hasta el final de la ventana; la píldora, abajo
  await scrollColumn(page)
  const column = await page.locator('[data-page-scroll]').boundingBox()
  await expect
    .poll(async () => {
      const box = await board.boundingBox()
      return Math.round((box?.y ?? 0) + (box?.height ?? 0))
    })
    .toBe(Math.round((column?.y ?? 0) + (column?.height ?? 0)))
  expect(await board.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

  // Un rectángulo con la píldora; deshacer lo quita
  await pill.getByRole('button', { name: 'Rectángulo' }).click()
  await expect(pill.getByRole('button', { name: 'Rectángulo' })).toHaveAttribute('aria-pressed', 'true')
  const box = await board.boundingBox()
  if (!box) throw new Error('sin pizarra')
  await page.mouse.move(box.x + 300, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 300, { steps: 6 })
  await page.mouse.up()
  // Tras dibujar, vuelve a «Elegir» (lo de Excalidraw), con lo dibujado elegido: su panel de propiedades
  await expect(pill.getByRole('button', { name: 'Elegir' })).toHaveAttribute('aria-pressed', 'true')
  await expect(board.locator('.App-menu__left')).toBeVisible()
  const count = () =>
    page.request
      .post('/api/actions/describeBoard', { data: { tabId: boardId } })
      .then(async (response) => (await response.json()).shapes.length as number)
  await expect.poll(count).toBe(1)
  await page.getByRole('toolbar', { name: 'Deshacer y rehacer' }).getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(count).toBe(0)
  await page.getByRole('toolbar', { name: 'Deshacer y rehacer' }).getByRole('button', { name: 'Rehacer' }).click()
  await expect.poll(count).toBe(1)

  // El zoom: acercar y volver al 100 %
  const zoom = page.getByRole('toolbar', { name: 'Acercar y alejar la pizarra' })
  await zoom.getByRole('button', { name: 'Acercar' }).click()
  await expect(zoom.getByRole('button', { name: 'Volver al 100 %' })).toHaveText('125 %')
  await zoom.getByRole('button', { name: 'Volver al 100 %' }).click()
  await expect(zoom.getByRole('button', { name: 'Volver al 100 %' })).toHaveText('100 %')
})
