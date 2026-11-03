import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki, slash } from './ayudas.ts'

/** El propietario crea Eana y entra en su wiki */
async function eanaWiki(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  // La portada del mundo, abierta
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeVisible()
}

/** Página nueva (o subpágina de la abierta) con su título */
async function newPage(page: Page, title: string, button = 'Página nueva') {
  // Una subpágina, con el botón derecho sobre su madre en el árbol
  if (button === 'Nueva subpágina') {
    await page.getByRole('tree').locator('[aria-current="page"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Crear subpágina' }).click()
  } else await page.getByRole('button', { name: button }).click()
  // El cuadro de página nueva: el título, y Intro la crea
  await expect(page.getByRole('dialog').getByLabel('Título', { exact: true })).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  // Ya con su nombre: la dirección deja de decir «nuevo»
  await expect(page).not.toHaveURL(/nuevo/)
}

/** En el móvil, la wiki se abre desde el menú de la llama */
async function openMobileWiki(page: Page) {
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('dialog', { name: 'Eana' }).getByRole('button', { name: 'Eana', exact: true }).click()
  // El menú se va del todo (su animación de salida) antes de seguir
  await expect(page.getByRole('dialog', { name: 'Eana' })).toHaveCount(0)
}

const tree = (page: Page) => page.getByRole('tree', { name: 'Páginas' })
const titles = (page: Page) => tree(page).getByRole('treeitem')

test('el máster crea páginas y subpáginas, las renombra y las recoloca; todo sigue al recargar', async ({ page }) => {
  await eanaWiki(page)
  // Solo la portada del mundo, que se creó al entrar
  await expect(titles(page)).toHaveText(['Eana'])
  await newPage(page, 'Lugares')
  await newPage(page, 'Costa Gris', 'Nueva subpágina')
  await expect(page.getByRole('treeitem', { name: 'Costa Gris' })).toHaveAttribute('aria-level', '2')
  await newPage(page, 'Personajes')
  await newPage(page, 'Reglas')
  await expect(titles(page)).toHaveText(['Eana', 'Lugares', 'Costa Gris', 'Personajes', 'Reglas'])

  // Renombrar en el sitio: el título se escribe ahí mismo e Intro lo guarda
  await page.getByLabel('Título de la página').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Reglas de la casa')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Reglas de la casa' })).toBeVisible()
  await expect(tree(page).getByRole('treeitem', { name: 'Reglas de la casa' })).toBeVisible()

  // Con el teclado: «Reglas de la casa» sube por encima de «Personajes»
  await tree(page).getByRole('treeitem', { name: 'Reglas de la casa' }).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(titles(page)).toHaveText(['Eana', 'Lugares', 'Costa Gris', 'Reglas de la casa', 'Personajes'])

  // Arrastrando: «Personajes» dentro de «Lugares»
  await tree(page)
    .getByRole('treeitem', { name: 'Personajes' })
    .dragTo(tree(page).getByRole('treeitem', { name: 'Lugares' }))
  await expect(tree(page).getByRole('treeitem', { name: 'Personajes' })).toHaveAttribute('aria-level', '2')

  await page.reload()
  await expect(titles(page).nth(1)).toHaveText('Lugares')
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(titles(page)).toHaveText(['Eana', 'Lugares', 'Costa Gris', 'Personajes', 'Reglas de la casa'])
})

test('propiedades y etiquetas: se guardan, siguen al recargar y cuentan en el panel', async ({ page }) => {
  await eanaWiki(page)
  await newPage(page, 'Costa Gris')
  await newPage(page, 'Puerto Ceniza')

  // Se escriben en el sitio y se guardan solas, sin «Guardar»
  const editor = page.getByRole('region', { name: 'Propiedades' })
  // Se añaden desde «Añadir bloque» del panel, como en Everlore
  const panel = page.getByRole('complementary', { name: 'Panel de la página' })
  const addFromPanel = async (name: string) => {
    await panel.getByRole('button', { name: 'Añadir bloque' }).click()
    await panel.getByRole('button', { name, exact: true }).click()
  }
  await addFromPanel('Etiquetas')
  await editor.getByLabel('Valor de la propiedad 1').fill('lugar/ciudad, costa')
  await editor.getByLabel('Valor de la propiedad 1').press('Enter')
  await expect(editor.getByRole('button', { name: 'Quitar costa' })).toBeVisible()
  await addFromPanel('Propiedad')
  await editor.getByLabel('Nombre de la propiedad 2').fill('Región')
  await editor.getByLabel('Nombre de la propiedad 2').press('Enter')
  await editor.getByLabel('Tipo de la propiedad 2').selectOption({ label: 'Páginas' })
  // Guardado antes de recargar (si no, la recarga puede cortar la petición)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/actions/setPageProperties') &&
      /"type":"pages","value":\["/.test(response.request().postData() ?? '')
  )
  await editor.getByLabel('Valor de la propiedad 2').fill('Costa Gris')
  await expect(editor.getByRole('button', { name: 'Quitar Costa Gris' })).toBeVisible()
  await saved

  await page.reload()
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByText('costa', { exact: true })).toBeVisible()
  await expect(properties.getByRole('link', { name: 'Costa Gris' })).toBeVisible()

  // Son de la cuenta: en la zona de Mis mundos
  await page.goto('/etiquetas')
  await expect(page.getByRole('list', { name: 'Etiquetas' }).getByRole('listitem')).toHaveText([
    'costa1 página',
    'lugar1 página',
    'ciudad1 página'
  ])
})

test('borrar una página con sus subpáginas, y restaurarla desde la papelera del mundo', async ({ page }) => {
  await eanaWiki(page)
  await newPage(page, 'Lugares')
  await newPage(page, 'Costa Gris', 'Nueva subpágina')
  await newPage(page, 'Puerto Ceniza', 'Nueva subpágina')
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).click()
  // Con el botón derecho en el árbol: «Borrar» y su confirmación
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  // De vuelta en la portada del mundo, sin las borradas
  await expect(page.getByRole('heading', { level: 1, name: 'Eana' })).toBeVisible()
  await expect(titles(page)).toHaveText(['Eana'])

  await page.goto(`${new URL(page.url()).pathname.replace(/\/$/, '')}/papelera`)
  const trash = page.getByRole('list', { name: 'En la papelera' })
  await expect(trash.getByText('Página de Eana, con 2 subpáginas', { exact: false })).toBeVisible()
  await trash.getByRole('button', { name: 'Restaurar Lugares' }).click()
  await expect(page.getByText('La papelera está vacía')).toBeVisible()
  await page.goBack()
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tree(page).getByRole('treeitem', { name: 'Costa Gris' })).toBeVisible()
})

test('pestañas y marcadores siguen al recargar; en el móvil, las abiertas van en el cajón', async ({ page }) => {
  await eanaWiki(page)
  await newPage(page, 'Puerto Ceniza')
  await newPage(page, 'Maela Varn')
  const tabs = page.getByRole('navigation', { name: 'Páginas abiertas' })
  // La portada del mundo, abierta al entrar
  await expect(tabs.getByRole('link')).toHaveText(['Eana', 'Puerto Ceniza', 'Maela Varn'])
  await tabs.getByRole('button', { name: 'Fijar Maela Varn' }).click()
  await expect(tabs.getByRole('link')).toHaveText(['Maela Varn', 'Eana', 'Puerto Ceniza'])
  await page.getByRole('button', { name: 'Marcar' }).click()
  // Los marcadores, en su panel; al recargar sigue abierto el último que se eligió
  await expect(page.getByRole('region', { name: 'Marcadores' }).getByRole('link', { name: 'Maela Varn' })).toBeVisible()

  await page.reload()
  await expect(tabs.getByRole('link')).toHaveText(['Maela Varn', 'Eana', 'Puerto Ceniza'])
  await expect(page.getByRole('region', { name: 'Marcadores' }).getByRole('link', { name: 'Maela Varn' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(tabs).toBeHidden()
  await openMobileWiki(page)
  await expect(page.getByRole('navigation', { name: 'Abiertas' }).getByRole('link')).toHaveText([
    'Maela Varn',
    'Eana',
    'Puerto Ceniza'
  ])
})

test('en el móvil el árbol va en un cajón, que se cierra al abrir una página', async ({ page }) => {
  await eanaWiki(page)
  await newPage(page, 'Lugares')
  await newPage(page, 'Personajes')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(tree(page)).toBeHidden()
  await openMobileWiki(page)
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(tree(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Menú' })).toBeFocused()
  await openMobileWiki(page)
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lugares' })).toBeVisible()
  await expect(tree(page)).toBeHidden()
})

test('la wiki, en los dos temas y en el móvil @a11y', async ({ page }) => {
  test.slow()
  await eanaWiki(page)
  await newPage(page, 'Lugares')
  await newPage(page, 'Costa Gris', 'Nueva subpágina')
  const check = async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
    }
  }
  // El cuerpo con un secreto
  await page.getByRole('textbox', { name: 'Texto de la página' }).click()
  await slash(page, 'Secreto')
  await page.getByRole('textbox', { name: 'Texto del secreto' }).click()
  await page.keyboard.type('El faro no fue un accidente.')
  await check()
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await check()
  await page.keyboard.press('Escape')
  const side = page.getByRole('complementary', { name: 'Panel de la página' })
  for (const name of ['Etiquetas', 'Propiedad']) {
    await side.getByRole('button', { name: 'Añadir bloque' }).click()
    await side.getByRole('button', { name, exact: true }).click()
  }
  await check()
  await page.getByLabel('Valor de la propiedad 1').fill('lugar')
  await page.getByLabel('Valor de la propiedad 1').press('Enter')
  await expect(page.getByRole('region', { name: 'Propiedades' }).getByText('lugar')).toBeVisible()
  await check()
  await page.getByRole('button', { name: 'Marcar' }).click()
  await newPage(page, 'Personajes')
  await page.getByRole('button', { name: 'Marcar' }).click()
  await expect(page.getByLabel('Grupo nuevo')).toBeVisible()
  await check()
  await page.keyboard.press('Escape')
  const wiki = page.url()
  await page.goto('/etiquetas')
  await expect(page.getByRole('list', { name: 'Etiquetas' })).toBeVisible()
  await check()
  await page.goto(wiki)
  await page.getByRole('tree').getByRole('treeitem', { name: 'Lugares' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await openMobileWiki(page)
  await expect(tree(page)).toBeVisible()
  await check()
})
