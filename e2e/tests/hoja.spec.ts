import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

/** El propietario crea Eana y una página; devuelve el mundo y la página, abierta */
async function openPage(page: Page, markdown = '') {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const created = await page.request.post('/api/actions/createPages', {
    data: { worldId, parentId: null, pages: [{ key: 'h', title: 'El Dragón Rojo', markdown }] }
  })
  const [sheet] = (await created.json()).pages
  await page.goto(`/mundos/${worldId}/wiki/${sheet.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'El Dragón Rojo' })).toBeVisible()
  return { worldId, pageId: sheet.id as string }
}

test('los bloques de hoja con «/»: se ven discretos en la vista sencilla y salen en el Markdown', async ({ page }) => {
  const { pageId } = await openPage(page, '## Guarida\n\nEn la cima.')
  await body(page).click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  for (const [command, name] of [
    ['salto', 'Salto de página'],
    ['indice', 'Índice']
  ] as const) {
    await page.keyboard.type(`/${command}`)
    await page
      .getByRole('listbox', { name: 'Bloques' })
      .getByRole('option', { name: new RegExp(name) })
      .click()
  }
  await expect(body(page).getByText('Salto de página')).toBeVisible()
  const toc = body(page).getByRole('navigation', { name: 'Índice' })
  await expect(toc.getByRole('link', { name: 'Guarida' })).toBeVisible()
  // Un statblock, y dentro lo suyo (tras el índice ya hay un párrafo vacío)
  await page.keyboard.type('/statblock')
  await page.keyboard.press('Enter')
  await page.keyboard.type('CA 19')
  await expect(body(page).getByRole('group', { name: 'Statblock' })).toContainText('CA 19')
  await expect
    .poll(
      async () => (await (await page.request.post('/api/actions/readPage', { data: { pageId } })).json()).markdown,
      {
        timeout: 10_000
      }
    )
    .toMatch(/<div class="salto-pagina"><\/div>[\s\S]*> \[!indice\][\s\S]*> \[!statblock\]\n> CA 19/)

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([])
})

test('lo que llega en Markdown: nota lateral a la izquierda, a lo ancho y salto de columna', async ({ page }) => {
  await openPage(
    page,
    '> [!lateral|izquierda]\n> Al margen.\n\n<div class="salto-columna"></div>\n\n> [!ancho]\n> Todo a lo ancho.'
  )
  const note = body(page).getByRole('complementary', { name: 'Nota lateral, a la izquierda' })
  await expect(note).toContainText('Al margen.')
  await note.getByRole('button', { name: 'A la derecha' }).click()
  await expect(body(page).getByRole('complementary', { name: 'Nota lateral, a la derecha' })).toBeVisible()
  await expect(body(page).getByText('Salto de columna')).toBeVisible()
  await expect(body(page).getByText('A lo ancho', { exact: true })).toBeVisible()
  await expect(body(page).getByText('Todo a lo ancho.')).toBeVisible()
})

test('la vista de hoja: se activa, pagina sin partir bloques, cambia de tema y quien lee vuelve a la sencilla', async ({
  page
}) => {
  test.slow()
  const paragraphs = Array.from(
    { length: 60 },
    (_, i) => `Párrafo ${i + 1}: la costa de Eana guarda faros, puertos y dragones que nadie ha contado todavía.`
  ).join('\n\n')
  await openPage(page, `> [!indice]\n\n## La costa\n\n${paragraphs}\n\n## El norte\n\nFin.`)
  await page.getByRole('button', { name: 'Hoja', exact: true }).click()
  const sheet = page.getByRole('region', { name: 'Vista de hoja' })
  await expect(sheet.getByRole('region', { name: 'Página 1' })).toBeVisible()
  await expect(sheet.getByRole('region', { name: 'Página 2' })).toBeVisible()
  // El pie con el título y el número; el índice con la página de cada título
  await expect(sheet.getByRole('region', { name: 'Página 1' }).locator('footer')).toContainText('El Dragón Rojo')
  await expect(sheet.getByRole('navigation', { name: 'Índice' })).toContainText('La costa')
  // Ningún bloque se sale de su página
  const outside = await sheet.locator('section[aria-label^="Página"]').evaluateAll(
    (pages) =>
      pages.flatMap((p) => {
        const bottom = p.getBoundingClientRect().bottom
        return [...p.querySelectorAll('[data-sheet-block]')].filter(
          (b) => b.getBoundingClientRect().bottom > bottom + 1
        )
      }).length
  )
  expect(outside).toBe(0)
  // El tema
  await page.getByLabel('Tema', { exact: true }).selectOption({ label: 'Neutro' })
  await expect(sheet).toHaveAttribute('data-theme', 'neutro')
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([])
  }
  // Quien lee vuelve a la sencilla, y se recuerda
  await page.getByRole('button', { name: 'Vista sencilla' }).click()
  await expect(sheet).toBeHidden()
  await expect(body(page)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Ver la hoja' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Vista de hoja' })).toBeHidden()
  await page.getByRole('button', { name: 'Ver la hoja' }).click()
  await expect(page.getByRole('region', { name: 'Vista de hoja' })).toBeVisible()
})

test('imprimir y PDF: solo la hoja, sin interfaz, con su número de páginas; los secretos solo si se piden', async ({
  page
}) => {
  test.slow()
  const paragraphs = Array.from({ length: 200 }, (_, i) => `Párrafo ${i + 1} de la costa de Eana, con sus faros.`).join(
    '\n\n'
  )
  const { worldId, pageId } = await openPage(
    page,
    `## La costa\n\n${paragraphs}\n\n> [!secreto]\n> La Hermandad quemó el faro.\n\n%%\nPreguntar por su familia.\n%%`
  )
  await page.request.post('/api/actions/updatePage', {
    data: { pageId, sheet: { paper: 'a4', theme: 'neutro', numbers: true, firstNumber: 1, footer: true } }
  })
  // La ruta de impresión: sin cabecera ni menús, y con la hoja paginada
  await page.goto(`/mundos/${worldId}/imprimir/${pageId}`)
  await expect(page.locator('body[data-sheet-ready="true"]')).toBeAttached()
  await expect(page.getByRole('banner')).toHaveCount(0)
  const sheets = await page.getByRole('region', { name: /^Página \d+$/ }).count()
  expect(sheets).toBeGreaterThan(1)
  await expect(page.getByText('La Hermandad quemó el faro.')).toHaveCount(0)
  await expect(page.getByText('Preguntar por su familia.')).toHaveCount(0)
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pages).toBe(sheets)
  // Con secretos
  await page.goto(`/mundos/${worldId}/imprimir/${pageId}?secretos=1`)
  await expect(
    page.getByRole('region', { name: /^Página \d+$/ }).getByText('La Hermandad quemó el faro.')
  ).toBeVisible()
  await expect(page.getByText('Preguntar por su familia.')).toHaveCount(0)

  // «Descargar PDF»: lo saca el servidor
  const response = await page.request.get(`/api/pages/${pageId}/pdf`)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/pdf')
  expect(response.headers()['content-disposition']).toContain(
    `filename*=UTF-8''${encodeURIComponent('El Dragón Rojo.pdf')}`
  )
  const body = (await response.body()).toString('latin1')
  expect(body.startsWith('%PDF')).toBe(true)
  expect((body.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(sheets)
})
