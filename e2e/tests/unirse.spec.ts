import { connect, schema } from '@crisol/db'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'
import { campaignLink, fillNewAccount, signOut, skipTours } from './ayudas.ts'

const jugadora = { name: 'Jugadora', email: 'jugadora@crisol.test', password: 'una-clave-larga' }

const players = async () => {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    const members = await conn.db.select().from(schema.campaignMembers)
    return members.filter((m) => m.role === 'player').length
  } finally {
    await conn.close()
  }
}

test('una jugadora nueva abre el enlace, crea su cuenta y queda en la campaña', async ({ page, browser, request }) => {
  const link = await campaignLink(page)

  // Como un bot de vista previa: abrir el enlace no une a nadie
  const preview = await request.get(link)
  expect(await preview.text()).toContain('Invitación a una campaña de Crisol')
  expect(preview.headers()['x-robots-tag']).toBe('noindex')
  expect(await players()).toBe(0)

  const player = await browser.newPage()
  await skipTours(player, jugadora.email)
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Te invitan a La Marca' })).toBeVisible()
  await expect(player.getByText('Eana · Máster: Enrique')).toBeVisible()
  await fillNewAccount(player, jugadora)
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  await expect(player.getByLabel('Enlace de invitación')).toHaveCount(0)
  expect(await players()).toBe(1)

  // El máster ve la entrada en el enlace
  await page.reload()
  await expect(page.getByText('Ha entrado 1 con este enlace')).toBeVisible()
  await player.close()

  // Con sesión, el enlace dice con qué cuenta se entra y deja cambiarla sin irse de él
  await page.goto(link)
  await expect(page.getByText('Entras como Enrique (enrique@crisol.test).')).toBeVisible()
  await page.getByRole('button', { name: 'Usar otra cuenta' }).click()
  await expect(page.getByRole('button', { name: 'Crear la cuenta y entrar' })).toBeVisible()
  await expect(page).toHaveURL(link)
  await expect(page.getByRole('heading', { level: 1, name: 'Te invitan a La Marca' })).toBeFocused()
})

test('con cuenta: entra y vuelve a la confirmación; con el enlace cerrado o cambiado, no entra', async ({
  page,
  browser
}) => {
  // Con la máquina cargada rozaba los 30 s (de 22 a 32 en las baterías enteras): con el margen de las demás largas
  test.slow()
  const link = await campaignLink(page)
  const player = await browser.newPage()
  await skipTours(player, jugadora.email)
  await player.goto(link)
  await fillNewAccount(player, jugadora)
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  await signOut(player)

  await player.goto(link)
  await player.getByRole('button', { name: 'Entrar con ella' }).click()
  await player.getByLabel('Email').fill('jugadora@crisol.test')
  await player.getByLabel('Contraseña', { exact: true }).fill('una-clave-larga')
  await player.getByRole('button', { name: 'Entrar', exact: true }).click()
  await player.getByRole('button', { name: 'Entrar en La Marca como jugador' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()

  // Cerradas de verdad (guardado) antes de probar el enlace
  const closing = page.waitForResponse('**/api/actions/setInvitationsOpen')
  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).uncheck()
  await closing
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()

  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).check()
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await expect(page.getByLabel('Enlace de invitación')).not.toHaveValue(link)
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()
  await player.close()
})
