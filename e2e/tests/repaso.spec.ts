import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { freshOwner, import5e, watchNetwork } from './ayudas.ts'

/**
 * El repaso visual frente al lienzo «Crisol: la mesa»: la cripta de Varn con las fichas del tablero Mesa (Lía, Bram,
 * Sela, tres goblins y su jefe), en tema oscuro y a 1440 × 900, como los tableros Mesa, Pantalla y Combate. Deja las
 * capturas en out/capturas/repaso-*.png
 */
const CRIPTA = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'), 'utf8')
const SIZE = { width: 1440, height: 900 }
/** Del tablero (en % del mapa) a píxeles de la cripta, de 3000 × 2000 */
const at = (x: number, y: number) => ({ x: Math.round((x / 100) * 3000), y: Math.round((y / 100) * 2000) })

test.use({ viewport: SIZE, colorScheme: 'dark' })

test('repaso visual: la mesa, la tele y el combate con la cripta del lienzo', async ({ page }) => {
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
  await call('drawScene', { sceneId, svg: CRIPTA, name: 'Cripta de Varn' })
  // La vista inicial, la del tablero Mesa (el mapa a 0,55 px por píxel)
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
  ).tokens as Array<{ id: string; actor: { id: string; version: number } }>
  const moves = [at(61.7, 24), at(65, 47.5), at(58.3, 52.5)].map((p, i) => ({ tokenId: goblins[i]?.id ?? '', ...p }))
  await call('moveTokens', { campaignId, moves })
  await call('placeTokens', {
    campaignId,
    sceneId,
    tokens: [{ content: { key: 'jefe_goblin_2024', unique: true }, ...at(68.3, 37.5) }]
  })
  // Goblin 2, envenenado y herido; Goblin 3, a punto de caer
  const [, g2, g3] = goblins
  if (!g2 || !g3) throw new Error('faltan goblins')
  await call('playCreature', { creatureId: g2.actor.id, version: g2.actor.version, damage: 3 })
  const g2now = (await call('getInPlay', { creatureId: g2.actor.id })).creature
  await call('playCreature', {
    creatureId: g2.actor.id,
    version: g2now.version,
    condition: { add: { name: 'Envenenado', rounds: 2 } }
  })
  await call('playCreature', { creatureId: g3.actor.id, version: g3.actor.version, damage: 5 })
  // La tele, fija donde la deja el tablero Pantalla
  await call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view: { x: 1800, y: 800, scale: 0.933 } } })

  await page.goto(`/mundos/${worldId}/campanas/${campaignId}`)
  const stage = page.getByRole('application', { name: 'Mesa: Cripta de Varn' })
  await expect(stage).toBeVisible()
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)
  const net = watchNetwork(page)
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Pantalla', exact: true }).click()
  ])
  const tvNet = watchNetwork(tv)
  await tv.setViewportSize(SIZE)
  await tv.emulateMedia({ colorScheme: 'dark' })
  await expect(tv.getByRole('list', { name: 'Lo que hay en la mesa' }).getByRole('listitem')).toHaveCount(7)
  // Que acaben de llegar las teselas antes de cada foto
  const settled = () => net.quiet()

  // La mesa con la tarjeta de Goblin 3 (como el tablero Mesa)
  // La lista de fichas del teclado: se elige con el foco y Intro
  await page.getByRole('list', { name: 'Fichas' }).getByRole('button', { name: /^G3/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Goblin 3' })).toBeVisible()
  // Sin el foco en la lista (se vería encima del mapa)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await settled()
  await page.screenshot({ path: '../out/capturas/repaso-mesa.png' })
  // Seguir
  await page.getByRole('radio', { name: 'Sigue tu vista' }).click()
  await expect(page.getByText('La tele sigue tu vista')).toBeVisible()
  await settled()
  await page.screenshot({ path: '../out/capturas/repaso-mesa-seguir.png' })
  await page.getByRole('region', { name: 'Goblin 3' }).getByRole('button', { name: 'Cerrar' }).click()
  // Sin nada elegido: el combate, con todas
  await stage.focus()
  await page.keyboard.press('Escape')

  // La tele (fija, como el tablero Pantalla)
  await call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view: { x: 1800, y: 800, scale: 0.933 } } })
  await tvNet.quiet()
  await tv.screenshot({ path: '../out/capturas/repaso-pantalla.png' })

  // El combate (como el tablero Combate): la iniciativa del lienzo, cada goblin aparte, ronda 2 y turno de Lía
  await page
    .getByRole('complementary', { name: 'Panel de la mesa' })
    .getByRole('tab', { name: /^Combate/ })
    .click()
  await page.getByRole('button', { name: 'Empezar el combate' }).click()
  const panel = page.getByRole('complementary', { name: 'Combate' })
  await expect(panel).toBeVisible()
  const combat = (await call('getCombat', { campaignId })).combat as {
    combatants: Array<{ id: string; name: string }>
  }
  const id = (name: string) => combat.combatants.find((c) => c.name === name)?.id ?? ''
  await call('groupCombatants', {
    campaignId,
    combatantIds: [id('Goblin 1'), id('Goblin 2'), id('Goblin 3')],
    together: false
  })
  const order: Array<[string, number]> = [
    ['Lía', 19],
    ['Goblin 1', 17],
    ['Goblin 3', 15],
    ['Bram', 14],
    ['Jefe goblin', 12],
    ['Goblin 2', 11],
    ['Sela', 8]
  ]
  await call('setInitiative', {
    campaignId,
    values: order.map(([name, initiative]) => ({ combatantId: id(name), initiative }))
  })
  for (let i = 0; i < 8; i++) await call('nextTurn', { campaignId })
  await expect(panel.getByText('Ronda 2')).toBeVisible()
  await settled()
  await page.screenshot({ path: '../out/capturas/repaso-combate.png' })
  await tvNet.quiet()
  await tv.screenshot({ path: '../out/capturas/repaso-pantalla-combate.png' })

  // Los resultados de las tiradas, sobre el d20, ya apagados (no tapan las fichas de esa esquina)
  await expect(page.getByRole('list', { name: 'Últimas tiradas' }).getByRole('listitem')).toHaveCount(0, {
    timeout: 15_000
  })
  // Daño a varias: tres elegidas en el mapa (la primera abre su tarjeta: se cierra y siguen con Mayús)
  const tokens = (await call('getCampaignTable', { campaignId })).tokens as Array<{
    id: string
    label: string
    x: number
    y: number
  }>
  const view = JSON.parse((await stage.getAttribute('data-view')) ?? '{}') as { x: number; y: number; scale: number }
  const box = await stage.boundingBox()
  if (!box) throw new Error('sin mesa')
  const click = async (label: string, shift: boolean) => {
    const token = tokens.find((t) => t.label === label)
    if (!token) throw new Error(`sin ${label}`)
    if (shift) await page.keyboard.down('Shift')
    await page.mouse.click(box.x + view.x + token.x * view.scale, box.y + view.y + token.y * view.scale)
    if (shift) await page.keyboard.up('Shift')
    // Elegida: lo dice la lista de fichas
    await expect(
      page.getByRole('list', { name: 'Fichas' }).getByRole('button', { name: new RegExp(`^${label},`) })
    ).toHaveAttribute('aria-pressed', 'true')
  }
  await click('G2', false)
  await page.getByRole('region', { name: 'Goblin 2' }).getByRole('button', { name: 'Cerrar' }).click()
  await click('Jefe', true)
  await click('G3', true)
  const damage = page.getByRole('region', { name: 'Daño a varias' })
  await expect(damage).toBeVisible()
  await damage.getByLabel('Cuánto').fill('3')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.screenshot({ path: '../out/capturas/repaso-combate-dano.png' })
  await damage.getByRole('button', { name: 'Cerrar el daño a varias' }).click()

  // Acabar
  await panel.getByRole('button', { name: 'Acabar combate' }).click()
  await expect(page.getByRole('dialog', { name: 'Acabar combate' })).toBeVisible()
  await page.screenshot({ path: '../out/capturas/repaso-combate-acabar.png' })
  await page.getByRole('dialog', { name: 'Acabar combate' }).getByRole('button', { name: 'Cancelar' }).click()

  // La tele oculta
  await call('hideScreen', { campaignId, hidden: true })
  await expect(tv.locator('[data-dark]')).toBeVisible()
  await tv.screenshot({ path: '../out/capturas/repaso-pantalla-oculta.png' })
})
