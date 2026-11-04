import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, settled, toWorlds } from './ayudas.ts'

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
  await page
    .getByRole('list', { name: 'De serie' })
    .getByRole('listitem')
    .filter({ hasText: 'En blanco' })
    .getByRole('button', { name: 'Copiar' })
    .click()
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

test('elegir el sistema de una campaña: la ficha de dados propone su tirada por defecto', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  // Un sistema de 2d6, subido por la API (el editor llega después)
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
  await page.getByRole('link', { name: 'Los páramos', exact: true }).click()
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
  await expect(page.getByRole('complementary', { name: 'Dados' }).getByRole('textbox', { name: 'Tirada' })).toHaveValue(
    '2d6'
  )
})

test('el editor: un tipo con sus campos, una fórmula mal escrita que no deja guardar, y en el móvil', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const created = await (await page.request.post('/api/actions/createSystem', { data: { name: 'Fronteras' } })).json()
  await page.goto(`/sistemas/${created.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Fronteras' })).toBeVisible()
  const parts = page.getByRole('complementary', { name: 'Partes del sistema' })
  await parts.getByRole('button', { name: /^Personaje/ }).click()
  await page.getByRole('button', { name: 'Campo nuevo' }).click()
  await page.getByLabel('Clase', { exact: true }).selectOption('derived')
  const formula = page.getByRole('combobox', { name: 'Fórmula' })
  await formula.fill('10 + @nada')
  await expect(page.getByText('No existe «@nada» en Personaje').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await accessible(page, 'main')
  await formula.fill('10')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Guardado')).toBeVisible()
  await page.reload()
  await page
    .getByRole('complementary', { name: 'Partes del sistema' })
    .getByRole('button', { name: /^Personaje 1/ })
    .click()
  await expect(page.getByText('@campo_nuevo')).toBeVisible()
  // «Probar», al lado: el calculado, con su valor
  const trying = page.getByRole('complementary', { name: 'Probar' })
  await expect(trying.getByText('Campo nuevo')).toBeVisible()
  await expect(trying.getByRole('list', { name: 'De dónde sale Campo nuevo' })).toContainText('10Base')

  // En el móvil: la parte, en un selector
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(parts).toBeHidden()
  await page.getByLabel('Parte del sistema').selectOption({ label: 'General' })
  await expect(page.getByRole('group', { name: 'General' })).toBeVisible()
  await accessible(page, 'main')
  // «Probar», en una hoja
  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByRole('dialog', { name: 'Probar' }).getByText('Campo nuevo')).toBeVisible()
  await accessible(page, 'dialog')
})

test('criterio 2: un sistema de 2d6 desde «En blanco», probado al lado y elegido en una campaña', async ({ page }) => {
  test.slow()
  await freshOwner(page)
  await page.goto('/sistemas')
  await page
    .getByRole('list', { name: 'De serie' })
    .getByRole('listitem')
    .filter({ hasText: 'En blanco' })
    .getByRole('button', { name: 'Copiar' })
    .click()
  const create = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await create.getByLabel('Nombre').fill('Fronteras')
  await create.getByRole('button', { name: 'Crear el sistema' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fronteras' })).toBeVisible()
  const parts = page.getByRole('complementary', { name: 'Partes del sistema' })

  // Un tipo con tres atributos y un derivado
  await parts.getByRole('button', { name: /^Personaje/ }).click()
  for (const name of ['Vigor', 'Astucia', 'Presencia']) {
    await page.getByRole('button', { name: 'Campo nuevo' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill(name)
    await page.getByLabel('Clave', { exact: true }).fill(name.toLowerCase())
  }
  await page.getByRole('button', { name: 'Campo nuevo' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Defensa')
  await page.getByLabel('Clave', { exact: true }).fill('defensa')
  await page.getByLabel('Clase', { exact: true }).selectOption('derived')
  await page.getByRole('combobox', { name: 'Fórmula' }).fill('7 + @vigor')

  // La tirada: 2d6 + el atributo por el que se tira, con sus franjas
  await parts.getByRole('button', { name: /^Tiradas/ }).click()
  await page.getByRole('button', { name: 'Tirada nueva' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Atributo')
  await page.getByLabel('Clave', { exact: true }).fill('atributo')
  await page.getByRole('combobox', { name: 'Fórmula' }).fill('2d6 + @este')
  const forEach = page.getByRole('group', { name: 'Una por cada uno de' })
  for (const name of ['Vigor', 'Astucia', 'Presencia'])
    await forEach.getByRole('checkbox', { name: new RegExp(`^${name}`) }).check()
  await page.getByRole('button', { name: 'Franja nueva' }).click()
  await page.getByRole('combobox', { name: 'Si (franja 1)' }).fill('@total >= 10')
  await page.getByLabel('Se llama (franja 1)').fill('Éxito total')
  await page.getByLabel('Es (franja 1)').selectOption('success')
  await page.getByRole('button', { name: 'Franja nueva' }).click()
  await page.getByLabel('Se llama (franja 2)').fill('Fallo')
  await page.getByLabel('Es (franja 2)').selectOption('failure')
  await accessible(page, 'main')

  // Los dados: 2d6 por defecto, sin críticos
  await parts.getByRole('button', { name: /^Dados/ }).click()
  await page.getByLabel('Tirada por defecto').fill('2d6')
  await page.getByRole('radio', { name: /^Ninguno/ }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Guardado')).toBeVisible()
  // Sigue en la parte en la que estaba
  await expect(page.getByLabel('Tirada por defecto')).toHaveValue('2d6')

  // Probar al lado: la tirada, sin apuntarla
  const trying = page.getByRole('complementary', { name: 'Probar' })
  await trying.getByLabel('Por qué se tira Atributo').selectOption('astucia')
  await trying.getByRole('button', { name: 'Tirar Atributo' }).click()
  await expect(trying.getByText('De prueba: no se apunta en ninguna campaña')).toBeVisible()
  await expect(trying.getByText(/^(Éxito total|Fallo)$/)).toBeVisible()

  // Avanzado: el JSON, sin problemas
  await parts.getByRole('button', { name: /^Avanzado/ }).click()
  await expect(page.getByLabel('El sistema en JSON')).toContainText('"formula": "2d6 + @este"')
  await expect(page.getByRole('complementary', { name: 'Problemas' })).toContainText('Ninguno.')
  await accessible(page, 'main')

  // Elegido en una campaña: la ficha de dados propone 2d6
  await createWorld(page, 'Eana')
  await createCampaign(page, 'Los páramos')
  await toWorlds(page)
  await page.getByRole('button', { name: 'Ajustes de Los páramos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajustes de Los páramos' })
  await dialog.getByLabel('Sistema').selectOption({ label: 'Fronteras' })
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeHidden()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('link', { name: 'Los páramos', exact: true }).click()
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
  await expect(page.getByRole('complementary', { name: 'Dados' }).getByRole('textbox', { name: 'Tirada' })).toHaveValue(
    '2d6'
  )
})

test('el editor, Avanzado: un JSON con errores marca su línea, y un archivo roto no reemplaza nada', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const created = await (await page.request.post('/api/actions/createSystem', { data: { name: 'Fronteras' } })).json()
  await page.goto(`/sistemas/${created.id}`)
  await page
    .getByRole('complementary', { name: 'Partes del sistema' })
    .getByRole('button', { name: /^Avanzado/ })
    .click()
  const code = page.getByLabel('El sistema en JSON')
  const text = await code.inputValue()
  await code.fill(
    text.replace('"fields": {}', '"fields": { "ca": { "kind": "derived", "label": "CA", "formula": "10 + @des" } }')
  )
  const problems = page.getByRole('complementary', { name: 'Problemas' })
  await expect(problems.getByRole('button', { name: /^Personaje › CA › Fórmula/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await problems.getByRole('button', { name: /^Personaje › CA › Fórmula/ }).click()
  await expect(code).toBeFocused()
  await accessible(page, 'main')
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // Un archivo roto: dice qué falla y el sistema sigue como estaba
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) })
  const refused = page.getByRole('alertdialog', { name: 'No se ha subido' })
  await expect(refused).toContainText('Fronteras sigue como estaba')
  await expect(refused).toContainText('No existe «@des» en Personaje')
  await accessible(page, 'dialog')
  await refused.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fronteras' })).toBeVisible()

  // En el móvil, los problemas van debajo
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('complementary', { name: 'Problemas' })).toBeVisible()
  await accessible(page, 'main')
})
