import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

test('el máster ve a la jugadora y la expulsa cambiando el enlace: ya no ve la campaña ni vuelve a entrar', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const player = await newPlayer(browser, link)
  const campaignUrl = player.url()

  await page.reload()
  const members = page.getByRole('list', { name: 'Miembros' })
  await expect(members.getByRole('listitem')).toHaveText([/Enrique.*Máster/, /Jugadora.*Jugador/])
  await page.getByRole('button', { name: 'Expulsar a Jugadora' }).click()
  await page.getByRole('button', { name: 'Expulsar y cambiar el enlace' }).click()
  // El aviso, en los ajustes de la campaña (se abren encima del Inicio)
  const settings = page.getByRole('dialog', { name: 'Ajustes de la campaña' })
  await expect(settings.getByText('Jugadora ya no está en la campaña.')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Jugadora ya no está en la campaña.')
  await expect(members.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByLabel('Enlace de invitación')).not.toHaveValue(link)

  await player.goto(campaignUrl)
  await expect(player.getByRole('heading', { name: 'Esta campaña no existe' })).toBeVisible()
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()
  await player.close()
})

test('la jugadora ve a sus compañeros y deja la campaña; el máster ya no la ve', async ({ page, browser }) => {
  const link = await campaignLink(page)
  const player = await newPlayer(browser, link)
  // Quién juega, en «La campaña», bajo su ficha
  await player.getByText('La campaña: La Marca').click()
  const members = player.getByRole('list', { name: 'Miembros' })
  await expect(members.getByRole('listitem')).toHaveText([/Enrique.*Máster/, /Jugadora.*Jugador/])
  await expect(player.getByRole('button', { name: /^Expulsar/ })).toHaveCount(0)

  await player.getByRole('button', { name: 'Dejar la campaña' }).click()
  await player.getByRole('button', { name: 'Dejarla' }).click()
  await expect(player).toHaveURL(/\/mundos$/)
  await expect(player.getByRole('link', { name: 'Eana' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveCount(1)
  await player.close()
})
