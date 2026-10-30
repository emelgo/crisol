import { expect, type Page, test } from '@playwright/test'
import { connectClaude, freshOwner } from './ayudas.ts'

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

/** El propietario crea Eana y Puerto Ceniza con dos secciones; devuelve la dirección de la página y sus ids */
async function puertoCeniza(page: Page) {
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
  for (const line of ['## Historia', 'El faro.', '## Barrios', 'Los Muelles.']) {
    await page.keyboard.type(line)
    await page.keyboard.press('Enter')
  }
  await expect(body(page)).toContainText('Los Muelles.')
  const url = page.url()
  const [, worldId, pageId] = /\/mundos\/([^/]+)\/wiki\/([^/?#]+)/.exec(url) ?? []
  return { url, worldId: worldId ?? '', pageId: pageId ?? '' }
}

test('Claude cambia una sección de la página abierta: se ve sin recargar, se resalta y se avisa', async ({ page }) => {
  const { url, worldId, pageId } = await puertoCeniza(page)
  const claude = await connectClaude(page)
  await page.goto(url)
  await expect(body(page)).toContainText('El faro.')

  const read = await claude.call('leer_pagina', { pageId })
  expect(read.text).toContain('## Historia')
  const edited = await claude.call('editar_pagina', {
    pageId,
    body: { mode: 'section', section: 'Historia', markdown: 'Ardió en una noche.' }
  })
  expect(edited.isError, edited.text).toBeFalsy()
  await expect(body(page).getByText('Ardió en una noche.')).toBeVisible()
  await expect(body(page).getByText('El faro.')).toHaveCount(0)
  await expect(body(page).getByText('Los Muelles.')).toBeVisible()
  await expect(body(page).locator('[class*="aiFlash"]')).toHaveCount(1)
  await expect(page.getByRole('status').getByText('Claude ha cambiado la página.')).toBeAttached()

  // Varias páginas de una vez, con un secreto: salen en el árbol sin recargar
  const created = await claude.call('crear_paginas', {
    worldId,
    parentId: pageId,
    pages: [
      { key: 'muelles', title: 'Los Muelles', markdown: 'El barrio del puerto.' },
      { key: 'maela', parent: 'muelles', title: 'Maela Varn', markdown: '> [!secreto]\n> Es la jefa de la Hermandad.' }
    ]
  })
  expect(created.isError, created.text).toBeFalsy()
  // Puerto Ceniza pasa a tener subpáginas: se despliega con la flecha a la derecha
  const puerto = page.getByRole('treeitem', { name: 'Puerto Ceniza' })
  await expect(puerto).toHaveAttribute('aria-expanded', /true|false/)
  await puerto.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('treeitem', { name: 'Los Muelles' })).toBeVisible()
  // El historial lo cuenta como de Claude
  await page.goto('/historial')
  await expect(page.getByText('creó 2 páginas: «Los Muelles» y «Maela Varn»')).toBeVisible()
  // La sesión del máster (lo que escribió) y el cambio de Claude, cada uno con su entrada
  await expect(page.getByText('cambió la página «Puerto Ceniza»')).toHaveCount(2)
})
