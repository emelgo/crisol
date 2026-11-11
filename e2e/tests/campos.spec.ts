import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

test('los campos en el panel: opciones, reloj y un enlace a una sola página, y siguen al recargar', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  const newPage = async (title: string) => {
    await page.getByRole('button', { name: 'Página nueva' }).click()
    await page.keyboard.type(title)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  }
  await newPage('La Raqisa')
  await newPage('Casa Vellard')
  await newPage('Mamá Gris')
  const pageId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const raqisa = await page.evaluate(async (worldId) => {
    const response = await fetch('/api/actions/listPageTree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worldId, levels: 1 })
    })
    const { pages } = (await response.json()) as { pages: { id: string; title: string }[] }
    return pages.find((p) => p.title === 'La Raqisa')?.id
  }, new URL(page.url()).pathname.split('/')[2])
  // Un campo de plantilla, como lo pondrá la plantilla PNJ (tarea 4): un enlace a una sola página
  await page.evaluate(
    async ([id, faction]) => {
      await fetch('/api/actions/setPageProperties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: id,
          properties: [{ name: 'Facción', field: 'faccion', type: 'pages', single: true, value: [faction] }]
        })
      })
    },
    [pageId, raqisa] as const
  )
  await page.reload()

  const panel = page.getByRole('complementary', { name: 'Panel de la página' })
  const properties = page.getByRole('region', { name: 'Propiedades' })
  await expect(properties.getByRole('link', { name: 'La Raqisa' })).toBeVisible()
  // Un enlace a una sola página: elegir otra la cambia
  const changed = page.waitForResponse((r) => r.url().endsWith('/api/actions/setPageProperties'))
  await properties.getByLabel('Valor de la propiedad 1').fill('Casa Vellard')
  await changed
  await expect(properties.getByRole('link', { name: 'Casa Vellard' })).toBeVisible()
  await expect(properties.getByRole('link', { name: 'La Raqisa' })).toHaveCount(0)

  // A mano: unas opciones y un reloj
  const addProperty = async (name: string, type: string) => {
    await panel.getByRole('button', { name: 'Añadir bloque' }).click()
    await panel.getByRole('button', { name: 'Propiedad', exact: true }).click()
    const n = await properties.getByRole('textbox', { name: /^Nombre de la propiedad/ }).count()
    await properties.getByLabel(`Nombre de la propiedad ${n}`).fill(name)
    await properties.getByLabel(`Nombre de la propiedad ${n}`).press('Enter')
    await properties.getByLabel(`Tipo de la propiedad ${n}`).selectOption({ label: type })
    return n
  }
  const estado = await addProperty('Estado', 'Opciones')
  await properties.getByLabel('Opciones de Estado').fill('Vive')
  await properties.getByLabel('Opciones de Estado').press('Enter')
  await properties.getByLabel('Opciones de Estado').fill('Ha muerto')
  await properties.getByLabel('Opciones de Estado').press('Enter')
  await properties.getByRole('button', { name: `Valor de la propiedad ${estado}` }).click()
  await properties.getByRole('option', { name: 'Ha muerto' }).click()
  await expect(properties.getByRole('button', { name: `Valor de la propiedad ${estado}` })).toContainText('Ha muerto')

  const reloj = await addProperty('Reloj', 'Reloj')
  const clock = properties.getByRole('group', { name: `Valor de la propiedad ${reloj}` })
  const ticked = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/actions/setPageProperties') &&
      /"type":"clock","value":3/.test(r.request().postData() ?? '')
  )
  await clock.getByRole('button', { name: 'Segmento 3 de 4' }).click()
  await ticked

  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('aside').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }

  await page.reload()
  await expect(properties.getByRole('link', { name: 'Casa Vellard' })).toBeVisible()
  await expect(properties.getByRole('button', { name: `Valor de la propiedad ${estado}` })).toContainText('Ha muerto')
  await expect(
    properties.getByRole('group', { name: `Valor de la propiedad ${reloj}` }).getByText('3 de 4')
  ).toBeVisible()
})
