import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

/** El propietario crea Eana y una página, y la deja abierta */
async function openPage(page: Page, title = 'Puerto Ceniza') {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Wiki de Eana' }).click()
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  return page.url()
}

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

test('lo escrito se guarda solo y sigue al recargar, con sus bloques', async ({ page }) => {
  await openPage(page)
  await body(page).click()
  // «# » es un título de nivel 1 del cuerpo: el h2 de la página (su h1 es el título)
  await page.keyboard.type('# Historia')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Se levantó sobre las ruinas de un faro.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- Los Muelles')
  await expect(body(page).getByRole('heading', { level: 2, name: 'Historia' })).toBeVisible()
  await expect(body(page).getByRole('listitem')).toHaveText('Los Muelles')
  // Se guarda unos segundos después del último cambio
  await page.waitForTimeout(2500)
  await page.reload()
  await expect(body(page).getByText('Se levantó sobre las ruinas de un faro.')).toBeVisible()
  await expect(body(page).getByRole('heading', { level: 2, name: 'Historia' })).toBeVisible()
})

test('dos pestañas convergen; sin conexión se sigue escribiendo y llega al volver', async ({ page, context }) => {
  const url = await openPage(page)
  const other = await context.newPage()
  // La red de la otra pestaña, a mano: sin red, su WebSocket de la edición se corta y no vuelve a conectar
  let offline = false
  const open: Array<{ close(): Promise<void> }> = []
  await other.routeWebSocket(/\/api\/collab/, (ws) => {
    if (offline) return void ws.close()
    ws.connectToServer()
    open.push(ws)
  })
  await other.goto(url)
  await expect(body(other)).toBeVisible()
  await body(page).click()
  await page.keyboard.type('Desde la primera pestaña.')
  await expect(body(other).getByText('Desde la primera pestaña.')).toBeVisible()

  offline = true
  for (const ws of open.splice(0)) await ws.close()
  await expect(other.getByText('Sin conexión: se guardará al volver.')).toBeVisible()
  await body(other).click()
  await other.keyboard.press('End')
  await other.keyboard.type(' Escrito sin conexión.')
  offline = false
  await expect(other.getByText('Sin conexión: se guardará al volver.')).toBeHidden({ timeout: 20_000 })
  await expect(body(page).getByText('Escrito sin conexión.', { exact: false })).toBeVisible({ timeout: 20_000 })
})

test('con el candado, el texto no se edita', async ({ page }) => {
  await openPage(page)
  await page.getByRole('button', { name: 'Poner en lectura' }).click()
  await expect(page.getByText('En lectura: quita el candado para editar.')).toBeVisible()
  await expect(body(page)).toHaveAttribute('contenteditable', 'false')
  await page.getByRole('button', { name: 'Quitar el candado' }).click()
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
})
