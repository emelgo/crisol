import { expect, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, import5e } from './ayudas.ts'

/** Una acción de la API con la sesión de `page` */
async function act(page: import('@playwright/test').Page, name: string, data: object) {
  const response = await page.request.post(`/api/actions/${name}`, { data })
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}

test('la campaña abre en su Inicio, con su barra; desde ahí, sus libros y la Mesa en otra pestaña (ADR-0021)', async ({
  page
}) => {
  await freshOwner(page)
  const five = await import5e(page)
  await createWorld(page, 'Eana')
  await createCampaign(page, 'La Marca')
  const { worlds } = await act(page, 'listWorlds', {})
  const { campaigns } = await act(page, 'listCampaigns', { worldId: worlds[0].id })
  await act(page, 'updateCampaign', { campaignId: campaigns[0].id, system: five })
  // Desde Mis mundos, en la misma pestaña
  await page.getByRole('link', { name: 'La Marca', exact: true }).first().click()

  // El Inicio: la campaña, ir a la Mesa, los jugadores y los libros
  await expect(page.getByRole('heading', { level: 1, name: 'La Marca' })).toBeVisible()
  await expect(page.getByText('Eana · 5e')).toBeVisible()
  const bar = page.getByRole('navigation', { name: 'Secciones' })
  // La campaña, con su nombre (su Inicio), y sus secciones; las páginas del mundo, en la Mesa
  for (const section of ['La Marca', 'Mesa', 'Libros', 'Compendio', 'Aventuras'])
    await expect(bar.getByRole('link', { name: section, exact: true })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Páginas', exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('inicio.png') })

  // Libros: apagar uno y que se vaya del compendio de la campaña
  await bar.getByRole('link', { name: 'Libros', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Libros' })).toBeVisible()
  const old = page.getByRole('switch', { name: 'SRD 5.1 en la campaña' })
  await expect(old).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: test.info().outputPath('libros.png') })
  await old.click()
  await expect(old).not.toBeChecked()
  // El último que queda no se puede apagar
  await expect(page.getByRole('switch', { name: 'SRD 5.2.1 en la campaña' })).toBeDisabled()
  const { sources } = await act(page, 'getCampaignCompendium', { campaignId: campaigns[0].id })
  expect(sources.map((s: { key: string }) => s.key)).toEqual(['srd521'])

  // Elegir contenido: quitar los conjuros y guardar
  await page.getByRole('button', { name: 'Elegir contenido' }).click()
  const choose = page.getByRole('dialog', { name: /qué entra/ })
  await expect(choose).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('elegir.png') })
  await choose.getByRole('checkbox', { name: 'Conjuro: todo' }).click()
  await choose.getByRole('button', { name: 'Guardar' }).click()
  await expect(choose).toBeHidden()
  await expect(page.getByRole('button', { name: '339 quitadas' })).toBeVisible()
  const found = await act(page, 'searchCampaignContent', { campaignId: campaigns[0].id, query: 'bola de fuego' })
  expect(found.items).toEqual([])

  // La ficha de un libro, al pulsar su portada
  await page.getByRole('button', { name: 'Abrir SRD 5.2.1' }).click()
  const card = page.getByRole('dialog', { name: 'SRD 5.2.1' })
  await expect(card.getByText('Qué trae')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('ficha.png') })
  await card.getByRole('button', { name: 'Cerrar' }).click()

  // La sección Mesa: los personajes, quién está y «Abrir la Mesa», que la abre en otra pestaña, a pantalla completa
  await bar.getByRole('link', { name: 'Mesa', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mesa' })).toBeVisible()
  await expect(page.getByText('Nadie en la Mesa.')).toBeVisible()
  const [mesa] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: /Abrir la Mesa/ }).click()
  ])
  await expect(mesa.getByRole('complementary', { name: 'Panel de la mesa' })).toBeVisible()
  await expect(mesa.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0)
  // Quien está dentro sale en la sección, en vivo
  const present = page.getByRole('region', { name: 'Mesa' }).getByRole('listitem')
  await expect(present).toHaveCount(1)
  await expect(present).toContainText('Enrique')
  await expect(present).toContainText('Máster')
  await page.screenshot({ path: test.info().outputPath('mesa.png') })
  await mesa.close()
  await expect(page.getByText('Nadie en la Mesa.')).toBeVisible()

  // Las direcciones de antes (?panel=) llevan a la Mesa
  const path = new URL(page.url()).pathname.replace(/\/personajes$/, '')
  await page.goto(`${path}?panel=compendio`)
  await expect(page).toHaveURL(/\/mesa\?panel=compendio$/)
})

test('un libro nuevo en un sistema: vacío, la IA le propone entradas, se revisan y salen en la campaña (ADR-0021)', async ({
  page
}) => {
  await freshOwner(page)
  const five = await import5e(page)
  await createWorld(page, 'Eana')
  await createCampaign(page, 'La Marca')
  const { worlds } = await act(page, 'listWorlds', {})
  const { campaigns } = await act(page, 'listCampaigns', { worldId: worlds[0].id })
  await act(page, 'updateCampaign', { campaignId: campaigns[0].id, system: five })

  // Sistemas → 5e → Libro nuevo, vacío
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sistemas' }).click()
  await page.getByRole('link', { name: '5e', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '5e' })).toBeVisible()
  await page.getByRole('button', { name: 'Libro nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Libro nuevo en 5e' })
  await dialog.getByRole('button', { name: /^Vacío/ }).click()
  await dialog.getByLabel('Nombre').fill('Grimorio')
  await page.screenshot({ path: test.info().outputPath('libro-nuevo.png') })
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(dialog).toBeHidden()
  // Se abre por dentro (su compendio), no en una ventana
  await expect(page.getByRole('link', { name: 'Abrir Grimorio' })).toBeVisible()

  // Lo que haría la IA desde el PDF: proponer entradas, con su página y el texto del que salen
  const spell = (key: string, name: string, page: number, notes: string[] = []) => ({
    type: 'conjuro',
    key,
    data: { name: { es: name }, nivel: 2, escuela: 'evocacion', descripcion: { es: `${name}: una lanza de brasas.` } },
    review: { page, excerpt: `${name}\nEvocación de nivel 2\nArrojas una lanza de brasas…`, notes }
  })
  await act(page, 'proposeContent', {
    systemId: five,
    source: 'grimorio',
    items: [
      spell('lanza_de_ceniza', 'Lanza de ceniza', 88),
      spell('velo_de_eana', 'Velo de Eana', 141, ['Sin tiempo de lanzamiento']),
      spell('bola_de_fuego_eana', 'Bola de fuego', 64)
    ]
  })
  await page.reload()
  await page.getByRole('link', { name: '3 para revisar' }).click()

  // La revisión: lo repetido, sin marcar; el texto del PDF al lado
  await expect(page.getByRole('heading', { level: 1, name: 'Revisar lo que trajo la IA' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Añadir Bola de fuego' })).not.toBeChecked()
  await page.getByRole('button', { name: /^Velo de Eana/ }).click()
  await expect(page.getByRole('tabpanel')).toContainText('Evocación de nivel 2')
  await page.screenshot({ path: test.info().outputPath('revision.png') })
  await page.getByRole('button', { name: 'Añadir 2 entradas a Grimorio' }).click()
  await expect(page.getByText('No queda nada por revisar en este libro.')).toBeVisible()

  // En el compendio de la campaña, en cuanto se enciende el libro en ella (los libros nuevos no entran solos)
  await act(page, 'updateCampaign', {
    campaignId: campaigns[0].id,
    systemChoices: { sources: ['srd51', 'srd521', 'grimorio'] }
  })
  const found = await act(page, 'searchCampaignContent', { campaignId: campaigns[0].id, query: 'lanza de ceniza' })
  expect(found.items.map((h: { key: string }) => h.key)).toEqual(['lanza_de_ceniza'])

  // El compendio de la campaña, por libro: cada fila dice su libro y su página
  await page.goto(`/mundos/${worlds[0].id}/campanas/${campaigns[0].id}/compendio`)
  await page.getByRole('button', { name: 'Por libro' }).click()
  await page
    .getByRole('list', { name: 'Por libro' })
    .getByRole('button', { name: /Grimorio/ })
    .click()
  const rows = page.getByRole('list', { name: 'Resultados' })
  await expect(rows.getByRole('button', { name: /Lanza de ceniza/ })).toContainText('Grimorio, pág. 88')
  await page.screenshot({ path: test.info().outputPath('compendio-por-libro.png') })
})
