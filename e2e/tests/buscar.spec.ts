import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWorld } from './ayudas.ts'

test('buscar en español: sin tildes y con erratas, por secciones, con lo de un secreto marcado y por rama', async ({
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
        { key: 'b', title: 'Bestiario', markdown: 'Las criaturas.' },
        { key: 'd', parent: 'b', title: 'Dragón rojo', markdown: 'El más temido.' },
        {
          key: 'm',
          title: 'La Montaña Gris',
          markdown: '## Guaridas\n\nLos dragones viven en sus cuevas.\n\n> [!secreto]\n> El dragón de la cima duerme.'
        }
      ]
    }
  })
  const [bestiario] = (await created.json()).pages
  // La caja está en la pestaña de buscar del panel de la wiki
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Wiki' }).click()
  await page.getByRole('tab', { name: 'Buscar' }).click()
  await page.getByRole('searchbox', { name: 'Buscar en la wiki' }).fill('dargon')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Buscar en Eana' })).toBeVisible()
  await expect(page.getByText('2 páginas coinciden con «dargon».')).toBeVisible()
  const results = page.getByRole('list', { name: 'Resultados' })
  await expect(results.getByRole('link').first()).toHaveText('Dragón rojo')
  const mountain = results.getByRole('listitem').filter({ hasText: 'La Montaña Gris' }).first()
  await expect(mountain.getByText('Guaridas')).toBeVisible()
  await expect(mountain.getByText('Secreto')).toBeVisible()
  await expect(mountain.locator('mark').first()).toBeVisible()

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }

  // Solo en una rama
  await page.goto(`/mundos/${worldId}/buscar?q=dragon&rama=${bestiario.id}`)
  await expect(page.getByText('Solo en «Bestiario» y sus subpáginas.')).toBeVisible()
  await expect(page.getByText('1 página coincide con «dragon».')).toBeVisible()
  await results.getByRole('link', { name: 'Dragón rojo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dragón rojo' })).toBeVisible()
})
