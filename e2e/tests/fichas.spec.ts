import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { freshOwner, import5e, png } from './ayudas.ts'

const GOBLIN = 'guerrero_goblin_2014'

type Seen = { x: number; y: number; scale: number; width: number; height: number }
type Token = { id: string; x: number; y: number; label: string; hidden: boolean; actor: { name: string } }

/** La vista de un lienzo de la mesa (la deja en un atributo): dónde cae el mapa y a qué escala */
async function viewOf(canvas: Locator): Promise<Seen> {
  return JSON.parse((await canvas.getAttribute('data-view')) ?? 'null') as Seen
}

/** Un punto del mapa, en la pantalla */
async function onScreen(canvas: Locator, point: { x: number; y: number }) {
  const view = await viewOf(canvas)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('sin lienzo')
  return { x: box.x + view.x + point.x * view.scale, y: box.y + view.y + point.y * view.scale }
}

async function axe(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${what}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
}

test('fichas: Lía y tres goblins de un encuentro, moverlos, dañar a uno, ocultar otro y encuadrar al grupo', async ({
  page
}) => {
  test.setTimeout(150_000)
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
  const tab = await call('createPageTab', { pageId, kind: 'scene' })
  const sceneId = (await call('getScene', { tabId: tab.id })).id
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#7a6b58"/>
  <rect x="100" y="100" width="1000" height="600" fill="#a89a84" stroke="#2a2018" stroke-width="10"/>
</svg>`
  await call('drawScene', { sceneId, svg, name: 'Cripta' })
  await call('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0 } })
  await call('createCharacter', { campaignId, name: 'Lía' })
  await call('saveEncounter', {
    worldId,
    systemId,
    name: 'Emboscada',
    members: [
      {
        key: GOBLIN,
        unique: false,
        at: [
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 }
        ]
      }
    ]
  })
  await call('openScene', { campaignId, sceneId })
  await call('presentScene', { campaignId })
  // La cripta, destapada a mano entera: lo que se prueba aquí son las fichas, no la niebla
  await call('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 1200, height: 800 })
  const tokens = async () => (await call('getCampaignTable', { campaignId })).tokens as Token[]

  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa`)
  const stage = page.getByRole('application', { name: 'Mesa: Escena' })
  await expect(stage).toBeVisible()
  // El mapa de la IA se trocea al abrirlo
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 30_000 })
    .toBe(2)
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Pantalla', exact: true }).click()
  ])
  const onTv = tv.getByRole('list', { name: 'Lo que hay en la mesa' })

  // Lía, desde «Personajes», arrastrada al mapa
  const panel = page.getByRole('complementary', { name: 'Panel de la mesa' })
  await panel.getByRole('tab', { name: 'Personajes' }).click()
  const lia = await onScreen(stage, { x: 350, y: 450 })
  const stageBox = await stage.boundingBox()
  if (!stageBox) throw new Error('sin mesa')
  await panel
    .getByRole('listitem')
    .filter({ hasText: 'Lía' })
    .dragTo(stage, { targetPosition: { x: lia.x - stageBox.x, y: lia.y - stageBox.y } })
  await expect(onTv.getByRole('listitem')).toHaveText(['Lía'])

  // La emboscada, desde «Encuentros»: tres goblins en su formación, ilesos en la tele
  await panel.getByRole('tab', { name: 'Encuentros' }).click()
  const ambush = await onScreen(stage, { x: 650, y: 250 })
  await panel
    .getByRole('listitem')
    .filter({ hasText: 'Emboscada' })
    .dragTo(stage, { targetPosition: { x: ambush.x - stageBox.x, y: ambush.y - stageBox.y } })
  await expect(onTv.getByRole('listitem')).toHaveCount(4)
  await expect(onTv.getByRole('listitem').filter({ hasText: 'Goblin 1' })).toHaveText('Goblin 1, Ilesa')

  // Mover un goblin arrastrándolo: se guarda al soltarlo
  const goblin = (await tokens()).find((token) => token.actor.name === 'Goblin 1') as Token
  const from = await onScreen(stage, goblin)
  const to = await onScreen(stage, { x: goblin.x + 200, y: goblin.y + 100 })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => {
      const moved = (await tokens()).find((token) => token.id === goblin.id) as Token
      return Math.round(Math.hypot(moved.x - goblin.x - 200, moved.y - goblin.y - 100))
    })
    .toBeLessThan(3)

  // Ctrl+Z deshace el movimiento; las flechas lo mueven una casilla (hacia arriba, donde no hay nadie)
  await stage.focus()
  await page.keyboard.press('Control+z')
  await expect.poll(async () => ((await tokens()).find((token) => token.id === goblin.id) as Token).x).toBe(goblin.x)
  await page.keyboard.press('ArrowUp')
  await expect
    .poll(async () => ((await tokens()).find((token) => token.id === goblin.id) as Token).y)
    .toBe(goblin.y - 100)

  // Pulsarlo abre su tarjeta: dañarlo lo deja «Herida» en la tele
  const moved = (await tokens()).find((token) => token.id === goblin.id) as Token
  const at = await onScreen(stage, moved)
  await page.mouse.click(at.x, at.y)
  const card = page.getByRole('region', { name: 'Goblin 1' })
  await expect(card).toBeVisible()
  await card.getByLabel('Cuánto').fill('2')
  await card.getByRole('button', { name: 'Dañar' }).click()
  await expect(onTv.getByRole('listitem').filter({ hasText: 'Goblin 1' })).toHaveText('Goblin 1, Herida')
  // Un estado escrito, con rondas
  await card.getByLabel('Estado', { exact: true }).fill('Derribado')
  await card.getByLabel('Rondas que dura').fill('2')
  await card.getByRole('button', { name: 'Poner' }).click()
  await expect(card.getByRole('list', { name: 'Estados' })).toContainText('Derribado')
  await expect(onTv.getByRole('listitem').filter({ hasText: 'Goblin 1' })).toHaveText('Goblin 1, Herida, Derribado')
  await axe(page, 'la mesa con la tarjeta')
  await page.screenshot({ path: '../out/capturas/fichas-tarjeta.png' })

  // Ocultarlo: desaparece de la tele (en la mesa sigue, a medias)
  await card.getByRole('button', { name: 'Ocultar' }).click()
  await expect(onTv.getByRole('listitem')).toHaveCount(3)
  await expect(onTv).not.toContainText('Goblin 1')

  // Encuadrar al grupo: la tele va a Lía
  await page.getByRole('radio', { name: 'Grupo' }).click()
  await expect(page.getByRole('radio', { name: 'Grupo' })).toBeChecked()
  const screen = tv.locator('[data-screen]')
  await expect
    .poll(async () => {
      const seen = await viewOf(screen)
      return Math.round(
        Math.hypot((seen.width / 2 - seen.x) / seen.scale - 350, (seen.height / 2 - seen.y) / seen.scale - 450)
      )
    })
    .toBeLessThan(5)
  await card.getByRole('button', { name: 'Cerrar' }).click()

  // El creador de fichas: una imagen del mundo para Lía, encuadrada en redondo
  const portrait = png(240, 240, (x, y) => (Math.hypot(x - 120, y - 100) < 60 ? [220, 180, 140] : [40, 90, 120]))
  const file = await page.request.post(`/api/files?worldId=${worldId}&name=lia.png`, {
    data: portrait,
    headers: { 'content-type': 'application/octet-stream' }
  })
  expect(file.status()).toBe(201)
  const liaToken = (await tokens()).find((token) => token.actor.name === 'Lía') as Token
  const liaAt = await onScreen(stage, liaToken)
  await page.mouse.click(liaAt.x, liaAt.y)
  await expect(page.getByRole('region', { name: 'Lía' })).toBeVisible()
  await panel.getByRole('tab', { name: 'Imágenes' }).click()
  await panel.getByRole('button', { name: 'lia.png' }).click()
  const editor = page.getByRole('dialog', { name: 'Imagen de Lía' })
  await expect(editor).toBeVisible()
  await editor.getByLabel('Acercar').fill('1.5')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toHaveCount(0)
  await expect
    .poll(async () => ((await tokens()).find((token) => token.id === liaToken.id) as Token & { image: unknown }).image)
    .toMatchObject({ fileId: (await file.json()).id, zoom: 1.5 })
  await page.getByRole('region', { name: 'Lía' }).getByRole('button', { name: 'Cerrar' }).click()
  await page.screenshot({ path: '../out/capturas/fichas-mesa.png' })
  await tv.screenshot({ path: '../out/capturas/fichas-pantalla.png' })
  await axe(tv, 'la tele')
})
