import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

const api = async (page: Page, name: string, data: Record<string, unknown>) => {
  const response = await page.request.post(`/api/actions/${name}`, { data })
  expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
  return response.json()
}

test('las versiones de la página: verlas, restaurar una y deshacerlo, sin recargar', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  const worldId = page.url().split('/')[4] ?? ''
  const { pages } = await api(page, 'createPages', {
    worldId,
    parentId: null,
    pages: [{ key: 'p', title: 'Puerto Ceniza', markdown: 'La primera versión.' }]
  })
  const pageId = pages[0].id as string
  await api(page, 'editPage', { pageId, body: { mode: 'append', markdown: 'Lo que vino después.' } })
  await page.goto(`/mundos/${worldId}/wiki/${pageId}`)
  await expect(body(page)).toContainText('Lo que vino después.')

  // Las versiones, en «⋯» de la página
  await page.getByRole('button', { name: 'Más acciones' }).click()
  const panel = page.getByRole('region', { name: 'Versiones' })
  await panel.getByRole('button', { name: 'Versiones' }).click()
  await expect(panel.getByRole('listitem')).toHaveCount(2)
  await expect(panel.getByRole('listitem').first()).toContainText('(la de ahora)')
  // Ver la primera, en solo lectura
  const older = panel.getByRole('listitem').nth(1)
  await older.getByRole('button', { name: /^Ver la versión/ }).click()
  const shown = older.getByRole('region', { name: /^Versión del/ })
  await expect(shown).toContainText('La primera versión.')
  await expect(shown).not.toContainText('Lo que vino después.')

  // Restaurarla: el texto cambia sin recargar
  await older.getByRole('button', { name: /^Restaurar la versión/ }).click()
  await expect(page.getByRole('status').getByText(/^Restaurada la versión del/)).toBeAttached()
  await expect(body(page)).not.toContainText('Lo que vino después.')
  await expect(body(page)).toContainText('La primera versión.')

  // Y se deshace desde el historial: vuelve lo de después
  const { entries } = await api(page, 'listHistory', { worldId })
  expect(entries[0].action).toBe('restoreVersion')
  await api(page, 'undoOperation', { operationId: entries[0].id })
  await expect(body(page)).toContainText('Lo que vino después.')
  await page.goto('/historial')
  // La entrada de restaurar, marcada como deshecha
  const restored = page
    .getByRole('listitem')
    .filter({ hasText: 'restauró una versión de «Puerto Ceniza»' })
    .filter({ hasNotText: 'deshizo' })
  await expect(restored).toContainText('deshecho')
})
