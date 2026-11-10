import { expect, type Page, test } from '@playwright/test'
import {
  campaignLink,
  connectClaude,
  createWorld,
  freshOwner,
  gotoLive,
  newPlayer,
  openCampaign,
  signOut,
  skipTours
} from './ayudas.ts'

/**
 * Retiene las respuestas de la API (todas, o las de esas acciones) hasta soltarlas: así se ve qué se pinta mientras
 * llega lo de la cuenta nueva. Devuelve con qué soltarlas
 */
async function holdApi(page: Page, actions?: string[]) {
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const url = '**/api/actions/**'
  await page.route(url, async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
    if (!actions || actions.includes(action)) await held
    await route.continue()
  })
  return async () => {
    release()
    await page.unroute(url)
  }
}

test('al salir no queda nada del máster en la pestaña, tampoco para la jugadora que entra después en ella', async ({
  page,
  browser
}) => {
  await skipTours(page, 'jugadora@crisol.test')
  await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const claude = await connectClaude(page)
  await gotoLive(page, '/mundos')
  await createWorld(page, 'Otro')

  // La cola de Claude, con lo que dijo al aprobar, y el aviso de que alguien ha entrado
  const main = page.getByRole('main')
  const asked = claude.call('enlace_invitacion', { campaignId, change: 'regenerate' })
  await page.getByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' }).click()
  await expect(main.getByText('Hecho: generar un enlace nuevo para La Marca')).toBeVisible()
  const link = String((await asked).structuredContent?.url)
  const player = await newPlayer(browser, link)
  await expect(main.getByText('Jugadora ha entrado en La Marca.')).toBeVisible()
  await player.close()

  await signOut(page)
  await expect(page).toHaveURL('/entrar')
  await expect(page.getByText(/^Hecho:/)).toHaveCount(0)
  await expect(page.getByText(/ha entrado en La Marca/)).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0)

  // La jugadora entra en la misma pestaña, sin recargar
  await page.getByLabel('Email').fill('jugadora@crisol.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-larga')
  // Mientras llegan sus mundos (retenidos desde antes de entrar), no se ven los del máster
  let release = await holdApi(page)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
  await expect(main.getByText('Otro')).toHaveCount(0)
  await expect(main.getByText('Eana')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Papelera', exact: true })).toHaveCount(0)
  await release()
  const worlds = page.getByRole('list', { name: 'Mundos' })
  await expect(worlds.getByRole('listitem')).toHaveText([/^Eana/])
  // Ni el historial ni la papelera del propietario
  await expect(page.getByRole('button', { name: 'Historial', exact: true })).toHaveCount(0)

  // Ni las campañas del máster mientras llegan las suyas, ni luego el enlace de invitación
  release = await holdApi(page, ['listCampaigns'])
  await worlds.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajustes de La Marca' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Historial', exact: true })).toHaveCount(0)
  await release()
  // Su Inicio, desde la tarjeta (en la misma pestaña)
  await page.getByRole('link', { name: 'La Marca', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Marca' })).toBeVisible()
  await page.getByText('La campaña: La Marca').click()
  await expect(page.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByLabel('Enlace de invitación')).toHaveCount(0)
})

test('si sale desde otra pestaña, esta deja de enseñar lo suyo y lleva a entrar', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')

  const other = await page.context().newPage()
  await other.goto('/')
  await signOut(other)
  await expect(other).toHaveURL('/entrar')

  await expect(page).toHaveURL('/entrar')
  await expect(page.getByText('Eana')).toHaveCount(0)
  await other.close()
})
