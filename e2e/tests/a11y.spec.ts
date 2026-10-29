import AxeBuilder from '@axe-core/playwright'
import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

for (const colorScheme of ['light', 'dark'] as const) {
  for (const path of ['/', '/no-existe', '/entrar', '/arranque/no-vale']) {
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

test('arranque, perfil, mundos y consentimiento, en los dos temas @a11y', async ({ page }) => {
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
    // La página de consentimiento sin consulta firmada: se ve igual, aunque permitir fallaría
    await page.goto(`/oauth/consentimiento?client_id=${encodeURIComponent('https://claude.ai/oauth/metadatos')}`)
    await expect(page.getByRole('heading', { name: 'Conectar claude.ai' })).toBeVisible()
    await check()
  } finally {
    await conn.close()
  }
})
