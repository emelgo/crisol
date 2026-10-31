import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })
const suggestions = (page: Page) => page.getByRole('listbox', { name: 'Páginas' })

async function newPage(page: Page, title: string) {
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  // Ya con su nombre: la dirección deja de decir «nuevo»
  await expect(page).not.toHaveURL(/nuevo/)
}

/** Eana con Maela Varn y Puerto Ceniza (abierta, con el cursor en el texto); devuelve el mundo y las páginas */
async function eana(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await newPage(page, 'Maela Varn')
  const maela = page.url().split('/').at(-1) ?? ''
  await newPage(page, 'Puerto Ceniza')
  const puerto = page.url().split('/').at(-1) ?? ''
  const worldId = page.url().split('/')[4] ?? ''
  await body(page).click()
  return { worldId, maela, puerto }
}

const api = async (page: Page, name: string, data: Record<string, unknown>) => {
  const response = await page.request.post(`/api/actions/${name}`, { data })
  expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
  return response.json()
}

test('[[ sugiere páginas con erratas, enlaza por id, crea la que falta y el enlace sigue a la página', async ({
  page
}) => {
  const { maela } = await eana(page)
  await page.keyboard.type('Lo gobierna [[mela')
  await expect(suggestions(page).getByRole('option', { name: /Maela Varn/ })).toHaveAttribute('aria-selected', 'true')
  await expect(body(page)).toHaveAttribute('aria-activedescendant', /.+/)
  await page.keyboard.press('Enter')
  const link = body(page).getByRole('link', { name: 'Maela Varn' })
  await expect(link).toHaveAttribute('data-state', 'ok')
  await expect(page.getByRole('status').getByText('Enlace a «Maela Varn».')).toBeAttached()

  // Una que no existe: «Crear página»
  await page.keyboard.type('y [[Velaria')
  await expect(suggestions(page).getByRole('option', { name: 'Crear página «Velaria»' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(body(page).getByRole('link', { name: 'Velaria' })).toHaveAttribute('data-state', 'ok')
  await expect(page.getByRole('treeitem', { name: 'Velaria' })).toBeVisible()

  // Renombrar la página: el enlace enseña el título nuevo, sin recargar
  await api(page, 'updatePage', { pageId: maela, title: 'Maela la Maestre' })
  await expect(body(page).getByRole('link', { name: 'Maela la Maestre' })).toBeVisible()

  // Pulsar el enlace lleva a la página
  await body(page).getByRole('link', { name: 'Maela la Maestre' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Maela la Maestre' })).toBeVisible()
})

test('un enlace sin resolver se ve «por crear» y se resuelve solo; uno a la papelera, roto, y se restaura', async ({
  page
}) => {
  const { worldId, maela, puerto } = await eana(page)
  // Claude escribe dos enlaces: uno a Maela y otro a lo que aún no existe
  await api(page, 'editPage', {
    pageId: puerto,
    body: { mode: 'append', markdown: 'Ver [[Maela Varn]] y [[La Torre]].' }
  })
  await expect(body(page).getByRole('link', { name: /La Torre: por crear/ })).toHaveAttribute('data-state', 'missing')
  // Aparece la página: se resuelve sola
  await api(page, 'createPage', { worldId, title: 'La Torre', parentId: null })
  await expect(body(page).getByRole('link', { name: 'La Torre' })).toHaveAttribute('data-state', 'ok')

  // Maela a la papelera: roto, y desde el enlace se restaura
  await api(page, 'deletePage', { pageId: maela })
  const broken = body(page).getByRole('link', { name: /Maela Varn: en la papelera/ })
  await expect(broken).toHaveAttribute('data-state', 'broken')
  await broken.click()
  await page.getByRole('button', { name: 'Restaurar' }).click()
  await expect(body(page).getByRole('link', { name: 'Maela Varn' })).toHaveAttribute('data-state', 'ok')
})

test('al elegir un nombre de página, la barra propone enlazarlo', async ({ page }) => {
  await eana(page)
  await page.keyboard.type('Habla con Maela Varn')
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft')
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString())).toBe('Maela Varn')
  await page.getByRole('toolbar', { name: 'Formato' }).getByRole('button', { name: 'Enlazar con «Maela Varn»' }).click()
  await expect(body(page).getByRole('link', { name: 'Maela Varn' })).toHaveAttribute('data-state', 'ok')
})

test('los enlaces de la página: quién la enlaza, dónde se la nombra y «Enlazar»; al borrarla, cuántas la enlazan', async ({
  page
}) => {
  const { worldId, maela, puerto } = await eana(page)
  await api(page, 'editPage', { pageId: puerto, body: { mode: 'append', markdown: 'Lo gobierna [[Maela Varn]].' } })
  const notas = await api(page, 'createPage', { worldId, title: 'Notas', parentId: null })
  await api(page, 'editPage', {
    pageId: notas.id,
    body: { mode: 'append', markdown: 'Preguntar a Maela Varn por el faro.' }
  })
  await page.getByRole('treeitem', { name: 'Maela Varn' }).click()
  const panel = page.getByRole('region', { name: 'Enlaces' })
  const incoming = panel.getByRole('list', { name: 'La enlazan' })
  await expect(incoming.getByRole('link', { name: 'Puerto Ceniza' })).toBeVisible()
  await expect(incoming.getByText('Lo gobierna Maela Varn.')).toBeVisible()
  const mentions = panel.getByRole('list', { name: 'La nombran sin enlazar' })
  await expect(mentions.getByText('Preguntar a Maela Varn por el faro.')).toBeVisible()
  await mentions.getByRole('button', { name: 'Enlazar en «Notas»' }).click()
  await expect(page.getByRole('status').getByText('Enlazada en «Notas».')).toBeAttached()
  await expect(incoming.getByRole('link', { name: 'Notas' })).toBeVisible()
  // Ya no queda ninguna sin enlazar: su lista se va
  await expect(mentions).toHaveCount(0)

  // Al borrarla, el aviso dice cuántas la enlazan
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Borrar' }).click()
  await expect(page.getByText('La enlazan 2 páginas: sus enlaces se verán rotos.')).toBeVisible()
  expect(maela).toBeTruthy()
})

test('los enlaces en sus tres estados y la lista de [[, en los dos temas @a11y', async ({ page }) => {
  const { maela, puerto } = await eana(page)
  await api(page, 'editPage', {
    pageId: puerto,
    body: { mode: 'append', markdown: 'Ver [[Maela Varn]] y [[La Torre]].' }
  })
  await api(page, 'deletePage', { pageId: maela })
  await expect(body(page).getByRole('link', { name: /en la papelera/ })).toBeVisible()
  await body(page)
    .getByRole('link', { name: /en la papelera/ })
    .click()
  await expect(page.getByRole('button', { name: 'Restaurar' })).toBeVisible()
  await body(page).getByText('Ver').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' [[ma')
  await expect(suggestions(page)).toBeVisible()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})
