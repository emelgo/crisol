import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, import5e, openCampaign, settled, toWorlds } from './ayudas.ts'

/** Que axe no encuentre fallos críticos ni graves, en claro y en oscuro */
async function accessible(page: Page, include: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
}

test('«Sistemas»: se hacen con la IA; subir un archivo roto y uno bueno, bajar uno vacío y borrar', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sistemas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sistemas' })).toBeVisible()
  // Crisol viene vacío (ADR-0015): ninguno de serie
  await expect(page.getByRole('list', { name: 'De serie' })).toHaveCount(0)
  await accessible(page, 'main')

  // «Sistema nuevo»: se hacen con la IA; aquí, un archivo roto dice qué falla y no se sube nada
  await page.getByRole('button', { name: 'Sistema nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await expect(dialog).toContainText('Los sistemas se hacen con la IA')
  await accessible(page, 'dialog')
  const file = (name: string, formula: string) => ({
    kind: 'crisol-system',
    format: 1,
    system: {
      format: 1,
      id: 'x',
      name,
      version: '1',
      languages: ['es'],
      types: {
        personaje: {
          document: 'actor',
          label: 'Personaje',
          fields: {
            des: { kind: 'number', label: 'Destreza' },
            ca: { kind: 'derived', label: 'CA', formula }
          }
        }
      }
    },
    content: []
  })
  const upload = (content: unknown, name: string) =>
    dialog
      .getByLabel('Elegir el archivo')
      .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) })
  await upload(file('Roto', '10 + @dex'), 'roto.json')
  await expect(dialog.getByRole('alert')).toContainText('Personaje › CA › Fórmula')
  await expect(dialog.getByRole('alert')).toContainText('No existe «@dex» en Personaje')
  await expect(dialog.getByRole('button', { name: 'Subir el sistema' })).toBeDisabled()
  await accessible(page, 'dialog')

  // Bajar uno vacío, para empezar a mano
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Bajar uno vacío' }).click()
  const blank = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(blank).toMatchObject({ kind: 'crisol-system', system: { id: 'blank' } })

  // El bueno se sube y sale en los tuyos, sin irse de aquí
  await upload(file('Fronteras', '10 + @des'), 'fronteras.json')
  await dialog.getByRole('button', { name: 'Subir el sistema' }).click()
  await expect(dialog).toBeHidden()
  const mine = page.getByRole('list', { name: 'Tuyos' })
  await expect(mine.getByRole('link', { name: 'Fronteras', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/sistemas$/)

  // Borrar uno que no usa ninguna campaña
  await mine.getByRole('button', { name: 'Ajustes de Fronteras' }).click()
  const settings = page.getByRole('dialog', { name: 'Ajustes de Fronteras' })
  await settings.getByRole('button', { name: 'Borrar el sistema' }).click()
  const confirm = page.getByRole('dialog', { name: '¿Borrar el sistema Fronteras?' })
  await confirm.getByLabel('Nombre').fill('Fronteras')
  await confirm.getByRole('button', { name: 'Borrar el sistema' }).click()
  await expect(mine.getByRole('button')).toHaveText(['Sistema nuevo'])
})

test('elegir el sistema de una campaña: los dados, al escribir, proponen su tirada por defecto', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  // Un sistema de 2d6, subido por la API (se hacen con la IA o se suben)
  const file = {
    kind: 'crisol-system',
    format: 1,
    system: {
      format: 1,
      id: 'x',
      name: 'Fronteras',
      version: '1',
      languages: ['es'],
      types: { personaje: { document: 'actor', label: 'Personaje', fields: {} } },
      dice: { default: '2d6', critical: 'none' }
    },
    content: []
  }
  expect((await page.request.post('/api/actions/importSystem', { data: { file } })).status()).toBe(200)
  await createWorld(page, 'Eana')
  await createCampaign(page, 'Los páramos')
  await toWorlds(page)
  await page.getByRole('button', { name: 'Ajustes de Los páramos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajustes de Los páramos' })
  await dialog.getByLabel('Sistema').selectOption({ label: 'Fronteras' })
  await accessible(page, 'dialog')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  // Guardado, «Guardar» se va; la ventana se cierra con su X
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeHidden()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await openCampaign(page, 'Los páramos')
  await page.locator('[data-tour="dados"]').click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await dice.getByRole('button', { name: 'Escribir la tirada' }).click()
  await expect(dice.getByRole('textbox', { name: 'Tirada' })).toHaveValue('2d6')
})

test('criterio 5: el 5e en una campaña, con sus ediciones, lo que está en las dos y sus reglas', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  const five = await import5e(page)
  await createWorld(page, 'Eana')
  await createCampaign(page, 'La Marca')
  await toWorlds(page)
  await page.getByRole('button', { name: 'Ajustes de La Marca' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajustes de La Marca' })
  await dialog.getByLabel('Sistema').selectOption({ label: '5e' })
  const editions = dialog.getByRole('group', { name: 'Ediciones' })
  await expect(editions.getByRole('checkbox', { name: /^2024/ })).toBeChecked()
  await expect(editions.getByRole('checkbox', { name: /^2014/ })).toBeChecked()
  // Lo de serie se ve como saldría: con las dos versiones, la de 2014 marcada «Legado»
  const look = dialog.getByRole('region', { name: 'Así se ve al elegir' })
  await expect(look.getByRole('listitem').first()).toContainText('2024')
  await dialog.getByRole('radio', { name: /Las dos versiones/ }).check()
  await expect(look.getByText(/2014 · Legado/).first()).toBeVisible()
  await dialog.getByRole('group', { name: 'Reglas generales' }).getByText('2014').click()
  await accessible(page, 'dialog')
  // Sin ninguna edición, no se guarda
  await editions.getByRole('checkbox', { name: /^2024/ }).uncheck()
  await editions.getByRole('checkbox', { name: /^2014/ }).uncheck()
  await expect(editions.getByRole('alert')).toHaveText('Activa al menos una edición')
  await editions.getByRole('checkbox', { name: /^2014/ }).check()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeHidden()
  const saved = await (await page.request.post('/api/actions/listWorldsWithCampaigns', { data: {} })).json()
  expect(saved.worlds[0].campaigns[0].system.id).toBe(five)
})
