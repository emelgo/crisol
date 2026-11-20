import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer, settled } from './ayudas.ts'

const COMBATE = `Cada asalto dura seis segundos.

## La iniciativa

Tira 1d20 y suma tu Destreza.

> [!secreto]
> Los goblins huyen al caer la mitad.

## Las acciones

Atacar, lanzar un conjuro, correr o esconderse.

### Atacar

Tira 1d20 y suma tu bonificador.`

test('los capítulos de un libro: el dueño del sistema los escribe y los ordena; la jugadora los lee en su campaña, sin los secretos, también en el móvil (ADR-0025)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const five = await import5e(page)
  await api('updateCampaign', { campaignId, system: five })

  // El libro por dentro, sin capítulos: sus dos pestañas (quien puede escribirlos ve «Capítulos») y abre en Entradas
  await page.goto(`/sistemas/${five}/libros/srd51`)
  const tabs = page.getByRole('navigation', { name: 'Vistas del libro' })
  await expect(tabs.getByRole('link', { name: 'Entradas' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('link', { name: 'Capítulos' }).click()
  await expect(page.getByText('Este libro aún no tiene capítulos.')).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-sin-capitulos.png') })

  // Crear uno y escribir en él: se guarda solo
  await page.getByRole('button', { name: 'Capítulo nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Capítulo nuevo' })
  await dialog.getByLabel('Título del capítulo').fill('El combate')
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByLabel('Título del capítulo')).toHaveValue('El combate')
  const text = page.getByRole('textbox', { name: 'Texto de «El combate»' })
  await text.click()
  await page.keyboard.type('Cada asalto dura seis segundos.')
  await expect(page.getByText('Guardado')).toBeVisible()
  const { chapters } = await api('listBookChapters', { systemId: five, source: 'srd51' })
  expect(chapters.map((c: { title: string }) => c.title)).toEqual(['El combate'])
  const first = chapters[0]
  expect((await api('getChapter', { chapterId: first.id })).markdown).toContain('Cada asalto dura seis segundos.')

  // Con sus secciones, su secreto y otro capítulo (como los pasaría la IA)
  const { version } = await api('getChapter', { chapterId: first.id })
  await api('saveChapter', { systemId: five, source: 'srd51', chapterId: first.id, version, markdown: COMBATE })
  await api('saveChapter', {
    systemId: five,
    source: 'srd51',
    title: 'La magia',
    markdown: 'Los conjuros gastan espacios.'
  })
  await page.goto(`/sistemas/${five}/libros/srd51`)
  // Con capítulos, el libro abre en ellos, en el primero
  await expect(tabs.getByRole('link', { name: 'Capítulos' })).toHaveAttribute('aria-current', 'page')
  const index = page.getByRole('navigation', { name: 'Capítulos' })
  await expect(index.getByRole('link', { name: 'El combate' })).toHaveAttribute('aria-current', 'page')
  await expect(index.getByRole('link', { name: 'La iniciativa' })).toBeVisible()
  await expect(index.getByRole('link', { name: 'Atacar' })).toBeVisible()
  // El dueño ve el secreto
  await expect(page.getByText('Los goblins huyen al caer la mitad.')).toBeVisible()
  // Abrirlo no lo cambia (ni versión nueva ni nada en el historial)
  await page.waitForTimeout(1200)
  expect((await api('getChapter', { chapterId: first.id })).version).toBe(version + 1)
  await expect(page.getByText('Guardando…')).toHaveCount(0)
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('2-lector-dueno.png') })

  // El índice sigue la lectura: ir a una sección la marca
  await index.getByRole('link', { name: 'Atacar' }).click()
  await expect(index.getByRole('link', { name: 'Atacar' })).toHaveAttribute('aria-current', 'location')

  // Siguiente, al final
  await page
    .getByRole('navigation', { name: 'Anterior y siguiente' })
    .getByRole('link', { name: /Siguiente/ })
    .click()
  await expect(page.getByRole('heading', { level: 2, name: 'La magia' })).toBeVisible()
  await expect(index.getByRole('link', { name: 'La magia' })).toHaveAttribute('aria-current', 'page')

  // Subirlo, desde su menú
  await page.getByRole('button', { name: 'Más acciones del capítulo' }).click()
  await page.getByRole('button', { name: 'Subir' }).click()
  await expect(index.getByRole('listitem').first()).toContainText('La magia')
  await page.getByRole('button', { name: 'Más acciones del capítulo' }).click()
  await page.getByRole('button', { name: 'Bajar' }).click()
  await expect(index.getByRole('listitem').first()).toContainText('El combate')

  // La jugadora: desde el compendio de su campaña, el libro y «Leer»
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/compendio`)
  await ana.getByRole('button', { name: 'Por libro' }).click()
  await ana.getByRole('button', { name: /SRD 5\.1/ }).click()
  await ana.getByRole('link', { name: /Leer · 2 capítulos/ }).click()
  await expect(ana.getByRole('heading', { level: 2, name: 'El combate' })).toBeVisible()
  await expect(ana.getByText('Cada asalto dura seis segundos.')).toBeVisible()
  // Sin el secreto, y sin poder escribir
  await expect(ana.getByText('Los goblins huyen')).toHaveCount(0)
  await expect(ana.getByLabel('Título del capítulo')).toHaveCount(0)
  await expect(ana.getByRole('button', { name: 'Capítulo nuevo' })).toHaveCount(0)
  await settled(ana)
  await ana.screenshot({ path: test.info().outputPath('3-lector-jugadora.png') })

  // En el móvil: «Ir a…» en lugar del índice
  await ana.setViewportSize({ width: 390, height: 844 })
  await expect(ana.getByRole('navigation', { name: 'Capítulos' })).toBeHidden()
  const goTo = ana.getByLabel('Ir a…')
  await expect(goTo).toBeVisible()
  await ana.screenshot({ path: test.info().outputPath('4-movil.png') })
  await goTo.selectOption({ label: 'La magia' })
  await expect(ana.getByRole('heading', { level: 2, name: 'La magia' })).toBeVisible()
})

test('el aspecto de libro (ADR-0033): recuadros con título, citas, imágenes con pie y crédito, y enlaces entre capítulos', async ({
  page,
  browser
}) => {
  test.slow()
  const invitation = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const five = await import5e(page)
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const svg = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'))
  await api('putSystemImages', {
    systemId: five,
    images: [{ path: 'book/cripta.svg', data: svg.toString('base64'), license: 'unknown', credit: 'Luca Bancone' }]
  })
  const second = await api('saveChapter', {
    systemId: five,
    source: 'srd51',
    title: 'Capítulo 2: Más reglas',
    markdown: [
      '## Encuentros {p105}',
      '',
      '![[book/cripta.svg|Una cripta|500]]',
      '*Una cripta en ruinas*',
      '',
      'Algo, como en [[Capítulo 1: Lo básico|el principio]], con `dice: 2d6+3`.',
      '',
      'Dos.',
      '',
      'Tres.',
      '',
      'Lo que ya no cabe.'
    ].join('\n')
  })
  const first = await api('saveChapter', {
    systemId: five,
    source: 'srd51',
    title: 'Capítulo 1: Lo básico',
    markdown: [
      '> [!cita]',
      '> Esta historia comenzó hace 50 años, y tú formas parte de ella.',
      '>',
      '> — Jeremy Crawford',
      '',
      '![[book/cripta.svg|Una cripta|500]]',
      '*No hace falta una mesa mágica, pero ¿a que sería divertido?*',
      '',
      'Dungeons & Dragons es un juego de historias compartidas: lee [[Capítulo 2]] y [[Capítulo 2#Encuentros|sus encuentros]].',
      '',
      '## ¿Qué hace el máster? {p5}',
      '',
      '> [!nota|p6] Aprender viendo jugar',
      '> Una buena forma de aprender lo básico es ver cómo juega otra gente.',
      '',
      '> [!leer]',
      '> El viento silba entre las lápidas.'
    ].join('\n')
  })
  await api('updateCampaign', { campaignId, system: five })
  await page.goto(`/sistemas/${five}/libros/srd51?vista=capitulos&capitulo=${first.id}`)
  // Se abre para leer, también para su dueño
  await expect(page.getByText('Aprender viendo jugar')).toBeVisible()
  await expect(page.getByText('Luca Bancone')).toBeVisible()
  await expect(page.getByText('No hace falta una mesa mágica, pero ¿a que sería divertido?')).toBeVisible()
  const link = page.getByRole('link', { name: 'Capítulo 2', exact: true })
  await expect(link).toHaveAttribute('href', new RegExp(`capitulo=${second.id}`))
  await settled(page)
  if (process.env.CRISOL_CAPTURAS)
    await page.screenshot({ path: `${process.env.CRISOL_CAPTURAS}/libro.png`, fullPage: true })

  // Su vista previa, como en el libro: la imagen con su pie, los enlaces y las tiradas, sin la sintaxis; y corta
  await page.getByRole('link', { name: 'sus encuentros' }).hover()
  const preview = page.getByRole('tooltip')
  await expect(preview.getByRole('heading', { name: 'Encuentros' })).toHaveAttribute('data-page', '105')
  await expect(preview.getByRole('button', { name: 'Ver «Una cripta» en grande' })).toBeVisible()
  await expect(preview.getByText('Una cripta en ruinas')).toBeVisible()
  await expect(preview.getByRole('link', { name: 'el principio' })).toBeVisible()
  await expect(preview.getByRole('button', { name: /2d6\+3/ })).toBeVisible()
  await expect(preview).not.toContainText('![[')
  await expect(preview).not.toContainText('{p105}')
  await expect(preview).not.toContainText('Lo que ya no cabe')
  await settled(page)
  if (process.env.CRISOL_CAPTURAS)
    await page.screenshot({ path: `${process.env.CRISOL_CAPTURAS}/libro-vista-previa.png` })

  // A otro capítulo, a su sección
  await page.getByRole('link', { name: 'sus encuentros' }).click()
  await expect(page).toHaveURL(new RegExp(`capitulo=${second.id}`))
  await expect(page.getByRole('heading', { level: 2, name: 'Capítulo 2: Más reglas' })).toBeVisible()

  // Como lo lee una jugadora: sin rótulos en los recuadros sin título, el pie y el crédito bajo la imagen
  const ana = await newPlayer(browser, invitation, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/libros/srd51?capitulo=${first.id}`)
  await expect(ana.getByText('Aprender viendo jugar')).toBeVisible()
  // De verdad a la vista (no solo para los lectores de pantalla)
  expect((await ana.getByText('Aprender viendo jugar').boundingBox())?.width ?? 0).toBeGreaterThan(50)
  // Su página en el libro, a la derecha
  await expect(ana.getByText('p6', { exact: true })).toBeVisible()
  await expect(ana.getByText('No hace falta una mesa mágica, pero ¿a que sería divertido?')).toBeVisible()
  await expect(ana.getByText('— Jeremy Crawford')).toHaveCSS('text-align', 'right')
  await settled(ana)
  if (process.env.CRISOL_CAPTURAS)
    await ana.screenshot({ path: `${process.env.CRISOL_CAPTURAS}/libro-jugadora.png`, fullPage: true })

  // El compendio, con el nombre como en un bloque de estadísticas
  await page.goto(`/sistemas/${five}/compendio?ver=lobo_2024`)
  await expect(page.getByRole('heading', { level: 2, name: 'Lobo' })).toBeVisible()
  await settled(page)
  if (process.env.CRISOL_CAPTURAS) await page.screenshot({ path: `${process.env.CRISOL_CAPTURAS}/compendio.png` })
})
