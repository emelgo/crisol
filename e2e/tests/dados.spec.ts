import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, newPlayer, settled } from './ayudas.ts'

/** Que axe no encuentre fallos críticos ni graves en lo que se indica, en claro y en oscuro */
async function accessible(page: Page, include: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include(include)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious, `${colorScheme}: ${JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))}`).toEqual([])
  }
}

test('el máster abre los dados en su campaña, junta unos cuantos y tira: se vacían, se cierran y se anuncia el total', async ({
  page
}) => {
  await campaignLink(page)
  // El d20 flotante (fuera de la barra), en la esquina
  const dados = page.locator('[data-tour="dados"]')
  await dados.click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  await expect(dados).toHaveAttribute('aria-expanded', 'true')
  // Pulsar suma; el botón derecho quita
  await dice.getByRole('button', { name: 'Añadir un d8' }).click()
  await dice.getByRole('button', { name: 'Añadir un d8 (van 1)' }).click()
  await dice.getByRole('button', { name: 'Añadir un d4' }).click()
  await dice.getByRole('button', { name: 'Añadir un d8 (van 2)' }).click({ button: 'right' })
  await dice.getByRole('button', { name: 'Sumar uno' }).click()
  await dice.getByRole('button', { name: 'Ventaja', exact: true }).click()
  await expect(dice.getByRole('list', { name: 'En la tirada' }).getByRole('listitem')).toHaveText([
    '1d8',
    '1d4',
    '1d20'
  ])
  await page.screenshot({ path: test.info().outputPath('dados-juntados.png') })
  await accessible(page, '[data-tour="ficha-dados"]')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  await expect(dice).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: '1d8+1d4+2d20kh1+1' })).toHaveText(
    /^1d8\+1d4\+2d20kh1\+1: \d+$/
  )
  // El resultado, sobre el d20 cuando paran los dados
  await expect(page.getByRole('list', { name: 'Últimas tiradas' })).toContainText('1d8+1d4+2d20kh1+1', {
    timeout: 8000
  })

  // Escribirla: se explica mientras se escribe; Escape los cierra y el foco vuelve al d20
  await dados.click()
  await dice.getByRole('button', { name: 'Escribir la tirada' }).click()
  const field = dice.getByRole('textbox', { name: 'Tirada' })
  await field.fill('1d20+5 # Iniciativa')
  await expect(dice.getByText('1d20 + 5 · Iniciativa')).toBeVisible()
  await accessible(page, '[data-tour="ficha-dados"]')
  await page.keyboard.press('Escape')
  await expect(dice).toBeHidden()
  await expect(dados).toHaveAttribute('aria-expanded', 'false')
  await expect(dados).toBeFocused()
})

test('el máster y una jugadora en dos pestañas: la pública le sale al momento; la «al máster», marcada para él', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const ana = await newPlayer(browser, link, 'Ana')
  const write = async (who: Page, formula: string) => {
    await who.locator('[data-tour="dados"]').click()
    const dice = who.getByRole('complementary', { name: 'Dados' })
    await dice.getByRole('button', { name: 'Escribir la tirada' }).click()
    await dice.getByRole('textbox', { name: 'Tirada' }).fill(formula)
    return dice
  }

  // Él tira para todos: a ella le sale sobre el d20 sin recargar
  await (await write(page, '1d20+5 # Iniciativa')).getByRole('button', { name: 'Tirar' }).click()
  await expect(ana.getByRole('list', { name: 'Últimas tiradas' })).toContainText(/Enrique · Iniciativa/, {
    timeout: 8000
  })

  // Ella tira solo para el máster (se recuerda): a él le sale «para ti»
  const hers = await write(ana, '1d20+7 # Sigilo')
  await hers.getByRole('button', { name: /^Quién la ve/ }).click()
  await hers.getByRole('menuitemradio', { name: 'Máster' }).click()
  await hers.getByRole('textbox', { name: 'Tirada' }).press('Enter')
  const forMaster = page
    .getByRole('list', { name: 'Últimas tiradas' })
    .getByRole('listitem')
    .filter({ hasText: 'Sigilo' })
  await expect(forMaster).toContainText('para ti', { timeout: 8000 })

  // En su historial (en la Mesa, una ventana), con su marca
  await forMaster.getByRole('button', { name: /Abrir el historial/ }).click()
  const history = page.getByRole('dialog', { name: 'Historial' })
  const last = history.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()
  await expect(last).toContainText('Sigilo')
  await expect(last).toContainText('Al máster')
  await expect(last).toContainText('Ana')
  await accessible(page, '[data-window]')
  await ana.close()
})

test('en el móvil de la jugadora, el d20 abre los dados en una hoja que sube desde abajo, como una ventana', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const ana = await newPlayer(browser, link, 'Ana')
  page = ana
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('[data-tour="dados"]').click()
  const dice = page.getByRole('dialog', { name: 'Dados' })
  await expect(dice).toBeVisible()
  // Abajo del todo y de lado a lado, cuando acaba de subir
  await expect
    .poll(async () => {
      const box = await dice.boundingBox()
      return [Math.round((box?.y ?? 0) + (box?.height ?? 0)), Math.round(box?.width ?? 0)]
    })
    .toEqual([844, 390])
  await dice.getByRole('button', { name: 'Añadir un d6' }).click()
  await dice.getByRole('button', { name: 'Añadir un d6 (van 1)' }).click()
  await settled(page)
  await accessible(page, '[data-tour="ficha-dados"]')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  await expect(dice).toBeHidden()
  // El resultado sobre el d20; pulsarlo abre el historial, también en una hoja
  const notice = page.getByRole('list', { name: 'Últimas tiradas' }).getByRole('listitem').filter({ hasText: '2d6' })
  await notice.getByRole('button', { name: /Abrir el historial/ }).click({ timeout: 10_000 })
  const history = page.getByRole('dialog', { name: 'Historial' })
  await expect(history.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()).toContainText(
    '2d6'
  )
  await settled(page)
  await accessible(page, '[role="dialog"]')
  // Escape lo cierra y el foco vuelve al d20
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await expect(page.locator('[data-tour="dados"]')).toBeFocused()
  await ana.close()
})

test('los dados 3D: la escena se carga aparte, en un rato libre dentro del mundo, y caen al tirar', async ({
  page
}) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname)
  })
  const workers: string[] = []
  page.on('worker', (worker) => workers.push(new URL(worker.url()).pathname))
  await campaignLink(page)
  await page.locator('[data-tour="dados"]').click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  // Lista antes de tirar: la primera tirada no espera a cargarla
  await expect.poll(() => scripts.some((path) => /\/scene-[^/]+\.js$/.test(path)), { timeout: 10_000 }).toBe(true)
  await dice.getByRole('button', { name: 'Escribir la tirada' }).click()
  await dice.getByRole('textbox', { name: 'Tirada' }).fill('1d20+2d6+1d8 # Golpe')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  // Al pararse, el resultado sobre el d20
  await expect(page.getByRole('list', { name: 'Últimas tiradas' })).toContainText('Golpe', { timeout: 8000 })
  // La física, en su worker: la página no tuvo que simularla (ni cargó la de respaldo)
  expect(workers.some((path) => /\/throw\.worker-[^/]+\.js$/.test(path))).toBe(true)
  expect(scripts.some((path) => /\/throw-[^/]+\.js$/.test(path))).toBe(false)
  await page.screenshot({ path: test.info().outputPath('dados-3d.png') })
})

test('una tirada escrita en una página: con «/» se pone y se cambia, al pulsarla tira en la campaña y se guarda como `dice:`', async ({
  page
}) => {
  test.slow()
  await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  await page.goto(`/mundos/${worldId}`)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('La trampa hace ')
  await page.keyboard.type('/tirada')
  await page.keyboard.press('Enter')
  // Recién puesta, su cuadro abierto
  const box = page.getByRole('dialog', { name: 'La tirada' })
  await expect(box).toBeVisible()
  await box.getByLabel('Tirada').fill('2d6+3')
  await expect(box.getByText('2d6 + 3')).toBeVisible()
  await box.getByLabel('Nombre').fill('Trampa')
  await box.getByRole('button', { name: 'Listo' }).click()
  await expect(box).toBeHidden()

  // Pulsarla tira en la campaña: el resultado, sobre el d20; y en el historial
  await body.getByRole('button', { name: 'Tirar 2d6+3 · Trampa' }).click()
  await expect(page.getByRole('list', { name: 'Últimas tiradas' })).toContainText('Trampa', { timeout: 8000 })
  await page.locator('[data-tour="dados"]').click()
  await page.getByRole('complementary', { name: 'Dados' }).getByRole('button', { name: 'Historial' }).click()
  const log = page
    .getByRole('complementary', { name: 'Historial' })
    .getByRole('list', { name: 'Tiradas de la campaña' })
  await expect(log.getByRole('listitem').last()).toContainText('Trampa')
  await expect(log.getByRole('listitem').last()).toContainText('2d6+3')

  // Y en el Markdown, como en Obsidian
  const homeId = await page.evaluate(async (id) => {
    const response = await fetch('/api/actions/getWorldHome', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worldId: id })
    })
    return ((await response.json()) as { pageId: string }).pageId
  }, worldId)
  await expect
    .poll(
      async () =>
        (await (await page.request.post('/api/actions/readPage', { data: { pageId: homeId } })).json()).markdown,
      {
        timeout: 10_000
      }
    )
    .toContain('`dice: 2d6+3 # Trampa`')

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([])
})
