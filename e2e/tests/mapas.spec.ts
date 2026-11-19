import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

/** Un mapa de mentira: un SVG con medidas, para que el navegador sepa lo que mide */
const MAP = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#cfe3ef"/>
  <path d="M200 300 Q500 80 900 260 T1400 420 L1300 820 Q900 940 500 800 Z" fill="#d9c9a0" stroke="#7a6a48" stroke-width="6"/>
  <circle cx="700" cy="500" r="40" fill="#8a5a3a"/>
</svg>`
)

/** «+» en las pestañas: el cuadro con el mapa ya elegido, y «Crear» */
async function addMap(page: Page) {
  await page.getByRole('button', { name: 'Pestaña nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await expect(dialog.getByRole('radio', { name: 'Texto' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Mapa' }).check()
  // La cronología y el árbol genealógico también son pestañas (ADR-0031): ninguna «Pronto»
  await expect(dialog.getByRole('radio', { name: 'Cronología' })).toBeEnabled()
  await expect(dialog.getByRole('radio', { name: 'Árbol genealógico' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(dialog).toHaveCount(0)
}

async function openPage(page: Page) {
  await freshOwner(page)
  await page.addInitScript(() => {
    // Sin el recorrido del mapa, que taparía lo que se pulsa (se prueba aparte)
    const key = 'crisol.recorridos.enrique@crisol.test'
    const seen = JSON.parse(localStorage.getItem(key) ?? '{"seen":[]}').seen
    localStorage.setItem(key, JSON.stringify({ seen: [...seen, 'mapa'] }))
  })
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  // El cuadro de página nueva: el título, y Intro la crea
  await expect(page.getByRole('dialog').getByLabel('Título', { exact: true })).toBeFocused()
  await page.keyboard.type('Costa Gris')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Costa Gris' })).toBeVisible()
  const [, , worldId] = new URL(page.url()).pathname.split('/')
  const uploaded = await page.request.post(`/api/files?worldId=${worldId}&name=Costa.svg`, {
    data: MAP,
    headers: { 'content-type': 'application/octet-stream' }
  })
  expect(uploaded.status()).toBe(201)
  return { worldId: worldId ?? '' }
}

test('un mapa en la página: se añade desde «⋯», se le pone imagen, se ponen pines y uno lleva a una página nueva', async ({
  page
}) => {
  await openPage(page)

  // Solo el texto; «+» añade un mapa (los demás tipos, pronto)
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await expect(tabs.getByRole('link')).toHaveText(['Texto'])
  await addMap(page)
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Mapa'])
  await expect(tabs.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(/pestana=/)

  // Sin imagen, la pide: una del mundo
  await expect(page.getByText('Este mapa aún no tiene imagen.')).toBeVisible()
  await page.getByLabel('Imagen del mapa').selectOption({ label: 'Costa.svg' })
  const map = page.getByRole('application', { name: 'Mapa', exact: true })
  await expect(map.locator('img')).toBeVisible()

  // «Poner un pin» y pulsar en el mapa: sale su panel
  await page.getByRole('button', { name: 'Poner un pin' }).click()
  await expect(page.getByText('Pulsa donde quieras el pin')).toBeVisible()
  const box = await map.boundingBox()
  if (!box) throw new Error('sin mapa')
  // En medio de lo que se ve del mapa (en la página del mundo sigue más abajo de la ventana hasta bajar la columna,
  // y abajo está la píldora de sus herramientas)
  const seen = Math.min(box.y + box.height, page.viewportSize()?.height ?? 0)
  await page.mouse.click(box.x + box.width / 2, (box.y + seen) / 2 - 30)
  const panel = page.getByRole('region', { name: 'Pin' })
  await expect(panel).toBeVisible()
  await panel.getByLabel('Nombre', { exact: true }).fill('El faro')
  await panel.getByLabel('Nombre', { exact: true }).press('Enter')
  const pins = page.getByRole('list', { name: 'Pines del mapa' })
  await expect(pins.getByRole('button', { name: 'El faro' })).toBeVisible()

  // Su forma y su color se cambian al momento
  // (al momento, sin esperar al servidor)
  await panel.getByRole('radio', { name: 'Escudo' }).click()
  await panel.getByRole('radio', { name: 'Musgo' }).click()
  await expect(panel.getByRole('radio', { name: 'Escudo' })).toBeChecked()
  await expect(panel.getByRole('radio', { name: 'Musgo' })).toBeChecked()
  await panel.getByRole('button', { name: 'Cerrar' }).click()
  await expect(panel).toHaveCount(0)

  // Botón derecho: «Pin con página nueva»; el nombre que se le da es el de su página, subpágina de esta
  await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3, { button: 'right' })
  await page.getByRole('menuitem', { name: 'Pin con página nueva' }).click()
  await expect(panel.getByLabel('Página', { exact: true })).toBeFocused()
  await page.keyboard.type('Puerto Ceniza')
  await page.keyboard.press('Enter')
  await expect(panel.getByRole('link', { name: 'Abrir' })).toBeVisible()
  await expect(pins.getByRole('button', { name: 'Puerto Ceniza' })).toBeVisible()

  // Al volver, siguen ahí
  await page.reload()
  await expect(pins.getByRole('button')).toHaveCount(2)

  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, `${colorScheme}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
  }

  // Doble clic en el pin abre su página, que es subpágina de la del mapa
  await pins.getByRole('button', { name: 'Puerto Ceniza' }).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'Puerto Ceniza' })).toHaveAttribute('aria-level', '2')
})

test('las pestañas se renombran y se quitan; el texto sigue siendo la primera', async ({ page }) => {
  await openPage(page)
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  for (const count of [2, 3]) {
    await addMap(page)
    await expect(tabs.getByRole('link')).toHaveCount(count)
  }
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Mapa', 'Mapa 2'])

  await tabs.getByRole('button', { name: 'Opciones de la pestaña Mapa 2' }).click()
  await page.getByLabel('Nombre de la pestaña').fill('Ciudad')
  await page.getByLabel('Nombre de la pestaña').press('Enter')
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Mapa', 'Ciudad'])
  // Con color: su icono lo lleva
  await page.getByRole('radio', { name: 'Musgo' }).click()
  await expect(tabs.getByRole('link', { name: 'Ciudad' })).toHaveAttribute('data-color', '')
  // Se recoloca con Alt y las flechas (con el ratón, arrastrando)
  await tabs.getByRole('link', { name: 'Ciudad' }).press('Alt+ArrowLeft')
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Ciudad', 'Mapa'])

  await page.getByRole('button', { name: 'Eliminar pestaña' }).click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Mapa'])
  await expect(page).not.toHaveURL(/pestana=/)
  await expect(tabs.getByRole('link', { name: 'Texto' })).toHaveAttribute('aria-current', 'page')
})

test('una pestaña de texto es otra página de texto, con lo suyo', async ({ page }) => {
  await openPage(page)
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await page.getByRole('button', { name: 'Pestaña nueva' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(tabs.getByRole('link')).toHaveText(['Texto', 'Texto 2'])
  await expect(page).toHaveURL(/pestana=/)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.type('Lo de la segunda.')
  await expect(page.getByText('Guardado')).toBeVisible()
  await tabs.getByRole('link', { name: 'Texto', exact: true }).click()
  await expect(page.getByText('Lo de la segunda.')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Lo de la segunda.')).toHaveCount(0)
  await tabs.getByRole('link', { name: 'Texto 2' }).click()
  await expect(page.getByText('Lo de la segunda.')).toBeVisible()
})
