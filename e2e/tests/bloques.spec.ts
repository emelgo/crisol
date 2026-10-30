import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

/** El propietario crea Eana y una página, y la deja abierta con el cursor en el texto */
async function openPage(page: Page) {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Wiki de Eana' }).click()
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type('Puerto Ceniza')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeVisible()
  await body(page).click()
}

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })
const slashMenu = (page: Page) => page.getByRole('listbox', { name: 'Bloques' })
const announced = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ }).last()

test('el menú «/» con el teclado: filtra, se mueve con las flechas, inserta y Escape lo cierra', async ({ page }) => {
  await openPage(page)
  await page.keyboard.type('/')
  await expect(slashMenu(page)).toBeVisible()
  // El texto sigue con el foco y señala la opción activa de la lista
  await expect(body(page)).toBeFocused()
  await expect(body(page)).toHaveAttribute('aria-controls', /.+/)
  const first = await body(page).getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowDown')
  await expect(body(page)).not.toHaveAttribute('aria-activedescendant', first ?? '')
  // Escape cierra y deja lo escrito
  await page.keyboard.type('cit')
  await expect(slashMenu(page).getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(slashMenu(page)).toBeHidden()
  await expect(body(page)).not.toHaveAttribute('aria-activedescendant')
  await expect(body(page)).toContainText('/cit')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')

  // Lo que no existe
  await page.keyboard.type('/zzz')
  await expect(page.getByText('Ningún bloque se llama así.')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')

  // Una tabla, con su fila de cabecera
  await page.keyboard.type('/tabla')
  await expect(slashMenu(page).getByRole('option', { name: /Tabla/ })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(slashMenu(page)).toBeHidden()
  const table = body(page).getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveCount(3)
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(announced(page)).toHaveText('Bloque insertado: tabla.')
  await page.keyboard.type('Barrio')
  await expect(table.getByRole('columnheader').first()).toHaveText('Barrio')

  // La barra de la tabla: con Alt+F10 y las flechas
  const tableBar = page.getByRole('toolbar', { name: 'Tabla' })
  await expect(tableBar).toBeVisible()
  await page.keyboard.press('Alt+F10')
  await expect(tableBar.getByRole('button', { name: 'Fila debajo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(table.getByRole('row')).toHaveCount(4)
  await page.keyboard.press('Alt+F10')
  await page.keyboard.press('ArrowRight')
  await expect(tableBar.getByRole('button', { name: 'Columna a la derecha' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(table.getByRole('row').first().getByRole('columnheader')).toHaveCount(4)
  await tableBar.getByRole('button', { name: 'Fila de cabecera' }).click()
  await expect(table.getByRole('columnheader')).toHaveCount(0)
  await tableBar.getByRole('button', { name: 'Quitar la tabla' }).click()
  await expect(body(page).getByRole('table')).toHaveCount(0)
})

test('los recuadros, la caja y los atajos de Markdown al escribir', async ({ page }) => {
  await openPage(page)
  await page.keyboard.type('/aviso')
  await page.keyboard.press('Enter')
  const warning = body(page).getByRole('note', { name: 'Aviso' })
  await expect(warning).toBeVisible()
  await page.keyboard.type('Cuidado con la marea.')
  await expect(warning).toContainText('Cuidado con la marea.')
  // Intro en un párrafo vacío sale del recuadro
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/voz')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Huele a sal y a ceniza.')
  await expect(body(page).getByRole('note', { name: 'Leer en voz alta' })).toContainText('Huele a sal')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/caja')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Dentro de la caja.')
  await expect(body(page).locator('[data-box]')).toContainText('Dentro de la caja.')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  // Los atajos: ## , - , 1. , [ ] , > , ``` y ---
  await page.keyboard.type('## Historia')
  await expect(body(page).getByRole('heading', { level: 3, name: 'Historia' })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('- uno')
  await expect(body(page).locator('ul:not([data-type]) li')).toHaveText('uno')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('1. dos')
  await expect(body(page).locator('ol li')).toHaveText('dos')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('[ ] tres')
  await expect(body(page).getByRole('checkbox', { name: 'Por hacer: tres' })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('> Una cita')
  await expect(body(page).locator('blockquote')).toHaveText('Una cita')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('``` ')
  await page.keyboard.type('tirar(1d20)')
  await expect(body(page).locator('pre code')).toHaveText('tirar(1d20)')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.type('---')
  await expect(body(page).locator('hr')).toHaveCount(1)

  // Sigue todo al recargar
  await page.waitForTimeout(2500)
  await page.reload()
  await expect(body(page).getByRole('note', { name: 'Aviso' })).toContainText('Cuidado con la marea.')
  await expect(body(page).getByRole('heading', { level: 3, name: 'Historia' })).toBeVisible()
})

test('la barra de formato: con el ratón y con Alt+F10; los enlaces, solo http, https o mailto', async ({ page }) => {
  await openPage(page)
  await page.keyboard.type('La Hermandad quemó el faro')
  await body(page)
    .getByText('La Hermandad quemó el faro')
    .dblclick({ position: { x: 40, y: 8 } })
  const format = page.getByRole('toolbar', { name: 'Formato' })
  await expect(format).toBeVisible()
  await format.getByRole('button', { name: 'Negrita' }).click()
  await expect(body(page).locator('strong')).toHaveCount(1)
  await expect(format.getByRole('button', { name: 'Negrita' })).toHaveAttribute('aria-pressed', 'true')

  // Con el teclado: elegir con Mayús y las flechas, Alt+F10 y a la barra. Antes, que la selección sea la nueva (la
  // barra de la anterior sigue un instante a la vista)
  await body(page).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString())).toBe('faro')
  await expect(format.getByRole('button', { name: 'Negrita' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Alt+F10')
  await expect(format.getByRole('button', { name: 'Negrita' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(format.getByRole('button', { name: 'Cursiva' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(body(page).locator('em')).toHaveText('faro')
  await page.keyboard.press('Escape')
  await expect(body(page)).toBeFocused()

  // Un enlace: lo que no es http, https o mailto no se pone
  await expect(format).toBeVisible()
  await page.keyboard.press('Alt+F10')
  await format.getByRole('button', { name: 'Enlace' }).click()
  const address = page.getByLabel('Dirección')
  await expect(address).toBeFocused()
  await address.fill('javascript:alert(1)')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Solo direcciones que empiecen por http, https o mailto.')
  await expect(body(page).locator('a')).toHaveCount(0)
  await address.fill('https://eana.example/faro')
  await page.keyboard.press('Enter')
  await expect(body(page).getByRole('link', { name: 'faro' })).toHaveAttribute('href', 'https://eana.example/faro')
  await expect(body(page)).toBeFocused()
})

test('el menú del bloque: desde la barra con el teclado, y desde el asa con el ratón', async ({ page }) => {
  await openPage(page)
  await page.keyboard.type('Primero')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Segundo')

  // Desde la barra: el bloque del cursor
  const blockButton = page
    .getByRole('toolbar', { name: 'Insertar en el texto' })
    .getByRole('button', { name: 'Bloque' })
  await blockButton.click()
  const menu = page.getByRole('menu', { name: 'Bloque' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(blockButton).toBeFocused()

  // Subir el segundo
  await body(page).getByText('Segundo').click()
  await blockButton.click()
  await menu.getByRole('menuitem', { name: 'Subir' }).click()
  await expect(body(page).locator('p').first()).toHaveText('Segundo')
  await expect(announced(page)).toHaveText('Bloque movido.')

  // Convertir en aviso, duplicar y borrar
  await body(page).getByText('Primero').click()
  await blockButton.click()
  await menu.getByRole('menuitem', { name: 'Aviso' }).click()
  await expect(body(page).getByRole('note', { name: 'Aviso' })).toHaveText(/Primero/)
  await blockButton.click()
  await menu.getByRole('menuitem', { name: 'Duplicar' }).click()
  await expect(body(page).getByRole('note', { name: 'Aviso' })).toHaveCount(2)
  await blockButton.click()
  await menu.getByRole('menuitem', { name: 'Borrar' }).click()
  await expect(body(page).getByRole('note', { name: 'Aviso' })).toHaveCount(1)

  // Un aviso pasa a consejo sin perder lo de dentro
  await body(page).getByText('Primero').click()
  await blockButton.click()
  await menu.getByRole('menuitem', { name: 'Consejo' }).click()
  await expect(body(page).getByRole('note', { name: 'Consejo' })).toHaveText(/Primero/)

  // Desde el asa, junto al bloque bajo el ratón
  await body(page).getByText('Segundo').hover()
  const grip = page.getByRole('button', { name: 'Mover o cambiar el bloque' })
  await expect(grip).toBeVisible()
  await grip.click()
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Título 2' }).click()
  await expect(body(page).getByRole('heading', { level: 3, name: 'Segundo' })).toBeVisible()
})

test('secretos desde el menú «/», y el menú dentro de un secreto, sin «Del máster»', async ({ page }) => {
  await openPage(page)
  await page.keyboard.type('/secreto')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Secreto' })).toBeVisible()
  const secret = page.getByRole('textbox', { name: 'Texto del secreto' })
  await secret.click()
  await page.keyboard.type('/')
  const menu = slashMenu(page)
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('group', { name: 'Recuadros' })).toBeVisible()
  await expect(menu.getByRole('group', { name: 'Del máster' })).toHaveCount(0)
  // Las flechas son del menú, no salen del secreto
  await page.keyboard.press('ArrowDown')
  await expect(secret).toBeFocused()
  await page.keyboard.type('aviso')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Solo para el máster.')
  await expect(secret.getByRole('note', { name: 'Aviso' })).toContainText('Solo para el máster.')
})

test('arrastrar un bloque por su asa lo cambia de sitio', async ({ page }) => {
  await openPage(page)
  for (const text of ['Primero', 'Segundo', 'Tercero']) {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }
  await body(page).getByText('Tercero').hover()
  const grip = page.getByRole('button', { name: 'Mover o cambiar el bloque' })
  await expect(grip).toBeVisible()
  await grip.dragTo(body(page).getByText('Primero'), { targetPosition: { x: 5, y: 2 } })
  await expect(body(page).locator('p').first()).toHaveText('Tercero')
})

test('los ids de los bloques no cambian al recargar ni al escribir, y no se repiten', async ({ page }) => {
  await openPage(page)
  for (const text of ['Uno', 'Dos', 'Tres']) {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }
  const ids = () =>
    body(page)
      .locator(':scope > [data-id]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-id')))
  await expect.poll(async () => (await ids()).length).toBeGreaterThanOrEqual(3)
  const before = await ids()
  expect(new Set(before).size).toBe(before.length)
  expect(before.every((id) => /^[a-z0-9]{8}$/.test(id ?? ''))).toBe(true)
  await page.waitForTimeout(2500)
  await page.reload()
  await expect(body(page)).toContainText('Tres')
  expect((await ids()).slice(0, 3)).toEqual(before.slice(0, 3))
  // Escribir en un bloque no le cambia el id
  await body(page).getByText('Dos').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' y medio')
  expect((await ids()).slice(0, 3)).toEqual(before.slice(0, 3))
})

test('pegar HTML de fuera: solo entra lo que el esquema conoce', async ({ page }) => {
  await openPage(page)
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData(
      'text/html',
      '<h1 style="color:red" onclick="window.pwned=1">El faro</h1><script>window.pwned=1</script>' +
        '<p class="x">La <b>Hermandad</b> <a href="javascript:window.pwned=1">lo quemó</a>.</p><img src="x" onerror="window.pwned=1">'
    )
    data.setData('text/plain', 'El faro La Hermandad lo quemó.')
    document.activeElement?.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    )
  })
  await expect(body(page).getByRole('heading', { level: 2, name: 'El faro' })).toBeVisible()
  await expect(body(page).locator('strong')).toHaveText('Hermandad')
  const html = await body(page).innerHTML()
  expect(html).not.toMatch(/onclick|onerror|<script|<img|javascript:|color:\s*red|class="x"/)
  expect(await page.evaluate(() => (window as { pwned?: number }).pwned)).toBeUndefined()
})

test('el editor con sus bloques y sus menús, en los dos temas @a11y', async ({ page }) => {
  await openPage(page)
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
  for (const block of ['/aviso', '/consejo', '/peligro', '/nota', '/voz', '/caja']) {
    await page.keyboard.type(block)
    await page.keyboard.press('Enter')
    await page.keyboard.type(`Texto de ${block.slice(1)}`)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
  }
  await page.keyboard.type('/tabla')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Barrio')
  await check()
  // Con el menú «/» abierto (en un párrafo nuevo tras el primer recuadro, lejos de la tabla)
  await body(page).getByText('Texto de aviso').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await expect(slashMenu(page)).toBeVisible()
  await check()
  await page.keyboard.press('Escape')
  // Con la barra de formato y con el menú del bloque
  await body(page).getByText('Texto de aviso').dblclick()
  await expect(page.getByRole('toolbar', { name: 'Formato' })).toBeVisible()
  await check()
  await page.getByRole('toolbar', { name: 'Insertar en el texto' }).getByRole('button', { name: 'Bloque' }).click()
  await expect(page.getByRole('menu', { name: 'Bloque' })).toBeVisible()
  await check()
})
