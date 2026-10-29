import AxeBuilder from '@axe-core/playwright'
import { connect, schema } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

for (const colorScheme of ['light', 'dark'] as const) {
  for (const path of ['/', '/no-existe', '/entrar', '/arranque/no-vale', '/unirse/no-vale']) {
    test(`${path} en tema ${colorScheme === 'light' ? 'claro' : 'oscuro'} @a11y`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
}

test('arranque, perfil, mundos, campañas y consentimiento, en los dos temas @a11y', async ({ page }) => {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    await resetDatabase(conn.sql)
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const check = async () => {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
        const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
        expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
      }
    }
    await page.goto(`/arranque/${secret}`)
    await expect(page.getByRole('button', { name: 'Crear la cuenta' })).toBeVisible()
    await check()
    await page.getByLabel('Nombre').fill('Enrique')
    await page.getByLabel('Email').fill('enrique@crisol.test')
    await page.getByLabel('Contraseña').fill('una-clave-larga')
    await page.getByRole('button', { name: 'Crear la cuenta' }).click()
    await page.getByRole('link', { name: 'Enrique' }).click()
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()
    await check()
    await page.goto('/mundos')
    await page.getByLabel('Nombre del mundo').fill('Eana')
    await page.getByRole('button', { name: 'Crear el mundo' }).click()
    await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible()
    await check()
    await page.getByRole('button', { name: 'Renombrar Eana' }).click()
    await check()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByRole('link', { name: 'Eana' }).click()
    await page.getByLabel('Nombre de la campaña').fill('La Marca')
    await page.getByRole('button', { name: 'Crear la campaña' }).click()
    await expect(page.getByRole('list', { name: 'Campañas' })).toBeVisible()
    await check()
    await page.getByRole('link', { name: 'La Marca' }).click()
    await expect(page.getByLabel('Enlace de invitación')).toBeVisible()
    const invitationLink = await page.getByLabel('Enlace de invitación').inputValue()
    await page.getByRole('button', { name: 'Nuevo enlace' }).click()
    await check()
    // Con una jugadora: la lista de miembros y la confirmación de expulsar
    await conn.db.insert(schema.user).values({ id: 'ana', name: 'Ana', email: 'ana@crisol.test' })
    const [campaign] = await conn.db.select().from(schema.campaigns)
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign?.id ?? '', userId: 'ana', role: 'player' })
    await page.reload()
    await page.getByRole('button', { name: 'Expulsar a Ana' }).click()
    await check()
    // La página de consentimiento sin consulta firmada: se ve igual, aunque permitir fallaría
    await page.goto(`/oauth/consentimiento?client_id=${encodeURIComponent('https://claude.ai/oauth/metadatos')}`)
    await expect(page.getByRole('heading', { name: 'Conectar claude.ai' })).toBeVisible()
    await check()
    // La página de unirse: con sesión (el máster) y sin ella
    await page.goto(invitationLink)
    await expect(page.getByRole('button', { name: 'Entrar en La Marca como jugador' })).toBeVisible()
    await check()
    await page.getByRole('button', { name: 'Salir' }).click()
    await page.goto(invitationLink)
    await expect(page.getByRole('button', { name: 'Crear la cuenta y entrar' })).toBeVisible()
    await check()
  } finally {
    await conn.close()
  }
})
