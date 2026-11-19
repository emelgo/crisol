import { expect, test } from '@playwright/test'
import { freshOwner, settled } from './ayudas.ts'

test('un sistema a mano: «A mano» lo crea y abre su editor; lo que se añade sale en la ficha de ejemplo, se guarda solo y se tira (tanda 8); «Ver reglas» lo enseña para leerlo', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await page.goto('/sistemas')
  await page.getByRole('button', { name: 'Sistema nuevo' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await dialog.getByRole('button', { name: /A mano/ }).click()
  await dialog.getByLabel('Cómo se llama el juego').fill('Mazmorras de bolsillo')
  await dialog.getByRole('button', { name: 'Crear y empezar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })).toBeVisible()
  const systemId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const read = async () =>
    (await (await page.request.post('/api/actions/getSystem', { data: { systemId } })).json()) as {
      version: number
      document: { rolls?: Record<string, { formula: string }> }
    }
  const before = await read()

  // Unas características: salen en la ficha de ejemplo y se guarda solo
  await page.getByRole('button', { name: 'Varias a la vez' }).click()
  const example = page.getByRole('region', { name: 'Ficha de ejemplo' })
  await expect(example.getByText('Características')).toBeVisible()
  await expect(page.getByText('Guardado')).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => (await read()).version, { timeout: 10_000 }).toBeGreaterThan(before.version)
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-personaje.png') })

  // Una tirada: se lee en palabras y se tira con la ficha de ejemplo
  await page.getByRole('button', { name: 'Siguiente: Cómo se tira' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '¿Cómo se tira?' })).toBeVisible()
  await page.getByRole('button', { name: 'Una tirada' }).click()
  const formula = page.getByLabel(/Se tira/)
  await formula.fill('2d6 + 1')
  await expect(page.getByText(/Se lee:/)).toBeVisible()
  await page.getByRole('button', { name: 'Tirar una vez' }).click()
  await expect(page.locator('p').filter({ hasText: /^\d+2d6/ })).toBeVisible()
  await expect
    .poll(async () => Object.values((await read()).document.rolls ?? {}).map((r) => r.formula), { timeout: 10_000 })
    .toContain('2d6 + 1')
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('2-tiradas.png') })

  // Un error: no se guarda, la revisión lo dice y lleva a él
  await formula.fill('1d20 + @nada')
  // A la vista y anunciado
  await expect(page.getByText(/Sin guardar/)).toHaveCount(2)
  await expect(page.getByRole('status').getByText(/Sin guardar/)).toBeAttached()
  const review = page.getByRole('region', { name: 'Revisión' })
  await expect(review).toContainText('nada')
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('3-revision.png') })
  await formula.fill('1d20')
  // Arreglado, se guarda y se anuncia (tras un problema)
  await expect(page.getByRole('status').getByText('Guardado')).toBeAttached({ timeout: 10_000 })

  // «Ver reglas»: la vista para leerlas, con lo que se hizo; «Editar reglas» vuelve al editor
  await page.getByRole('link', { name: 'Ver reglas' }).click()
  await expect(page).toHaveURL(new RegExp(`/sistemas/${systemId}/reglas$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Reglas' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Personaje' }).getByText('Características')).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Tiradas' }).getByRole('heading', { name: 'Tirada nueva' })
  ).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('4-vista.png') })
  await page.getByRole('link', { name: 'Editar reglas' }).click()
  await expect(page).toHaveURL(new RegExp(`/sistemas/${systemId}/reglas/editar$`))
  await expect(page.getByRole('heading', { level: 2, name: '¿Qué tiene un personaje?' })).toBeVisible()
})
