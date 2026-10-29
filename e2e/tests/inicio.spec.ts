import { expect, test } from '@playwright/test'

test('la portada sale en español', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Crisol' })).toBeVisible()
  await expect(page.getByText('Mundos de rol y mesa virtual')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
})

test('el tema elegido se mantiene al recargar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Cambiar a tema claro' })).toBeVisible()
})

test('una dirección de la app que no existe lo dice y deja volver', async ({ page }) => {
  await page.goto('/esto/no-existe')
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver al inicio' }).click()
  await expect(page).toHaveURL('/')
})
