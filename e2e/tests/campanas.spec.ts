import { expect, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, openWorld, rename } from './ayudas.ts'

test('el máster crea dos campañas en su mundo, renombra una y siguen al recargar', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWorld(page, 'Eana')
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Campañas' }).click()
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  for (const name of ['La Marca', 'Las Islas']) {
    await createCampaign(page, name)
    await expect(page.getByRole('list', { name: 'Campañas' }).getByText(name)).toBeVisible()
  }

  await rename(page, 'campaña', 'La Marca', 'La Marca del Este')
  const list = page.getByRole('list', { name: 'Campañas' })
  await expect(list.getByText('La Marca del Este')).toBeVisible()

  await page.reload()
  await expect(list.getByText('La Marca del Este')).toBeVisible()
  await expect(list.getByText('Las Islas')).toBeVisible()
  await expect(list.getByText('Máster')).toHaveCount(2)
})
