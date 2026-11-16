import { expect, type Page, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

/** Lo que se descarga de Excalidraw (su código, que va con el editor o la vista de la pizarra, o sus fuentes) */
const isExcalidraw = (url: string) => /excalidraw|board-(editor|view)/i.test(url)

/** Arrastra con el ratón por la pizarra, de un punto a otro, en varios pasos */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2 + 30, { steps: 8 })
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

// El máster trabaja en un PC: con la pantalla de uno (a 1280, Excalidraw se pone en su modo de móvil)
test.use({ viewport: { width: 1600, height: 1000 } })

test('la pizarra: el máster pone tarjetas, una flecha y dibuja a mano; otra pestaña lo ve al momento; la jugadora, sin lo que no conoce (módulo 9)', async ({
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
      { key: 'r', title: 'El robo del relicario' },
      { key: 'd', title: 'Doran el Cojo' },
      { key: 'm', title: 'La Madre Ceniza' }
    ]
  })
  const id = (title: string) => created.pages.find((p: { title: string }) => p.title === title).id as string

  // Abrir una página sin pizarra no descarga nada de Excalidraw
  const downloaded: string[] = []
  page.on('request', (request) => {
    if (isExcalidraw(request.url())) downloaded.push(request.url())
  })
  await page.goto(`/mundos/${worldId}/wiki/${id('El robo del relicario')}`)
  await expect(page.getByRole('heading', { level: 1, name: 'El robo del relicario' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(downloaded).toEqual([])

  // «Pizarra», en el «+» de las pestañas
  await page.getByRole('button', { name: 'Pestaña nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await dialog.getByRole('radio', { name: 'Pizarra' }).check()
  await dialog.getByRole('button', { name: 'Crear' }).click()
  const board = page.getByRole('region', { name: 'Pizarra', exact: true })
  await expect(board.locator('.excalidraw')).toBeVisible()
  // Sus herramientas, en la tira de la página (la misma en todas las pestañas)
  await expect(page.getByRole('button', { name: 'Página…' })).toBeVisible()
  expect(downloaded.length).toBeGreaterThan(0)
  // Sus fuentes, de Crisol (no de su CDN)
  expect(downloaded.filter((url) => !url.startsWith(new URL(page.url()).origin))).toEqual([])

  // Dos tarjetas con «Página…»
  for (const title of ['Doran el Cojo', 'La Madre Ceniza']) {
    await page.getByRole('button', { name: 'Página…' }).click()
    const form = page.getByRole('form', { name: 'Poner una página' })
    await form.getByLabel('Página', { exact: true }).fill(title)
    await form.getByRole('button', { name: 'Poner' }).click()
    await expect(board.getByRole('link', { name: title, exact: true })).toBeVisible()
    // La segunda, a un lado: se arrastra la recién puesta (elegida) hacia la izquierda
    if (title === 'Doran el Cojo') {
      const card = await board.getByRole('link', { name: title, exact: true }).boundingBox()
      if (!card) throw new Error('sin tarjeta')
      await drag(page, { x: card.x - 6, y: card.y + 4 }, { x: card.x - 200, y: card.y - 60 })
    }
  }
  // La Madre Ceniza, oculta para los jugadores (va elegida al ponerla)
  await page.getByRole('button', { name: 'Oculto para los jugadores' }).click()
  await expect(page.getByRole('button', { name: 'Oculto para los jugadores' })).toHaveAttribute('aria-pressed', 'true')

  // Una flecha de Doran a la Madre y un trazo a mano
  const doran = await board.getByRole('link', { name: 'Doran el Cojo', exact: true }).boundingBox()
  const madre = await board.getByRole('link', { name: 'La Madre Ceniza', exact: true }).boundingBox()
  if (!doran || !madre) throw new Error('sin tarjetas')
  // Con nuestra píldora de abajo (la barra de formas de Excalidraw va escondida en el mundo)
  const tools = page.getByRole('toolbar', { name: 'Herramientas de la pizarra' })
  await expect(board.locator('.shapes-section')).toBeHidden()
  await tools.getByRole('button', { name: 'Flecha', exact: true }).click()
  await expect(tools.getByRole('button', { name: 'Flecha', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // Desde el borde de la Madre Ceniza hacia la derecha (a la izquierda, Excalidraw abre su panel): queda atada a ella
  const edge = { x: madre.x + madre.width + 4, y: madre.y + madre.height / 2 }
  await drag(page, edge, { x: edge.x + 180, y: edge.y + 90 })
  await tools.getByRole('button', { name: 'Dibujar', exact: true }).click()
  await drag(page, { x: madre.x, y: madre.y + 150 }, { x: madre.x + 220, y: madre.y + 190 })
  await tools.getByRole('button', { name: 'Elegir', exact: true }).click()
  await page.screenshot({ path: test.info().outputPath('0-dibujado.png') })

  // Se guarda solo: lo tiene el servidor
  const tabs = await api('listPageTabs', { pageId: id('El robo del relicario') })
  const tab = tabs.tabs.find((t: { kind: string }) => t.kind === 'board')
  await expect
    .poll(async () => {
      const { elements } = await api('getBoard', { tabId: tab.id })
      return elements.map((e: { type: string }) => e.type).sort()
    })
    .toEqual(['arrow', 'embeddable', 'embeddable', 'freedraw'])
  // Y como quedó, no como empezó: Excalidraw cambia en el sitio lo que se arrastra o se dibuja (la tarjeta movida a
  // un lado y el trazo entero)
  type Stored = { type: string; x: number; points?: unknown[]; customData?: { pageId?: string } }
  await expect
    .poll(async () => {
      const { elements } = (await api('getBoard', { tabId: tab.id })) as { elements: Stored[] }
      const card = (title: string) => elements.find((e) => e.customData?.pageId === id(title))
      return {
        moved: (card('Doran el Cojo')?.x ?? 0) < (card('La Madre Ceniza')?.x ?? 0) - 100,
        stroke: (elements.find((e) => e.type === 'freedraw')?.points?.length ?? 0) > 8
      }
    })
    .toEqual({ moved: true, stroke: true })
  // Al salir y volver se ve igual: lo mismo y donde estaba (el encuadre y el zoom de antes)
  const before = await board.getByRole('link', { name: 'Doran el Cojo', exact: true }).boundingBox()
  await page.getByRole('tree', { name: 'Páginas' }).getByRole('treeitem', { name: 'Doran el Cojo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Doran el Cojo' })).toBeVisible()
  await page.goBack()
  await expect(board.getByRole('link', { name: 'La Madre Ceniza', exact: true })).toBeVisible()
  await expect
    .poll(async () => {
      const after = await board.getByRole('link', { name: 'Doran el Cojo', exact: true }).boundingBox()
      return after && before ? Math.round(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)) : -1
    })
    .toBeLessThan(3)
  // Lo nuevo, con trazo limpio y sin letra a mano
  const { elements: drawn } = (await api('getBoard', { tabId: tab.id })) as { elements: { roughness?: number }[] }
  expect(drawn.find((e) => 'roughness' in e && e.roughness !== 0)).toBeUndefined()

  // Otra pestaña del máster la ve igual y, al momento, lo que se añade
  const other = await page.context().newPage()
  await other.goto(`/mundos/${worldId}/wiki/${id('El robo del relicario')}?pestana=${tab.id}`)
  const otherBoard = other.getByRole('region', { name: 'Pizarra', exact: true })
  await expect(otherBoard.getByRole('link', { name: 'Doran el Cojo', exact: true })).toBeVisible()
  await expect(otherBoard.getByRole('link', { name: 'La Madre Ceniza', exact: true })).toBeVisible()
  // Lo que pone la IA (por el MCP) llega a las dos al momento
  await api('changeBoard', {
    tabId: tab.id,
    add: [
      { pageId: id('El robo del relicario'), column: 0, row: 3 },
      { text: 'le debe dinero', column: 1, row: 3 }
    ]
  })
  // Excalidraw solo pinta las tarjetas a la vista: se encuadra todo (Mayús+1), sin recargar
  for (const each of [otherBoard, board]) {
    const area = await each.locator('canvas.excalidraw__canvas.interactive').boundingBox()
    if (!area) throw new Error('sin lienzo')
    await each.page().mouse.click(area.x + area.width - 40, area.y + area.height - 120)
    await each.page().keyboard.press('Shift+1')
    await expect(each.getByRole('link', { name: 'El robo del relicario', exact: true })).toBeVisible()
  }
  await page.screenshot({ path: test.info().outputPath('1-pizarra.png') })

  // La jugadora: con la pestaña revelada, en solo lectura, sin la tarjeta oculta ni la flecha que iba a ella
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id('El robo del relicario'), known: true })
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id('Doran el Cojo'), known: true })
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('El robo del relicario')}?pestana=${tab.id}`)
  const hers = ana.getByRole('region', { name: 'Pizarra', exact: true })
  await expect(hers.getByRole('link', { name: 'Doran el Cojo', exact: true })).toBeVisible()
  await expect(hers.getByText('La Madre Ceniza')).toHaveCount(0)
  await expect(ana.getByRole('button', { name: 'Página…' })).toHaveCount(0)
  const { elements } = await (
    await ana.request.post('/api/actions/getBoard', { data: { tabId: tab.id, campaignId } })
  ).json()
  type Seen = {
    id: string
    type: string
    startBinding?: { elementId: string } | null
    endBinding?: { elementId: string } | null
  }
  const seen = elements as Seen[]
  expect(
    seen
      .filter((e) => e.type !== 'arrow')
      .map((e) => e.type)
      .sort()
  ).toEqual(['embeddable', 'embeddable', 'freedraw', 'text'])
  // Nada de lo que le llega apunta a algo que no ve (una flecha atada a la tarjeta oculta no le llega)
  const ids = new Set(seen.map((e) => e.id))
  for (const arrow of seen.filter((e) => e.type === 'arrow')) {
    for (const end of [arrow.startBinding?.elementId, arrow.endBinding?.elementId])
      if (end) expect(ids.has(end)).toBe(true)
  }
  expect(JSON.stringify(elements)).not.toContain('Madre')
  await ana.screenshot({ path: test.info().outputPath('2-jugadora.png') })
})
