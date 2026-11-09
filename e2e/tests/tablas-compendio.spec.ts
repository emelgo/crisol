import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { campaignLink, import5e, openCompendiumWindow, settled } from './ayudas.ts'

test('una tabla del mundo: el máster la crea con sus filas, tira dos veces sin que repita y la reinicia', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
  const systemId = await import5e(page)
  const chosen = await page.request.post('/api/actions/updateCampaign', { data: { campaignId, system: systemId } })
  expect(chosen.status()).toBe(200)
  // El compendio entero, en su ventana de la Mesa
  const compendium = await openCompendiumWindow(page)

  // Crearla en el mundo: «Tabla» está aunque el sistema no la declare
  await compendium.getByRole('button', { name: 'Nueva entrada' }).click()
  const editor = page.getByRole('dialog', { name: 'Nueva entrada' })
  await editor.getByLabel('Dónde').selectOption({ label: 'En el mundo' })
  await editor.getByLabel('Tipo').selectOption({ label: 'Tabla' })
  await editor.getByLabel('Nombre').fill('Encuentros en el camino')
  await editor.getByLabel('Fórmula').fill('1d2')
  await editor.getByLabel('Sin reemplazo').check()
  await editor.getByLabel('Resultado del 1 al 1').fill('Bandidos')
  await editor.getByRole('button', { name: 'Añadir una fila' }).click()
  await editor.getByLabel('Resultado del 2 al 2').fill('Un mercader perdido')
  await page.screenshot({ path: test.info().outputPath('tabla-editor.png'), fullPage: false })
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toBeHidden()

  const article = compendium.getByRole('article', { name: 'Encuentros en el camino' })
  const rows = article.getByRole('region', { name: 'Filas de «Encuentros en el camino»' })
  await expect(rows.getByRole('row')).toHaveCount(3)
  const roll = rows.getByRole('button', { name: 'Tirar 1d2 en «Encuentros en el camino»' })

  // Dos tiradas: no repite, y lo sacado queda marcado
  await roll.click()
  await expect(rows.getByText('Ahora')).toBeVisible()
  await expect(rows).toContainText('Una sacada')
  await roll.click()
  await expect(rows).toContainText('Ya ha salido todo')
  await expect(rows.getByText('Ya salió')).toHaveCount(1)
  await expect(rows.getByText('Ahora')).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('tabla-tiradas.png'), fullPage: false })
  // Las dos, en el registro: una de cada
  const log = await (await page.request.post('/api/actions/listRolls', { data: { campaignId } })).json()
  const texts = log.rolls.map((r: { table?: { results: { text: string }[] } }) => r.table?.results[0]?.text)
  expect(texts.sort()).toEqual(['Bandidos', 'Un mercader perdido'])

  // Una tercera, no: hay que reiniciarla
  await expect(roll).toHaveAttribute('aria-disabled', 'true')
  await rows.getByRole('button', { name: 'Reiniciar' }).click()
  await page.getByRole('dialog', { name: '¿Reiniciar la tabla?' }).getByRole('button', { name: 'Reiniciar' }).click()
  await expect(rows).toContainText('0 sacadas')
  await expect(rows.getByText('Ya salió')).toHaveCount(0)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page })
      .include('[data-window]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
})
