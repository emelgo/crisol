import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

test('el máster ve entrar a la jugadora sin recargar, la expulsa desde el aviso y ella pierde la campaña al momento', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const members = page.getByRole('list', { name: 'Miembros' }).getByRole('listitem')
  await expect(members).toHaveCount(1)

  const player = await newPlayer(browser, link)
  // Sin recargar: el aviso, la lista y la cuenta del enlace
  await expect(page.getByText('Jugadora ha entrado en La Marca.')).toBeVisible()
  await expect(members).toHaveCount(2)
  await expect(page.getByText('Ha entrado 1 con este enlace')).toBeVisible()

  const notices = page.getByRole('region', { name: 'Avisos' })
  await notices.getByRole('button', { name: 'Expulsar a Jugadora' }).click()
  await notices.getByRole('button', { name: 'Expulsar y cambiar el enlace' }).click()
  await expect(notices.getByText('Jugadora ya no está en la campaña.')).toBeVisible()
  await expect(members).toHaveCount(1)

  // La jugadora tenía la campaña abierta: deja de verla sin recargar, y la API ya no le contesta
  await expect(player.getByRole('heading', { name: 'Esta campaña no existe' })).toBeVisible()
  const campaignId = new URL(player.url()).pathname.split('/').at(-1)
  const response = await player.request.post('/api/actions/listMembers', { data: { campaignId } })
  expect(response.status()).toBe(404)
  await player.close()
})
