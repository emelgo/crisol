import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

/** El propietario crea Eana y entra en su wiki */
async function openWiki(page: Page) {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Wiki de Eana' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wiki de Eana' })).toBeVisible()
}

/** Página nueva (o subpágina de la abierta) con su título */
async function newPage(page: Page, title: string, button = 'Página nueva') {
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

const tree = (page: Page) => page.getByRole('tree', { name: 'Páginas' })
const titles = (page: Page) => tree(page).getByRole('treeitem')

test('el máster crea páginas y subpáginas, las renombra y las recoloca; todo sigue al recargar', async ({ page }) => {
  await openWiki(page)
  await expect(page.getByText('Aún no hay páginas.')).toBeVisible()
  await newPage(page, 'Lugares')
  await newPage(page, 'Costa Gris', 'Nueva subpágina')
  await expect(
    page.getByRole('navigation', { name: 'Migas de pan' }).getByRole('link', { name: 'Lugares' })
  ).toBeVisible()
  await newPage(page, 'Personajes')
  await newPage(page, 'Reglas')
  await expect(titles(page)).toHaveText(['Lugares', 'Costa Gris', 'Personajes', 'Reglas'])

  // Renombrar en el sitio
  await page.getByRole('button', { name: 'Renombrar' }).click()
  await page.getByLabel('Título de la página').fill('Reglas de la casa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reglas de la casa' })).toBeVisible()
  await expect(tree(page).getByRole('treeitem', { name: 'Reglas de la casa' })).toBeVisible()

  // Con el teclado: «Reglas de la casa» sube por encima de «Personajes»
  await tree(page).getByRole('treeitem', { name: 'Reglas de la casa' }).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(titles(page)).toHaveText(['Lugares', 'Costa Gris', 'Reglas de la casa', 'Personajes'])

  // Arrastrando: «Personajes» dentro de «Lugares»
  await tree(page)
    .getByRole('treeitem', { name: 'Personajes' })
    .dragTo(tree(page).getByRole('treeitem', { name: 'Lugares' }))
  await expect(tree(page).getByRole('treeitem', { name: 'Personajes' })).toHaveAttribute('aria-level', '2')

  await page.reload()
  await expect(titles(page).first()).toHaveText('Lugares')
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(titles(page)).toHaveText(['Lugares', 'Costa Gris', 'Personajes', 'Reglas de la casa'])
})

test('propiedades, icono y etiquetas: se guardan, siguen al recargar y cuentan en el panel', async ({ page }) => {
  await openWiki(page)
  await newPage(page, 'Costa Gris')
  await newPage(page, 'Puerto Ceniza')
  await page.getByRole('button', { name: 'Añadir icono' }).click()
  await page.getByRole('button', { name: 'Usar ⚓' }).click()
  await expect(page.getByRole('button', { name: 'Icono ⚓: cambiarlo' })).toBeVisible()

  await page.getByRole('button', { name: 'Añadir propiedades' }).click()
  const editor = page.getByRole('form', { name: 'Propiedades' })
  await editor.getByRole('button', { name: 'Etiquetas' }).click()
  await editor.getByLabel('Valor de la propiedad 1').fill('lugar/ciudad, costa')
  await editor.getByRole('button', { name: 'Añadir propiedad' }).click()
  await editor.getByLabel('Nombre de la propiedad 2').fill('Región')
  await editor.getByLabel('Tipo de la propiedad 2').selectOption({ label: 'Páginas' })
  await editor.getByLabel('Valor de la propiedad 2').fill('Costa Gris')
  await expect(editor.getByRole('button', { name: 'Quitar Costa Gris' })).toBeVisible()
  await editor.getByRole('button', { name: 'Guardar' }).click()

  await page.reload()
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByText('costa', { exact: true })).toBeVisible()
  await expect(properties.getByRole('link', { name: 'Costa Gris' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Icono ⚓: cambiarlo' })).toBeVisible()

  await page.getByRole('link', { name: 'Etiquetas' }).click()
  await expect(page.getByRole('list', { name: 'Etiquetas' }).getByRole('listitem')).toHaveText([
    'costa1 página',
    'lugar1 página',
    'ciudad1 página'
  ])
})

test('en el móvil el árbol va en un cajón, que se cierra al abrir una página', async ({ page }) => {
  await openWiki(page)
  await newPage(page, 'Lugares')
  await newPage(page, 'Personajes')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(tree(page)).toBeHidden()
  await page.getByRole('button', { name: 'Páginas' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(tree(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Páginas' })).toBeFocused()
  await page.getByRole('button', { name: 'Páginas' }).click()
  await tree(page).getByRole('treeitem', { name: 'Lugares' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lugares' })).toBeVisible()
  await expect(tree(page)).toBeHidden()
})

test('la wiki, en los dos temas y en el móvil @a11y', async ({ page }) => {
  test.slow()
  await openWiki(page)
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
  await check()
  await page.getByRole('button', { name: 'Renombrar' }).click()
  await check()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Añadir icono' }).click()
  await check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Añadir propiedades' }).click()
  await page.getByRole('button', { name: 'Etiquetas' }).click()
  await page.getByRole('button', { name: 'Añadir propiedad' }).click()
  await check()
  await page.getByLabel('Valor de la propiedad 1').fill('lugar')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('region', { name: 'Propiedades' }).getByText('lugar')).toBeVisible()
  await check()
  await page.getByRole('link', { name: 'Etiquetas' }).click()
  await expect(page.getByRole('list', { name: 'Etiquetas' })).toBeVisible()
  await check()
  await page.getByRole('tree').getByRole('treeitem', { name: 'Lugares' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Páginas' }).click()
  await expect(tree(page)).toBeVisible()
  await check()
})
