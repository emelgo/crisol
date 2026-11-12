import { expect, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer, settled } from './ayudas.ts'

test('las acciones de una entrada se tiran: el goblin con lo suyo (el máster) y un conjuro con el personaje de la jugadora, al registro (revisión, tanda 7)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object, on = page) => {
    const response = await on.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const five = await import5e(page)
  await api('updateCampaign', {
    campaignId,
    system: five,
    systemChoices: { sources: ['srd51', 'srd521'], duplicates: 'both' }
  })

  // El máster: el goblin, en el compendio de la campaña; «Ataque» de la cimitarra
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/compendio?ver=guerrero_goblin_2014`)
  const play = page.getByRole('region', { name: 'En juego' })
  await play.getByRole('button', { name: 'Tirar el ataque de Cimitarra' }).click()
  await expect
    .poll(async () => (await api('listRolls', { campaignId })).rolls.map((r: { label: string }) => r.label))
    .toContain('Goblin · Cimitarra')
  // Su resultado, como el de cualquier tirada: en el aviso sobre el d20
  await expect(page.getByRole('region', { name: 'Últimas tiradas' })).toContainText('Goblin · Cimitarra', {
    timeout: 10_000
  })
  await settled(page)
  await page.screenshot({ path: test.info().outputPath('1-goblin.png') })

  // La jugadora, con su personaje: el daño de Flecha ácida
  const ana = await newPlayer(browser, link, 'Ana')
  await api('createCharacter', { campaignId, name: 'Thora' }, ana)
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/compendio?ver=flecha_acida_2014`)
  const spell = ana.getByRole('region', { name: 'En juego' })
  await spell.getByRole('button', { name: 'Tirar el daño de Flecha ácida' }).click()
  await expect
    .poll(async () => (await api('listRolls', { campaignId })).rolls.map((r: { label: string }) => r.label))
    .toContain('Thora · Flecha ácida · daño')
  await expect(ana.getByRole('region', { name: 'Últimas tiradas' })).toContainText('Thora · Flecha ácida · daño', {
    timeout: 10_000
  })
  await settled(ana)
  await ana.screenshot({ path: test.info().outputPath('2-conjuro.png') })
})
