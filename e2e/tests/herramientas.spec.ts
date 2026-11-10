import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { freshOwner, import5e, watchNetwork } from './ayudas.ts'

/**
 * Las herramientas de la mesa (docs/specs/herramientas-mesa.md) con la cripta de Varn del lienzo «Crisol: la mesa» y
 * las fichas del tablero Mesa: medir un cono desde Lía, dejarlo como plantilla, elegir las de dentro (Goblin 2 y
 * Goblin 3) y dañarlas; un reloj de progreso que se ve en la tele; guardar una instantánea, mover una ficha y volver a
 * ella; el láser que llega a la tele. Deja las capturas en out/capturas/herramientas-*.png, en oscuro y a 1440 × 900,
 * como el tablero Herramientas
 */
const CRIPTA = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'), 'utf8')
const SIZE = { width: 1440, height: 900 }
/** Del tablero (en % del mapa) a píxeles de la cripta, de 3000 × 2000 */
const at = (x: number, y: number) => ({ x: Math.round((x / 100) * 3000), y: Math.round((y / 100) * 2000) })

test.use({ viewport: SIZE, colorScheme: 'dark', actionTimeout: 20_000 })

type Point = { x: number; y: number }

/** Un punto del mapa en la página, con la vista que deja el lienzo en su atributo */
async function onMap(stage: Locator, p: Point) {
  const view = JSON.parse((await stage.getAttribute('data-view')) ?? '{}') as { x: number; y: number; scale: number }
  const box = await stage.boundingBox()
  if (!box) throw new Error('sin mesa')
  return { x: box.x + view.x + p.x * view.scale, y: box.y + view.y + p.y * view.scale }
}

async function axe(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${what}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
}

test('las herramientas: medir y dejar un cono, dañar a las de dentro, un reloj en la tele, una instantánea y el láser', async ({
  page
}) => {
  test.setTimeout(300_000)
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
  await call('editPage', {
    pageId,
    body: {
      mode: 'replace',
      markdown:
        '- Bajo el altar, la llave de la cueva (Investigación CD 15).\n- Si suena el gong, el acechador llega en dos asaltos.\n- La puerta secreta del sur se abre empujando la losa con la runa.'
    }
  })
  const tab = await call('createPageTab', { pageId, kind: 'scene', name: 'Cripta de Varn' })
  const sceneId = (await call('getScene', { tabId: tab.id })).id
  await call('drawScene', { sceneId, svg: CRIPTA, name: 'Cripta de Varn' })
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
  await call('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 3000, height: 2000 })
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [
      { characterId: characters.Lía, ...at(51.7, 44) },
      { characterId: characters.Bram, ...at(48.3, 47.5) },
      { characterId: characters.Sela, ...at(43.3, 52.5) }
    ]
  })
  const goblins = (
    await call('placeTokens', {
      campaignId,
      sceneId,
      tokens: [{ content: { key: 'guerrero_goblin_2014', count: 3 }, ...at(61.7, 24) }]
    })
  ).tokens as Array<{ id: string; actor: { id: string } }>
  const spots = [at(61.7, 24), at(65, 47.5), at(58.3, 52.5)]
  await call('moveTokens', { campaignId, moves: spots.map((p, i) => ({ tokenId: goblins[i]?.id ?? '', ...p })) })
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [{ content: { key: 'jefe_goblin_2024', unique: true }, ...at(68.3, 37.5) }]
  })
  // La nube de niebla del tablero (un círculo azul de 10 pies) y los widgets de la cripta
  await call('changeMarks', {
    campaignId,
    add: [
      {
        kind: 'template',
        shape: 'circle',
        a: at(63.3, 21),
        b: { x: at(63.3, 21).x + 200, y: at(63.3, 21).y },
        color: '#8ab4f8'
      }
    ]
  })
  await call('createWidget', { campaignId, kind: 'counter', label: 'Antorchas', value: 3, min: 0 })
  await call('createWidget', {
    campaignId,
    kind: 'timer',
    label: 'Hasta que cierre el portal',
    duration: 150,
    shown: false
  })
  await call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view: { x: 1800, y: 800, scale: 0.933 } } })

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
  const tvHost = tv.locator('[data-screen]')
  await expect(tv.getByRole('list', { name: 'Lo que hay en la mesa' }).getByRole('listitem')).toHaveCount(7)
  const settled = () => net.quiet()
  const tools = page.getByRole('toolbar', { name: 'Herramientas de la mesa' })

  // Medir: un camino con un punto de paso, de Sela a Goblin 2, que la tele ve
  await tools.getByRole('button', { name: 'Medir' }).click()
  const plantillas = page.getByRole('complementary', { name: 'Plantillas' })
  await plantillas.getByRole('switch', { name: 'Los jugadores ven lo que mides' }).click()
  await expect(plantillas.getByRole('switch', { name: 'Los jugadores ven lo que mides' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  const sela = await onMap(stage, at(43.3, 52.5))
  const step = await onMap(stage, { x: 1750, y: 1150 })
  const g2 = await onMap(stage, at(65, 47.5))
  await page.mouse.click(sela.x, sela.y)
  await page.mouse.move(step.x, step.y, { steps: 4 })
  await page.mouse.click(step.x, step.y)
  await page.mouse.move(g2.x, g2.y, { steps: 4 })
  await expect.poll(() => tvHost.getAttribute('data-measure')).toMatch(/pies · .* pies · .* pies/)
  await page.mouse.move(g2.x + 1, g2.y)
  await settled()
  await axe(page, 'medir')
  await page.screenshot({ path: '../out/capturas/herramientas-medir.png' })
  await tvNet.quiet()
  await tv.screenshot({ path: '../out/capturas/herramientas-tele-medida.png' })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect.poll(() => tvHost.getAttribute('data-measure')).toBe('')

  // El láser: su estela llega a la tele (la mesa, delante, como la tiene el máster)
  await page.bringToFront()
  await tools.getByRole('button', { name: 'Láser' }).click()
  const from = await onMap(stage, { x: 1500, y: 700 })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // La estela dura un momento: se sigue moviendo mientras se mira la tele
  let dx = 0
  await expect
    .poll(
      async () => {
        dx = (dx + 37) % 240
        await page.mouse.move(from.x + dx, from.y + dx / 4)
        return Number(await tvHost.getAttribute('data-laser'))
      },
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0)
  await page.mouse.up()

  await tools.getByRole('button', { name: 'Medir' }).click()

  // Un cono de 30 pies desde Lía hacia los goblins: lo deja como plantilla y elige las de dentro
  await page.getByRole('toolbar', { name: 'Medir' }).getByRole('radio', { name: 'Cono' }).check()
  const lia = await onMap(stage, { x: 1550, y: 900 })
  const end = await onMap(stage, { x: 2100, y: 1100 })
  await page.mouse.move(lia.x, lia.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('toolbar', { name: 'Medir' }).getByRole('button', { name: 'Dejar como plantilla' }).click()
  const cone = plantillas.getByRole('region', { name: 'Cono de 30 pies' })
  await expect(cone.getByText('Dentro: 2 fichas')).toBeVisible()
  await expect(cone.getByText('G2, G3')).toBeVisible()
  await settled()
  await page.screenshot({ path: '../out/capturas/herramientas-plantilla.png' })
  await cone.getByRole('button', { name: 'Elegirlas' }).click()
  const damage = page.getByRole('region', { name: 'Daño a varias' })
  await expect(damage.getByText('Dentro de la plantilla: 2')).toBeVisible()
  await damage.getByLabel('Cuánto').fill('3')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await axe(page, 'la plantilla y sus fichas de dentro')
  await page.screenshot({ path: '../out/capturas/herramientas-plantilla-dano.png' })
  type Life = { id: string; actor: { life: { value: number; max: number } | null } }
  const lives = async () =>
    ((await call('getCampaignTable', { campaignId })).tokens as Life[])
      .filter((token) => goblins.slice(1).some((goblin) => goblin.id === token.id))
      .map((token) => (token.actor.life ? token.actor.life.max - token.actor.life.value : null))
  await damage.getByRole('button', { name: 'Aplicar' }).click()
  await expect.poll(lives).toEqual([3, 3])
  await damage.getByRole('button', { name: 'Cerrar el daño a varias' }).click()

  // Dibujar: un trazo a mano alrededor del altar, un texto y unos sellos
  await tools.getByRole('button', { name: 'Dibujar' }).click()
  const altar = { x: 1800, y: 690 }
  const ring = Array.from({ length: 25 }, (_, i) => ({
    x: altar.x + 135 * Math.cos((i / 24) * Math.PI * 2),
    y: altar.y + 115 * Math.sin((i / 24) * Math.PI * 2)
  }))
  const first = await onMap(stage, ring[0] as Point)
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (const p of ring.slice(1)) {
    const screen = await onMap(stage, p)
    await page.mouse.move(screen.x, screen.y, { steps: 2 })
  }
  await page.mouse.up()
  await call('changeMarks', {
    campaignId,
    add: [
      {
        kind: 'drawing',
        tool: 'pen',
        points: [
          { x: 1000, y: 1300 },
          { x: 1200, y: 1180 },
          { x: 1400, y: 1150 }
        ],
        color: '#ff6b5b',
        width: 8,
        opacity: 1
      },
      {
        kind: 'drawing',
        tool: 'line',
        points: [
          { x: 1350, y: 1110 },
          { x: 1405, y: 1150 },
          { x: 1340, y: 1190 }
        ],
        color: '#ff6b5b',
        width: 8,
        opacity: 1
      },
      { kind: 'text', x: 1080, y: 1350, text: '¡Ojo con el suelo!', color: '#ff6b5b', size: 50 },
      { kind: 'stamp', x: 1800, y: 1300, icon: 'skull', size: 70, color: '#f3e7c9' },
      { kind: 'stamp', x: 750, y: 840, icon: 'package', size: 70, color: '#f3e7c9' },
      { kind: 'stamp', x: 1200, y: 1050, icon: 'triangle-alert', size: 70, color: '#f3e7c9', hidden: true }
    ]
  })
  await expect(page.getByRole('complementary', { name: 'Dibujos' }).getByText('3 trazos')).toBeVisible()
  await tools.getByRole('button', { name: 'Sellos' }).click()
  await page
    .getByRole('toolbar', { name: 'Sellos' })
    .getByRole('button', { name: /Sellos/ })
    .click()
  await settled()
  await axe(page, 'dibujar')
  await page.screenshot({ path: '../out/capturas/herramientas-dibujar.png' })
  await page
    .getByRole('toolbar', { name: 'Sellos' })
    .getByRole('button', { name: /Sellos/ })
    .click()

  // Un reloj de progreso: se crea, se nombra y se llena hasta 4 de 6; la tele lo ve
  await tools.getByRole('button', { name: 'Contadores' }).click()
  const widgets = page.getByRole('complementary', { name: 'Contadores' })
  await widgets.getByRole('button', { name: 'Reloj' }).click()
  const name = widgets.getByRole('region', { name: 'Reloj' }).getByLabel('Nombre')
  await name.fill('La cripta despierta')
  await name.press('Enter')
  const clock = page.getByRole('article', { name: 'La cripta despierta' })
  // Con el teclado, cada Intro llena un segmento
  const face = clock.getByRole('button', { name: /^La cripta despierta: \d de 6$/ })
  await expect(face).toHaveAccessibleName('La cripta despierta: 0 de 6')
  for (let n = 1; n <= 4; n++) {
    await face.press('Enter')
    await expect(face).toHaveAccessibleName(`La cripta despierta: ${n} de 6`)
  }
  await expect(clock.getByRole('button', { name: 'La cripta despierta: 4 de 6' })).toBeVisible()
  await expect(
    tv.getByRole('region', { name: 'Contadores' }).getByRole('img', { name: 'La cripta despierta: 4 de 6' })
  ).toBeVisible()
  // El temporizador del máster, solo para él
  await expect(tv.getByRole('article', { name: 'Hasta que cierre el portal' })).toHaveCount(0)
  await page
    .getByRole('article', { name: 'Hasta que cierre el portal' })
    .getByRole('button', { name: 'Poner en marcha' })
    .click()
  await settled()
  await axe(page, 'los widgets')
  await page.screenshot({ path: '../out/capturas/herramientas-widgets.png' })
  await tvNet.quiet()
  await axe(tv, 'la tele con los widgets')
  await tv.screenshot({ path: '../out/capturas/herramientas-tele.png' })

  // Una instantánea: se guarda con su miniatura, se mueve una ficha y se vuelve a ella
  await tools.getByRole('button', { name: 'Instantáneas' }).click()
  const snapshots = page.getByRole('complementary', { name: 'Instantáneas' })
  await snapshots.getByLabel('Nombre').fill('Antes de la emboscada')
  await snapshots.getByRole('button', { name: 'Guardar instantánea' }).click()
  const saved = snapshots.getByRole('listitem').filter({ hasText: 'Antes de la emboscada' })
  await expect(saved.locator('img')).toBeVisible()
  const listed = (await call('listSnapshots', { campaignId })).snapshots as Array<{ thumbnail: string | null }>
  expect(listed[0]?.thumbnail).toMatch(/^data:image\/webp;base64,/)
  const lead = goblins[0]?.id ?? ''
  await call('moveTokens', { campaignId, moves: [{ tokenId: lead, x: 2550, y: 1650 }] })
  await settled()
  await axe(page, 'las instantáneas')
  await page.screenshot({ path: '../out/capturas/herramientas-instantaneas.png' })
  await saved.getByRole('button', { name: 'Volver a ella' }).click()
  const dialog = page.getByRole('dialog', { name: 'Volver a la instantánea' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Volver' }).click()
  // Las fichas vuelven como fichas nuevas (otro id): se busca por su rótulo
  await expect
    .poll(async () => {
      const table = (await call('getCampaignTable', { campaignId })) as {
        tokens: Array<{ id: string; label: string; x: number; y: number }>
      }
      const token = table.tokens.find((each) => each.label === 'G1')
      return token ? { x: token.x, y: token.y } : null
    })
    .toEqual(at(61.7, 24))

  // La pantalla del máster: los statblocks de las criaturas de la escena y la nota de la cripta
  await tools.getByRole('button', { name: 'Pantalla del máster' }).click()
  const drawer = page.getByRole('region', { name: 'Pantalla del máster' })
  await expect(drawer.getByText('3 en la escena')).toBeVisible()
  await expect(drawer.getByRole('article', { name: 'Cripta de Varn' }).getByText(/acechador/)).toBeVisible()
  await settled()
  await axe(page, 'la pantalla del máster')
  await page.screenshot({ path: '../out/capturas/herramientas-pantalla-master.png' })
  await drawer.getByRole('button', { name: 'Cerrar la pantalla del máster' }).click()
})
