import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer } from './ayudas.ts'

test('la página de los jugadores: el máster deja editar el diario a la campaña; la jugadora escribe y el máster lo ve en vivo (docs/specs/pagina-de-jugadores.md)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
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
      { key: 'd', title: 'Diario de la compañía', markdown: 'Lo que llevamos.' },
      { key: 'a', title: 'Aldoria', markdown: ['Un reino.', '', '> [!secreto]', '> Varn vendió el paso.'].join('\n') }
    ]
  })
  const id = (title: string) => created.pages.find((p: { title: string }) => p.title === title).id as string
  const ana = await newPlayer(browser, link, 'Ana')

  // Una página con secretos no se deja editar
  await page.goto(`/mundos/${worldId}/wiki/${id('Aldoria')}`)
  await page.getByRole('button', { name: 'Quién la conoce' }).click()
  await page.getByRole('combobox', { name: 'Quién de «La Marca» puede editarla' }).selectOption('all')
  await expect(page.getByRole('combobox', { name: 'Quién de «La Marca» puede editarla' })).toHaveValue('none')

  // El diario, sí: a toda la campaña
  await page.goto(`/mundos/${worldId}/wiki/${id('Diario de la compañía')}`)
  await page.getByRole('button', { name: 'Quién la conoce' }).click()
  const editors = page.getByRole('combobox', { name: 'Quién de «La Marca» puede editarla' })
  await editors.selectOption('all')
  // Quien la edita, la ve
  await expect(page.getByRole('region', { name: 'La Marca' })).toContainText('La ve toda la campaña')
  await expect(editors).toHaveValue('all')
  await page.screenshot({ path: test.info().outputPath('dejar-editar.png'), fullPage: false })
  await page.keyboard.press('Escape')

  // La jugadora la abre y escribe; al máster le llega en vivo
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Diario de la compañía')}`)
  const body = ana.getByRole('textbox', { name: 'Texto de la página' })
  await expect(body).toContainText('Lo que llevamos.')
  await body.click()
  await ana.keyboard.press('End')
  await ana.keyboard.press('Enter')
  await ana.keyboard.type('Día 1: llegamos al faro.')
  await expect(body).toContainText('Día 1: llegamos al faro.')
  await expect(page.getByRole('textbox', { name: 'Texto de la página' })).toContainText('Día 1: llegamos al faro.')
  await ana.screenshot({ path: test.info().outputPath('diario-jugadora.png'), fullPage: false })

  // En otra página que solo lee, no hay editor
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id('Aldoria'), known: true })
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id('Aldoria')}`)
  await expect(ana.getByRole('main')).toContainText('Un reino.')
  await expect(ana.getByRole('textbox', { name: 'Texto de la página' })).toHaveCount(0)
})
