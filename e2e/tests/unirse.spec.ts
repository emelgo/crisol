import { connect, schema } from '@crisol/db'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'
import { freshOwner } from './ayudas.ts'

/** El máster crea Eana y La Marca y devuelve el enlace de invitación */
async function campaignLink(page: import('@playwright/test').Page) {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByLabel('Nombre de la campaña').fill('La Marca')
  await page.getByRole('button', { name: 'Crear la campaña' }).click()
  await page.getByRole('link', { name: 'La Marca' }).click()
  return page.getByLabel('Enlace de invitación').inputValue()
}

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
  await player.goto(link)
  await expect(player.getByRole('heading', { name: 'Te invitan a La Marca' })).toBeVisible()
  await expect(player.getByText('Eana · máster: Enrique')).toBeVisible()
  await player.getByLabel('Nombre').fill('Jugadora')
  await player.getByLabel('Email').fill('jugadora@crisol.test')
  await player.getByLabel('Contraseña').fill('una-clave-larga')
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  await expect(player.getByLabel('Enlace de invitación')).toHaveCount(0)
  expect(await players()).toBe(1)

  // El máster ve la entrada en el enlace
  await page.reload()
  await expect(page.getByText('Ha entrado 1 con este enlace')).toBeVisible()
  await player.close()
})

test('con cuenta: entra y vuelve a la confirmación; con el enlace cerrado o cambiado, no entra', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const player = await browser.newPage()
  await player.goto(link)
  await player.getByLabel('Nombre').fill('Jugadora')
  await player.getByLabel('Email').fill('jugadora@crisol.test')
  await player.getByLabel('Contraseña').fill('una-clave-larga')
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Salir' }).click()

  await player.goto(link)
  await player.getByRole('button', { name: 'Ya tengo cuenta' }).click()
  await player.getByLabel('Email').fill('jugadora@crisol.test')
  await player.getByLabel('Contraseña').fill('una-clave-larga')
  await player.getByRole('button', { name: 'Entrar', exact: true }).click()
  await player.getByRole('button', { name: 'Entrar en La Marca como jugador' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()

  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).uncheck()
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
