import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWorld } from './ayudas.ts'

test('Ctrl+K: recientes, títulos con erratas y órdenes; buscar en la página resalta y salta', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWorld(page, 'Eana')
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const created = await page.request.post('/api/actions/createPages', {
    data: {
      worldId,
      parentId: null,
      pages: [
        {
          key: 'p',
          title: 'Puerto Ceniza',
          markdown: 'El dragón del puerto.\n\nOtro Dragon más.\n\nY el último dragón.'
        },
        { key: 'm', title: 'Maela Varn', markdown: 'Capitana.' }
      ]
    }
  })
  const [puerto] = (await created.json()).pages
  await page.goto(`/mundos/${worldId}/wiki/${puerto.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeVisible()

  // Recientes: la página abierta
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', { name: 'Ir a una página' })
  await expect(dialog.getByRole('combobox')).toBeFocused()
  await expect(dialog.getByRole('option', { name: /Puerto Ceniza/ })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([])
  // Con una errata
  await page.keyboard.type('maela barn')
  await expect(dialog.getByRole('option', { name: /Maela Varn/ })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Maela Varn' })).toBeVisible()
  await expect(dialog).toBeHidden()

  // Las órdenes
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('>archivos')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Archivos de Eana' })).toBeVisible()

  // Buscar en la página
  await page.goto(`/mundos/${worldId}/wiki/${puerto.id}`)
  await page.getByRole('button', { name: 'Buscar en la página' }).click()
  const field = page.getByRole('searchbox', { name: 'Buscar en la página' })
  await expect(field).toBeFocused()
  await field.fill('dragon')
  await expect(page.getByRole('status').filter({ hasText: 'de 3' })).toHaveText('1 de 3')
  await expect(page.locator('.ProseMirror mark, .ProseMirror [class*="match"]')).toHaveCount(3)
  await field.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'de 3' })).toHaveText('2 de 3')
  await page.getByRole('button', { name: 'Cerrar la búsqueda' }).click()
  await expect(page.locator('.ProseMirror [class*="match"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Buscar en la página' })).toBeFocused()
})
