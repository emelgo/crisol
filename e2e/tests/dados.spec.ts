import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { campaignLink } from './ayudas.ts'

test('el máster abre los dados en su campaña y tira: la tirada se explica y se anuncia el total', async ({ page }) => {
  await campaignLink(page)
  const dados = page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' })
  await dados.click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  await expect(dados).toHaveAttribute('aria-pressed', 'true')
  const field = dice.getByRole('textbox', { name: 'Tirada' })
  await field.fill('1d20+5 # Iniciativa')
  await expect(dice.getByText('1d20 + 5 · Iniciativa')).toBeVisible()
  await field.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Iniciativa' })).toHaveText(/^Iniciativa: \d+$/)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('[data-tour="ficha-dados"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious, `${colorScheme}: ${JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))}`).toEqual([])
  }

  // Se cierra con su X, y la barra lo dice
  await dice.getByRole('button', { name: 'Cerrar los dados' }).click()
  await expect(dice).toBeHidden()
  await expect(dados).toHaveAttribute('aria-pressed', 'false')
})
