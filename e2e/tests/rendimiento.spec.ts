import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWorld } from './ayudas.ts'

test('una página mediana se abre lista para escribir en menos de 1 s', async ({ page }) => {
  // El tiempo cuenta en el VPS (como staging); las máquinas de la CI no se le parecen
  test.skip(Boolean(process.env.CI), 'Se mide en el VPS, no en la CI')
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWorld(page, 'Eana')
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
  // Se mide dentro del navegador, del clic a lista para escribir (contando desde fuera entrarían las esperas de
  // Playwright antes de pulsar y al preguntar, unos cientos de ms que no son de la app)
  await page.evaluate(() => {
    const w = window as unknown as { abrir?: Promise<number> }
    w.abrir = new Promise((resolve) => {
      document.addEventListener(
        'click',
        () => {
          const start = performance.now()
          const check = () => {
            const body = document.querySelector('[role="textbox"][aria-label="Texto de la página"]')
            const end = [...(body?.querySelectorAll('p') ?? [])].find((p) => p.textContent === 'Fin de la página.')
            if (body?.getAttribute('contenteditable') === 'true' && (end?.getBoundingClientRect().height ?? 0) > 0) {
              resolve(Math.round(performance.now() - start))
            } else requestAnimationFrame(check)
          }
          check()
        },
        { capture: true, once: true }
      )
    })
  })
  await item.click()
  const elapsed = await page.evaluate(() => (window as unknown as { abrir: Promise<number> }).abrir)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body.getByText('Fin de la página.')).toBeVisible()
  await expect(body).toHaveAttribute('contenteditable', 'true')
  test.info().annotations.push({ type: 'abrir', description: `${elapsed} ms` })
  process.stderr.write(`abrir la página mediana: ${elapsed} ms\n`)
  expect(elapsed).toBeLessThan(1000)
})
