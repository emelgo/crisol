import { expect, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer } from './ayudas.ts'

test('revelar en partida: el máster revela un secreto a Lía; a su jugadora le llega el aviso, lo lee como nuevo, y el máster lo oculta otra vez (docs/specs/revelar.md)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const systemId = await import5e(page)
  await page.request.post('/api/actions/updateCampaign', { data: { campaignId, system: systemId } })

  // La jugadora entra y hace a Lía
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.request.post('/api/actions/createCharacter', { data: { campaignId, name: 'Lía' } })

  // Aldoria, conocida por la campaña, con un secreto en «El pacto de Varn»
  const created = await (
    await page.request.post('/api/actions/createPages', {
      data: {
        worldId,
        parentId: null,
        pages: [
          {
            key: 'a',
            title: 'Aldoria',
            markdown: [
              'Un reino antiguo.',
              '',
              '## El pacto de Varn',
              '',
              '> [!secreto]',
              '> Varn vendió el paso.'
            ].join('\n')
          }
        ]
      }
    })
  ).json()
  const aldoria = created.pages[0].id as string
  await page.request.post('/api/actions/setKnowledge', {
    data: { worldId, campaignId, kind: 'page', targetId: aldoria, known: true }
  })

  // La jugadora la lee, sin el secreto
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${aldoria}`)
  await expect(ana.getByRole('heading', { level: 1, name: 'Aldoria' })).toBeVisible()
  await expect(ana.getByRole('main')).not.toContainText('Varn vendió el paso')

  // El máster lo revela a Lía desde la cabecera del secreto
  await page.goto(`/mundos/${worldId}/wiki/${aldoria}`)
  const secret = page.getByRole('region', { name: 'Secreto' })
  await secret.getByRole('button', { name: 'Revelar' }).click()
  const menu = page.getByRole('dialog', { name: 'Revelar el secreto' })
  await menu.getByRole('group', { name: 'A quién' }).getByRole('button', { name: 'Lía' }).click()
  await page.screenshot({ path: test.info().outputPath('revelar.png'), fullPage: false })
  await menu.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect(secret).toContainText('Lo saben: Lía')

  // A ella le llega el aviso; «Leerlo» lo enseña, marcado como nuevo
  const notice = ana.getByRole('region', { name: 'Lo nuevo' })
  await expect(notice).toContainText('Nuevo: El pacto de Varn')
  await ana.screenshot({ path: test.info().outputPath('aviso.png'), fullPage: false })
  await notice.getByRole('link', { name: 'Leerlo' }).click()
  const main = ana.getByRole('main')
  await expect(main).toContainText('Varn vendió el paso')
  await expect(main.getByRole('region', { name: 'Secreto' })).toContainText('Nuevo')

  // «Lo que sabe el grupo»: lo enseña y lo oculta otra vez; a ella se le va
  // En la Mesa, su pestaña Páginas
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}?panel=paginas`)
  await page
    .getByRole('complementary', { name: 'Panel de la mesa' })
    .getByRole('button', { name: 'Lo que sabe el grupo' })
    .click()
  const group = page.getByRole('dialog', { name: 'Lo que sabe el grupo' })
  await expect(group).toContainText('El pacto de Varn')
  await expect(group).toContainText('Lía')
  await page.screenshot({ path: test.info().outputPath('lo-que-sabe.png'), fullPage: false })
  await group
    .getByRole('listitem')
    .filter({ hasText: 'El pacto de Varn' })
    .getByRole('button', { name: 'Ocultar otra vez' })
    .click()
  await expect(main).not.toContainText('Varn vendió el paso')
})
