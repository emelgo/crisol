import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'
import { fillNewAccount, openProfile, signOut, skipTours } from './ayudas.ts'

const owner = { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' }

test.describe.configure({ mode: 'serial' })

let conn: ReturnType<typeof connect>

test.beforeAll(async () => {
  conn = connect(e2eDatabaseUrl(), { max: 1 })
  await resetDatabase(conn.sql)
})

test.afterAll(async () => {
  await conn.close()
})

test('el propietario crea su cuenta con el enlace de arranque, sale y vuelve a entrar', async ({ page }) => {
  const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
  await skipTours(page, owner.email)

  await page.goto(`/arranque/${secret}`)
  await expect(page.getByText('Crisol de Enrique')).toBeVisible()
  await fillNewAccount(page, owner)
  await page.getByRole('button', { name: 'Crear la cuenta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()

  await signOut(page)
  await expect(page).toHaveURL('/entrar')
  await expect(page.getByRole('button', { name: 'Enrique', exact: true })).toHaveCount(0)

  await page.getByLabel('Email').fill(owner.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(owner.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()

  await page.goto(`/arranque/${secret}`)
  await expect(page.getByRole('heading', { name: 'Este enlace no vale' })).toBeVisible()
})

test('con la contraseña mal no entra y lo dice', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('Email').fill(owner.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('no-es-la-clave')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos')
})

test('el propietario cambia su nombre de usuario en el perfil', async ({ page }) => {
  await skipTours(page, owner.email)
  await page.goto('/entrar')
  await page.getByLabel('Email').fill(owner.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(owner.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
  const profile = await openProfile(page)
  await profile.getByLabel('Nombre de usuario').fill('Enrique M.')
  await profile.getByRole('button', { name: 'Guardar' }).click()
  await expect(profile.getByRole('status')).toHaveText('Guardado')
  await page.reload()
  // El nombre nuevo, en el menú de la cuenta
  await expect(page.getByRole('button', { name: 'Enrique M.', exact: true })).toBeVisible()
})
