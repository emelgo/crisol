import { expect, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

test('el propietario crea un mundo, lo renombra y sigue ahí al recargar', async ({ page }) => {
  await freshOwner(page)
  await page.getByRole('main').getByRole('link', { name: 'Mis mundos' }).click()
  await expect(page.getByText('Aún no tienes mundos')).toBeVisible()

  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  const list = page.getByRole('list', { name: 'Mundos' })
  await expect(list.getByText('Eana')).toBeVisible()
  await expect(list.getByText('Máster')).toBeVisible()
  await expect(page.getByLabel('Nombre del mundo')).toHaveValue('')

  await page.getByRole('button', { name: 'Renombrar Eana' }).click()
  await page.getByLabel('Nuevo nombre de Eana').fill('Eana (Fateforge)')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(list.getByText('Eana (Fateforge)')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('list', { name: 'Mundos' }).getByText('Eana (Fateforge)')).toBeVisible()
})
