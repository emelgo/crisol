import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])
const PDF = Buffer.from('%PDF-1.7\nun bestiario')

/** Subir del mundo: el primero (después va el de los comunes) */
const worldUpload = (page: Page) => page.locator('input[type=file][multiple]').first()

async function openFiles(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('link', { name: 'Archivos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeVisible()
}

test('subir archivos: salen como tarjetas, se sirven tal cual, se ordenan en carpetas y van a la papelera y vuelven', async ({
  page
}) => {
  await openFiles(page)

  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  await expect(page.getByRole('status').getByText('Subidos 2 archivos')).toBeAttached()
  // Acabadas, ya son sus tarjetas: no queda ninguna subida
  await expect(page.getByRole('button', { name: /Cancelar la subida/ })).toHaveCount(0)
  const files = page.getByRole('list', { name: 'Archivos' }).first()
  await expect(files.getByRole('button', { name: 'Mapa de Eana.png', exact: true })).toBeVisible()
  const bestiary = files.getByRole('link', { name: 'Bestiario.pdf', exact: true })
  await expect(bestiary).toBeVisible()

  // El enlace lleva a sus bytes, con la sesión
  const served = await page.request.get((await bestiary.getAttribute('href')) ?? '')
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('application/pdf')
  expect(Buffer.from(await served.body()).equals(PDF)).toBe(true)

  // El mismo nombre otra vez: con número
  await worldUpload(page).setInputFiles([{ name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG }])
  await expect(files.getByRole('button', { name: 'Mapa de Eana (2).png', exact: true })).toBeVisible()

  // Una carpeta, y el bestiario dentro, arrastrándolo
  await page.getByRole('button', { name: 'Nueva carpeta' }).first().click()
  const create = page.getByRole('dialog', { name: 'Nueva carpeta' })
  await create.getByLabel('Nombre de la carpeta').fill('Bestias')
  await create.getByRole('button', { name: 'Crear la carpeta' }).click()
  await expect(create).toHaveCount(0)
  // Las tarjetas, por lo que pone (la del archivo y la de la carpeta)
  const folder = page.locator('[data-file-card]').filter({ hasText: 'Bestias' })
  await expect(folder).toBeVisible()
  await page.locator('[data-file-card]').filter({ hasText: 'Bestiario.pdf' }).dragTo(folder)
  await expect(bestiary).toHaveCount(0)
  await expect(folder.getByText('1 archivo')).toBeVisible()
  await page.getByRole('button', { name: 'Abrir la carpeta Bestias' }).click()
  await expect(files.getByRole('link', { name: 'Bestiario.pdf', exact: true })).toBeVisible()

  // A la papelera (desde su engranaje) y de vuelta
  await page.getByRole('button', { name: 'Ajustes de Bestiario.pdf' }).click()
  await page
    .getByRole('dialog', { name: 'Ajustes de Bestiario.pdf' })
    .getByRole('button', { name: 'Borrar el archivo' })
    .click()
  await page
    .getByRole('dialog', { name: '¿Borrar «Bestiario.pdf»?' })
    .getByRole('button', { name: 'Borrar el archivo' })
    .click()
  await expect(page.getByRole('link', { name: 'Bestiario.pdf', exact: true })).toHaveCount(0)
  await page.goto(page.url().replace('/archivos', '/papelera'))
  await page.getByRole('button', { name: 'Restaurar Bestiario.pdf' }).click()
  await expect(page.getByText('La papelera está vacía')).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Abrir la carpeta Bestias' }).click()
  await expect(page.getByRole('link', { name: 'Bestiario.pdf', exact: true })).toBeVisible()
})

test('los archivos, en los dos temas @a11y', async ({ page }) => {
  await openFiles(page)
  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  await expect(page.getByRole('status').getByText('Subidos 2 archivos')).toBeAttached()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})
