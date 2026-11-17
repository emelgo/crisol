import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki, openWorldFiles } from './ayudas.ts'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])

test('las etiquetas de la cuenta: un archivo lleva una, sale en Etiquetas y, renombrada, cambia en el archivo', async ({
  page
}) => {
  // Con la máquina cargada rozaba los 30 s (de 22 a 32 en las baterías enteras): con el margen de las demás largas
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await openWorldFiles(page)
  await page
    .locator('input[type=file][multiple]')
    .first()
    .setInputFiles([{ name: 'Mapa.png', mimeType: 'image/png', buffer: PNG }])
  await expect(page.getByRole('status').getByText('Subido 1 archivo')).toBeAttached()

  // Desde su engranaje, una etiqueta nueva: se crea sola al guardar
  await page.getByRole('button', { name: 'Ajustes de Mapa.png' }).click()
  const settings = page.getByRole('dialog', { name: 'Ajustes de Mapa.png' })
  await settings.getByLabel('Etiquetas').fill('lugar/costa')
  await settings.getByLabel('Etiquetas').press('Enter')
  await expect(settings.getByRole('button', { name: 'Quitar lugar/costa' })).toBeVisible()
  // Se guarda con «Guardar», como el nombre y la carpeta
  await settings.getByRole('button', { name: 'Guardar' }).click()
  await expect(settings.getByRole('button', { name: 'Guardar' })).toHaveCount(0)
  await settings.getByRole('button', { name: 'Cerrar' }).click()

  // En Mis mundos, «Etiquetas»: en árbol, con su madre
  await page.goto('/etiquetas')
  const list = page.getByRole('list', { name: 'Etiquetas' })
  await expect(list.getByRole('listitem')).toHaveText(['lugar1 archivo', 'costa1 archivo', 'Nueva etiqueta'])

  // Renombrar la madre cambia la del archivo
  await page.getByRole('button', { name: 'Ajustes de lugar', exact: true }).click()
  const tag = page.getByRole('dialog', { name: 'Ajustes de lugar' })
  await tag.getByLabel('Nombre de la etiqueta').fill('sitio')
  await tag.getByRole('button', { name: 'Guardar' }).click()
  await expect(list.getByRole('listitem')).toHaveText(['sitio1 archivo', 'costa1 archivo', 'Nueva etiqueta'])

  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
  await page.goBack()
  await expect(page.getByText('sitio/costa')).toBeVisible()
})
