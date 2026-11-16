import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { CON_DESENFOQUE } from '../sin-desenfoque.ts'
import { campaignLink, campaignPath, freshOwner, newPlayer } from './ayudas.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function axe(page: Page) {
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

const fest = (name: string) => ({ name, days: 7, festival: true })
const month = (name: string) => ({ name, days: 28 })
/** El de Eana: 12 meses de 28 días y 4 semanas de fiestas, semana de 7, dos lunas */
const EANA = {
  yearSuffix: 'RC',
  weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
  months: [
    fest('Alba Triste'),
    month('Cierzo'),
    month('Escarcha'),
    month('Deshielo'),
    fest('Carnaval'),
    month('Siembra'),
    month('Florida'),
    month('Pastos'),
    fest('Semana del Yunque'),
    month('Siega'),
    month('Trilla'),
    month('Vendimia'),
    fest('Semana de las Hermanas'),
    month('Hojarasca'),
    month('Brumas'),
    month('Nochelarga')
  ],
  seasons: [
    { name: 'Invierno', startDay: 1, endDay: 91 },
    { name: 'Primavera', startDay: 92, endDay: 182 },
    { name: 'Verano', startDay: 183, endDay: 273 },
    { name: 'Otoño', startDay: 274, endDay: 364 }
  ],
  moons: [
    { name: 'Melancolía', cycleDays: 28, offsetDays: -1.25, color: '#4f7fd1' },
    { name: 'Eternidad', cycleDays: 91, offsetDays: 48.1875, color: '#b07a3a' }
  ],
  eras: [
    { name: 'Era de la República', abbreviation: 'ER', start: '0' },
    { name: 'Era del Eclipse', start: '1300', hidden: true }
  ]
}

function apiOf(page: Page) {
  return async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
}

test('cronologías (módulo 8): crearla, un evento de un día, un rango entre dos meses, uno de cada año, la página con fecha que sale sola, arrastrar en el calendario y convertir en página', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const api = apiOf(page)
  const worldId = (await api('createWorld', { name: 'Valdren' })).id as string
  await api('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })
  // Una subpágina con su fecha: sale sola
  const history = await api('createPage', { worldId, title: 'Historia' })
  const founding = await api('createPage', { worldId, title: 'Puerto Ceniza', parentId: history.id })
  await api('editPage', {
    pageId: founding.id,
    properties: [{ name: 'Fundación', type: 'date', value: '-980-Siega-12' }]
  })

  // Desde Calendarios: «Cronología nueva»
  await page.goto(`/mundos/${worldId}/calendarios`)
  await page.getByRole('button', { name: 'Cronología nueva' }).click()
  const create = page.getByRole('dialog', { name: 'Cronología nueva' })
  await create.getByLabel('Nombre').fill('Historia de Valdren')
  await create.getByRole('button', { name: 'Crear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Historia de Valdren' })).toBeVisible()
  const list = page.getByRole('list', { name: 'Lista' })
  await expect(list.getByRole('heading', { name: 'Puerto Ceniza' })).toBeVisible()
  await expect(list).toContainText('12 Sie -980 RC')

  // Un rango que cruza dos meses y una fiesta de cada año (como los pasaría la IA)
  await api('createTimelineEvents', {
    worldId,
    events: [
      { title: 'Campaña de los Pasos', date: '1250-Siega-20/1250-Trilla-3', group: 'Guerras' },
      { title: 'Feria de Vendimia', date: '1249-Vendimia-1 (cada año)' }
    ]
  })
  await expect(list.getByRole('heading', { name: 'Campaña de los Pasos' })).toBeVisible()
  await expect(list).toContainText('20 Sie – 3 Tri 1250 RC')

  // Uno de un día, desde el calendario: elegir el día y «Evento en este día»
  const pill = page.getByRole('toolbar', { name: 'Vistas' })
  await pill.getByRole('button', { name: 'Calendario' }).click()
  // Abre en el mes de la última con mes (la campaña empieza en Siega)
  await expect(page.getByRole('heading', { name: 'Siega de 1250 RC' })).toBeVisible()
  const siega = page.getByRole('table', { name: 'Siega de 1250 RC' })
  await siega.getByRole('cell', { name: /, 18 de Siega de 1250 RC/ }).click({ position: { x: 8, y: 48 } })
  await page.getByRole('button', { name: 'Evento en este día' }).click()
  const dialog = page.getByRole('dialog', { name: 'Evento nuevo' })
  await dialog.getByLabel('Título').fill('Boda de Ilsa y Doran')
  expect(await axe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Crear evento' }).click()
  await expect(dialog).toBeHidden()
  await expect(siega.getByRole('cell', { name: /, 18 de Siega de 1250 RC/ })).toContainText('Boda de Ilsa y Doran')
  // El rango, en sus dos meses
  await expect(
    siega.getByRole('cell', { name: /, 28 de Siega de 1250 RC/ }).locator('button[aria-label="Campaña de los Pasos"]')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  const trilla = page.getByRole('table', { name: 'Trilla de 1250 RC' })
  await expect(
    trilla.getByRole('cell', { name: /, 3 de Trilla de 1250 RC/ }).locator('button[aria-label="Campaña de los Pasos"]')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Mes anterior' }).click()

  // La rejilla, con las flechas
  await siega.getByRole('cell', { name: /, 18 de Siega de 1250 RC/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(siega.getByRole('cell', { name: /, 19 de Siega de 1250 RC/ })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(siega.getByRole('cell', { name: /, 26 de Siega de 1250 RC/ })).toBeFocused()
  expect(await axe(page)).toEqual([])

  // Arrastrar la boda al 22 le cambia la fecha
  await siega
    .getByRole('button', { name: 'Boda de Ilsa y Doran' })
    .dragTo(siega.getByRole('cell', { name: /, 22 de Siega de 1250 RC/ }))
  await expect(siega.getByRole('cell', { name: /, 22 de Siega de 1250 RC/ })).toContainText('Boda de Ilsa y Doran')
  await pill.getByRole('button', { name: 'Lista' }).click()
  await expect(list).toContainText('22 Sie 1250 RC')

  // Meses, con sus carriles
  await pill.getByRole('button', { name: 'Meses' }).click()
  const lanes = page.getByRole('list', { name: 'Grupos' })
  await expect(lanes.getByText('Guerras')).toBeVisible()
  await expect(lanes.getByRole('button', { name: /Campaña de los Pasos/ })).toBeVisible()
  expect(await axe(page)).toEqual([])
  await page.getByRole('toolbar', { name: 'Zoom' }).getByRole('button', { name: 'Años' }).click()
  await expect(page.getByRole('toolbar', { name: 'Zoom' }).getByRole('button', { name: 'Años' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  // Convertir la boda en página, dentro de Historia
  await pill.getByRole('button', { name: 'Lista' }).click()
  await list.getByRole('button', { name: 'Acciones de «Boda de Ilsa y Doran»' }).click()
  await page.getByRole('button', { name: 'Convertir en página…' }).click()
  const convert = page.getByRole('dialog', { name: 'Convertir en página' })
  await convert.getByLabel('Dónde').selectOption({ label: 'Historia' })
  await convert.getByRole('button', { name: 'Convertir' }).click()
  await expect(convert).toBeHidden()
  await expect(list.getByRole('link', { name: 'Abrir la página' })).toBeVisible()
  expect(await axe(page)).toEqual([])
  const tree = await api('listPageTree', { worldId, levels: 3 })
  expect(JSON.stringify(tree)).toContain('Boda de Ilsa y Doran')
})

test('la jugadora en el móvil: solo la cronología revelada, con lo que sabe su campaña, en lista y calendario sin desplazarse de lado', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const [, , worldId = '', , campaignId = ''] = campaignPath(page).split('/')
  const api = apiOf(page)
  await api('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })
  const known = await api('createPage', { worldId, title: 'Puerto Ceniza' })
  const unknown = await api('createPage', { worldId, title: 'La Torre Negra' })
  await api('editPage', { pageId: known.id, properties: [{ name: 'Fundación', type: 'date', value: '1250-Siega-12' }] })
  await api('editPage', {
    pageId: unknown.id,
    properties: [{ name: 'Fundación', type: 'date', value: '1250-Siega-14' }]
  })
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: known.id, known: true })
  await api('createTimelineEvents', {
    worldId,
    events: [
      { title: 'Boda de Ilsa y Doran', date: '1250-Siega-18', description: 'En el Salón de las Velas.' },
      { title: 'El Asesinato del Rey', date: '1250-Siega-20', hidden: true },
      { title: 'Tras el eclipse', date: '1301-Siega-1' }
    ]
  })
  const shown = await api('createChronology', { worldId, name: 'Historia de Valdren' })
  await api('createChronology', { worldId, name: 'Los Planes del Culto' })
  await api('setKnowledge', { worldId, campaignId, kind: 'chronology', targetId: shown.id, known: true })

  const player = await newPlayer(browser, link)
  await player.setViewportSize({ width: 375, height: 812 })
  await player.goto(`/mundos/${worldId}/campanas/${campaignId}/cronologias`)
  const cards = player.getByRole('list', { name: 'Cronologías del mundo' })
  await expect(cards.getByRole('link')).toHaveCount(1)
  await cards.getByRole('link', { name: 'Historia de Valdren' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'Historia de Valdren' })).toBeVisible()
  const list = player.getByRole('list', { name: 'Lista' })
  await expect(list.getByRole('heading', { name: 'Boda de Ilsa y Doran' })).toBeVisible()
  await expect(list.getByRole('heading', { name: 'Puerto Ceniza' })).toBeVisible()
  await expect(list).not.toContainText('Asesinato')
  await expect(list).not.toContainText('Torre Negra')
  // Solo lectura: sin «+» ni «⋯»
  await expect(player.getByRole('button', { name: 'Añadir evento' })).toHaveCount(0)
  await expect(player.getByRole('button', { name: /^Acciones de/ })).toHaveCount(0)
  const sideways = () => player.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(await sideways()).toBe(false)
  expect(await axe(player)).toEqual([])

  // El calendario compacto: un punto por día con algo; tocar un día sube su hoja (sin la era oculta)
  await player.getByRole('toolbar', { name: 'Vistas' }).getByRole('button', { name: 'Calendario' }).click()
  const month = player.getByRole('table', { name: 'Siega de 1301 RC' })
  await expect(month).toBeVisible()
  await expect(player.getByRole('main')).toContainText('Era de la República')
  await expect(player.getByRole('main')).not.toContainText('Era del Eclipse')
  await month.getByRole('cell', { name: /, 1 de Siega de 1301 RC/ }).click()
  const sheet = player.getByRole('complementary', { name: /1 de Siega de 1301 RC/ })
  await expect(sheet.getByRole('heading', { name: 'Tras el eclipse' })).toBeVisible()
  expect(await sideways()).toBe(false)
  expect(await axe(player)).toEqual([])
  await player.close()
})

test.describe('con el cristal de verdad', () => {
  test.use({ storageState: CON_DESENFOQUE })

  test('la sección de Calendarios y las tres vistas, sin fallos graves de accesibilidad @a11y', async ({ page }) => {
    await freshOwner(page)
    const api = apiOf(page)
    const worldId = (await api('createWorld', { name: 'Valdren' })).id as string
    await api('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })
    await api('createTimelineEvents', {
      worldId,
      events: [
        { title: 'Boda de Ilsa y Doran', date: '1250-Siega-18', group: 'La Corona', color: 'wine' },
        { title: 'Campaña de los Pasos', date: '1250-Siega-20/1250-Trilla-3', group: 'Guerras' }
      ]
    })
    const chronology = await api('createChronology', { worldId, name: 'Historia de Valdren' })
    await page.goto(`/mundos/${worldId}/calendarios`)
    await expect(page.getByRole('list', { name: 'Cronologías del mundo' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/calendarios/cronologias/${chronology.id}`)
    await expect(page.getByRole('list', { name: 'Lista' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    const pill = page.getByRole('toolbar', { name: 'Vistas' })
    await pill.getByRole('button', { name: 'Meses' }).click()
    await expect(page.getByRole('list', { name: 'Grupos' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await pill.getByRole('button', { name: 'Calendario' }).click()
    await expect(page.getByRole('table', { name: /de 1250 RC/ })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await expect(page.getByRole('dialog', { name: 'Ajustes de la cronología' })).toBeVisible()
    expect(await axe(page)).toEqual([])
  })
})
