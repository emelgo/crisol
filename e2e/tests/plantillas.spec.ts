import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

/** Sin plantillas de serie (ADR-0024): las que se usan aquí se hacen por la API, como las haría la cuenta */
async function seedTemplates(page: Page) {
  const call = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const faccion = await call('createTemplate', { name: 'Facción', icon: '🛡️' })
  const pnj = await call('createTemplate', { name: 'PNJ', icon: '🧙' })
  const withFields = await call('updateTemplate', {
    templateId: pnj.id,
    fields: [
      { name: 'Especie', type: 'text', value: '' },
      { name: 'Rol', type: 'text', value: '' },
      { name: 'Facción', type: 'pages', single: true, value: [], targets: [faccion.id] }
    ],
    skeleton: '## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos\n'
  })
  const field = withFields.fields.find((f: { name: string }) => f.name === 'Facción').field
  await call('updateTemplate', {
    templateId: faccion.id,
    fields: [
      { name: 'Tipo', type: 'text', value: '' },
      { name: 'Líder', type: 'pages', single: true, value: [], targets: [pnj.id] }
    ],
    panel: [
      { id: 'miembros', type: 'related', title: 'Miembros', template: pnj.id, field, columns: [], sort: 'title' }
    ],
    skeleton: '## Quiénes son\n\n## Qué quieren\n'
  })
  return { call, faccion, pnj }
}

/** Sin infracciones graves de accesibilidad en lo que se mira (en oscuro, el tema de siempre) */
async function axe(page: Page, include: string) {
  await page.emulateMedia({ colorScheme: 'dark' })
  const { violations } = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa']).analyze()
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

/** «Página nueva» desde una plantilla: «Desde plantilla» (la última, tras «o»), la plantilla de la lista y el título */
async function fromTemplate(page: Page, template: string, title: string, check?: () => Promise<void>) {
  await page.getByRole('button', { name: 'Página nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Página nueva' })
  await dialog.getByRole('button', { name: 'Desde plantilla' }).click()
  await dialog.getByLabel('Buscar plantilla').fill(template)
  await dialog.getByRole('radio', { name: new RegExp(`^${template}`) }).check()
  await check?.()
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByLabel('Título').press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test('desde plantilla: una facción y un PNJ que nace como copia de la suya (campos, texto y marca)', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await seedTemplates(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')

  await fromTemplate(page, 'Facción', 'La Raqisa', () => axe(page, 'dialog'))
  await expect(page.getByTitle('Hecha con la plantilla Facción')).toBeVisible()

  await fromTemplate(page, 'PNJ', 'Mamá Gris')
  await expect(page.getByTitle('Hecha con la plantilla PNJ')).toBeVisible()
  // Su texto, el de la plantilla
  await expect(page.getByRole('heading', { level: 3, name: 'Quién es' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Ganchos' })).toBeVisible()
  // Sus campos, en el panel: la Facción busca primero entre las facciones
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByLabel('Nombre de la propiedad 3')).toHaveValue('Facción')
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/actions/setPageProperties'))
  await properties.getByLabel('Valor de la propiedad 3').fill('La Raqisa')
  await saved
  await expect(properties.getByRole('link', { name: 'La Raqisa' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Propiedades' }).getByRole('link', { name: 'La Raqisa' })).toBeVisible()

  // Al abrir la facción, Mamá Gris sale sola en «Miembros»
  await page.getByRole('tree', { name: 'Páginas' }).getByRole('treeitem', { name: 'La Raqisa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'La Raqisa' })).toBeVisible()
  const members = page
    .getByRole('complementary', { name: 'Panel de la página' })
    .getByRole('region', { name: 'Miembros' })
  await expect(members.getByRole('link', { name: 'Mamá Gris' })).toBeVisible()
  await axe(page, 'aside')
})

test('un enlace a una página que aún no existe se crea pulsándolo: como texto o con una plantilla', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await seedTemplates(page)
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

test('«Plantillas», como Archivos: «Plantilla nueva» la abre como página, y se ordenan en carpetas', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Plantillas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plantillas' })).toBeVisible()
  // Sin ninguna de serie
  await expect(page.getByText('Aún no hay plantillas')).toBeVisible()
  // «Plantilla nueva»: su cuadro (como el de «Página nueva»); sin nombre, la abre con su título elegido para escribir
  // encima; un emoji delante es su icono
  await page.getByRole('button', { name: 'Plantilla nueva' }).click()
  const created = page.getByRole('dialog', { name: 'Plantilla nueva' })
  await expect(created.getByRole('radio', { name: 'Texto' })).toBeChecked()
  await axe(page, 'dialog')
  await created.getByRole('button', { name: 'Crear' }).click()
  const title = page.getByRole('textbox', { name: 'Título de la página' })
  await expect(title).toBeFocused()
  await expect(title).toHaveText('Plantilla sin título')
  const renamed = page.waitForResponse((r) => r.url().endsWith('/api/actions/updatePage'))
  await page.keyboard.type('⏳ Frente')
  await page.keyboard.press('Enter')
  await renamed
  await expect(title).toHaveText('Frente')
  await expect(page.getByText('Plantilla', { exact: true })).toBeVisible()
  // Su icono, también de los de la app: «:» y su nombre en el título
  await title.click()
  await page.keyboard.press('Home')
  await page.keyboard.type(':reloj')
  await expect(page.getByRole('listbox', { name: 'Iconos' })).toBeVisible()
  const iconed = page.waitForResponse((r) => r.url().endsWith('/api/actions/updatePage'))
  await page.keyboard.press('Enter')
  await iconed
  await expect(title).toHaveText('Frente')
  await expect(page.getByRole('button', { name: /^Icono .*: cambiarlo$/ })).toBeVisible()
  // «⋯»: sin imprimir ni descargar
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await expect(page.getByRole('button', { name: 'Duplicar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir o descargar…' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await axe(page, 'main')
  // «‹ Plantillas» vuelve a la lista
  await page.getByRole('link', { name: 'Plantillas' }).and(page.locator(':not(nav *)')).click()
  const list = page.getByRole('list', { name: 'Tus plantillas' })
  await expect(list.getByRole('link', { name: 'Frente' })).toBeVisible()
  // «Nueva carpeta» y meterla dentro, con el botón derecho (sin cuadro de ajustes: Enrique, 2026-11-19)
  await page.getByRole('button', { name: 'Nueva carpeta' }).click()
  const folder = page.getByRole('dialog', { name: 'Nueva carpeta' })
  await folder.getByLabel('Nombre').fill('Campaña')
  await folder.getByRole('button', { name: 'Crear la carpeta' }).click()
  await list.getByRole('link', { name: 'Frente' }).click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Opciones de «Frente»' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Renombrar', 'Duplicar', 'Mover a…', 'Borrar'])
  await axe(page, '[role="menu"]')
  await menu.getByRole('menuitem', { name: 'Mover a…' }).hover()
  await page.getByRole('menu', { name: 'Mover a…' }).getByRole('menuitem', { name: 'Campaña' }).click()
  await expect(list.getByRole('button', { name: 'Campaña', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(list.getByRole('link', { name: 'Frente' })).toBeVisible()
  await axe(page, 'main')
  // Y sigue ahí al recargar (la carpeta, plegada)
  await page.reload()
  await list.getByRole('button', { name: 'Campaña', exact: true }).click()
  await expect(list.getByRole('link', { name: 'Frente' })).toBeVisible()
})

test('editar una plantilla como una página: «Frente» con un reloj de 8 y su texto, y una página hecha con ella', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await page.goto('/plantillas')
  await page.getByRole('button', { name: 'Plantilla nueva' }).click()
  await page.getByRole('dialog', { name: 'Plantilla nueva' }).getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toBeFocused()
  await page.keyboard.type('Frente')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveText('Frente')
  // Sus campos, en el panel: se definen (nombre y tipo)
  const fields = page.getByRole('complementary', { name: 'Panel de la página' }).getByRole('region', { name: 'Campos' })
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
  // Su texto es el de su página: «## » hace un título; se guarda solo
  const text = page.getByRole('textbox', { name: 'Texto de la página' })
  await text.click()
  await page.keyboard.type('## En una frase')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## La verdad')
  await expect(page.getByText('Guardado')).toBeVisible()
  await axe(page, 'main')
  // Una página con ella: el reloj, con sus 8 segmentos, y su texto
  await page.goto('/mundos')
  await openWiki(page, 'Eana')
  await fromTemplate(page, 'Frente', 'Los muelles en llamas')
  const clock = page
    .getByRole('region', { name: 'Propiedades' })
    .getByRole('group', { name: 'Valor de la propiedad 1' })
  await expect(clock.getByRole('button', { name: 'Segmento 8 de 8' })).toBeVisible()
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body.getByRole('heading', { level: 3, name: 'En una frase' })).toBeVisible()
  await expect(body.getByRole('heading', { level: 3, name: 'La verdad' })).toBeVisible()
})

test('el árbol del editor: carpeta nueva, plantilla nueva con un mapa y, con el botón derecho, borrarla; «Pestaña nueva» sin plantillas', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const { call } = await seedTemplates(page)
  const puerto = await call('createTemplate', { name: 'Puerto', icon: '⚓' })
  await page.goto(`/plantillas/${puerto.id}`)
  const side = page.getByRole('complementary', { name: 'Tus plantillas' })
  await side.getByRole('button', { name: 'Nueva carpeta' }).click()
  const folder = page.getByRole('dialog', { name: 'Nueva carpeta' })
  await folder.getByLabel('Nombre').fill('Lugares')
  await folder.getByRole('button', { name: 'Crear la carpeta' }).click()
  await expect(side.getByRole('button', { name: 'Lugares' })).toBeVisible()
  // Con el botón derecho en la carpeta, una plantilla nueva dentro, con un mapa
  await side.getByRole('button', { name: 'Lugares' }).click({ button: 'right' })
  await page
    .getByRole('menu', { name: 'Opciones de «Lugares»' })
    .getByRole('menuitem', { name: 'Plantilla nueva aquí' })
    .click()
  const created = page.getByRole('dialog', { name: 'Plantilla nueva' })
  await created.getByRole('radio', { name: 'Mapa' }).check()
  await created.getByRole('textbox', { name: 'Nombre' }).fill('Ciudad')
  await created.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ciudad' })).toBeVisible()
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await expect(tabs.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  await axe(page, 'main')
  // Con el botón derecho en «Puerto»: borrarla
  await side.getByRole('link', { name: 'Puerto' }).click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Opciones de «Puerto»' })
  await menu.getByRole('menuitem', { name: 'Borrar' }).click()
  await menu.getByRole('menuitem', { name: 'Borrar la plantilla' }).click()
  await expect(side.getByRole('link', { name: 'Puerto' })).toHaveCount(0)
  // «Pestaña nueva», en una página, ya no ofrece plantillas
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await page.keyboard.type('Ciudad Libre')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Ciudad Libre' })).toBeVisible()
  await page.getByRole('button', { name: 'Pestaña nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await expect(dialog.getByRole('radio', { name: 'Texto' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Desde plantilla' })).toHaveCount(0)
})
