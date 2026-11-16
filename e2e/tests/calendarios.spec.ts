import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { CON_DESENFOQUE } from '../sin-desenfoque.ts'
import { campaignLink, freshOwner, newPlayer, sections } from './ayudas.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function axe(page: Page) {
  // Lo que esté a medio animar se mide ya quieto (lo que no para nunca, el fondo o lo que va con el desplazamiento, no)
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY ||
          !(animation.timeline instanceof DocumentTimeline) ||
          ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest('[data-fondo]')
      )
  )
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.help}`)
}

test('calendarios (módulo 8): crear uno de 16 meses con dos lunas, editarlo, hacer principal a otro; la jugadora no ve la era oculta', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''

  // Desde la barra del mundo: Páginas · Calendarios · Archivos
  await page.goto(`/mundos/${worldId}`)
  const bar = sections(page)
  await expect(bar.getByRole('button', { name: 'Páginas' })).toBeVisible()
  await bar.getByRole('link', { name: 'Calendarios' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendarios' })).toBeVisible()
  expect(await axe(page)).toEqual([])

  // Vacía: «Calendario nuevo» abre su cuadro; en blanco, y se abre su editor
  await page.getByRole('button', { name: 'Calendario nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Calendario nuevo' })
  await dialog.getByLabel('Nombre').fill('Calendario de Varn')
  expect(await axe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeVisible()
  await expect(page.getByText('Principal')).toBeVisible()

  // Cuatro meses más y cuatro festividades: 16 «meses» en el año; y dos lunas
  const months = page.getByRole('region', { name: 'Meses' })
  for (let n = 13; n <= 16; n++) await months.getByRole('button', { name: 'Mes', exact: true }).click()
  for (const n of [13, 14, 15, 16]) {
    await months.getByLabel(`Nombre del mes ${n}`).fill(`Fiesta ${n - 12}`)
    await months.getByLabel(`Días de Fiesta ${n - 12}`).fill('7')
    await months.getByLabel(`Fiesta ${n - 12}, festividad`).check()
  }
  const nav = page.getByRole('navigation', { name: 'Secciones del calendario' })
  await expect(nav).toContainText('388 días')
  const moons = page.getByRole('region', { name: 'Lunas' })
  await nav.getByRole('button', { name: 'Lunas' }).click()
  await moons.getByRole('button', { name: 'Luna', exact: true }).click()
  await moons.getByRole('button', { name: 'Luna', exact: true }).click()
  await moons.getByLabel('Ciclo (días) · Luna 2').fill('91')
  // Una era solo del máster
  const eras = page.getByRole('region', { name: 'Eras' })
  await eras.getByRole('button', { name: 'Era', exact: true }).click()
  await eras.getByLabel('Nombre', { exact: true }).fill('Era del Eclipse')
  await eras.getByLabel('Solo del máster').check()
  // La vista previa, al momento: las dos lunas en la leyenda
  const preview = page.getByRole('complementary', { name: 'Vista previa' })
  await expect(preview).toContainText('Luna 1:')
  // La de 91 días no está nueva ni llena todos los meses: se pasa de mes hasta verla
  for (let i = 0; i < 6 && !(await preview.textContent())?.includes('Luna 2:'); i++)
    await preview.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(preview).toContainText('Luna 2:')
  expect(await axe(page)).toEqual([])
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeHidden()

  // Vuelta a la lista: la ficha con sus cifras
  await page.getByRole('link', { name: 'Calendarios', exact: true }).first().click()
  const list = page.getByRole('list', { name: 'Calendarios del mundo' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('12 meses y 4 festividades')
  await expect(list).toContainText('388 días')
  await expect(list).toContainText('Luna 1 y Luna 2')

  // Otro, como el nuestro; se hace principal desde su engranaje
  await page.getByRole('button', { name: 'Calendario nuevo' }).click()
  await dialog.getByLabel('Nombre').fill('Gregoriano')
  await dialog.locator('label', { hasText: 'Como el nuestro' }).click()
  await expect(dialog.getByRole('radio', { name: /Como el nuestro/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gregoriano' })).toBeVisible()
  // No es el principal: lleva la correspondencia con él
  await expect(page.getByRole('region', { name: 'Correspondencia con el principal' })).toBeVisible()
  await page.goto(`/mundos/${worldId}/calendarios`)
  await page.getByRole('button', { name: 'Acciones de Gregoriano' }).click()
  await page.getByRole('button', { name: 'Hacer principal' }).click()
  await expect(list.getByRole('listitem').filter({ hasText: 'Gregoriano' })).toContainText('Principal')
  await expect(list.getByRole('listitem').filter({ hasText: 'Calendario de Varn' })).not.toContainText('Principal')

  // La jugadora lee los calendarios sin la era oculta (y no ve «Calendarios» en su barra)
  const player = await newPlayer(browser, link)
  await expect(sections(player).getByRole('link', { name: 'Calendarios' })).toHaveCount(0)
  const response = await player.request.post('/api/actions/listCalendars', { data: { worldId } })
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text).toContain('Calendario de Varn')
  expect(text).not.toContain('Eclipse')
})

test.describe('con el cristal de verdad', () => {
  test.use({ storageState: CON_DESENFOQUE })

  test('la pantalla de calendarios, su cuadro y el editor, sin fallos graves de accesibilidad; el teclado ordena @a11y', async ({
    page
  }) => {
    await freshOwner(page)
    const world = await page.request.post('/api/actions/createWorld', { data: { name: 'Valdren' } })
    const worldId = (await world.json()).id as string
    for (const [name, from] of [
      ['Calendario de Varn', 'gregorian'],
      ['Cuenta de Kharum', 'blank']
    ] as const)
      await page.request.post('/api/actions/createCalendar', { data: { worldId, name, from } })
    await page.goto(`/mundos/${worldId}/calendarios`)
    const list = page.getByRole('list', { name: 'Calendarios del mundo' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    expect(await axe(page)).toEqual([])
    // Con el teclado: Alt y las flechas en su enlace lo mueven
    await list.getByRole('link', { name: 'Cuenta de Kharum' }).focus()
    await page.keyboard.press('Alt+ArrowUp')
    await expect(list.getByRole('listitem').first()).toContainText('Cuenta de Kharum')
    await page.getByRole('button', { name: 'Acciones de Calendario de Varn' }).click()
    await expect(page.getByRole('button', { name: 'Duplicar' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.keyboard.press('Escape')
    await list.getByRole('link', { name: 'Calendario de Varn' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeVisible()
    expect(await axe(page)).toEqual([])
  })
})
