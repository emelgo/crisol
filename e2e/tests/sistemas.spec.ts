import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

/** Que axe no encuentre fallos críticos ni graves, en claro y en oscuro */
async function accessible(page: Page, include: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
}

test('«Sistemas»: hacer uno desde cero, copiar uno de serie, subir un archivo roto y borrar', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sistemas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sistemas' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'De serie' }).getByRole('link', { name: 'En blanco' })).toBeVisible()
  await accessible(page, 'main')

  // Desde cero: se abre
  await page.getByRole('button', { name: 'Sistema nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await accessible(page, 'dialog')
  await dialog.getByLabel('Nombre').fill('Fronteras')
  await dialog.getByRole('button', { name: 'Crear el sistema' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fronteras' })).toBeVisible()
  await page.goBack()

  // Copiar uno de serie
  await page.getByRole('list', { name: 'De serie' }).getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByRole('dialog', { name: 'Sistema nuevo' }).getByLabel('Nombre')).toHaveValue(
    'En blanco (copia)'
  )
  await page.getByRole('dialog', { name: 'Sistema nuevo' }).getByRole('button', { name: 'Crear el sistema' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'En blanco (copia)' })).toBeVisible()
  await page.goBack()
  const mine = page.getByRole('list', { name: 'Tuyos' })
  await expect(mine.getByRole('link')).toHaveText(['Fronteras', 'En blanco (copia)'])

  // Un archivo roto: dice qué falla y no se sube nada
  await page.getByRole('button', { name: 'Sistema nuevo' }).click()
  await dialog.getByText('De un archivo').click()
  const broken = {
    kind: 'crisol-system',
    format: 1,
    system: {
      format: 1,
      id: 'x',
      name: 'Roto',
      version: '1',
      languages: ['es'],
      types: {
        personaje: {
          document: 'actor',
          label: 'Personaje',
          fields: { ca: { kind: 'derived', label: 'CA', formula: '10 + @des' } }
        }
      }
    },
    content: []
  }
  await dialog
    .getByLabel('Elegir el archivo')
    .setInputFiles({ name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) })
  await expect(dialog.getByRole('alert')).toContainText('Personaje › CA › Fórmula')
  await expect(dialog.getByRole('alert')).toContainText('No existe «@des» en Personaje')
  await expect(dialog.getByRole('button', { name: 'Subir el sistema' })).toBeDisabled()
  await accessible(page, 'dialog')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  // Borrar uno que no usa ninguna campaña
  await mine.getByRole('button', { name: 'Ajustes de En blanco (copia)' }).click()
  const settings = page.getByRole('dialog', { name: 'Ajustes de En blanco (copia)' })
  await settings.getByRole('button', { name: 'Borrar el sistema' }).click()
  const confirm = page.getByRole('dialog', { name: '¿Borrar el sistema En blanco (copia)?' })
  await confirm.getByLabel('Nombre').fill('En blanco (copia)')
  await confirm.getByRole('button', { name: 'Borrar el sistema' }).click()
  await expect(mine.getByRole('link')).toHaveText(['Fronteras'])
})
