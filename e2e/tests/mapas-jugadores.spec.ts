import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

const MAP = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#cfe3ef"/>
  <circle cx="700" cy="500" r="40" fill="#8a5a3a"/>
</svg>`
)

test('los mapas para los jugadores: la jugadora ve lo que no está oculto; un pin a lo que no conoce, sin enlace; el máster revela uno y le aparece (docs/specs/mapas-jugadores.md)', async ({
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
  const created = await api('createPages', {
    worldId,
    parentId: null,
    pages: [
      { key: 'c', title: 'Costa Gris' },
      { key: 'f', title: 'El Faro' },
      { key: 't', title: 'La Torre' }
    ]
  })
  const id = (title: string) => created.pages.find((p: { title: string }) => p.title === title).id as string
  const uploaded = await page.request.post(`/api/files?worldId=${worldId}&name=Costa.svg`, {
    data: MAP,
    headers: { 'content-type': 'application/octet-stream' }
  })
  const file = await uploaded.json()
  const tab = await api('createPageTab', { pageId: id('Costa Gris'), kind: 'map', name: 'Mapa' })
  const map = await api('getMap', { tabId: tab.id })
  await api('updateMap', { mapId: map.id, image: { fileId: file.id, width: 1600, height: 1000 } })
  await api('createMapPin', { mapId: map.id, x: 0.3, y: 0.3, pageId: id('El Faro') })
  await api('createMapPin', { mapId: map.id, x: 0.5, y: 0.5, pageId: id('La Torre'), label: 'Torre' })
  const cave = await api('createMapPin', { mapId: map.id, x: 0.7, y: 0.6, label: 'Cueva', hidden: true })
  for (const title of ['Costa Gris', 'El Faro'])
    await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id(title), known: true })

  // La jugadora: el mapa con el faro (con enlace) y la torre (sin él); la cueva no
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Costa Gris')}`)
  await ana.getByRole('group', { name: 'Pestañas de la página' }).getByRole('button', { name: 'Mapa' }).click()
  const pins = ana.getByRole('list', { name: 'Pines' })
  await expect(pins.getByRole('button', { name: 'El Faro' })).toBeVisible()
  await expect(pins.getByRole('button', { name: 'Torre' })).toBeVisible()
  await expect(pins.getByRole('button', { name: 'Cueva' })).toHaveCount(0)
  await pins.getByRole('button', { name: 'Torre' }).click()
  await expect(ana.getByRole('region', { name: 'Pin' })).toContainText('Torre')
  await expect(ana.getByRole('link', { name: 'Abrir' })).toHaveCount(0)
  await ana.getByRole('region', { name: 'Pin' }).getByRole('button').first().click()
  await pins.getByRole('button', { name: 'El Faro' }).click()
  await expect(ana.getByRole('region', { name: 'Pin' }).getByRole('link', { name: 'Abrir' })).toBeVisible()
  await ana.screenshot({ path: test.info().outputPath('mapa-jugadora.png'), fullPage: false })

  // El máster revela la cueva desde su panel; a ella le aparece
  await page.goto(`/mundos/${worldId}/wiki/${id('Costa Gris')}?pestana=${tab.id}`)
  await page.getByRole('list', { name: 'Pines' }).getByRole('button', { name: 'Cueva' }).click()
  await page.getByRole('button', { name: 'Revelar…' }).click()
  await page
    .getByRole('dialog', { name: 'Revelar el pin' })
    .getByRole('button', { name: 'Revelar', exact: true })
    .click()
  await expect(pins.getByRole('button', { name: 'Cueva' })).toBeVisible()
  expect(cave.id).toBeTruthy()
})
