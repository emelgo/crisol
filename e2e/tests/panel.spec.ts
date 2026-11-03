import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

test('el panel de la página: se añaden bloques, se tocan, se recolocan y siguen al recargar', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  // El cuadro de página nueva: el título, y Intro la crea
  await expect(page.getByRole('dialog').getByLabel('Título', { exact: true })).toBeFocused()
  await page.keyboard.type('Puerto Ceniza')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeVisible()
  const panel = page.getByRole('complementary', { name: 'Panel de la página' })
  await expect(panel.getByText('Panel vacío')).toBeVisible()
  const add = async (kind: string, title: string) => {
    await panel.getByRole('button', { name: 'Añadir bloque' }).click()
    await panel.getByRole('button', { name: kind, exact: true }).click()
    // El título del bloque nuevo, con el foco
    await expect(panel.getByLabel('Título').last()).toBeFocused()
    await page.keyboard.type(title)
    await page.keyboard.press('Enter')
  }

  await add('Barra', 'Amenaza')
  const threat = panel.getByRole('region', { name: 'Amenaza' })
  for (let i = 0; i < 3; i++) await threat.getByRole('button', { name: 'Más' }).click()
  await expect(threat.getByRole('meter', { name: 'Amenaza' })).toHaveAttribute('aria-valuenow', '3')
  await add('Estrellas', 'Fama')
  await panel.getByRole('button', { name: '4 de 5 estrellas' }).click()
  await add('Texto', 'Clima')
  await panel.getByRole('textbox', { name: 'Texto' }).fill('Niebla por la mañana')
  await panel.getByRole('textbox', { name: 'Texto' }).blur()

  // Desde sus opciones: otro máximo y subirlo
  await panel.getByRole('button', { name: 'Opciones de «Fama»' }).click()
  await panel.getByLabel('Máximo').fill('3')
  await panel.getByLabel('Máximo').blur()
  await panel.getByRole('button', { name: 'Subir' }).click()

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('aside').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }

  await expect
    .poll(async () =>
      (await page.getByRole('region').evaluateAll((all) => all.map((r) => r.getAttribute('aria-label')))).join()
    )
    .toContain('Fama,Amenaza,Clima')
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(panel.getByRole('meter', { name: 'Amenaza' })).toHaveAttribute('aria-valuenow', '3')
  // Con 3 de máximo, las 4 estrellas se quedan en 3
  await expect(panel.getByRole('button', { name: '3 de 3 estrellas' })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('textbox', { name: 'Texto' })).toHaveValue('Niebla por la mañana')

  // Queda en el historial y se quita desde sus opciones
  await panel.getByRole('button', { name: 'Opciones de «Clima»' }).click()
  await panel.getByRole('button', { name: 'Quitar el bloque' }).click()
  await expect(panel.getByRole('region', { name: 'Clima' })).toHaveCount(0)
})
