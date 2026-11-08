import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

const api = async (page: Page, name: string, data: Record<string, unknown>) => {
  const response = await page.request.post(`/api/actions/${name}`, { data })
  expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
  return response.json()
}

/** Eana con Maela Varn (con resumen y una sección) y Puerto Ceniza, que la enlaza y la incrusta; abierta Puerto */
async function eana(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  const worldId = page.url().split('/')[4] ?? ''
  const { pages } = await api(page, 'createPages', {
    worldId,
    parentId: null,
    pages: [
      {
        key: 'm',
        title: 'Maela Varn',
        markdown:
          '---\nresumen: La jefa de la Lonja.\n---\nNació en los Muelles.\n\n## Historia\n\nLlegó en el barco del alba.'
      },
      {
        key: 'p',
        title: 'Puerto Ceniza',
        markdown: 'Lo gobierna [[Maela Varn]], que [[Maela Varn#Historia|llegó por mar]].\n\n![[Maela Varn#Historia]]'
      }
    ]
  })
  const [maela, puerto] = pages as { id: string }[]
  await page.goto(`/mundos/${worldId}/wiki/${puerto?.id}`)
  await expect(body(page)).toContainText('Lo gobierna')
  return { worldId, maela: maela?.id ?? '', puerto: puerto?.id ?? '' }
}

test.describe('en escritorio', () => {
  test('con el ratón: a los 300 ms sale la vista previa con el resumen; con ancla, la sección', async ({ page }) => {
    await eana(page)
    await body(page).getByRole('link', { name: 'Maela Varn', exact: true }).hover()
    const preview = page.getByRole('dialog', { name: 'Maela Varn' })
    await expect(preview).toBeVisible()
    await expect(preview.getByText('La jefa de la Lonja.')).toBeVisible()
    await page.mouse.move(5, 5)
    await expect(preview).toBeHidden()
    await body(page).getByRole('link', { name: 'llegó por mar' }).hover()
    await expect(
      page.getByRole('dialog', { name: 'Maela Varn' }).getByText('Llegó en el barco del alba.')
    ).toBeVisible()
  })

  test('con el teclado: al elegir el enlace sale; Tab entra en ella y Escape la cierra y vuelve al texto', async ({
    page
  }) => {
    await eana(page)
    // Con la flecha hasta que el enlace queda elegido entero (sin contar letras: lo que importa es llegar). Si un
    // cambio que llega del servidor justo entonces quita la selección, se vuelve a empezar
    const chosen = body(page).locator('.ProseMirror-selectednode')
    await expect(async () => {
      await body(page)
        .getByText('Lo gobierna')
        .click({ position: { x: 4, y: 8 } })
      await page.keyboard.press('Home')
      for (let i = 0; i < 30 && (await chosen.count()) === 0; i++) await page.keyboard.press('ArrowRight')
      await expect(chosen.getByRole('link', { name: 'Maela Varn', exact: true })).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 15_000 })
    const preview = page.getByRole('dialog', { name: 'Maela Varn' })
    await expect(preview).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(preview.getByRole('link', { name: 'Abrir' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()
    await expect(body(page)).toBeFocused()
  })

  test('el incrustado enseña la sección, en solo lectura, y se pone al día cuando la otra página cambia', async ({
    page
  }) => {
    const { maela } = await eana(page)
    const embed = body(page).getByRole('region', { name: 'Incrustado: Maela Varn · Historia' })
    await expect(embed.getByText('Llegó en el barco del alba.')).toBeVisible()
    await expect(embed.getByText('Nació en los Muelles.')).toHaveCount(0)
    await api(page, 'editPage', {
      pageId: maela,
      body: { mode: 'section', section: 'Historia', markdown: 'Llegó a nado.' }
    })
    await expect(embed.getByText('Llegó a nado.')).toBeVisible()
  })

  test('![[ en el texto incrusta una página', async ({ page }) => {
    await eana(page)
    await body(page)
      .getByText('Lo gobierna')
      .click({ position: { x: 4, y: 8 } })
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('![[Maela')
    await page
      .getByRole('listbox', { name: 'Páginas' })
      .getByRole('option', { name: /Maela Varn/ })
      .click()
    await expect(body(page).getByRole('region', { name: 'Incrustado: Maela Varn', exact: true })).toContainText(
      'Nació en los Muelles.'
    )
  })
})

test('la vista previa abierta y el incrustado, en los dos temas @a11y', async ({ page }) => {
  await eana(page)
  await body(page).getByRole('link', { name: 'Maela Varn', exact: true }).hover()
  await expect(page.getByRole('dialog', { name: 'Maela Varn' })).toBeVisible()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})
