import { expect, test } from '@playwright/test'
import { campaignLink, import5e, settled } from './ayudas.ts'

test('una entrada nueva del compendio desde una página del mundo, en una ventana: su enlace queda donde se pidió (revisión, tanda 7)', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const five = await import5e(page)
  await api('updateCampaign', { campaignId, system: five })
  const { pages } = await api('createPages', {
    worldId,
    parentId: null,
    pages: [{ key: 'a', title: 'La forja', markdown: 'El herrero vende' }]
  })
  const pageId = pages[0].id as string
  await page.goto(`/mundos/${worldId}/wiki/${pageId}`)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' [[@Martillo de brasa')
  const option = page
    .getByRole('listbox', { name: 'Páginas' })
    .getByRole('option', { name: /Entrada nueva «Martillo de brasa»/ })
  await option.click()

  // La ventana, con el nombre ya escrito; la página sigue ahí
  const window = page.locator('[data-window]').filter({ hasText: 'Nueva entrada' })
  await expect(window).toBeVisible()
  await expect(window.getByLabel('Nombre')).toHaveValue('Martillo de brasa')
  await expect(body).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-ventana.png') })
  await window.getByRole('button', { name: 'Guardar' }).click()
  await expect(window).toBeHidden()

  // Su enlace, donde se pidió, y la entrada en el compendio del mundo
  await expect(body.locator('[data-content-link]', { hasText: 'Martillo de brasa' })).toBeVisible()
  await expect
    .poll(async () => (await api('readPage', { pageId })).markdown as string, { timeout: 10_000 })
    .toContain('[[@Martillo de brasa]]')

  // «/» también la ofrece
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/entrada')
  await expect(
    page.getByRole('listbox', { name: 'Bloques' }).getByRole('option', { name: /^Entrada nueva del compendio/ })
  ).toBeVisible()
  await page.keyboard.press('Escape')
})
