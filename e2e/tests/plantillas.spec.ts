import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

/** «Página nueva» desde una plantilla: el recuadro, la plantilla de la lista y el título */
async function fromTemplate(page: Page, template: string, title: string, check?: () => Promise<void>) {
  await page.getByRole('button', { name: 'Página nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Página nueva' })
  await dialog.getByText('Desde plantilla').click()
  await dialog.getByLabel('Buscar plantilla').fill(template)
  await dialog.getByRole('radio', { name: new RegExp(`^${template}`) }).check()
  await check?.()
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByLabel('Título').press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test('desde plantilla: una facción y un PNJ que nace con sus campos, su texto y su marca', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')

  await fromTemplate(page, 'Facción', 'La Raqisa', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const { violations } = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
    }
  })
  await expect(page.getByTitle('Hecha con la plantilla Facción')).toBeVisible()

  await fromTemplate(page, 'PNJ', 'Mamá Gris')
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  // Su texto, con los apartados de la plantilla
  await expect(page.getByRole('heading', { level: 3, name: 'Quién es' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Ganchos' })).toBeVisible()
  // Sus campos, en el panel: la Facción busca primero entre las facciones
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByLabel('Nombre de la propiedad 3')).toHaveValue('Facción')
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/actions/setPageProperties'))
  await properties.getByLabel('Valor de la propiedad 3').fill('La Raqisa')
  await saved
  await expect(properties.getByRole('link', { name: 'La Raqisa' })).toBeVisible()
  // En el árbol, con el icono de su plantilla; y sigue al recargar
  await page.reload()
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Propiedades' }).getByRole('link', { name: 'La Raqisa' })).toBeVisible()

  // Al abrir la facción, Mamá Gris sale sola en «Miembros» (el primer criterio de éxito)
  await page.getByRole('tree', { name: 'Páginas' }).getByRole('treeitem', { name: 'La Raqisa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Raqisa' })).toBeVisible()
  const members = page
    .getByRole('complementary', { name: 'Panel de la página' })
    .getByRole('region', { name: 'Miembros' })
  await expect(members.getByRole('link', { name: 'Mamá Gris' })).toBeVisible()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('aside').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})

test('un enlace a una página que aún no existe se crea pulsándolo: como texto o con una plantilla', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await fromTemplate(page, 'PNJ', 'Mamá Gris')
  const pageId = new URL(page.url()).pathname.split('/').at(-1)
  // La IA escribe un enlace a quien aún no tiene página
  const response = await page.request.post('/api/actions/editPage', {
    data: { pageId, body: { mode: 'append', markdown: 'Su mano derecha es [[El Viejo Gyles]].' } }
  })
  expect(response.status()).toBe(200)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.getByRole('link', { name: /El Viejo Gyles: por crear/ }).click()
  const menu = page.getByRole('menu', { name: 'Crear «El Viejo Gyles»' })
  await expect(menu.getByRole('menuitem', { name: 'Texto' })).toBeFocused()
  await menu.getByRole('menuitem', { name: 'PNJ' }).click()
  // Nace con esa plantilla y el enlace queda resuelto
  await expect(page.getByRole('heading', { level: 1, name: 'El Viejo Gyles' })).toBeVisible()
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  await page.goBack()
  await expect(body.getByRole('link', { name: 'El Viejo Gyles' })).toHaveAttribute('data-state', 'ok')
})
