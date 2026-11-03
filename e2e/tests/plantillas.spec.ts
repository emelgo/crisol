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
})
