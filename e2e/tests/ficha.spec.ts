import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, import5e, settled } from './ayudas.ts'

/** Que axe no encuentre fallos críticos ni graves, en claro y en oscuro */
async function accessible(page: Page) {
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
}

test('la hoja en partida: tirar Atletismo y un ataque, un escudo que sube la CA, daño y descanso largo', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const [, , worldId, , campaignId] = new URL(page.url()).pathname.split('/')
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: { campaignId, system: await import5e(page), systemChoices: { sources: ['srd521'], duplicates: 'newest' } }
  })
  expect(chosen.status()).toBe(200)
  const created = await (
    await page.request.post('/api/actions/createCharacter', { data: { campaignId, name: 'Thora' } })
  ).json()
  const build = {
    scores: { method: 'matriz', base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } },
    picks: [
      { id: 'c1', step: 'clase', key: 'guerrero_2024', level: 3 },
      { id: 'e1', step: 'especie', key: 'enano_2024' },
      { id: 't1', step: 'trasfondo', key: 'soldado_2024' }
    ]
  }
  const done = await page.request.post('/api/actions/updateCharacter', {
    data: { characterId: created.character.id, version: 1, build, confirm: 'created' }
  })
  expect(done.status(), await done.text()).toBe(200)
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/personajes/${created.character.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Thora' })).toBeVisible()

  // Tirar Atletismo: el servidor tira y dice lo que salió
  await page.getByRole('button', { name: 'Tirar por Atletismo' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Atletismo' })).toBeVisible()

  // La CA de antes; un escudo del compendio, equipado: +2
  const ca = page
    .getByRole('listitem')
    .filter({ hasText: /^Clase de armadura/ })
    .first()
  const before = Number((await ca.textContent())?.replace(/\D+/g, ''))
  await page.getByRole('tab', { name: 'Inventario' }).click()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Añadir' }).first().click()
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('escudo')
  await page
    .getByRole('button', { name: /^Escudo/ })
    .first()
    .click()
  await page.getByRole('checkbox', { name: 'Equipado' }).first().check()
  await expect(ca).toContainText(String(before + 2))

  // Una espada larga, y su ataque
  await page.getByRole('tab', { name: 'Acciones' }).click()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Añadir' }).first().click()
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('espada larga')
  await page
    .getByRole('button', { name: /^Espada larga/ })
    .first()
    .click()
  await page.getByRole('button', { name: /^Ataque con Espada larga/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Espada larga' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('ficha.png'), fullPage: true })

  // Daño: 5 menos; descanso largo: lleno otra vez
  const hp = page.getByRole('region', { name: 'Puntos de golpe' })
  const full = Number((await hp.locator('strong').textContent()) ?? '0')
  await hp.getByLabel('Cuánto').fill('5')
  await hp.getByRole('button', { name: 'Daño' }).click()
  await expect(hp.locator('strong')).toHaveText(String(full - 5))
  await page.getByRole('button', { name: 'Descanso largo' }).click()
  await expect(hp.locator('strong')).toHaveText(String(full))

  // Lo que se cambia jugando: la inspiración y el cansancio
  await page.getByRole('checkbox', { name: 'Inspiración heroica' }).check()
  const exhaustion = page.getByRole('spinbutton', { name: 'Cansancio' })
  await exhaustion.fill('1')
  const saved = page.waitForResponse((r) => r.url().endsWith('/updateCharacter') && r.ok())
  await exhaustion.press('Enter')
  await saved
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Inspiración heroica' })).toBeChecked()
  await expect(page.getByRole('spinbutton', { name: 'Cansancio' })).toHaveValue('1')
  await accessible(page)
})
