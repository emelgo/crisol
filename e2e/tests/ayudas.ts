import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { expect, type Page } from '@playwright/test'
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
