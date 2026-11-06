import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, createCampaign, fillNewAccount, newPlayer, settled, skipTours, toWorlds } from './ayudas.ts'

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

test('lo que sabe cada campaña: el máster da a conocer «Aldoria» a La Marca; su jugadora la lee y la de otra campaña no (docs/specs/conocimiento.md)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  // Otra campaña del mundo, con su jugador
  await toWorlds(page)
  await createCampaign(page, 'Los del norte', 'Eana')
  const campaigns = (await (await page.request.post('/api/actions/listCampaigns', { data: { worldId } })).json()).campaigns
  const norte = campaigns.find((c: { name: string }) => c.name === 'Los del norte').id as string
  const norteLink = (await (await page.request.post('/api/actions/getInvitation', { data: { campaignId: norte } })).json()).url

  // Las páginas: Reinos del sur › Aldoria (con un secreto y un campo oculto) › La capital; y Varn, aparte
  const created = await (
    await page.request.post('/api/actions/createPages', {
      data: {
        worldId,
        parentId: null,
        pages: [
          { key: 'sur', title: 'Reinos del sur' },
          {
            key: 'aldoria',
            title: 'Aldoria',
            parent: 'sur',
            markdown: [
              '---',
              'Gobierno: La reina Ysolde',
              '---',
              'El reino más antiguo del sur. Al norte vive [[Varn]].',
              '',
              '> [!secreto]',
              '> El rey ha muerto.'
            ].join('\n')
          },
          { key: 'capital', title: 'La capital', parent: 'aldoria' },
          { key: 'varn', title: 'Varn' }
        ]
      }
    })
  ).json()
  const id = (title: string) => created.pages.find((p: { title: string }) => p.title === title).id as string
  const aldoria = await (await page.request.post('/api/actions/getPage', { data: { pageId: id('Aldoria') } })).json()
  await page.request.post('/api/actions/setPageProperties', {
    data: {
      pageId: aldoria.id,
      properties: [...aldoria.properties, { name: 'Heredero verdadero', type: 'text', value: 'Varn', hidden: true }]
    }
  })

  // En la página, «Quién la conoce»: La Marca la conoce
  await page.goto(`/mundos/${worldId}/wiki/${id('Aldoria')}`)
  await page.getByRole('button', { name: 'Quién la conoce' }).click()
  const who = page.getByRole('dialog', { name: 'Quién la conoce' })
  await expect(who.getByRole('region', { name: 'La Marca' })).toContainText('No la ve')
  await who.getByRole('combobox', { name: 'Lo que sabe «La Marca» de esta página' }).selectOption({ label: 'Lo sabe toda la campaña' })
  await expect(who.getByRole('region', { name: 'La Marca' })).toContainText('La ve toda la campaña')
  await expect(who.getByRole('region', { name: 'La Marca' })).toContainText('Marcada aquí')
  await expect(who.getByRole('region', { name: 'Los del norte' })).toContainText('No la ve')
  await page.screenshot({ path: test.info().outputPath('quien-la-conoce.png'), fullPage: false })
  // El ojo en el árbol, en ella y en su subpágina
  await page.keyboard.press('Escape')
  await expect(page.getByRole('treeitem', { name: /Aldoria/ }).getByRole('img', { name: 'La conoce alguna campaña' })).toBeVisible()

  // La jugadora de La Marca: en su campaña, las páginas del mundo, con Aldoria y su capital
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Eana' }).click()
  await expect(ana.getByRole('heading', { level: 1, name: 'Aldoria' })).toBeVisible()
  const tree = ana.getByRole('navigation', { name: 'Páginas' })
  await expect(tree.getByRole('link', { name: 'Aldoria' })).toBeVisible()
  await expect(tree.getByRole('link', { name: 'Reinos del sur' })).toHaveCount(0)
  await expect(tree.getByRole('link', { name: 'Varn' })).toHaveCount(0)
  const main = ana.getByRole('main')
  await expect(main).toContainText('El reino más antiguo del sur')
  await expect(main).toContainText('La reina Ysolde')
  // Ni el secreto, ni el campo oculto; el enlace a Varn, como texto
  await expect(main).not.toContainText('El rey ha muerto')
  await expect(main).not.toContainText('Heredero verdadero')
  await expect(main.getByRole('link', { name: 'Varn' })).toHaveCount(0)
  await ana.screenshot({ path: test.info().outputPath('jugadora.png'), fullPage: false })
  await tree.getByRole('button', { name: 'Abrir «Aldoria»' }).click()
  await tree.getByRole('link', { name: 'La capital' }).click()
  await expect(ana.getByRole('heading', { level: 1, name: 'La capital' })).toBeVisible()

  // El jugador de Los del norte no sabe nada
  const bruno = await browser.newPage()
  await skipTours(bruno, 'bruno@crisol.test')
  await bruno.goto(norteLink)
  await fillNewAccount(bruno, { name: 'Bruno', email: 'bruno@crisol.test', password: 'una-clave-larga' })
  await bruno.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(bruno.getByRole('heading', { level: 1, name: 'Los del norte', exact: true })).toBeVisible()
  await bruno.goto(`/mundos/${worldId}/campanas/${norte}/paginas`)
  await expect(bruno.getByText('Aún no sabéis nada de este mundo.')).toBeVisible()
  await bruno.goto(`/mundos/${worldId}/campanas/${norte}/paginas/${id('Aldoria')}`)
  await expect(bruno.getByText('Esta página ya no está a tu alcance.')).toBeVisible()

  // El máster se la quita a La Marca: a la jugadora se le va al momento
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Aldoria')}`)
  await expect(ana.getByRole('heading', { level: 1, name: 'Aldoria' })).toBeVisible()
  await page.request.post('/api/actions/setKnowledge', {
    data: { worldId, campaignId, kind: 'page', targetId: id('Aldoria'), known: false }
  })
  await expect(ana.getByText('Esta página ya no está a tu alcance.')).toBeVisible()

  // «Ver como»: el máster, como la campaña, ve lo que ella
  await page.request.post('/api/actions/setKnowledge', {
    data: { worldId, campaignId, kind: 'page', targetId: id('Aldoria'), known: true }
  })
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Aldoria')}?como=campaign`)
  await expect(page.getByRole('status').filter({ hasText: 'Viendo como la campaña' })).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('El rey ha muerto')
  await page.screenshot({ path: test.info().outputPath('viendo-como.png'), fullPage: false })
  // La vista es la de la jugadora: accesible
  await accessible(page)
})
