import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { createWorld, freshOwner, openWiki, slash } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

async function newPage(page: Page, title: string, button = 'Página nueva') {
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  // Ya con su nombre: la dirección deja de decir «nuevo»
  await expect(page).not.toHaveURL(/nuevo/)
}

/** Lo que hay en el .zip descargado: ruta → texto */
async function downloaded(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent('download')
  await click()
  const file = await download
  const zip = unzipSync(new Uint8Array(await readFile(await file.path())))
  return {
    name: file.suggestedFilename(),
    files: Object.fromEntries(Object.entries(zip).map(([p, d]) => [p, strFromU8(d)]))
  }
}

test('exportar una página, con sus subpáginas, y la wiki entera en Markdown', async ({ page }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await newPage(page, 'Lugares')
  await body(page).click()
  await page.keyboard.type('Los sitios de Eana.')
  await page.keyboard.press('Enter')
  await slash(page, 'Secreto')
  await page.getByRole('textbox', { name: 'Texto del secreto' }).click()
  await page.keyboard.type('El faro no fue un accidente.')
  await newPage(page, 'Costa Gris', 'Nueva subpágina')
  await page.getByRole('treeitem', { name: 'Lugares' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lugares' })).toBeVisible()

  // Con subpáginas: se elige
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  const branch = await downloaded(page, () => page.getByRole('button', { name: 'Con sus subpáginas' }).click())
  expect(branch.name).toBe('Lugares.zip')
  expect(Object.keys(branch.files).sort()).toEqual(['Lugares/Costa Gris.md', 'Lugares/Lugares.md'])
  expect(branch.files['Lugares/Lugares.md']).toContain('Los sitios de Eana.')
  expect(branch.files['Lugares/Lugares.md']).toContain('> [!secreto]\n> El faro no fue un accidente.')
  await expect(page.getByRole('status').getByText('Descargado: Lugares.zip')).toBeAttached()
  const only = await downloaded(page, () => page.getByRole('button', { name: 'Solo esta página' }).click())
  expect(Object.keys(only.files)).toEqual(['Lugares.md'])

  // La wiki entera
  const wiki = await downloaded(page, () => page.getByRole('button', { name: 'Exportar la wiki' }).click())
  expect(wiki.name).toBe('Eana.zip')
  expect(Object.keys(wiki.files).sort()).toEqual(['Lugares/Costa Gris.md', 'Lugares/Lugares.md'])
})
