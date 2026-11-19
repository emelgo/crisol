import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer, settled } from './ayudas.ts'

/** Un mapa sencillo: el mar, una isla grande y un islote */
const MAP = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#3a5463"/>
  <path d="M200 160 C420 90 700 120 900 110 C1150 100 1350 160 1420 300 C1460 480 1400 700 1250 800 C1050 900 800 880 600 900 C380 910 230 820 170 650 C110 480 120 280 200 160Z" fill="#d8c7a0" stroke="#5a4630" stroke-width="4"/>
  <path d="M1280 860 C1330 840 1390 850 1400 880 C1405 920 1340 940 1300 925 C1270 910 1262 880 1280 860Z" fill="#d8c7a0" stroke="#5a4630" stroke-width="3"/>
</svg>`
)

test('los mapas con capas: el máster dibuja una región y una ruta, ordena capas y oculta una; la jugadora ve solo lo suyo (módulo 9)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const created = await api('createPages', {
    worldId,
    parentId: null,
    pages: [
      { key: 'v', title: 'Valdren' },
      { key: 'r', title: 'Reino de Varn' }
    ]
  })
  const id = (title: string) => created.pages.find((p: { title: string }) => p.title === title).id as string
  const uploaded = await page.request.post(`/api/files?worldId=${worldId}&name=Valdren.svg`, {
    data: MAP,
    headers: { 'content-type': 'application/octet-stream' }
  })
  const file = await uploaded.json()
  const tab = await api('createPageTab', { pageId: id('Valdren'), kind: 'map', name: 'Mapa' })
  const map = await api('getMap', { tabId: tab.id })
  await api('updateMap', { mapId: map.id, image: { fileId: file.id, width: 1600, height: 1000 } })
  // 100 px de la imagen son 25 km
  await api('updateMap', { mapId: map.id, scale: { length: 100, value: 25, unit: 'km' } })
  // Lo que traería la IA: la capa «Política» con dos reinos, y «Secretos», solo del máster
  const politica = await api('createMapLayer', { mapId: map.id, name: 'Política' })
  const secretos = await api('createMapLayer', { mapId: map.id, name: 'Secretos', hidden: true })
  await api('createMapElement', {
    mapId: map.id,
    layerId: politica.id,
    kind: 'region',
    pageId: id('Reino de Varn'),
    style: { color: 'wine', opacity: 0.25 },
    geometry: {
      pieces: [
        [
          [0.15, 0.2],
          [0.45, 0.15],
          [0.5, 0.55],
          [0.35, 0.8],
          [0.15, 0.65]
        ]
      ]
    }
  })
  await api('createMapElement', {
    mapId: map.id,
    layerId: politica.id,
    kind: 'region',
    label: 'Marca Verde',
    style: { color: 'moss', fill: 'hatch', stroke: 'dashed' },
    geometry: {
      pieces: [
        [
          [0.45, 0.15],
          [0.85, 0.2],
          [0.85, 0.7],
          [0.5, 0.55]
        ]
      ]
    }
  })
  await api('createMapElement', {
    mapId: map.id,
    layerId: secretos.id,
    kind: 'region',
    label: 'Guarida de la Madre Ceniza',
    style: { color: 'plum', fill: 'hatch' },
    geometry: {
      pieces: [
        [
          [0.6, 0.25],
          [0.7, 0.25],
          [0.7, 0.35],
          [0.6, 0.35]
        ]
      ]
    }
  })
  await api('createMapElement', {
    mapId: map.id,
    layerId: politica.id,
    kind: 'label',
    label: 'Mar de Ceniza',
    style: { color: 'sea', size: 28 },
    geometry: { at: [0.5, 0.95], arc: 0.2 }
  })
  await api('createMapElement', {
    mapId: map.id,
    layerId: politica.id,
    kind: 'region',
    label: 'Tierras sin señor',
    hidden: true,
    style: { color: 'ochre', fill: 'hatch' },
    geometry: {
      pieces: [
        [
          [0.35, 0.8],
          [0.5, 0.55],
          [0.85, 0.7],
          [0.6, 0.85]
        ]
      ]
    }
  })
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id('Valdren'), known: true })

  // El máster: lo dibujado, sobre la imagen; las capas, de arriba abajo
  await page.goto(`/mundos/${worldId}/wiki/${id('Valdren')}?pestana=${tab.id}`)
  const viewer = page.getByRole('application', { name: 'Mapa', exact: true })
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('[data-kind="region"]')).toHaveCount(4)
  await page.getByRole('toolbar', { name: 'Herramientas del mapa' }).getByRole('button', { name: 'Capas' }).click()
  const layers = page.getByRole('region', { name: 'Capas' })
  await expect(layers.getByRole('button', { name: /^Renombrar/ })).toHaveText(['Secretos', 'Política'])
  await expect(layers.getByText('Solo del máster')).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-capas.png') })

  // Ampliado, para dibujar con sitio; una ruta con el ratón: tres puntos e Intro (va a «Política», no a la del máster)
  await page.getByRole('button', { name: 'Ampliar el mapa' }).click()
  await page.waitForTimeout(300)
  const box = await viewer.boundingBox()
  if (!box) throw new Error('sin visor')
  await page.getByRole('toolbar', { name: 'Herramientas del mapa' }).getByRole('button', { name: 'Ruta' }).click()
  for (const [x, y] of [
    [0.3, 0.45],
    [0.45, 0.6],
    [0.7, 0.62]
  ] as const) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
  }
  await page.keyboard.press('Enter')
  const routePanel = page.getByRole('region', { name: 'Ruta' })
  await expect(routePanel).toBeVisible()
  await routePanel.getByLabel('Nombre').fill('Camino real')
  await routePanel.getByLabel('Nombre').press('Enter')
  await routePanel.getByText('Aspecto').click()
  await routePanel.getByText('Discontinuo').click()
  await expect.poll(async () => (await api('getMap', { tabId: tab.id })).elements.length).toBe(6)
  const route = (await api('getMap', { tabId: tab.id })).elements.find((e: { kind: string }) => e.kind === 'path')
  expect(route).toMatchObject({ label: 'Camino real', layerId: politica.id, style: { stroke: 'dashed' } })
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('2-ruta.png') })

  // Elegir la Marca Verde: sus tiradores y su panel
  await routePanel.getByRole('button', { name: 'Cerrar' }).click()
  await viewer.locator('[data-kind="region"]').nth(1).click({ force: true })
  await expect(page.getByRole('region', { name: 'Región' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Arrastra para moverlo/ })).toHaveCount(4)
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('3-region.png') })

  // Escape suelta lo elegido y, después, vuelve el mapa a la página
  await viewer.focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Región' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Ampliar el mapa' })).toBeVisible()

  // Dar a conocer a la campaña lo oculto (las Tierras sin señor), con el ojo de su panel (como el del árbol). Desde la
  // Mesa (en las páginas del mundo no se revela): en la ventana de la página, su pestaña del mapa
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa?pagina=${id('Valdren')}`)
  const win = page.getByRole('dialog', { name: 'Valdren' })
  await win.getByRole('navigation', { name: 'Pestañas de la página' }).getByRole('link', { name: 'Mapa' }).click()
  const inWindow = win.getByRole('application', { name: 'Mapa', exact: true })
  await inWindow.locator('[data-kind="region"][data-hidden]').first().click({ force: true })
  const hiddenPanel = win.getByRole('region', { name: 'Región' })
  await expect(hiddenPanel.getByLabel('Nombre')).toHaveValue('Tierras sin señor')
  await hiddenPanel.getByRole('button', { name: /: No la conoce/ }).click()
  await expect(hiddenPanel.getByRole('button', { name: /: La conoce/ })).toBeVisible()

  // La jugadora: sin «Secretos»; el reino lleva a una página que no conoce, sin nombre
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Valdren')}`)
  await ana.getByRole('group', { name: 'Pestañas de la página' }).getByRole('button', { name: 'Mapa' }).click()
  const seen = ana.getByRole('application', { name: 'Mapa', exact: true })
  await expect(seen.locator('[data-kind="region"]')).toHaveCount(3)
  await expect(seen).not.toContainText('Guarida')
  await expect(seen).not.toContainText('Reino de Varn')
  await expect(seen).toContainText('Marca Verde')
  await expect(seen).toContainText('Tierras sin señor')
  await ana.getByRole('toolbar', { name: 'Herramientas del mapa' }).getByRole('button', { name: 'Capas' }).click()
  await expect(ana.getByRole('region', { name: 'Capas' }).getByText('Política')).toBeVisible()
  await expect(ana.getByRole('region', { name: 'Capas' }).getByText('Secretos')).toHaveCount(0)
  await expect(
    ana.getByRole('toolbar', { name: 'Herramientas del mapa' }).getByRole('button', { name: 'Ruta' })
  ).toHaveCount(0)
  // Mide de un sitio a otro: la distancia y los días
  await ana.getByRole('toolbar', { name: 'Herramientas del mapa' }).getByRole('button', { name: 'Medir' }).click()
  const seenBox = await seen.boundingBox()
  if (!seenBox) throw new Error('sin visor')
  await ana.mouse.click(seenBox.x + seenBox.width * 0.3, seenBox.y + seenBox.height * 0.5)
  await ana.mouse.click(seenBox.x + seenBox.width * 0.7, seenBox.y + seenBox.height * 0.5)
  const ruler = ana.getByRole('region', { name: 'Medir' })
  await expect(ruler).toContainText('En línea recta')
  await expect(ruler).toContainText('km')
  await expect(ruler).toContainText('A pie')
  await expect(ruler).toContainText(/\d+ días?|Menos de 1 día/)
  await settled(ana)
  await ana.screenshot({ path: test.info().outputPath('4-jugadora.png') })
  // En el móvil: el mapa y medir, abajo y a lo ancho
  await ana.setViewportSize({ width: 390, height: 844 })
  await expect(ruler).toBeVisible()
  await settled(ana)
  await ana.screenshot({ path: test.info().outputPath('5-movil.png') })
})
