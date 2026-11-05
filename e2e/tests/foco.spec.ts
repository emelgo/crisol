import { expect, test } from '@playwright/test'
import { campaignLink, createWorld, freshOwner, openAccountWindow, openWindow, sections } from './ayudas.ts'

test('con el teclado: el modo de IA con flechas y las invitaciones con espacio, sin perder el foco', async ({
  page
}) => {
  await campaignLink(page)
  // Cada cambio, guardado antes del siguiente (mientras se guarda uno, otro se ignora)
  const saved = (action: string) => page.waitForResponse(`**/api/actions/${action}`)
  const toggle = page.getByRole('checkbox', { name: 'Invitaciones abiertas' })
  await toggle.focus()
  let saving = saved('setInvitationsOpen')
  await page.keyboard.press('Space')
  await expect(toggle).toBeFocused()
  await expect(toggle).toBeEnabled()
  await saving
  await expect(page.getByText('Ahora nadie puede entrar con el enlace.')).toBeVisible()
  saving = saved('setInvitationsOpen')
  await page.keyboard.press('Space')
  await saving
  await expect(toggle).toBeChecked()
  await expect(toggle).toBeFocused()

  // El modo de la IA, en Ajustes (desde el menú de la cuenta)
  let settings = await openAccountWindow(page, 'Ajustes')
  const copilot = settings.getByRole('radio', { name: /^Copiloto/ })
  await expect(copilot).toBeChecked()
  await copilot.focus()
  for (const name of [/^Asistente/, /^Solo lectura/]) {
    saving = saved('setAiMode')
    await page.keyboard.press('ArrowUp')
    const option = settings.getByRole('radio', { name })
    await expect(option).toBeFocused()
    await expect(option).toBeChecked()
    await expect(option).toBeEnabled()
    await saving
    await expect(page.getByRole('status')).toHaveText('Guardado')
  }
  await page.reload()
  settings = await openAccountWindow(page, 'Ajustes')
  await expect(settings.getByRole('radio', { name: /^Solo lectura/ })).toBeChecked()
})

test('al navegar, el foco va al título de la página, y la pestaña lo dice', async ({ page }) => {
  await campaignLink(page)
  await expect(page).toHaveTitle('La Marca · Crisol')
  // Dentro de la campaña, su barra: el compendio
  await sections(page).getByRole('link', { name: 'Compendio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Compendio' })).toBeFocused()
  await expect(page).toHaveTitle('Compendio · Crisol')
  // La llama de la barra vuelve a Mis mundos
  await sections(page).getByRole('link', { name: 'Crisol' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeFocused()
  await expect(page).toHaveTitle('Mis mundos · Crisol')
  // El mundo: su portada
  await page.getByRole('link', { name: 'Eana', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeFocused()
  await expect(page).toHaveTitle('Eana · Crisol')
})

test('las confirmaciones: el foco va a ellas, vuelve al cancelar y, si algo desaparece, va al siguiente', async ({
  page
}) => {
  await freshOwner(page)
  for (const name of ['Eana', 'Otro']) await createWorld(page, name)

  // Los ajustes del mundo y, dentro, borrarlo: el foco va al campo de la confirmación, que lee su aviso
  await page.getByRole('button', { name: 'Ajustes de Eana' }).press('Enter')
  const settings = page.getByRole('dialog', { name: 'Ajustes de Eana' })
  await settings.getByRole('button', { name: 'Borrar el mundo' }).first().press('Enter')
  const confirm = page.getByRole('dialog', { name: '¿Borrar «Eana»?' })
  await expect(confirm).toHaveAccessibleDescription(
    'Irá a la papelera, con sus campañas y sus páginas, y se podrá recuperar durante 30 días.'
  )
  await expect(confirm.getByLabel('Nombre del mundo')).toBeFocused()
  await confirm.getByRole('button', { name: 'Cancelar' }).press('Enter')
  await expect(settings.getByRole('button', { name: 'Borrar el mundo' }).first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajustes de Eana' })).toBeFocused()

  // Borrado con el teclado: el foco va al mundo siguiente
  await page.getByRole('button', { name: 'Ajustes de Eana' }).press('Enter')
  await settings.getByRole('button', { name: 'Borrar el mundo' }).first().press('Enter')
  await page.keyboard.type('Eana')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Otro' })).toBeFocused()

  // Renombrar con el teclado: al guardar y cerrar, el foco vuelve a su engranaje
  await page.getByRole('button', { name: 'Ajustes de Otro' }).press('Enter')
  await page.getByRole('dialog', { name: 'Ajustes de Otro' }).getByLabel('Nombre del mundo').press('End')
  await page.keyboard.type(' 2')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Ajustes de Otro 2' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajustes de Otro 2' })).toBeFocused()

  // Deshacerlo: el botón desaparece y el foco va a «Rehacer» de la operación nueva
  const history = await openWindow(page, 'Historial')
  await history.getByRole('button', { name: 'Deshacer: renombró el mundo «Otro» a «Otro 2»' }).press('Enter')
  await expect(history.getByRole('button', { name: 'Rehacer: renombró el mundo «Otro» a «Otro 2»' })).toBeFocused()
})
