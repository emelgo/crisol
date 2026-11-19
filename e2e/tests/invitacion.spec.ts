import { expect, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, openCampaign, openWorld } from './ayudas.ts'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('el máster ve y copia el enlace de su campaña, genera uno nuevo y cierra las invitaciones', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWorld(page, 'Eana')
  await createCampaign(page, 'La Marca')
  // La campaña se abre en otra pestaña; aquí, en esta, en su pestaña «Campaña»
  await openCampaign(page, 'La Marca', 'campana')

  // Los ajustes, encima del Inicio, que también tiene su «Copiar» (el del conector de la IA)
  const settings = page.getByRole('dialog', { name: 'Ajustes de la campaña' })
  const link = settings.getByLabel('Enlace de invitación')
  await expect(link).toHaveValue(/^http:\/\/127\.0\.0\.1:8131\/unirse\/[\w-]{43}$/)
  const first = await link.inputValue()
  await expect(page.getByText('Nadie ha entrado aún con este enlace')).toBeVisible()

  await settings.getByRole('button', { name: 'Copiar' }).click()
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
