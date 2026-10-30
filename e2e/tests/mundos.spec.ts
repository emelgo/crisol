import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, rename } from './ayudas.ts'

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
