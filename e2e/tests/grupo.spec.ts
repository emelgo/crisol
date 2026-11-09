import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, campaignPath, import5e, newPlayer, settled } from './ayudas.ts'

const POCION = 'pocion_de_curacion_2024'

/** Que axe no encuentre fallos críticos ni graves, en claro y en oscuro */
async function accessible(page: Page) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await settled(page)
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help} ${v.nodes[0]?.target}`)).toEqual([])
  }
}

test('el grupo: la jugadora coge una poción para su personaje y la usa; el máster reparte 100 po entre tres', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignUrl = new URL(page.url()).pathname
  const campaignId = campaignUrl.split('/campanas/')[1] ?? ''
  const systemId = await import5e(page)
  expect(
    (await page.request.post('/api/actions/updateCampaign', { data: { campaignId, system: systemId } })).status()
  ).toBe(200)
  // El botín, en el grupo: tres pociones y 100 po
  const put = async (data: object) => {
    const { party } = await (await page.request.post('/api/actions/getParty', { data: { campaignId } })).json()
    const response = await page.request.post('/api/actions/updateParty', {
      data: { campaignId, version: party.version, ...data }
    })
    expect(response.status()).toBe(200)
  }
  await put({ add: { key: POCION, quantity: 3 } })
  await put({ coins: { po: 100 } })

  // La jugadora entra y hace su personaje; el máster lleva otros dos
  const player = await newPlayer(browser, link, 'Ana')
  const thora = (
    await (await player.request.post('/api/actions/createCharacter', { data: { campaignId, name: 'Thora' } })).json()
  ).character.id as string
  for (const name of ['Bram', 'Lys'])
    await page.request.post('/api/actions/createCharacter', { data: { campaignId, name } })

  // En «Grupo», la poción: una para Thora
  await player.goto(`${campaignPath(player)}/grupo`)
  await expect(player.getByRole('heading', { level: 1, name: 'Grupo' })).toBeVisible()
  await expect(player.getByText('Poción de curación', { exact: true }).first()).toBeVisible()
  await expect(player.getByText('×3')).toBeVisible()
  await player.getByRole('button', { name: 'Mover «Poción de curación»' }).click()
  const menu = player.getByRole('group', { name: 'Mover «Poción de curación»' })
  await menu.getByRole('spinbutton', { name: 'Cuántas' }).fill('1')
  await player.screenshot({ path: test.info().outputPath('grupo-mover.png'), fullPage: false })
  await menu.getByRole('button', { name: /A Thora/ }).click()
  await expect(player.getByText('×2')).toBeVisible()
  await expect(player.getByRole('complementary', { name: 'Movimientos' })).toContainText(
    'Ana pasó 1 × «Poción de curación» del grupo a Thora'
  )

  // En su hoja la lleva; al usarla, se va
  await player.goto(`${campaignUrl}/personajes/${thora}?vista=ficha`)
  await player.getByRole('tab', { name: 'Inventario' }).click()
  await expect(player.getByText('Poción de curación', { exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Del grupo' }).click()
  await expect(player.getByText('×2')).toBeVisible()
  await player.screenshot({ path: test.info().outputPath('grupo-hoja.png'), fullPage: false })
  await player.getByRole('button', { name: 'Mío' }).click()
  // La papelera pide un segundo toque
  await player.getByRole('button', { name: 'Quitar Poción de curación' }).click()
  await player.getByRole('button', { name: '¿Quitar Poción de curación? Pulsa otra vez' }).click()
  await expect
    .poll(async () => {
      const { character } = await (
        await player.request.post('/api/actions/getCharacter', { data: { characterId: thora } })
      ).json()
      return character.play.items ?? []
    })
    .toEqual([])

  // El máster reparte las 100 po entre los tres: 33 cada uno, y 1 se queda en el grupo
  await page.goto(`${campaignUrl}/grupo`)
  await page.getByRole('button', { name: 'Gestionar' }).click()
  const coins = page.getByRole('dialog', { name: 'Las monedas' })
  await expect(coins.getByRole('checkbox')).toHaveCount(3)
  await page.screenshot({ path: test.info().outputPath('grupo-monedas.png'), fullPage: false })
  await coins.getByRole('button', { name: 'Repartir' }).click()
  await expect(coins).toBeHidden()
  const party = await (await page.request.post('/api/actions/getParty', { data: { campaignId } })).json()
  expect(party.party.coins.po).toBe(1)
  expect(party.characters.map((c: { coins: { po?: number } }) => c.coins.po)).toEqual([33, 33, 33])
  await accessible(page)
})
