import { expect, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('el máster ve y copia el enlace de su campaña, genera uno nuevo y cierra las invitaciones', async ({ page }) => {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByLabel('Nombre de la campaña').fill('La Marca')
  await page.getByRole('button', { name: 'Crear la campaña' }).click()
  await page.getByRole('link', { name: 'La Marca' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Marca' })).toBeVisible()

  const link = page.getByLabel('Enlace de invitación')
  await expect(link).toHaveValue(/^http:\/\/127\.0\.0\.1:8131\/unirse\/[\w-]{43}$/)
  const first = await link.inputValue()
  await expect(page.getByText('Han entrado 0 con este enlace')).toBeVisible()

  await page.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByRole('status')).toHaveText('Copiado')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first)

  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await expect(page.getByText('Quien aún no haya entrado necesitará el nuevo.')).toBeVisible()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await expect(link).not.toHaveValue(first)

  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).uncheck()
  await expect(page.getByText('Ahora nadie puede entrar con el enlace.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Invitaciones abiertas' })).not.toBeChecked()
  await expect(link).not.toHaveValue(first)
})
