import { expect, test } from '@playwright/test'

test('la portada sale en español', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Crisol' })).toBeVisible()
  await expect(page.getByText('Mundos de rol y mesa virtual')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
})

test('solo hay tema oscuro, aunque el sistema pida el claro, y nada para cambiarlo', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Crisol' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(23, 24, 27)')
  await expect(page.getByRole('button', { name: /tema/i })).toHaveCount(0)
})

test('una dirección de la app que no existe lo dice y deja volver', async ({ page }) => {
  await page.goto('/esto/no-existe')
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver al inicio' }).click()
  await expect(page).toHaveURL('/')
})
