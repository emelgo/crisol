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

test('subir archivos: con su progreso, en su carpeta, se sirven tal cual y van a la papelera y vuelven', async ({
  page
}) => {
  await openFiles(page)

  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  const uploads = page.getByRole('region', { name: 'Subidas' })
  await expect(uploads.getByText('Subido')).toHaveCount(2)
  await expect(page.getByRole('status').getByText('Subidos 2 archivos')).toBeAttached()
  const map = page.getByRole('region', { name: /Imágenes/ }).getByRole('link', { name: 'Mapa de Eana.png' })
  await expect(map).toBeVisible()
  await expect(page.getByRole('region', { name: /PDF/ }).getByRole('link', { name: 'Bestiario.pdf' })).toBeVisible()

  // El enlace lleva a sus bytes, con la sesión
  const served = await page.request.get((await map.getAttribute('href')) ?? '')
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('image/png')
  expect(Buffer.from(await served.body()).equals(PNG)).toBe(true)

  // El mismo nombre otra vez: con número
  await worldUpload(page).setInputFiles([{ name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG }])
  await expect(page.getByRole('link', { name: 'Mapa de Eana (2).png' })).toBeVisible()

  // A la papelera y de vuelta
  await page.getByRole('button', { name: 'Borrar Bestiario.pdf' }).click()
  await page.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Bestiario.pdf' })).toHaveCount(0)
  await page.goto(page.url().replace('/archivos', '/papelera'))
  await page.getByRole('button', { name: 'Restaurar Bestiario.pdf' }).click()
  await expect(page.getByText('La papelera está vacía')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Bestiario.pdf' })).toBeVisible()
})

test('los archivos, en los dos temas @a11y', async ({ page }) => {
  await openFiles(page)
  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  await expect(page.getByRole('region', { name: 'Subidas' }).getByText('Subido')).toHaveCount(2)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})
