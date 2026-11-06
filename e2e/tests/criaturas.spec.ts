import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer, settled } from './ayudas.ts'

/** Que axe no encuentre fallos críticos ni graves, en claro y en oscuro */
async function accessible(page: Page) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
}

test('las criaturas en juego: tres goblins desde el compendio, su hoja, tirar su cimitarra y aplicar el daño', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
  const systemId = await import5e(page)
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: { campaignId, system: systemId, systemChoices: { sources: ['srd51'], duplicates: 'both' } }
  })
  expect(chosen.status()).toBe(200)
  await page.reload()

  // Desde el compendio: «Poner en juego» tres goblins
  const sections = page.getByRole('navigation', { name: 'Secciones' })
  await sections.getByRole('link', { name: 'Compendio' }).click()
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('goblin')
  await page
    .getByRole('list', { name: 'Resultados' })
    .getByRole('button', { name: /^Goblin/ })
    .first()
    .click()
  const put = page.getByRole('region', { name: 'Poner en juego' })
  await put.getByLabel('Cuántas').fill('3')
  await put.getByRole('button', { name: 'Poner 3 en juego' }).click()
  await expect(put).toContainText('Goblin 1, Goblin 2, Goblin 3')
  await page.screenshot({ path: test.info().outputPath('poner-en-juego.png'), fullPage: false })

  // «En juego», en la barra de la campaña
  await sections.getByRole('link', { name: 'En juego' }).click()
  const list = page.getByRole('complementary', { name: 'En juego' })
  await expect(list.getByRole('button', { name: /Goblin 1/ })).toBeVisible()
  await list.getByRole('button', { name: /Goblin 2/ }).click()
  const sheet = page.getByRole('article', { name: 'Goblin 2' })
  await expect(sheet).toBeVisible()
  // Su cimitarra: el ataque y el daño, a su nombre
  await sheet.getByRole('button', { name: /^Ataque con Cimitarra/ }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'Goblin 2 · Cimitarra' })).toBeVisible()
  // Desde su hoja, oculta de entrada (solo la ve el máster)
  const listed = await page.request.post('/api/actions/listRolls', { data: { campaignId } })
  expect((await listed.json()).rolls.at(-1)).toMatchObject({ label: 'Goblin 2 · Cimitarra', visibility: 'hidden' })
  await sheet.getByRole('button', { name: 'Daño de Cimitarra' }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'daño' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('en-juego.png'), fullPage: false })
  await accessible(page)

  // Aplicar ese daño desde el registro a Goblin 1 (entero) y Goblin 3 (mitad)
  const log = page.getByRole('complementary', { name: 'Registro de tiradas' })
  await log.getByRole('button', { name: 'Aplicar' }).last().click()
  const apply = page.getByRole('dialog', { name: /^Aplicar \d+ de daño/ })
  await apply.getByRole('checkbox', { name: /Goblin 1/ }).check()
  await apply.getByRole('checkbox', { name: /Goblin 3/ }).check()
  await apply.getByRole('group', { name: 'Cuánto recibe Goblin 3' }).getByText('Mitad').click()
  await page.screenshot({ path: test.info().outputPath('aplicar.png'), fullPage: false })
  await apply.getByRole('button', { name: 'Aplicar a 2' }).click()
  await expect(apply).toBeHidden()
  await expect(list.getByRole('button', { name: /Goblin 1/ })).not.toContainText('7 / 7')

  // Quitar las copias
  await list.getByRole('button', { name: 'Quitar las copias' }).click()
  await expect(page.getByText('Aún no hay nada en juego')).toBeVisible()

  // La jugadora no tiene «En juego»
  const player = await newPlayer(browser, link)
  await expect(
    player.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'En juego' })
  ).toHaveCount(0)
})

test('enlazar una criatura desde la página de un PNJ: [[@ la sugiere, su tarjeta al pasar y abrirla en el compendio', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const systemId = await import5e(page)
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: { campaignId, system: systemId, systemChoices: { sources: ['srd51'], duplicates: 'both' } }
  })
  expect(chosen.status()).toBe(200)
  const created = await page.request.post('/api/actions/createPage', {
    data: { worldId, title: 'Grak', parentId: null }
  })
  const pageId = (await created.json()).id as string
  await page.goto(`/mundos/${worldId}/wiki/${pageId}`)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.type('Su criatura: [[@gob')
  const option = page
    .getByRole('listbox', { name: 'Páginas' })
    .getByRole('option', { name: /^Goblin/ })
    .first()
  await expect(option).toBeVisible()
  await page.keyboard.press('Enter')
  const link = body.getByRole('link', { name: 'Goblin' })
  await expect(link).toBeVisible()
  await link.hover()
  const card = page.getByRole('group', { name: 'Goblin' })
  await expect(card).toContainText('Criatura')
  await expect(card).toContainText('Clase de armadura 15')
  await page.screenshot({ path: test.info().outputPath('enlace-criatura.png'), fullPage: false })
  await card.getByRole('button', { name: 'Abrir en el compendio' }).click()
  await expect(page.getByRole('article', { name: 'Goblin' })).toBeVisible()
  await expect(page).toHaveURL(/compendio\?ver=guerrero_goblin_2014/)
  // En su Markdown, [[@Goblin]]
  const read = await page.request.post('/api/actions/readPage', { data: { pageId } })
  expect(await read.text()).toContain('[[@Goblin]]')
})
