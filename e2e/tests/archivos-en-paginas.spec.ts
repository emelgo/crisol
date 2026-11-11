import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { createWorld, freshOwner, openWiki } from './ayudas.ts'

// Un PNG de verdad (1×1), para que el navegador lo pinte
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const body = (page: Page) => page.getByRole('textbox', { name: 'Texto de la página' })

/** El propietario crea Eana y «Puerto Ceniza», y la deja abierta; devuelve el mundo y la página */
async function openPage(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await openWiki(page, 'Eana')
  await page.getByRole('button', { name: 'Página nueva' }).click()
  // El cuadro de página nueva: el título, y Intro la crea
  await expect(page.getByRole('dialog').getByLabel('Título', { exact: true })).toBeFocused()
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

  // Con `![[`, los archivos del mundo: en la línea de más, debajo de la imagen (abrir la página no añade ninguna)
  await body(page).locator('[data-ghost-line]').click()
  await page.keyboard.type('![[escu')
  await page
    .getByRole('listbox', { name: 'Páginas' })
    .getByRole('option', { name: /escudo\.png/ })
    .click()
  await expect(body(page).getByRole('figure', { name: 'Archivo: escudo.png' })).toHaveCount(2)

  for (const colorScheme of ['dark'] as const) {
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

/** Un PDF de verdad con tantas páginas como se pida, cada una con su número */
function pdfOfPages(count: number) {
  const objects: string[] = []
  const kids = Array.from({ length: count }, (_, i) => `${3 + i * 2} 0 R`).join(' ')
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${count} >>`)
  const font = 3 + count * 2
  for (let i = 0; i < count; i++) {
    const stream = `BT /F1 24 Tf 20 100 Td (Pagina ${i + 1}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`
    )
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let text = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(text.length)
    text += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = text.length
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) text += `${String(offset).padStart(10, '0')} 00000 n \n`
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(text, 'latin1')
}

test('un PDF en la página: enseña su tamaño, se abre aquí por la página 3 y se pasa de página', async ({ page }) => {
  const { worldId } = await openPage(page)
  const uploaded = await page.request.post(`/api/files?worldId=${worldId}&name=Libro.pdf`, {
    data: pdfOfPages(3),
    headers: { 'content-type': 'application/octet-stream' }
  })
  expect(uploaded.status()).toBe(201)
  const created = await page.request.post('/api/actions/createPages', {
    data: { worldId, parentId: null, pages: [{ key: 'l', title: 'Lecturas', markdown: '![[Libro.pdf#page=3]]' }] }
  })
  const [lecturas] = (await created.json()).pages
  await page.goto(`/mundos/${worldId}/wiki/${lecturas.id}`)
  const figure = body(page).getByRole('figure', { name: 'Archivo: Libro.pdf' })
  await expect(figure.getByText(/PDF · .* · desde la página 3/)).toBeVisible()
  // pdf.js no se ha pedido todavía
  const loaded: string[] = []
  page.on('request', (request) => {
    if (/pdf\.worker|\/pdf-/.test(request.url())) loaded.push(request.url())
  })
  expect(loaded).toEqual([])
  await figure.getByRole('button', { name: 'Ver «Libro.pdf» aquí' }).click()
  await expect(figure.getByRole('img', { name: 'Página 3 de 3 de «Libro.pdf»' })).toBeVisible()
  expect(loaded.length).toBeGreaterThan(0)
  await figure.getByRole('button', { name: 'Anterior' }).click()
  await expect(figure.getByRole('img', { name: 'Página 2 de 3 de «Libro.pdf»' })).toBeVisible()
  await figure.getByLabel('Página', { exact: true }).fill('1')
  await figure.getByLabel('Página', { exact: true }).press('Enter')
  await expect(figure.getByRole('img', { name: 'Página 1 de 3 de «Libro.pdf»' })).toBeVisible()
  await expect(figure.getByRole('button', { name: 'Anterior' })).toBeDisabled()
})

test('la portada: se sube desde la página, se encuadra con el teclado y se quita', async ({ page }) => {
  const { pageId } = await openPage(page)
  // «Añadir portada», sobre la cabecera (como en Everlore)
  await page.getByRole('button', { name: 'Añadir portada' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Subir una imagen' }).click()
  await (await chooser).setFiles({ name: 'puerto.png', mimeType: 'image/png', buffer: PNG })
  const banner = page.locator('[data-cover-image] img').first()
  await expect(banner).toHaveAttribute('src', /^\/api\/files\//)
  // Puesta, se cambia desde ella: «Cambiar», al pasar por encima
  await banner.hover()
  await page.getByRole('button', { name: 'Cambiar' }).click()
  await expect(page.getByLabel('Imagen de portada')).toHaveValue(/[0-9a-f-]{36}/)
  const current = async () =>
    (await (await page.request.post('/api/actions/getPage', { data: { pageId } })).json()).cover
  expect(await current()).toMatchObject({ x: 50, y: 50 })

  // El encuadre, con el teclado: se guarda al soltar la tecla
  await page.getByRole('slider', { name: 'Horizontal' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(current).toMatchObject({ x: 55, y: 50 })
  await expect(banner).toHaveCSS('object-position', '55% 50%')

  for (const colorScheme of ['dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
  }

  await page.getByRole('button', { name: 'Quitar la portada' }).click()
  await expect(banner).toHaveCount(0)
  expect(await current()).toBeNull()
})
