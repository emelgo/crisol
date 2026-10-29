import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

test('el máster borra una campaña con una jugadora dentro: ella la pierde al momento y vuelve al restaurarla', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const player = await newPlayer(browser, link)
  const campaignUrl = player.url()

  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('button', { name: 'Borrar La Marca' }).click()
  await expect(page.getByText('¿Borrar La Marca? Irá a la papelera: se puede restaurar durante 30 días.')).toBeVisible()
  await page.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  // La tenía abierta: deja de verla sin recargar, y su enlace ya no vale
  await expect(player.getByRole('heading', { name: 'Esta campaña no existe' })).toBeVisible()
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()

  await page.getByRole('link', { name: 'Papelera de Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Papelera de Eana' })).toBeVisible()
  const items = page.getByRole('list', { name: 'En la papelera' }).getByRole('listitem')
  await expect(items).toHaveText([/^La Marca.*Campaña de Eana · Se borra del todo el/])
  await page.getByRole('button', { name: 'Restaurar La Marca' }).click()
  await expect(page.getByText('La papelera está vacía')).toBeVisible()

  await player.goto(campaignUrl)
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Historial de Eana' }).click()
  await expect(page.getByRole('list', { name: 'Operaciones' }).getByRole('listitem').first()).toHaveText(
    /^Enrique restauró la campaña «La Marca» de Eana/
  )
  await player.close()
})
