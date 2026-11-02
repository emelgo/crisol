import AxeBuilder from '@axe-core/playwright'
import { connect, schema } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'
import {
  closeWindow,
  createCampaign,
  createWorld,
  fillNewAccount,
  newPlayer,
  openProfile,
  openSettings,
  openWindow,
  openWorld,
  skipTours
} from './ayudas.ts'

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

test('arranque, perfil, mundos y sus ajustes, campañas, avisos, historial, papelera y consentimiento, en los dos temas @a11y', async ({
  page,
  browser
}) => {
  // Recorre todas las pantallas con axe en los dos temas: más largo que una prueba normal
  test.slow()
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    await resetDatabase(conn.sql)
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const check = async () => {
      // Lo que esté a medio animar (entrar en un mundo) se mide ya quieto
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== 'running' || animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY
          )
      )
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
        const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
        expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
      }
    }
    await skipTours(page, 'enrique@crisol.test')
    await page.goto(`/arranque/${secret}`)
    await expect(page.getByRole('button', { name: 'Crear la cuenta' })).toBeVisible()
    await check()
    await fillNewAccount(page, { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' })
    await page.getByRole('button', { name: 'Crear la cuenta' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
    const profile = await openProfile(page)
    await expect(profile.getByRole('heading', { name: 'Perfil' })).toBeVisible()
    await check()
    await closeWindow(profile)
    await createWorld(page, 'Eana')
    await check()
    // Los ajustes del mundo, con su zona de peligro y la confirmación de borrarlo
    const settings = await openSettings(page, 'Eana')
    await check()
    await settings.getByRole('button', { name: 'Borrar el mundo' }).click()
    await check()
    await page.getByRole('dialog', { name: '¿Borrar «Eana»?' }).getByRole('button', { name: 'Cancelar' }).click()
    await closeWindow(settings)
    await openWorld(page, 'Eana')
    await check()
    await createCampaign(page, 'La Marca')
    await check()
    await page.getByRole('link', { name: 'La Marca', exact: true }).click()
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
    await page.keyboard.press('Escape')
    // El aviso de que alguien ha entrado, con su confirmación de expulsar
    const bea = await newPlayer(browser, invitationLink, 'Bea')
    const notices = page.getByRole('region', { name: 'Avisos' })
    await notices.getByRole('button', { name: 'Expulsar a Bea' }).click()
    await check()
    await bea.close()
    await page.keyboard.press('Escape')
    // Historial y Papelera, en su ventana
    const history = await openWindow(page, 'Historial')
    await expect(history.getByRole('list', { name: 'Operaciones' })).toBeVisible()
    await check()
    await closeWindow(history)
    const trash = await openWindow(page, 'Papelera')
    await expect(trash.getByText('La papelera está vacía')).toBeVisible()
    await check()
    await closeWindow(trash)
    // La página de consentimiento sin consulta firmada: se ve igual, aunque permitir fallaría. El cliente no es una
    // URL: con una, el servidor iría a buscar sus metadatos (CIMD) a internet y la prueba dependería de la red
    await page.goto('/oauth/consentimiento?client_id=cliente-de-prueba')
    await expect(page.getByRole('heading', { name: 'Conectar cliente-de-prueba' })).toBeVisible()
    await check()
    // La página de unirse: con sesión (el máster) y sin ella
    await page.goto(invitationLink)
    await expect(page.getByRole('button', { name: 'Entrar en La Marca como jugador' })).toBeVisible()
    await check()
    // El menú de la cuenta, abierto
    await page.getByRole('navigation', { name: 'Cuenta' }).locator('button[aria-expanded]').click()
    await check()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await page.goto(invitationLink)
    await expect(page.getByRole('button', { name: 'Crear la cuenta y entrar' })).toBeVisible()
    await check()
  } finally {
    await conn.close()
  }
})
