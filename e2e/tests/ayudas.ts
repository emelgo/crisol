import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { type Browser, expect, type Page } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'

export const owner = { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' }

/** Base de datos vacía y el propietario con su cuenta recién creada y la sesión abierta en `page` */
export async function freshOwner(page: Page) {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    await resetDatabase(conn.sql)
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Fateforge' })
    await page.goto(`/arranque/${secret}`)
    await page.getByLabel('Nombre').fill(owner.name)
    await page.getByLabel('Email').fill(owner.email)
    await page.getByLabel('Contraseña').fill(owner.password)
    await page.getByRole('button', { name: 'Crear la cuenta' }).click()
    await expect(page.getByText(`Hola, ${owner.name}`)).toBeVisible()
  } finally {
    await conn.close()
  }
}

/** El propietario crea Eana y La Marca; devuelve el enlace de invitación (con `page` en la campaña) */
export async function campaignLink(page: Page) {
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

/** Una jugadora nueva entra con el enlace creando su cuenta; queda en la campaña, en su propia página */
export async function newPlayer(browser: Browser, link: string, name = 'Jugadora') {
  const player = await browser.newPage()
  await player.goto(link)
  await player.getByLabel('Nombre').fill(name)
  await player.getByLabel('Email').fill(`${name.toLowerCase()}@crisol.test`)
  await player.getByLabel('Contraseña').fill('una-clave-larga')
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  return player
}
