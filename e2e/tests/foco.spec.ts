import { expect, test } from '@playwright/test'
import { campaignLink, freshOwner } from './ayudas.ts'

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

  await page.getByRole('link', { name: 'IA', exact: true }).click()
  const copilot = page.getByRole('radio', { name: /^Copiloto/ })
  await expect(copilot).toBeChecked()
  await copilot.focus()
  for (const name of [/^Asistente/, /^Solo lectura/]) {
    saving = saved('setAiMode')
    await page.keyboard.press('ArrowUp')
    const option = page.getByRole('radio', { name })
    await expect(option).toBeFocused()
    await expect(option).toBeChecked()
    await expect(option).toBeEnabled()
    await saving
    await expect(page.getByRole('status')).toHaveText('Guardado')
  }
  await page.reload()
  await expect(page.getByRole('radio', { name: /^Solo lectura/ })).toBeChecked()
})

test('al navegar, el foco va al título de la página, y la pestaña lo dice', async ({ page }) => {
  await campaignLink(page)
  await expect(page).toHaveTitle('La Marca · Crisol')
  await page.getByRole('link', { name: 'Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeFocused()
  await expect(page).toHaveTitle('Eana · Crisol')
  await page.getByRole('link', { name: 'Mis mundos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeFocused()
  await expect(page).toHaveTitle('Mis mundos · Crisol')
})

test('las confirmaciones: el foco va a ellas, vuelve al cancelar y, si algo desaparece, va al siguiente', async ({
  page
}) => {
  await freshOwner(page)
  await page.goto('/mundos')
  for (const name of ['Eana', 'Otro']) {
    await page.getByLabel('Nombre del mundo').fill(name)
    await page.getByRole('button', { name: 'Crear el mundo' }).click()
    await expect(page.getByRole('link', { name })).toBeVisible()
  }

  await page.getByRole('button', { name: 'Borrar Eana' }).press('Enter')
  const confirm = page.getByRole('button', { name: 'Borrar', exact: true })
  await expect(confirm).toBeFocused()
  await expect(confirm).toHaveAccessibleDescription(
    '¿Borrar Eana? Irá a la papelera: se puede restaurar durante 30 días.'
  )
  await page.getByRole('button', { name: 'Cancelar' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Borrar Eana' })).toBeFocused()

  await page.getByRole('button', { name: 'Renombrar Eana' }).press('Enter')
  await expect(page.getByLabel('Nuevo nombre de Eana')).toBeFocused()
  await page.getByRole('button', { name: 'Cancelar' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Renombrar Eana' })).toBeFocused()

  await page.getByRole('button', { name: 'Borrar Eana' }).press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Otro' })).toBeFocused()

  // Renombrar con el teclado: al guardar, el foco vuelve a «Renombrar»
  await page.getByRole('button', { name: 'Renombrar Otro' }).press('Enter')
  await page.keyboard.type(' 2')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Renombrar Otro 2' })).toBeFocused()

  // Deshacerlo: el botón desaparece y el foco va a «Rehacer» de la operación nueva
  await page.getByRole('link', { name: 'Historial de la organización' }).click()
  await page.getByRole('button', { name: 'Deshacer: renombró el mundo «Otro» a «Otro 2»' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Rehacer: renombró el mundo «Otro» a «Otro 2»' })).toBeFocused()
})
