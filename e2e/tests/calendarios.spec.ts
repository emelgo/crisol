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

/** El calendario abierto (en grande o en su editor), por su dirección */
const calendarId = async (page: Page) => new URL(page.url()).pathname.split('/')[4] ?? ''

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

  // Vacía: «Calendario nuevo» abre su cuadro; en blanco, y se abre su editor, por fases
  await page.getByRole('button', { name: 'Calendario nuevo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Calendario nuevo' })
  await dialog.getByLabel('Nombre').fill('Calendario de Varn')
  expect(await axe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeVisible()
  await expect(page).toHaveURL(/\/editar$/)
  const phases = page.getByRole('navigation', { name: 'Fases del calendario' })
  const summary = page.getByRole('complementary', { name: 'El año y los problemas' })
  await expect(summary).toContainText('Principal')

  // Cuatro meses más, que son festividades: 16 «meses» en el año; en blanco, sin días de más
  await phases.getByRole('button', { name: 'Meses' }).click()
  await expect(page).toHaveURL(/fase=meses/)
  const months = page.getByRole('region', { name: 'Meses' })
  for (let n = 13; n <= 16; n++) await months.getByRole('button', { name: 'Mes', exact: true }).click()
  for (const n of [13, 14, 15, 16]) {
    await months.getByLabel(`Nombre del mes ${n}`).fill(`Fiesta ${n - 12}`)
    await months.getByLabel(`Días de Fiesta ${n - 12}`).fill('7')
    await months.getByLabel(`Tipo de Fiesta ${n - 12}`).selectOption({ label: 'Festividad' })
  }
  await expect(summary).toContainText('388 días')
  await expect(summary).toContainText('12 meses y 4 festividades')
  await page.getByRole('button', { name: 'Siguiente: Días señalados' }).click()
  await page.getByRole('button', { name: 'Siguiente: Días de más' }).click()
  const extra = page.getByRole('region', { name: 'Días de más' })
  await expect(extra).toContainText('Todos los años duran lo mismo.')
  await expect(extra.getByRole('button', { name: 'Como el gregoriano' })).toHaveCount(0)
  // Dos lunas
  await phases.getByRole('button', { name: 'Lunas' }).click()
  const moons = page.getByRole('region', { name: 'Lunas' })
  await moons.getByRole('button', { name: 'Luna', exact: true }).click()
  await moons.getByRole('button', { name: 'Luna', exact: true }).click()
  await moons.getByLabel('Ciclo (días) · Luna 2').fill('91')
  // Una era solo del máster
  await phases.getByRole('button', { name: 'Eras' }).click()
  const eras = page.getByRole('region', { name: 'Eras' })
  await eras.getByRole('button', { name: 'Era', exact: true }).click()
  await eras.getByLabel('Nombre', { exact: true }).fill('Era del Eclipse')
  await eras.getByLabel('Oculta para los jugadores').check()
  await expect(summary).toContainText('Luna 1 y Luna 2')
  expect(await axe(page)).toEqual([])
  await page.screenshot({ path: test.info().outputPath('editor.png') })
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeHidden()

  // En grande: el mes, sin fichas a los lados; la del día sale al pasar el ratón, se fija al pulsar (con su era) y
  // «Nuevo evento» crea uno suelto con su fecha
  await page.getByRole('link', { name: 'Ver calendario' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Mes 1 del año 0', exact: true })).toBeVisible()
  const day = page.getByRole('complementary', { name: 'El día elegido' })
  await expect(day).toHaveCount(0)
  await page.getByRole('cell', { name: / 3 de Mes 1 de 0$/ }).hover()
  await expect(day.getByRole('heading', { level: 2 })).toContainText('3 de Mes 1 de 0')
  await page.getByRole('cell', { name: / 5 de Mes 1 de 0$/ }).click()
  await expect(day.getByRole('heading', { level: 2 })).toContainText('5 de Mes 1 de 0 de la Era del Eclipse')
  await day.getByRole('button', { name: 'Un evento nuevo en este día' }).click()
  const event = page.getByRole('dialog')
  await event.getByLabel('Título').fill('Coronación de Ilsa')
  await event.getByRole('button', { name: 'Crear evento' }).click()
  await expect(day).toContainText('Coronación de Ilsa')
  await expect(page.getByRole('cell', { name: / 5 de Mes 1 de 0$/ })).toContainText('Coronación de Ilsa')
  expect(await axe(page)).toEqual([])
  await page.screenshot({ path: test.info().outputPath('en-grande.png') })
  // Esc quita la ficha; la semana y el año
  await page.mouse.move(0, 0)
  await page.keyboard.press('Escape')
  await expect(day).toHaveCount(0)
  const modes = page.getByRole('toolbar', { name: 'Vista' })
  await modes.getByRole('button', { name: 'Semana' }).click()
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeVisible()
  // Su título lleva a otra fecha: el año, el mes y el día, que lleva a su semana; Esc lo cierra
  const weekTitle = page.getByRole('button', { name: /^Semana del/ })
  await weekTitle.click()
  const jump = page.getByRole('dialog', { name: 'Ir a otra semana' })
  await expect(jump.getByLabel('Año')).toBeFocused()
  expect(await axe(page)).toEqual([])
  await jump.getByRole('group', { name: 'Mes' }).getByRole('button', { name: 'Mes 2', exact: true }).click()
  await jump.getByRole('group', { name: 'Día' }).getByRole('button', { name: '10', exact: true }).click()
  await expect(jump).toHaveCount(0)
  await expect(page.getByRole('cell', { name: / 10 de Mes 2 de 0$/ })).toBeVisible()
  await weekTitle.click()
  await page.keyboard.press('Escape')
  await expect(jump).toHaveCount(0)
  await expect(weekTitle).toBeFocused()
  expect(await axe(page)).toEqual([])
  await modes.getByRole('button', { name: 'Año' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Año 0', exact: true })).toBeVisible()
  expect(await axe(page)).toEqual([])
  await page.screenshot({ path: test.info().outputPath('en-grande-año.png') })
  await page.getByRole('button', { name: /^Fiesta 1/ }).click()
  await expect(modes.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')

  // Vuelta a la lista: la ficha con sus cifras
  await sections(page).getByRole('link', { name: 'Calendarios' }).click()
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
  // No es el principal: lleva la correspondencia con él, en su fase
  await page
    .getByRole('navigation', { name: 'Fases del calendario' })
    .getByRole('button', { name: 'Correspondencia' })
    .click()
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

  test('la pantalla de calendarios, su cuadro, uno en grande y el editor, sin fallos graves de accesibilidad; el teclado ordena @a11y', async ({
    page
  }) => {
    // La lista, el cuadro, la vista grande y tres fases del editor, cada una con su axe
    test.slow()
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
    await page.getByRole('cell').filter({ hasText: /^15/ }).first().click()
    await expect(page.getByRole('complementary', { name: 'El día elegido' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.screenshot({ path: test.info().outputPath('en-grande-cristal.png') })
    await page.getByRole('link', { name: 'Editar calendario' }).click()
    await expect(page.getByRole('navigation', { name: 'Fases del calendario' })).toBeVisible()
    for (const phase of ['semana', 'meses', 'dias-de-mas']) {
      await page.goto(`/mundos/${worldId}/calendarios/${await calendarId(page)}/editar?fase=${phase}`)
      await expect(page.getByRole('navigation', { name: 'Fases del calendario' })).toBeVisible()
      expect(await axe(page)).toEqual([])
      await page.screenshot({ path: test.info().outputPath(`editor-${phase}.png`) })
    }
  })
})
