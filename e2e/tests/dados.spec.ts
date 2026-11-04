import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

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

test('el máster y una jugadora en dos pestañas: la pública llega al momento; la «al máster», marcada para él', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const ana = await newPlayer(browser, link, 'Ana')
  const open = async (who: typeof page) => {
    await who.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
    const dice = who.getByRole('complementary', { name: 'Dados' })
    await expect(dice).toBeVisible()
    return dice
  }
  const master = await open(page)
  const player = await open(ana)

  // Él tira para todos: a ella le llega sin recargar
  await master.getByRole('textbox', { name: 'Tirada' }).fill('1d20+5 # Iniciativa')
  await master.getByRole('button', { name: 'Tirar' }).click()
  const forAna = player.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()
  await expect(forAna).toContainText('Iniciativa')
  await expect(forAna).toContainText(/Enrique|Ana/)

  // Ella tira «al máster»: a él le llega marcada, y a ella también
  await player.getByText('Al máster', { exact: true }).click()
  await player.getByRole('textbox', { name: 'Tirada' }).fill('1d20+7 # Sigilo')
  await player.getByRole('textbox', { name: 'Tirada' }).press('Enter')
  const forMaster = master.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()
  await expect(forMaster).toContainText('Sigilo')
  await expect(forMaster).toContainText('Al máster')
  await expect(player.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()).toContainText(
    'Tú'
  )

  // El desglose, al desplegar
  await forMaster.getByRole('button', { name: 'Desglose' }).click()
  await expect(forMaster).toContainText(/1d20\+7 → \[\d+\] \+ 7 = \d+/)

  const { violations } = await new AxeBuilder({ page })
    .include('[data-tour="ficha-dados"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([])
  await ana.close()
})

test('en el móvil, los dados en una hoja que sube desde abajo, desde el menú de la llama', async ({ page }) => {
  await campaignLink(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dados' }).click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  // Abajo del todo y de lado a lado, cuando acaba de subir
  await expect
    .poll(async () => {
      const box = await dice.boundingBox()
      return [Math.round((box?.y ?? 0) + (box?.height ?? 0)), Math.round(box?.width ?? 0)]
    })
    .toEqual([844, 390])
  await dice.getByRole('textbox', { name: 'Tirada' }).fill('2d6+3 # Daño')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  await expect(dice.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()).toContainText(
    'Daño'
  )
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('[data-tour="ficha-dados"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious, `${colorScheme}: ${JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))}`).toEqual([])
  }
})
