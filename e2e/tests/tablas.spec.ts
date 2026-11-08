import { expect, test } from '@playwright/test'
import { campaignLink } from './ayudas.ts'

test('una tabla del máster: sus filas, tirar en una campaña y lo que salió, en su registro', async ({ page }) => {
  test.slow()
  await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const created = await page.request.post('/api/actions/createPage', { data: { worldId, title: 'Encuentros' } })
  const pageId = (await created.json()).id as string
  const tab = await (await page.request.post('/api/actions/createPageTab', { data: { pageId, kind: 'table' } })).json()
  await page.goto(`/mundos/${worldId}/wiki/${pageId}?pestana=${tab.id}`)

  // Tres filas: 1, 2 y 3; sin fórmula, se tira 1d3
  const add = page.getByRole('button', { name: 'Añadir una fila' })
  for (const text of ['Lobos', 'Bandidos', 'Nada']) {
    await add.click()
    await page
      .getByRole('textbox', { name: /^Resultado del/ })
      .last()
      .fill(text)
  }
  await expect(page.getByRole('textbox', { name: 'Fórmula' })).toHaveAttribute('placeholder', '1d3')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeHidden()

  // Tirar: la fila que salió, marcada «Ahora»; en el registro de dados, con lo que salió
  await page.getByRole('button', { name: 'Tirar' }).click()
  await expect(page.getByText('Ahora')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('tabla.png') })
  await page.locator('[data-tour="dados"]').click()
  const log = page.getByRole('complementary', { name: 'Dados' })
  await expect(log.getByText(/^(Lobos|Bandidos|Nada)$/)).toBeVisible()
})
