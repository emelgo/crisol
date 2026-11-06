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

test('el compendio del mundo: el máster copia el Goblin al mundo, lo cambia y trae lo que cambia el original', async ({
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

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Compendio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Compendio' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('goblin')
  await page
    .getByRole('list', { name: 'Resultados' })
    .getByRole('button', { name: /^Goblin/ })
    .first()
    .click()
  await expect(page.getByRole('article', { name: 'Goblin' })).toBeVisible()

  // Copiar al mundo: se abre para cambiarla, con «(copia)» en el nombre
  await page.getByRole('button', { name: 'Copiar al mundo' }).click()
  await expect(page.getByRole('dialog', { name: /Editar «Goblin \(copia\)»/ })).toBeVisible()
  // Su título sigue al nombre que se escribe
  const editor = page.getByRole('dialog')
  await editor.getByLabel('Nombre').fill('Goblin jefe')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toBeHidden()
  const article = page.getByRole('article', { name: 'Goblin jefe' })
  await expect(article).toBeVisible()
  await expect(article.getByText('Del mundo', { exact: true })).toBeVisible()
  const about = page.getByRole('complementary', { name: 'Sobre este documento' })
  await expect(about).toContainText('El compendio del mundo')
  await expect(about).toContainText('Copia de Goblin')

  // «Del mundo»: solo lo suyo
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('')
  await page.getByText('Del mundo', { exact: true }).first().click()
  const library = page.getByRole('navigation', { name: 'Biblioteca del compendio' })
  await expect(library.getByRole('button', { name: /Criaturas/ })).toContainText('1')
  await page.screenshot({ path: test.info().outputPath('compendio-mundo.png'), fullPage: false })
  await accessible(page)

  // El original cambia (el dueño del sistema le sube los PG): la copia lo avisa y se traen sus cambios
  const read = await page.request.post('/api/actions/getSystemContent', {
    data: { systemId, keys: ['guerrero_goblin_2014'] }
  })
  const [original] = (await read.json()).items
  const system = await (await page.request.post('/api/actions/getSystem', { data: { systemId } })).json()
  const saved = await page.request.post('/api/actions/putSystemContent', {
    data: { systemId, version: system.version, items: [{ ...original, data: { ...original.data, pg_max: 12 } }] }
  })
  expect(saved.status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'El original ha cambiado.' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver cambios' }).click()
  const changes = page.getByRole('dialog', { name: 'Cambios del original' })
  await expect(changes.getByRole('row', { name: /Puntos de golpe/ })).toContainText('12')
  await page.screenshot({ path: test.info().outputPath('compendio-mundo-cambios.png'), fullPage: false })
  await changes.getByRole('button', { name: /^Traer/ }).click()
  await expect(changes).toBeHidden()
  await expect(page.getByText('El original ha cambiado.')).toBeHidden()

  // La jugadora no ve lo del mundo (hasta el módulo 5)
  const player = await newPlayer(browser, link)
  await player.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Compendio' }).click()
  await player.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('goblin jefe')
  await expect(player.getByText('Nada con ese nombre')).toBeVisible()
  await expect(player.getByText('Del mundo', { exact: true })).toHaveCount(0)
})
