import { expect, type Page, test } from '@playwright/test'
import { campaignLink, connectClaude, freshOwner, gotoLive, newPlayer, signOut } from './ayudas.ts'

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
  await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const claude = await connectClaude(page)
  await gotoLive(page, '/mundos')
  await page.getByLabel('Nombre del mundo').fill('Otro')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await expect(page.getByRole('link', { name: 'Otro' })).toBeVisible()

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
  await expect(page.getByRole('link', { name: 'IA', exact: true })).toHaveCount(0)

  // La jugadora entra en la misma pestaña, sin recargar
  await page.getByLabel('Email').fill('jugadora@crisol.test')
  await page.getByLabel('Contraseña').fill('una-clave-larga')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Hola, Jugadora')).toBeVisible()

  // Mientras llegan sus mundos, no se ven los del máster
  let release = await holdApi(page)
  await page.getByRole('main').getByRole('link', { name: 'Mis mundos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
  await expect(main.getByText('Otro')).toHaveCount(0)
  await expect(main.getByText('Eana')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Papelera' })).toHaveCount(0)
  await release()
  const worlds = page.getByRole('list', { name: 'Mundos' })
  await expect(worlds.getByRole('listitem')).toHaveText([/^Eana.*Jugador/])
  await expect(page.getByRole('link', { name: 'IA', exact: true })).toHaveCount(0)

  // Ni las campañas del máster mientras llegan las suyas, ni luego el enlace de invitación
  release = await holdApi(page, ['listCampaigns'])
  await worlds.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Renombrar La Marca' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Historial' })).toHaveCount(0)
  await release()
  await page.getByRole('link', { name: 'La Marca' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Marca' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByLabel('Enlace de invitación')).toHaveCount(0)
})

test('si sale desde otra pestaña, esta deja de enseñar lo suyo y lleva a entrar', async ({ page }) => {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await expect(page.getByRole('link', { name: 'Eana' })).toBeVisible()

  const other = await page.context().newPage()
  await other.goto('/')
  await signOut(other)
  await expect(other).toHaveURL('/entrar')

  await expect(page).toHaveURL('/entrar')
  await expect(page.getByText('Eana')).toHaveCount(0)
  await other.close()
})
