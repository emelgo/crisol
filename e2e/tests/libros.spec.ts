import { expect, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, import5e, openCampaign } from './ayudas.ts'

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
  await openCampaign(page, 'La Marca')

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
  await expect(old).toHaveAttribute('aria-checked', 'false')
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
