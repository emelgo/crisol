import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { freshOwner, newPlayer } from './ayudas.ts'

/**
 * El tiempo de la campaña (módulos 8 y 10 · campaña; docs/specs/modulo-8-10-campana.md): el hoy y deshacer, el clima a
 * mano, un viaje que avanza la fecha, la capa de clima e Interior (en la Mesa, la jugadora y la Vista de jugadores), la
 * actividad con su insignia y su aviso en vivo, el cajón G y la jugadora en el móvil, con axe. Deja capturas en la
 * carpeta de salida de la prueba
 */
const SIZE = { width: 1440, height: 900 }
const CRIPTA = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'), 'utf8')
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.use({ viewport: SIZE, colorScheme: 'dark', actionTimeout: 20_000 })

const fest = (name: string) => ({ name, days: 7, festival: true })
const month = (name: string) => ({ name, days: 28 })
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
  moons: [{ name: 'Melancolía', cycleDays: 28, offsetDays: -1.25, color: '#4f7fd1' }]
}

/** WCAG 2.1 AA: ni críticos ni graves (CONSTRAINTS.md), con las animaciones ya quietas */
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

const apiOf = (page: Page) => async (name: string, data: object) => {
  const response = await page.request.post(`/api/actions/${name}`, { data })
  expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
  return response.json()
}

test('el tiempo de la campaña: el hoy y deshacer, el clima a mano, la actividad, un viaje, la capa de clima e Interior, el cajón G y la jugadora en el móvil', async ({
  page,
  browser
}) => {
  test.setTimeout(300_000)
  await freshOwner(page)
  const call = apiOf(page)
  const worldId = (await call('createWorld', { name: 'Eana' })).id as string
  await call('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })
  const campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).id as string
  const invitation = await call('regenerateInvitation', { campaignId })
  const home = `/mundos/${worldId}/campanas/${campaignId}`
  const player = await newPlayer(browser, invitation.url as string)
  const shot = (p: Page, name: string) => p.screenshot({ path: test.info().outputPath(`${name}.png`) })

  // Sin fecha: «Sin fecha» y «Poner fecha»
  await page.goto(home)
  const today = page.getByRole('region', { name: 'Hoy' })
  await expect(today.getByRole('heading', { name: 'Sin fecha' })).toBeVisible()
  await expect(today.getByRole('button', { name: 'Poner fecha' })).toBeVisible()

  // El hoy: +1 día y «Deshacer» lo devuelve; todo queda en el registro
  await call('setCampaignToday', { campaignId, date: '1250-Siega-18' })
  await expect(today.getByRole('heading', { name: /Frostelle, 18 de Siega/ })).toBeVisible()
  await expect(today.getByText('Próximos días')).toBeVisible()
  await today.getByRole('button', { name: '+1 día' }).click()
  await expect(today.getByRole('heading', { name: /Flora, 19 de Siega/ })).toBeVisible()
  const toast = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Deshacer' }) })
  await expect(toast).toBeVisible()
  await shot(page, 'inicio-mas-un-dia')
  await toast.getByRole('button', { name: 'Deshacer' }).click()
  await expect(today.getByRole('heading', { name: /Frostelle, 18 de Siega/ })).toBeVisible()
  await expect
    .poll(async () => {
      const log = await call('listLog', { campaignId })
      return (log.entries as Array<{ kind: string; event?: { type: string; undo?: boolean } }>)
        .filter((e) => e.kind === 'event' && e.event?.type === 'date')
        .map((e) => (e.event?.undo ? 'undo' : 'date'))
    })
    .toEqual(expect.arrayContaining(['date', 'date', 'undo']))

  // El clima a mano de mañana: se queda y lo dice su día
  await today
    .getByRole('button', { name: /Cambiar el clima del/ })
    .nth(1)
    .click()
  const weather = page.getByRole('dialog', { name: /Clima ·/ })
  await weather.getByRole('button', { name: 'Nieve', exact: true }).click()
  await weather.getByRole('button', { name: 'Guardar' }).click()
  await expect(weather).toBeHidden()
  await expect(today.getByRole('button', { name: /Nieve/ }).first()).toBeVisible()
  expect(await axe(page)).toEqual([])
  await shot(page, 'inicio')

  // La actividad: la nota de la jugadora sale, con la insignia en la barra; «Marcar como visto» la vacía
  await apiOf(player)('createPlayerNote', { campaignId, title: 'Diario de Mirra' })
  await page.reload()
  const activity = page.getByRole('region', { name: 'Desde tu última visita' })
  await expect(activity.getByRole('link', { name: 'Diario de Mirra' })).toBeVisible()
  const badge = page.getByRole('link', { name: /La Marca.*cosas? nuevas?/ })
  await expect(badge).toBeVisible()
  await shot(page, 'actividad')
  // En vivo: otra nota mientras se está en otra parte de la campaña, con su aviso; «Ver» lleva al Inicio
  await page.goto(`${home}/libros`)
  await expect(page.getByRole('link', { name: /La Marca.*cosas? nuevas?/ })).toBeVisible()
  await apiOf(player)('createPlayerNote', { campaignId, title: 'Lo que sabemos de la Mano Gris' })
  const live = page.getByRole('complementary', { name: 'Algo nuevo en La Marca' })
  await expect(live).toBeVisible()
  await shot(page, 'aviso-en-vivo')
  await live.getByRole('button', { name: 'Ver' }).click()
  await expect(activity.getByRole('link', { name: 'Lo que sabemos de la Mano Gris' })).toBeVisible()
  await activity.getByRole('button', { name: 'Marcar como visto' }).click()
  await expect(activity.getByText('Nada nuevo desde tu última visita')).toBeVisible()
  await expect(page.getByRole('link', { name: /cosas? nuevas?/ })).toHaveCount(0)

  // La Mesa: una escena con mapa, presentada a los jugadores
  const sceneId = (await call('createScene', { worldId, name: 'El vado del Tejo' })).id as string
  await call('drawScene', { sceneId, svg: CRIPTA, name: 'Vado' })
  await call('openScene', { campaignId, sceneId })
  await call('presentScene', { campaignId })
  await page.goto(`${home}/mesa`)
  const stage = page.getByRole('application', { name: /Mesa: El vado del Tejo/ })
  await expect(stage).toBeVisible()
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)
  const chip = page.getByRole('button', { name: /El hoy de la campaña: 18 de Siega/ })
  await expect(chip).toBeVisible()

  // Un viaje con la distancia escrita: avanza el hoy y deja su resumen en el registro
  await chip.click()
  await page.getByRole('button', { name: /Viaje…/ }).click()
  const trip = page.getByRole('dialog', { name: 'Viaje' })
  await trip.getByLabel('Distancia').fill('60')
  await trip.getByText('A caballo').click()
  const advance = trip.getByRole('button', { name: /Avanzar hoy · \d+ días?/ })
  await expect(advance).toBeEnabled()
  await shot(page, 'viaje-desde-la-mesa')
  await advance.click()
  await expect(trip).toBeHidden()
  await expect(page.getByRole('button', { name: /El hoy de la campaña:/ })).not.toHaveAccessibleName(/ 18 de Siega/)
  await expect
    .poll(async () => {
      const log = await call('listLog', { campaignId })
      return (log.entries as Array<{ kind: string; event?: { type: string } }>).some(
        (e) => e.kind === 'event' && e.event?.type === 'travel'
      )
    })
    .toBe(true)

  // La capa de clima a mano: lluvia en la Mesa, en la de la jugadora y en la Vista de jugadores
  await page.getByRole('button', { name: /El hoy de la campaña/ }).click()
  const menu = page.getByRole('region', { name: /El hoy de la campaña/ })
  await menu.getByText('A mano', { exact: true }).click()
  await menu.getByText('Lluvia', { exact: true }).click()
  await expect(page.locator('[data-weather="rain"]')).toHaveCount(1)
  await shot(page, 'mesa-a-mano')
  await page.keyboard.press('Escape')
  const [tv] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Vista de jugadores', exact: true }).click()
  ])
  await expect(tv.locator('[data-weather="rain"]')).toHaveCount(1)
  await player.goto(`${home}/mesa`)
  await expect(player.locator('[data-weather="rain"]')).toHaveCount(1)
  // Interior: sin clima en ninguna
  await page.getByRole('button', { name: /El hoy de la campaña/ }).click()
  await menu.getByRole('switch', { name: /Escena interior/ }).click()
  await expect(page.locator('[data-weather]')).toHaveCount(0)
  await expect(tv.locator('[data-weather]')).toHaveCount(0)
  await expect(player.locator('[data-weather]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /El hoy de la campaña/ })).toContainText('Interior')
  await shot(page, 'mesa-interior')
  await page.keyboard.press('Escape')
  await tv.close()

  // El cajón G: cuatro columnas que se encienden y apagan (guardado en el servidor) y una tabla oculta
  const tablePage = (await call('createPage', { worldId, title: 'Encuentros en el camino' })).id as string
  const tab = await call('createPageTab', { pageId: tablePage, kind: 'table', name: 'Encuentros en el camino' })
  const random = (await call('getRandomTable', { tabId: tab.id })).table
  await call('updateRandomTable', {
    tabId: tab.id,
    version: random.version,
    rows: ['Nada', 'Una patrulla', 'Peregrinos', 'Un huargo herido'].map((text, i) => ({
      id: `f${i + 1}`,
      from: i + 1,
      to: i + 1,
      text
    }))
  })
  await stage.focus()
  await page.keyboard.press('g')
  const drawer = page.getByRole('region', { name: 'Pantalla del máster' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('heading', { name: 'Personajes de la escena' })).toBeVisible()
  await drawer.getByRole('checkbox', { name: 'Nota' }).uncheck()
  await expect.poll(async () => (await call('getCampaignTable', { campaignId })).gmScreen?.columns.note).toBe(false)
  await drawer.getByRole('button', { name: 'Añadir tabla' }).click()
  await page.getByRole('menuitem', { name: /Encuentros en el camino/ }).click()
  await drawer.getByRole('button', { name: 'Tirar Encuentros en el camino' }).click()
  await expect(drawer.getByRole('status')).toContainText('Solo tú')
  expect(await axe(page)).toEqual([])
  await shot(page, 'pantalla-master')
  await expect.poll(async () => (await call('getCampaignTable', { campaignId })).gmScreen?.tables).toEqual([tab.id])

  // La jugadora en el móvil: hoy y el sol, sin previsión; su actividad
  const phone = await player.context().newPage()
  await phone.setViewportSize({ width: 390, height: 844 })
  await phone.goto(home)
  const hers = phone.getByRole('region', { name: 'Hoy' })
  await expect(hers.getByRole('heading', { name: /de Siega/ })).toBeVisible()
  await expect(hers.getByText(/min de luz/)).toBeVisible()
  await expect(hers.getByText('Próximos días')).toHaveCount(0)
  await expect(phone.getByRole('region', { name: 'Desde tu última visita' })).toBeVisible()
  expect(await axe(phone)).toEqual([])
  await shot(phone, 'movil')
  await player.close()
})
