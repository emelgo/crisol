import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWorld } from './ayudas.ts'

test('un solo buscador, el de la ficha del árbol (Ctrl+K lo enfoca): filtra el árbol y con Intro busca en el texto; buscar en la página resalta y salta', async ({
  page
}) => {
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

  // Ctrl+K enfoca el buscador de la ficha del árbol (Enrique, 2026-11-16: uno solo, el de la izquierda)
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('searchbox', { name: 'Buscar por nombre o #etiqueta' })
  await expect(search).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Filtra al escribir
  await page.keyboard.type('maela')
  await page
    .getByRole('list', { name: 'Páginas que coinciden' })
    .getByRole('link', { name: /Maela Varn/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Maela Varn' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([])
  // Con Intro, en el texto de todas
  await page.keyboard.press('ControlOrMeta+k')
  await search.fill('dragón')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/buscar\?q=/)

  // Buscar en la página
  await page.goto(`/mundos/${worldId}/wiki/${puerto.id}`)
  await page.getByRole('textbox', { name: 'Texto de la página' }).click()
  await page.keyboard.press('Control+Alt+f')
  const field = page.getByRole('searchbox', { name: 'Buscar en la página' })
  await expect(field).toBeFocused()
  await field.fill('dragon')
  await expect(page.getByRole('status').filter({ hasText: 'de 3' })).toHaveText('1 de 3')
  await expect(page.locator('.ProseMirror mark, .ProseMirror [class*="match"]')).toHaveCount(3)
  await field.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'de 3' })).toHaveText('2 de 3')
  await page.getByRole('button', { name: 'Cerrar la búsqueda' }).click()
  await expect(page.locator('.ProseMirror [class*="match"]')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Texto de la página' })).toBeFocused()
})
