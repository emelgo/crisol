import { expect, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

test('el máster crea dos campañas en su mundo, renombra una y siguen al recargar', async ({ page }) => {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeVisible()
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  for (const name of ['La Marca', 'Las Islas']) {
    await page.getByLabel('Nombre de la campaña').fill(name)
    await page.getByRole('button', { name: 'Crear la campaña' }).click()
    await expect(page.getByRole('list', { name: 'Campañas' }).getByText(name)).toBeVisible()
  }

  await page.getByRole('button', { name: 'Renombrar La Marca' }).click()
  await page.getByLabel('Nuevo nombre de La Marca').fill('La Marca del Este')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const list = page.getByRole('list', { name: 'Campañas' })
  await expect(list.getByText('La Marca del Este')).toBeVisible()

  await page.reload()
  await expect(list.getByText('La Marca del Este')).toBeVisible()
  await expect(list.getByText('Las Islas')).toBeVisible()
  await expect(list.getByText('Máster')).toHaveCount(2)
})
