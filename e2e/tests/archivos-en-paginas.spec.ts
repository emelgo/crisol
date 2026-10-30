import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner } from './ayudas.ts'

// Un PNG de verdad (1×1), para que el navegador lo pinte
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

/** El propietario crea Eana y «Puerto Ceniza», y la deja abierta; devuelve el mundo y la página */
async function openPage(page: Page) {
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
  const [, , worldId, , pageId] = new URL(page.url()).pathname.split('/')
  return { worldId: worldId ?? '', pageId: pageId ?? '' }
}

test('una imagen con «/»: se sube, lleva su pie, se abre en grande y sale en el Markdown; con ![[ se pone otra vez', async ({
  page
}) => {
  test.slow()
  const { pageId } = await openPage(page)
  await body(page).click()
  await page.keyboard.type('/imagen')
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles({ name: 'escudo.png', mimeType: 'image/png', buffer: PNG })
  const figure = body(page).getByRole('figure', { name: 'Archivo: escudo.png' })
  await expect(figure.locator('img').first()).toHaveAttribute('src', /^\/api\/files\//)
  await expect(page.getByRole('status').getByText('«escudo.png» subido')).toBeAttached()

  // El pie se guarda al salir del campo
  await figure.getByLabel('Pie de la imagen').fill('El escudo de la ciudad')
  await figure.getByLabel('Pie de la imagen').press('Enter')
  await expect
    .poll(
      async () => (await (await page.request.post('/api/actions/readPage', { data: { pageId } })).json()).markdown,
      {
        timeout: 10_000
      }
    )
    .toContain('![[escudo.png]]\n*El escudo de la ciudad*')

  // La caja de luz
  await figure.getByRole('button', { name: 'Ver «escudo.png» en grande' }).click()
  const lightbox = page.getByRole('dialog', { name: 'escudo.png' })
  await expect(lightbox).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(lightbox).toBeHidden()

  // Con `![[`, los archivos del mundo
  await body(page).click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('![[escu')
  await page
    .getByRole('listbox', { name: 'Páginas' })
    .getByRole('option', { name: /escudo\.png/ })
    .click()
  await expect(body(page).getByRole('figure', { name: 'Archivo: escudo.png' })).toHaveCount(2)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }
})

test('lo que Claude escribió antes de subir el archivo: «aún no está subido», y al subirlo aquí se ve', async ({
  page
}) => {
  const { worldId } = await openPage(page)
  const created = await page.request.post('/api/actions/createPages', {
    data: {
      worldId,
      parentId: null,
      pages: [{ key: 'm', title: 'Mapas', markdown: 'El mapa:\n\n![[Mapa de Eana.png]]' }]
    }
  })
  const [mapas] = (await created.json()).pages
  await page.goto(`/mundos/${worldId}/wiki/${mapas.id}`)
  await expect(body(page).getByText('«Mapa de Eana.png» aún no está subido')).toBeVisible()
  const chooser = page.waitForEvent('filechooser')
  await body(page).getByRole('button', { name: 'Subirlo' }).click()
  // Se sube con el nombre que espera la página, se llame como se llame en el disco
  await (await chooser).setFiles({ name: 'IMG_0042.png', mimeType: 'image/png', buffer: PNG })
  await expect(body(page).getByRole('button', { name: 'Ver «Mapa de Eana.png» en grande' })).toBeVisible()
  const { files } = await (await page.request.post('/api/actions/listFiles', { data: { worldId } })).json()
  expect(files).toMatchObject([{ name: 'Mapa de Eana.png', usedBy: 1 }])
})

test('pegar una imagen en el texto la sube y la pone donde estaba el cursor', async ({ page }) => {
  const { worldId } = await openPage(page)
  await body(page).click()
  await page.keyboard.type('Antes de la imagen.')
  await body(page).evaluate(
    (element, bytes) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], 'pegada.png', { type: 'image/png' }))
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    },
    [...PNG]
  )
  await expect(body(page).getByRole('figure', { name: 'Archivo: pegada.png' })).toBeVisible()
  const { files } = await (await page.request.post('/api/actions/listFiles', { data: { worldId } })).json()
  expect(files).toMatchObject([{ name: 'pegada.png', kind: 'image' }])
})
