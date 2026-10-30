import { expect, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

test('una página mediana se abre lista para escribir en menos de 1 s', async ({ page }) => {
  // El tiempo cuenta en el VPS (como staging); las máquinas de la CI no se le parecen
  test.skip(Boolean(process.env.CI), 'Se mide en el VPS, no en la CI')
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  // Unos 40 KB: secciones, listas, una tabla, enlaces y un secreto
  const section = (n: number) =>
    `## Capítulo ${n}\n\n${'La costa de Eana guarda faros, puertos y dragones que nadie ha contado todavía. '.repeat(6)}\n\n- Uno\n- Dos\n- [[Otra ${n}]]\n\n| A | B |\n|---|---|\n| ${n} | ${n * 2} |`
  const markdown = `${Array.from({ length: 40 }, (_, n) => section(n + 1)).join('\n\n')}\n\n> [!secreto]\n> Lo del máster.\n\nFin de la página.`
  await page.request.post('/api/actions/createPages', {
    data: { worldId, parentId: null, pages: [{ key: 'm', title: 'Mediana', markdown }] }
  })
  await page.goto(`/mundos/${worldId}/wiki`)
  const item = page.getByRole('treeitem', { name: 'Mediana' })
  await expect(item).toBeVisible()
  const start = Date.now()
  await item.click()
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body.getByText('Fin de la página.')).toBeVisible()
  await expect(body).toHaveAttribute('contenteditable', 'true')
  const elapsed = Date.now() - start
  test.info().annotations.push({ type: 'abrir', description: `${elapsed} ms` })
  process.stderr.write(`abrir la página mediana: ${elapsed} ms\n`)
  expect(elapsed).toBeLessThan(1000)
})
