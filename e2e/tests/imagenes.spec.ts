import { expect, test } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'
import { freshOwner } from './ayudas.ts'

/** Un PNG de 1×1 de verdad (para que el navegador lo pinte) */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/** Un sistema de Foundry pequeño: un compendio de criaturas (NeDB), su mapa de arte, el retrato y su aviso */
function bestias() {
  const manifest = {
    id: 'bestias',
    title: 'Bestias',
    version: '1.0.0',
    packs: [{ name: 'criaturas', label: 'Criaturas', type: 'Actor', path: 'packs/criaturas.db' }],
    flags: {
      compendiumArtMappings: {
        bestias: { mapping: 'systems/bestias/json/arte.json', credit: '<em>Arte de Alguien</em>' }
      }
    }
  }
  const lobo = { _id: 'lobo000000000001', name: 'Lobo', type: 'npc', img: 'icons/svg/mystery-man.svg', system: {} }
  return zipSync({
    'bestias/system.json': strToU8(JSON.stringify(manifest)),
    'bestias/packs/criaturas.db': strToU8(JSON.stringify(lobo)),
    'bestias/json/arte.json': strToU8(
      JSON.stringify({ 'bestias.criaturas': { lobo000000000001: { actor: 'systems/bestias/tokens/lobo.png' } } })
    ),
    'bestias/tokens/lobo.png': new Uint8Array(PNG),
    'bestias/tokens/LICENSE': strToU8('These tokens may not be used outside of Foundry Virtual Tabletop.')
  })
}

test('traer de Foundry con sus imágenes: el aviso de licencias, subirlas y el retrato en el compendio', async ({
  page
}) => {
  await freshOwner(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sistemas' }).click()
  await page.getByRole('button', { name: 'Sistema nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sistema nuevo' })
  await dialog
    .getByLabel('Elegir el archivo')
    .setInputFiles({ name: 'bestias.zip', mimeType: 'application/zip', buffer: Buffer.from(bestias()) })
  await dialog.getByRole('button', { name: 'Traer de Foundry' }).click()
  // Sus imágenes: cuántas con cada licencia, y subirlas
  await expect(dialog.getByText('Trae 1 imagen:')).toBeVisible()
  await expect(dialog).toContainText('solo para usar en Foundry')
  await page.screenshot({ path: test.info().outputPath('imagenes-licencias.png'), fullPage: false })
  await dialog.getByRole('button', { name: 'Subir 1 imagen' }).click()
  await expect(dialog).toBeHidden()

  // En una campaña con ese sistema, el lobo lleva su retrato y su crédito
  const { systems } = await (await page.request.post('/api/actions/listSystems', { data: {} })).json()
  const systemId = systems.find((s: { name: string }) => s.name === 'Bestias').id as string
  const world = await (await page.request.post('/api/actions/createWorld', { data: { name: 'Valdren' } })).json()
  const campaign = await (
    await page.request.post('/api/actions/createCampaign', {
      data: { worldId: world.id, name: 'La Marca', system: systemId }
    })
  ).json()
  await page.goto(`/mundos/${world.id}/campanas/${campaign.id}/compendio`)
  await page.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('lobo')
  await page.getByRole('list', { name: 'Resultados' }).getByRole('button', { name: /^Lobo/ }).click()
  const article = page.getByRole('article', { name: 'Lobo' })
  const portrait = article.locator('img')
  await expect(portrait).toHaveAttribute('src', /\/api\/system-images\//)
  await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await expect(page.getByRole('complementary', { name: 'Sobre este documento' })).toContainText('Arte de Alguien')
  await page.screenshot({ path: test.info().outputPath('imagenes-compendio.png'), fullPage: false })
})
