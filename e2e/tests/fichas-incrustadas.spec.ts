import { expect, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer, settled } from './ayudas.ts'

test('la ficha de una entrada incrustada (![[@Nombre]]): el máster la pone con «/» y la jugadora solo la ve si su campaña ve la entrada (revisión, tanda 7)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object, on = page) => {
    const response = await on.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const five = await import5e(page)
  await api('updateCampaign', {
    campaignId,
    system: five,
    systemChoices: { sources: ['srd51', 'srd521'], duplicates: 'both' }
  })
  // Una entrada del compendio del mundo, aún del máster
  await api('putWorldContent', {
    worldId,
    systemId: five,
    items: [{ type: 'arma', key: 'hoja_del_valle', data: { name: { es: 'Hoja del Valle' } } }]
  })

  // El máster, en una página: «/» → «Ficha del compendio», la busca y la elige
  const { pages } = await api('createPages', {
    worldId,
    parentId: null,
    pages: [{ key: 'a', title: 'La armería', markdown: 'En la vitrina:' }]
  })
  const pageId = pages[0].id as string
  await page.goto(`/mundos/${worldId}/wiki/${pageId}`)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/ficha')
  await page
    .getByRole('listbox', { name: 'Bloques' })
    .getByRole('option', { name: /^Ficha del compendio/ })
    .click()
  await page.keyboard.type('Hoja del')
  await page
    .getByRole('listbox', { name: 'Páginas' })
    .getByRole('option', { name: /Hoja del Valle/ })
    .click()
  const card = body.getByRole('article', { name: 'Hoja del Valle' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('link', { name: 'Abrir', exact: true })).toBeVisible()
  await expect
    .poll(async () => (await api('readPage', { pageId })).markdown as string, { timeout: 10_000 })
    .toContain('![[@Hoja del Valle]]')
  // Una criatura, con lo que hace en juego al desplegarla
  await api('editPage', { pageId, body: { mode: 'append', markdown: 'Y en la trastienda:\n\n![[@Goblin]]' } })
  const goblin = body.getByRole('article', { name: /Goblin/ })
  await expect(goblin).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-ficha-master.png') })
  await goblin.getByRole('button', { name: /Goblin/ }).click()
  await expect(goblin.getByRole('region', { name: 'En juego' })).toBeVisible()
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1b-ficha-desplegada.png') })

  // La jugadora conoce la página, pero no la entrada: la ficha no le sale
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: pageId, known: true })
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${pageId}`)
  await expect(ana.getByRole('heading', { level: 1, name: 'La armería' })).toBeVisible()
  await expect(ana.getByText('En la vitrina:')).toBeVisible()
  await ana.waitForTimeout(1500)
  await expect(ana.getByRole('article', { name: 'Hoja del Valle' })).toHaveCount(0)
  // Revelada, sí
  await api('reveal', { worldId, campaignId, kind: 'content', targetId: 'hoja_del_valle' })
  await ana.reload()
  await expect(ana.getByRole('article', { name: 'Hoja del Valle' })).toBeVisible()
  await settled(ana)
  await ana.screenshot({ path: test.info().outputPath('2-ficha-jugadora.png') })
})
