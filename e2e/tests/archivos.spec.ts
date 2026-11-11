import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki, openWorldFiles } from './ayudas.ts'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])
const PDF = Buffer.from('%PDF-1.7\nun bestiario')

/** Subir (a la carpeta elegida; sin ninguna, a lo más alto) */
const worldUpload = (page: Page) => page.locator('input[type=file][multiple]').first()

async function openFiles(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await openWorldFiles(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeVisible()
}

test('subir archivos: salen en la lista, se sirven tal cual, se ordenan en carpetas y van a la papelera y vuelven', async ({
  page
}) => {
  await openFiles(page)

  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  await expect(page.getByRole('status').getByText('Subidos 2 archivos')).toBeAttached()
  // Acabadas, ya son sus filas: no queda ninguna subida
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

  // Una carpeta (la fila del final de la lista), y el bestiario dentro, arrastrándolo al centro de su fila
  await page.getByRole('button', { name: 'Nueva carpeta', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Nueva carpeta' })
  await create.getByLabel('Nombre de la carpeta').fill('Bestias')
  await create.getByRole('button', { name: 'Crear la carpeta' }).click()
  await expect(create).toHaveCount(0)
  // (has: se busca dentro de la fila: sin partir de la lista)
  const folder = page.getByRole('button', { name: 'Bestias', exact: true })
  const folderRow = page.locator('[data-file-card]').filter({ has: folder })
  await expect(folder).toBeVisible()
  await page.locator('[data-file-card]').filter({ hasText: 'Bestiario.pdf' }).dragTo(folderRow)
  // Va dentro: la carpeta se queda abierta, con él debajo
  await expect(folder).toHaveAttribute('aria-expanded', 'true')
  await expect(folderRow.getByText('1 archivo')).toBeVisible()
  await expect(
    page.getByRole('listitem').filter({ has: folder }).getByRole('link', { name: 'Bestiario.pdf' })
  ).toBeVisible()
  await expect(page.getByRole('status').getByText('«Bestiario.pdf», ahora en «Bestias»')).toBeAttached()
  // Pulsarla la pliega
  await folder.click()
  await expect(bestiary).toHaveCount(0)
  await folder.click()
  await expect(bestiary).toBeVisible()

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
  await page.getByRole('button', { name: 'Bestias', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Bestiario.pdf', exact: true })).toBeVisible()
})

test('los archivos, en los dos temas @a11y', async ({ page }) => {
  await openFiles(page)
  await worldUpload(page).setInputFiles([
    { name: 'Mapa de Eana.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Bestiario.pdf', mimeType: 'application/pdf', buffer: PDF }
  ])
  await expect(page.getByRole('status').getByText('Subidos 2 archivos')).toBeAttached()
  // Sin animaciones a medias (un archivo que aparece aún no tiene su contraste)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})
