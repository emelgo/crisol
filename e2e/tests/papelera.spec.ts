import { expect, test } from '@playwright/test'
import { campaignLink, closeWindow, newPlayer, openSettings, openWindow, openWorld, toWorlds } from './ayudas.ts'

test('el máster borra una campaña con una jugadora dentro: ella la pierde al momento y vuelve al restaurarla', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const player = await newPlayer(browser, link)
  const campaignUrl = player.url()

  await toWorlds(page)
  const settings = await openSettings(page, 'La Marca')
  await settings.getByRole('button', { name: 'Borrar la campaña' }).click()
  const confirm = page.getByRole('dialog', { name: '¿Borrar «La Marca»?' })
  await expect(confirm).toHaveAccessibleDescription(
    'Irá a la papelera y sus jugadores dejarán de verla. Se podrá recuperar durante 30 días.'
  )
  await confirm.getByLabel('Nombre de la campaña').fill('La Marca')
  await confirm.getByRole('button', { name: 'Borrar la campaña' }).click()
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  // La tenía abierta: deja de verla sin recargar, y su enlace ya no vale
  await expect(player.getByRole('heading', { name: 'Esta campaña no existe' })).toBeVisible()
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()

  // La del mundo, dentro de él
  await openWorld(page, 'Eana')
  const trash = await openWindow(page, 'Papelera')
  await expect(trash.getByRole('heading', { level: 1, name: 'Papelera de Eana' })).toBeVisible()
  const items = trash.getByRole('list', { name: 'En la papelera' }).getByRole('listitem')
  await expect(items).toHaveText([/^La Marca.*Campaña de Eana · Se borra del todo el/])
  await trash.getByRole('button', { name: 'Restaurar La Marca' }).click()
  await expect(trash.getByText('La papelera está vacía.')).toBeVisible()
  await closeWindow(trash)

  await player.goto(campaignUrl)
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  const history = await openWindow(page, 'Historial')
  await expect(history.getByRole('list', { name: 'Operaciones' }).getByRole('listitem').first()).toHaveText(
    /^Enrique restauró la campaña «La Marca» de Eana/
  )
  await player.close()
})
