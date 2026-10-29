import { expect, test } from '@playwright/test'
import { campaignLink, freshOwner, newPlayer } from './ayudas.ts'

test('el máster ve entrar a la jugadora sin recargar, la expulsa desde el aviso y ella pierde la campaña al momento', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const members = page.getByRole('list', { name: 'Miembros' }).getByRole('listitem')
  await expect(members).toHaveCount(1)

  // La pestaña tiene la misma versión de la web que el servidor: no hay aviso de versión nueva
  await expect(page.getByText('Hay una versión nueva de Crisol.')).toHaveCount(0)

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

test('una pestaña abierta antes de un despliegue avisa de que hay una versión nueva y recarga', async ({ page }) => {
  // Como si el servidor ya sirviera otra versión: se cambia la del saludo al conectar
  await page.routeWebSocket('**/api/realtime', (ws) => {
    const server = ws.connectToServer()
    server.onMessage((message) => {
      const data = JSON.parse(String(message)) as { type: string }
      ws.send(data.type === 'hello' ? JSON.stringify({ ...data, build: '/assets/index-nueva.js' }) : message)
    })
  })
  await freshOwner(page)
  await expect(page.getByText('Hay una versión nueva de Crisol.')).toBeVisible()
  const reloaded = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Recargar' }).click()
  await reloaded
})
