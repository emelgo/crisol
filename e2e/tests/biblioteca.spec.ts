import AxeBuilder from '@axe-core/playwright'
import { textPdf } from '@crisol/server/pdf-de-prueba'
import { expect, test } from '@playwright/test'
import { campaignLink, settled } from './ayudas.ts'

test('la biblioteca: un PDF subido se lee solo; buscar una palabra de su página 3 abre el visor en la 3', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const campaignUrl = new URL(page.url()).pathname
  const worldId = campaignUrl.split('/')[2] ?? ''
  const pdf = textPdf([
    'Guía de Valdren\nUn libro de prueba.',
    'Las Marcas\nLos vigías encienden hogueras en las torres.',
    'Puertoceniza\nLa guardia de la ciudad viste capas grises.\nEl capitán Hesk responde ante el consejo.'
  ])
  const uploaded = await page.request.post(
    `/api/files?worldId=${worldId}&name=${encodeURIComponent('Guía de Valdren.pdf')}`,
    {
      data: Buffer.from(pdf),
      headers: { 'content-type': 'application/octet-stream' }
    }
  )
  expect(uploaded.status()).toBe(201)

  // Los libros, en la Mesa: Compendio › Libros, y cada uno en su ventana
  await page.goto(`${campaignUrl}?panel=compendio`)
  const panel = page.getByRole('complementary', { name: 'Panel de la mesa' })
  await panel.getByRole('button', { name: /^Libros/ }).click()
  await panel.getByRole('button', { name: /Guía de Valdren\.pdf/ }).click()
  const window = page.getByRole('dialog', { name: 'Guía de Valdren.pdf' })
  // Se lee en segundo plano: el estado cambia solo
  const books = window.getByRole('region', { name: 'Libros' })
  await expect(books.getByRole('button', { name: /Guía de Valdren\.pdf/ })).toContainText('Se puede buscar', {
    timeout: 20_000
  })
  await expect(books).toContainText('3 páginas · del mundo')
  await page.screenshot({ path: test.info().outputPath('biblioteca-libros.png'), fullPage: false })

  // Buscar sin tilde: la página 3, con lo encontrado marcado
  await window.getByRole('searchbox', { name: 'Buscar en los libros' }).fill('capitan')
  const results = window.getByRole('region', { name: 'Lo encontrado' })
  const hit = results.getByRole('button', { name: /Página 3/ })
  await expect(hit).toBeVisible()
  await expect(hit.locator('mark')).toHaveText('capitán')
  await hit.click()
  const viewer = window.getByRole('region', { name: 'Visor de «Guía de Valdren.pdf»' })
  await expect(viewer.getByRole('textbox', { name: 'Página' })).toHaveValue('3')
  await expect(viewer.getByRole('img', { name: /Página 3 de 3/ })).toBeVisible()
  // La capa de texto, con la línea buscada marcada
  await expect(viewer.locator('span[class*="hit"]').first()).toBeAttached()
  await page.screenshot({ path: test.info().outputPath('biblioteca-visor.png'), fullPage: false })

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
})
