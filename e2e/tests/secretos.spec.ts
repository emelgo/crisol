import { connect, schema } from '@crisol/db'
import { expect, type Page, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'
import { freshOwner } from './ayudas.ts'

/** El propietario crea Eana y una página, y la deja abierta */
async function openPage(page: Page, title = 'Puerto Ceniza') {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('link', { name: 'Wiki de Eana' }).click()
  await newPage(page, title)
  return page.url()
}

async function newPage(page: Page, title: string) {
  await page.getByRole('button', { name: 'Página nueva' }).click()
  await expect(page.getByLabel('Título de la página')).toBeFocused()
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })
const secretText = (page: Page) => page.getByRole('textbox', { name: 'Texto del secreto' })

/** Lo guardado en la base de datos: el cuerpo y los secretos de las páginas, en bytes */
async function stored() {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    const rows = await conn.db.select().from(schema.documents)
    return {
      body: Buffer.concat(rows.filter((r) => r.kind === 'body').map((r) => Buffer.from(r.state))),
      secrets: rows.filter((r) => r.kind === 'secret').map((r) => Buffer.from(r.state))
    }
  } finally {
    await conn.close()
  }
}

test('un párrafo se hace secreto y su texto se guarda aparte, nunca en el cuerpo; y vuelve a ser normal', async ({
  page
}) => {
  await openPage(page)
  await body(page).click()
  await page.keyboard.type('Puerto Ceniza es la última ciudad libre.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('La Hermandad quemó el faro.')
  await page.keyboard.press('Shift+Home')
  await page.getByRole('toolbar', { name: 'Insertar en el texto' }).getByRole('button', { name: 'Secreto' }).click()
  const secret = page.getByRole('region', { name: 'Secreto' })
  await expect(secret).toBeVisible()
  await expect(secretText(page)).toHaveText('La Hermandad quemó el faro.')
  await expect(body(page).getByText('Puerto Ceniza es la última ciudad libre.')).toBeVisible()

  // Más texto dentro del secreto, y se guarda
  await secretText(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Nadie lo sabe.')
  await page.waitForTimeout(2500)
  await page.reload()
  await expect(secretText(page)).toHaveText('La Hermandad quemó el faro. Nadie lo sabe.')
  const saved = await stored()
  expect(saved.body.includes('Hermandad')).toBe(false)
  expect(saved.body.includes('última ciudad libre')).toBe(true)
  expect(saved.secrets.some((s) => s.includes('Hermandad'))).toBe(true)

  await page.getByRole('button', { name: 'Convertir en texto normal' }).click()
  await expect(page.getByRole('region', { name: 'Secreto' })).toHaveCount(0)
  await expect(body(page).getByText('La Hermandad quemó el faro. Nadie lo sabe.')).toBeVisible()
})

test('con el teclado se entra y se sale del secreto; Ctrl+Z dentro solo deshace lo del secreto', async ({ page }) => {
  await openPage(page)
  await body(page).click()
  await page.keyboard.type('Antes.')
  await page.getByRole('toolbar', { name: 'Insertar en el texto' }).getByRole('button', { name: 'Nota oculta' }).click()
  const note = page.getByRole('textbox', { name: 'Texto de la nota oculta' })
  await expect(note).toBeVisible()

  // Desde el párrafo de antes, la flecha abajo elige el bloque e Intro entra en él
  await body(page).getByText('Antes.').click()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(note).toBeFocused()
  await page.keyboard.type('Preguntar por la familia de Maela.')
  await expect(note).toHaveText('Preguntar por la familia de Maela.')
  // Ctrl+Z: solo lo escrito en la nota
  await page.keyboard.press('ControlOrMeta+z')
  await expect(note).toHaveText('')
  await expect(body(page).getByText('Antes.')).toBeVisible()
  await page.keyboard.type('Otra cosa.')

  // Al final, la flecha abajo sale al cuerpo, detrás del bloque
  await page.keyboard.press('ArrowDown')
  await expect(body(page)).toBeFocused()
  await page.keyboard.type('Después.')
  await expect(body(page).getByText('Después.')).toBeVisible()
  // Escape, desde dentro, vuelve al cuerpo con el bloque elegido
  await note.click()
  await page.keyboard.press('Escape')
  await expect(body(page)).toBeFocused()
})

test('dos pestañas ven el mismo secreto al momento', async ({ page, context }) => {
  const url = await openPage(page)
  await body(page).click()
  await page.getByRole('toolbar', { name: 'Insertar en el texto' }).getByRole('button', { name: 'Secreto' }).click()
  await secretText(page).click()
  await page.keyboard.type('El mapa de las corrientes.')
  const other = await context.newPage()
  await other.goto(url)
  // Con toContainText: el cursor de la otra pestaña, con su nombre, va dentro del texto
  await expect(secretText(other)).toContainText('El mapa de las corrientes.')
  await secretText(other).click()
  await other.keyboard.press('End')
  await other.keyboard.type(' Lo tiene Maela.')
  await expect(secretText(page)).toContainText('El mapa de las corrientes. Lo tiene Maela.')
})

test('copiar un secreto a otra página crea otro documento: cambiar uno no cambia el otro', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openPage(page)
  await body(page).click()
  await page.getByRole('toolbar', { name: 'Insertar en el texto' }).getByRole('button', { name: 'Secreto' }).click()
  await secretText(page).click()
  await page.keyboard.type('Original.')
  // Elegir el bloque entero (Escape desde dentro) y copiarlo
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+c')

  await newPage(page, 'Velaria')
  await body(page).click()
  await page.keyboard.press('ControlOrMeta+v')
  await expect(secretText(page)).toHaveText('Original.')
  await secretText(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Copia cambiada.')
  await page.waitForTimeout(2500)

  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    const secrets = (await conn.db.select().from(schema.documents)).filter((d) => d.kind === 'secret')
    expect(secrets).toHaveLength(2)
    const texts = secrets.map((s) => Buffer.from(s.state))
    expect(texts.filter((t) => t.includes('Copia cambiada.'))).toHaveLength(1)
  } finally {
    await conn.close()
  }
})
