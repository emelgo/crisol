import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openSettings, rename } from './ayudas.ts'

// Un PNG de verdad (1×1), para que el navegador lo pinte
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

test('el propietario crea un mundo, lo renombra y sigue ahí al recargar', async ({ page }) => {
  await freshOwner(page)
  await expect(page.getByText('Aún no tienes mundos')).toBeVisible()

  await createWorld(page, 'Eana')
  const list = page.getByRole('list', { name: 'Mundos' })
  await expect(list.getByText('Eana')).toBeVisible()
  await expect(list.getByText('Máster')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Nuevo mundo' })).toHaveCount(0)

  await rename(page, 'mundo', 'Eana', 'Eana (Fateforge)')
  await expect(list.getByText('Eana (Fateforge)')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('list', { name: 'Mundos' }).getByText('Eana (Fateforge)')).toBeVisible()
})

test('la portada de un mundo: se pone desde su engranaje y «Ver» la abre en grande desde la tarjeta', async ({
  page
}) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  const settings = await openSettings(page, 'Eana')
  await settings.getByRole('button', { name: 'Añadir portada' }).click()
  const cover = page.getByRole('dialog', { name: 'Portada de Eana' })
  await cover.locator('input[type="file"]').setInputFiles({ name: 'eana.png', mimeType: 'image/png', buffer: PNG })
  await cover.getByRole('button', { name: 'Guardar' }).click()
  await expect(cover).toHaveCount(0)
  await settings.getByRole('button', { name: 'Cerrar' }).click()
  await expect(settings).toHaveCount(0)
  // En la tarjeta, «Ver» queda por encima del enlace que la cubre
  const card = page.getByRole('listitem').filter({ hasText: 'Eana' })
  await card.hover()
  await card.getByRole('button', { name: 'Ver' }).click()
  await expect(page.getByRole('dialog', { name: 'Portada de Eana' })).toBeVisible()
})
