import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { freshOwner, import5e } from './ayudas.ts'

const GOBLIN = 'guerrero_goblin_2014'

type Seen = { x: number; y: number; scale: number }
type Token = { id: string; x: number; y: number; actor: { id: string; name: string; version: number } }

/** Un punto del mapa, en la pantalla (la mesa deja su vista en un atributo) */
async function onScreen(canvas: Locator, point: { x: number; y: number }) {
  const view = JSON.parse((await canvas.getAttribute('data-view')) ?? 'null') as Seen
  const box = await canvas.boundingBox()
  if (!box) throw new Error('sin lienzo')
  return { x: box.x + view.x + point.x * view.scale, y: box.y + view.y + point.y * view.scale }
}

async function axe(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, `${what}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
}

test('combate: tirar la iniciativa, dos rondas (un estado de una ronda se va solo), dañar a dos goblins a la vez y acabar', async ({
  page
}) => {
  test.setTimeout(150_000)
  await freshOwner(page)
  await page.emulateMedia({ colorScheme: 'dark' })
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
  const lia = (await call('createCharacter', { campaignId, name: 'Lía' })).character
  await call('openScene', { campaignId, sceneId })
  await call('presentScene', { campaignId })
  await call('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 1200, height: 800 })
  await call('placeTokens', { campaignId, sceneId, tokens: [{ characterId: lia.id, column: 3, row: 4 }] })
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [{ content: { key: GOBLIN, count: 3 }, column: 6, row: 2 }]
  })
  const tokens = async () => (await call('getCampaignTable', { campaignId })).tokens as Token[]
  const byName = async (name: string) => (await tokens()).find((t) => t.actor.name === name) as Token

  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa`)
  const stage = page.getByRole('application', { name: 'Mesa: Escena' })
  await expect(stage).toBeVisible()
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 30_000 })
    .toBe(2)
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Vista de jugadores', exact: true }).click()
  ])
  await tv.emulateMedia({ colorScheme: 'dark' })

  // Empezar con todas las fichas de la escena, desde la pestaña Combate: su panel, sin empezar
  await page
    .getByRole('complementary', { name: 'Panel de la mesa' })
    .getByRole('tab', { name: /^Combate/ })
    .click()
  await page.getByRole('button', { name: 'Empezar el combate' }).click()
  const panel = page.getByRole('complementary', { name: 'Combate' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Sin empezar')).toBeVisible()
  const order = panel.getByRole('list', { name: 'Orden de la iniciativa' })
  await expect(order.getByRole('listitem')).toHaveCount(4)

  // Tirar la de las criaturas (una para el grupo); la de Lía la dice su jugadora
  await panel.getByRole('button', { name: 'Tirar la iniciativa' }).click()
  await panel.getByRole('button', { name: 'De las criaturas' }).click()
  const goblinInitiative = panel.getByLabel('Iniciativa de Goblin 1')
  await expect(goblinInitiative).not.toHaveValue('')
  await panel.getByLabel('Iniciativa de Lía').fill('30')
  await panel.getByLabel('Iniciativa de Lía').press('Enter')
  await expect(order.getByRole('listitem').first()).toContainText('Lía')

  // Goblin 1, derribado una ronda: se le irá al empezar el turno de los goblins
  const g1 = await byName('Goblin 1')
  await call('playCreature', {
    creatureId: g1.actor.id,
    version: g1.actor.version,
    condition: { add: { name: 'Derribado', rounds: 1 } }
  })

  // Ronda 1: Lía; la tele dice de quién es el turno
  await panel.getByRole('button', { name: 'Primer turno' }).click()
  await expect(panel.getByText('Ronda 1')).toBeVisible()
  const strip = tv.getByRole('region', { name: 'Turnos' })
  await expect(strip).toContainText('Ronda 1')
  await expect(strip).toContainText('Turno de Lía')
  // Los goblins, en un turno: el estado se va solo y lo dice el aviso
  await panel.getByRole('button', { name: 'Siguiente turno' }).click()
  await expect(panel.getByRole('status')).toContainText('Goblin 1 ya no está «Derribado»')
  await expect(strip).toContainText('Turno de Goblin 1, Goblin 2 y Goblin 3')
  // Ronda 2
  await panel.getByRole('button', { name: 'Siguiente turno' }).click()
  await expect(panel.getByText('Ronda 2')).toBeVisible()
  await expect(strip).toContainText('Turno de Lía')
  await axe(page, 'la mesa en combate')
  await page.screenshot({ path: '../out/capturas/combate-mesa.png' })
  await tv.screenshot({ path: '../out/capturas/combate-pantalla.png' })
  await axe(tv, 'la tele en combate')

  // Dañar a dos goblins de una vez: se eligen con Mayús y se les aplica a los dos
  const g2 = await byName('Goblin 2')
  const g3 = await byName('Goblin 3')
  const at2 = await onScreen(stage, g2)
  const at3 = await onScreen(stage, g3)
  await page.mouse.click(at2.x, at2.y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at3.x, at3.y)
  await page.keyboard.up('Shift')
  const damage = page.getByRole('region', { name: 'Daño a varias' })
  await expect(damage).toContainText('2 elegidas')
  await damage.getByLabel('Cuánto').fill('50')
  await page.screenshot({ path: '../out/capturas/combate-dano.png' })
  await damage.getByRole('button', { name: 'Aplicar' }).click()
  await expect
    .poll(async () =>
      [await byName('Goblin 2'), await byName('Goblin 3')].map(
        (t) => t && (t as Token & { actor: { life: { value: number } } }).actor.life.value
      )
    )
    .toEqual([0, 0])

  // Acabar: las copias a 0 se van, con sus fichas
  await panel.getByRole('button', { name: 'Acabar combate' }).click()
  const end = page.getByRole('dialog', { name: 'Acabar combate' })
  await expect(end).toContainText('Se quitan de la mesa y de «En juego»: Goblin 2 y Goblin 3.')
  await page.screenshot({ path: '../out/capturas/combate-acabar.png' })
  await end.getByRole('button', { name: 'Acabar', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect.poll(async () => (await tokens()).map((t) => t.actor.name).sort()).toEqual(['Goblin 1', 'Lía'])
  expect((await call('listInPlay', { campaignId })).creatures).toHaveLength(1)
  await expect(strip).toHaveCount(0)
})
