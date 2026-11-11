import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

/** «Página nueva» desde una plantilla: el recuadro, la plantilla de la lista y el título */
async function fromTemplate(page: Page, template: string, title: string, check?: () => Promise<void>) {
  await page.getByRole('button', { name: 'Página nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Página nueva' })
  await dialog.getByText('Desde plantilla').click()
  await dialog.getByLabel('Buscar plantilla').fill(template)
  await dialog.getByRole('radio', { name: new RegExp(`^${template}`) }).check()
  await check?.()
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByLabel('Título').press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test('desde plantilla: una facción y un PNJ que nace con sus campos, su texto y su marca', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')

  await fromTemplate(page, 'Facción', 'La Raqisa', async () => {
    for (const colorScheme of ['dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const { violations } = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
    }
  })
  await expect(page.getByTitle('Hecha con la plantilla Facción')).toBeVisible()

  await fromTemplate(page, 'PNJ', 'Mamá Gris')
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  // Su texto, con los apartados de la plantilla
  await expect(page.getByRole('heading', { level: 3, name: 'Quién es' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Ganchos' })).toBeVisible()
  // Sus campos, en el panel: la Facción busca primero entre las facciones
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByLabel('Nombre de la propiedad 3')).toHaveValue('Facción')
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/actions/setPageProperties'))
  await properties.getByLabel('Valor de la propiedad 3').fill('La Raqisa')
  await saved
  await expect(properties.getByRole('link', { name: 'La Raqisa' })).toBeVisible()
  // En el árbol, con el icono de su plantilla; y sigue al recargar
  await page.reload()
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Propiedades' }).getByRole('link', { name: 'La Raqisa' })).toBeVisible()

  // Al abrir la facción, Mamá Gris sale sola en «Miembros» (el primer criterio de éxito)
  await page.getByRole('tree', { name: 'Páginas' }).getByRole('treeitem', { name: 'La Raqisa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Raqisa' })).toBeVisible()
  const members = page
    .getByRole('complementary', { name: 'Panel de la página' })
    .getByRole('region', { name: 'Miembros' })
  await expect(members.getByRole('link', { name: 'Mamá Gris' })).toBeVisible()
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('aside').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})

test('un enlace a una página que aún no existe se crea pulsándolo: como texto o con una plantilla', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await fromTemplate(page, 'PNJ', 'Mamá Gris')
  const pageId = new URL(page.url()).pathname.split('/').at(-1)
  // La IA escribe un enlace a quien aún no tiene página
  const response = await page.request.post('/api/actions/editPage', {
    data: { pageId, body: { mode: 'append', markdown: 'Su mano derecha es [[El Viejo Gyles]].' } }
  })
  expect(response.status()).toBe(200)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.getByRole('link', { name: /El Viejo Gyles: por crear/ }).click()
  const menu = page.getByRole('menu', { name: 'Crear «El Viejo Gyles»' })
  await expect(menu.getByRole('menuitem', { name: 'Texto' })).toBeFocused()
  await menu.getByRole('menuitem', { name: 'PNJ' }).click()
  // Nace con esa plantilla y el enlace queda resuelto
  await expect(page.getByRole('heading', { level: 1, name: 'El Viejo Gyles' })).toBeVisible()
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  await page.goBack()
  await expect(body.getByRole('link', { name: 'El Viejo Gyles' })).toHaveAttribute('data-state', 'ok')
})

test('«Plantillas» en Mis mundos: una desde cero y otra copiando PNJ', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Plantillas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plantillas' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'De serie' }).getByRole('link', { name: 'Facción' })).toBeVisible()
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
  // Desde cero
  await page.getByRole('button', { name: 'Plantilla nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Plantilla nueva' })
  await dialog.getByLabel('Nombre').fill('Frente')
  await dialog.getByRole('radio', { name: 'Reloj de arena' }).check()
  await dialog.getByRole('button', { name: 'Crear la plantilla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Frente' })).toBeVisible()
  // Copiando PNJ
  await page.goBack()
  const pnj = page.getByRole('list', { name: 'De serie' }).getByRole('listitem').filter({ hasText: 'PNJ' })
  // «Copiar», en su engranaje
  await pnj.getByRole('button', { name: 'Ajustes de PNJ' }).click()
  await page.getByRole('dialog', { name: 'PNJ' }).getByRole('button', { name: 'Copiar' }).click()
  const copy = page.getByRole('dialog', { name: 'Plantilla nueva' })
  await copy.getByLabel('Nombre').fill('PNJ de Eana')
  await copy.getByRole('button', { name: 'Crear la plantilla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'PNJ de Eana' })).toBeVisible()
  await page.goBack()
  const mine = page.getByRole('list', { name: 'Tuyas' })
  await expect(mine.getByRole('link', { name: 'Frente' })).toBeVisible()
  await expect(mine.getByText('Copia de PNJ')).toBeVisible()
})

test('editar una plantilla tuya: «Frente» con un reloj de 8, y una página hecha con ella', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await page.goto('/plantillas')
  await page.getByRole('button', { name: 'Plantilla nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Plantilla nueva' })
  await dialog.getByLabel('Nombre').fill('Frente')
  await dialog.getByRole('button', { name: 'Crear la plantilla' }).click()
  const fields = page.getByRole('complementary', { name: 'Campos y panel de la plantilla' }).getByRole('region', {
    name: 'Campos'
  })
  await fields.getByRole('button', { name: 'Campo' }).click()
  await fields.getByLabel('Nombre').fill('Reloj')
  await fields.getByLabel('Nombre').press('Enter')
  await fields.getByLabel('Tipo').selectOption({ label: 'Reloj' })
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/actions/updateTemplate') && /"segments":8/.test(r.request().postData() ?? '')
  )
  await fields.getByLabel('Segmentos').fill('8')
  await fields.getByLabel('Segmentos').press('Enter')
  await saved
  await expect(fields.getByRole('button', { name: /Reloj de 8/ })).toBeVisible()
  // Su texto: «## » hace un título, como en la wiki; se guarda solo
  const skeleton = page.getByRole('textbox', { name: 'Texto de la plantilla' })
  await skeleton.click()
  const written = page.waitForResponse(
    (r) => r.url().endsWith('/api/actions/updateTemplate') && /La verdad/.test(r.request().postData() ?? '')
  )
  await page.keyboard.type('## En una frase')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## La verdad')
  await written
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
  // Una página con ella: el reloj, con sus 8 segmentos
  await page.goto('/mundos')
  await openWiki(page, 'Eana')
  await fromTemplate(page, 'Frente', 'Los muelles en llamas')
  const clock = page
    .getByRole('region', { name: 'Propiedades' })
    .getByRole('group', { name: 'Valor de la propiedad 1' })
  await expect(clock.getByRole('button', { name: 'Segmento 8 de 8' })).toBeVisible()
  // Y su texto, igual que se escribió
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body.getByRole('heading', { level: 3, name: 'En una frase' })).toBeVisible()
  await expect(body.getByRole('heading', { level: 3, name: 'La verdad' })).toBeVisible()
})

test('aplicar una plantilla a una página ya hecha, desde «⋯»: añade lo que falta sin borrar nada', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await page.keyboard.type('Ciudad Libre')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Ciudad Libre' })).toBeVisible()
  const pageId = new URL(page.url()).pathname.split('/').at(-1)
  const written = await page.request.post('/api/actions/editPage', {
    data: {
      pageId,
      body: { mode: 'replace', markdown: '---\nPoblación: 12000\n---\n## Descripción\n\nPuerto franco.\n' }
    }
  })
  expect(written.status()).toBe(200)
  await page.reload()
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Aplicar plantilla…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Aplicar plantilla' })
  await dialog.getByRole('radio', { name: /^Lugar/ }).check()
  await expect(dialog.getByRole('region', { name: 'Lo que añade Lugar' }).getByText('Ganchos')).toBeVisible()
  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
  await dialog.getByRole('button', { name: 'Aplicar Lugar' }).click()
  await expect(page.getByTitle('Hecha con la plantilla Lugar')).toBeVisible()
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByLabel('Nombre de la propiedad 2')).toHaveValue('Tipo')
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body.getByText('Puerto franco.')).toBeVisible()
  await expect(body.getByRole('heading', { level: 3, name: 'Ganchos' })).toBeVisible()
})
