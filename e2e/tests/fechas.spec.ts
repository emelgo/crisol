import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, campaignPath, newPlayer } from './ayudas.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.help}`)
}

test('fechas (módulo 8): fechar una página con el selector, con fin y cada año; quitar su mes se impide; la jugadora no ve un campo oculto', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const [, , worldId = '', , campaignId = ''] = campaignPath(page).split('/')
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const calendar = await api('createCalendar', {
    worldId,
    name: 'Calendario de Varn',
    from: {
      definition: {
        yearSuffix: 'RV',
        weekdays: ['Lunden', 'Marden', 'Miden', 'Joden', 'Viden', 'Saden', 'Doden'],
        months: [
          { name: 'Siega', days: 30 },
          { name: 'Fiesta de la Siega', days: 3, festival: true, outsideWeek: true },
          { name: 'Vendimia', days: 30 }
        ],
        eras: [{ name: 'Era de la Corona', start: '0' }]
      }
    }
  })
  // Puerto Ceniza, que conoce La Marca, con un campo oculto de fecha
  const port = await api('createPage', { worldId, title: 'Puerto Ceniza' })
  await api('editPage', {
    pageId: port.id,
    properties: [{ name: 'Coronación', type: 'date', value: '415-Vendimia-3' }]
  })
  const read = await api('getPage', { pageId: port.id })
  await api('setPageProperties', {
    pageId: port.id,
    properties: read.properties.map((p: object) => ({ ...p, hidden: true }))
  })
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: port.id, known: true })

  // El máster: «Propiedad» desde el panel, de tipo Fecha; el año a mano y el día en la rejilla
  await page.goto(`/mundos/${worldId}/wiki/${port.id}`)
  const panel = page.getByRole('complementary', { name: 'Panel de la página' })
  await panel.getByRole('button', { name: 'Añadir bloque' }).click()
  await panel.getByRole('button', { name: 'Propiedad', exact: true }).click()
  await page.keyboard.type('Fundación')
  await panel.getByLabel('Tipo de la propiedad 2').selectOption({ label: 'Fecha' })
  await panel.getByRole('button', { name: /^Valor de la propiedad 2:/ }).click()
  const picker = page.getByRole('dialog', { name: 'Fundación' })
  await expect(picker.getByRole('columnheader', { name: 'Lunden' })).toBeVisible()
  await picker.getByLabel('Año que se ve').fill('412')
  await picker.getByRole('button', { name: /12 de Siega de 412 RV$/ }).click()
  await expect(picker.getByText(/, 12 de Siega de 412 RV$/)).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Valor de la propiedad 2: 12 de Siega de 412 RV' })).toBeVisible()
  // Con fin y cada año
  await picker.getByRole('button', { name: 'Añadir fin' }).click()
  await picker.getByRole('button', { name: /20 de Siega de 412 RV$/ }).click()
  await picker.getByRole('checkbox', { name: 'Cada año' }).check()
  await expect(picker.getByText('12–20 de Siega de 412 RV')).toBeVisible()
  expect(await axe(page)).toEqual([])
  await page.screenshot({ path: test.info().outputPath('selector.png') })
  // Se guarda solo, también tras recargar
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
  await page.reload()
  await expect(panel.getByRole('button', { name: /^Valor de la propiedad 2: 12–20 de Siega de 412 RV/ })).toBeVisible()
  const saved = await api('getPage', { pageId: port.id })
  expect(saved.properties.find((p: { name: string }) => p.name === 'Fundación')).toMatchObject({
    type: 'date',
    value: { calendarId: calendar.id, start: { year: 412, day: 12 }, end: { year: 412, day: 20 }, yearly: true },
    text: '12–20 de Siega de 412 RV'
  })

  // Quitar Siega, que tiene fechas, se impide al guardar
  await page.goto(`/mundos/${worldId}/calendarios/${calendar.id}/editar?fase=meses`)
  await page.getByRole('region', { name: 'Meses' }).getByRole('button', { name: 'Quitar Siega' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('#contenido').getByText('Hay fechas en un mes que quitas: cámbialas antes')).toBeVisible()
  const kept = await api('getCalendar', { calendarId: calendar.id })
  expect(kept.months.map((m: { name: string }) => m.name)).toContain('Siega')

  // La jugadora lee la fecha, y no el campo oculto
  const ana = await newPlayer(browser, link, 'Ana')
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${port.id}`)
  await expect(ana.getByRole('heading', { level: 1, name: 'Puerto Ceniza' })).toBeVisible()
  const main = ana.getByRole('main')
  await expect(main).toContainText('12–20 de Siega de 412 RV')
  await expect(main).not.toContainText('Coronación')
  await expect(main).not.toContainText('Vendimia')
  await ana.close()
})
