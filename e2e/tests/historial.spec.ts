import { expect, test } from '@playwright/test'
import { campaignLink } from './ayudas.ts'

test('el propietario ve en el historial lo que ha hecho, en el mundo y en toda la organización', async ({ page }) => {
  await campaignLink(page)
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('button', { name: 'Renombrar La Marca' }).click()
  await page.getByLabel('Nuevo nombre de La Marca').fill('La Marca del Este')
  await page.getByRole('button', { name: 'Guardar' }).click()

  await page.getByRole('link', { name: 'Historial' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Historial de Eana' })).toBeVisible()
  const entries = page.getByRole('list', { name: 'Operaciones' }).getByRole('listitem')
  await expect(entries).toHaveText([
    /^Enrique renombró la campaña «La Marca» a «La Marca del Este».*· web/,
    /^Enrique generó un enlace nuevo para La Marca/,
    /^Enrique creó la campaña «La Marca» en Eana/,
    /^Enrique creó el mundo «Eana»/
  ])

  await page.goto('/mundos')
  await page.getByRole('link', { name: 'Historial de la organización' }).click()
  await expect(entries).toHaveCount(6)
  await expect(entries.last()).toHaveText(/^Crisol creó la organización «Fateforge»/)
  await expect(entries.nth(4)).toHaveText(/^Enrique entró como propietario/)
})

test('el máster deshace crear una campaña y lo rehace; si algo cambió después, se le dice qué', async ({ page }) => {
  await campaignLink(page)
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Historial' }).click()
  await page.getByRole('button', { name: 'Deshacer: creó la campaña «La Marca» en Eana' }).click()
  const entries = page.getByRole('list', { name: 'Operaciones' }).getByRole('listitem')
  await expect(entries.first()).toHaveText(/^Enrique deshizo: creó la campaña «La Marca» en Eana/)
  await page.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  // Rehacer: deshacer el deshacer
  await page.getByRole('link', { name: 'Historial' }).click()
  await page.getByRole('button', { name: 'Rehacer: creó la campaña «La Marca» en Eana' }).click()
  await expect(entries.first()).toHaveText(/^Enrique rehízo: creó la campaña «La Marca» en Eana/)
  await page.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByRole('link', { name: 'La Marca' })).toBeVisible()

  // Con un cambio posterior, el deshacer de la creación se niega y dice cuál
  await page.getByRole('button', { name: 'Renombrar La Marca' }).click()
  await page.getByLabel('Nuevo nombre de La Marca').fill('La Marca del Este')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('link', { name: 'Historial' }).click()
  await page.getByRole('button', { name: 'Deshacer: creó la campaña «La Marca» en Eana' }).click()
  const conflict =
    'No se puede deshacer: después, Enrique renombró la campaña «La Marca» a «La Marca del Este». Deshaz eso antes.'
  await expect(page.getByRole('main').getByText(conflict)).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(conflict)
})
