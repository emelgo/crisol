import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { campaignLink, newPlayer, settled } from './ayudas.ts'

test('el máster abre los dados en su campaña y tira: la tirada se explica y se anuncia el total', async ({ page }) => {
  await campaignLink(page)
  const dados = page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' })
  await dados.click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  await expect(dados).toHaveAttribute('aria-pressed', 'true')
  const field = dice.getByRole('textbox', { name: 'Tirada' })
  await field.fill('1d20+5 # Iniciativa')
  await expect(dice.getByText('1d20 + 5 · Iniciativa')).toBeVisible()
  await field.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Iniciativa' })).toHaveText(/^Iniciativa: \d+$/)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('[data-tour="ficha-dados"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious, `${colorScheme}: ${JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))}`).toEqual([])
  }

  // Se cierra con su X, y la barra lo dice
  await dice.getByRole('button', { name: 'Cerrar los dados' }).click()
  await expect(dice).toBeHidden()
  await expect(dados).toHaveAttribute('aria-pressed', 'false')
})

test('el máster y una jugadora en dos pestañas: la pública llega al momento; la «al máster», marcada para él', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const ana = await newPlayer(browser, link, 'Ana')
  const open = async (who: typeof page) => {
    await who.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
    const dice = who.getByRole('complementary', { name: 'Dados' })
    await expect(dice).toBeVisible()
    return dice
  }
  const master = await open(page)
  const player = await open(ana)

  // Él tira para todos: a ella le llega sin recargar
  await master.getByRole('textbox', { name: 'Tirada' }).fill('1d20+5 # Iniciativa')
  await master.getByRole('button', { name: 'Tirar' }).click()
  const forAna = player.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()
  await expect(forAna).toContainText('Iniciativa')
  await expect(forAna).toContainText(/Enrique|Ana/)

  // Ella tira «al máster»: a él le llega marcada, y a ella también
  await player.getByText('Al máster', { exact: true }).click()
  await player.getByRole('textbox', { name: 'Tirada' }).fill('1d20+7 # Sigilo')
  await player.getByRole('textbox', { name: 'Tirada' }).press('Enter')
  const forMaster = master.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()
  await expect(forMaster).toContainText('Sigilo')
  await expect(forMaster).toContainText('Al máster')
  await expect(player.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()).toContainText(
    'Tú'
  )

  // El desglose, al desplegar
  await forMaster.getByRole('button', { name: 'Desglose' }).click()
  await expect(forMaster).toContainText(/1d20\+7 → \[\d+\] \+ 7 = \d+/)

  const { violations } = await new AxeBuilder({ page })
    .include('[data-tour="ficha-dados"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([])
  await ana.close()
})

test('en el móvil, los dados en una hoja que sube desde abajo, desde el menú de la llama', async ({ page }) => {
  await campaignLink(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dados' }).click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  // Abajo del todo y de lado a lado, cuando acaba de subir
  await expect
    .poll(async () => {
      const box = await dice.boundingBox()
      return [Math.round((box?.y ?? 0) + (box?.height ?? 0)), Math.round(box?.width ?? 0)]
    })
    .toEqual([844, 390])
  await dice.getByRole('textbox', { name: 'Tirada' }).fill('2d6+3 # Daño')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  await expect(dice.getByRole('list', { name: 'Tiradas de la campaña' }).getByRole('listitem').last()).toContainText(
    'Daño'
  )
  // La tirada nueva entra con una animación (sube y aparece): el contraste se mide cuando acaba, no a medias
  await settled(page)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('[data-tour="ficha-dados"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious, `${colorScheme}: ${JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))}`).toEqual([])
  }
})

test('los dados 3D caen al tirar: la escena se carga aparte, solo la primera vez que se tira', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname)
  })
  const workers: string[] = []
  page.on('worker', (worker) => workers.push(new URL(worker.url()).pathname))
  await campaignLink(page)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
  const dice = page.getByRole('complementary', { name: 'Dados' })
  await expect(dice).toBeVisible()
  expect(scripts.some((path) => /\/scene-[^/]+\.js$/.test(path))).toBe(false)
  await dice.getByRole('textbox', { name: 'Tirada' }).fill('1d20+2d6+1d8 # Golpe')
  await dice.getByRole('button', { name: 'Tirar' }).click()
  await expect.poll(() => scripts.some((path) => /\/scene-[^/]+\.js$/.test(path))).toBe(true)
  // Al pararse, el total
  await expect(page.getByTestId('total-tirada')).toBeVisible({ timeout: 6000 })
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

  // Con la ficha de dados abierta, pulsarla tira en la campaña
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Dados' }).click()
  await body.getByRole('button', { name: 'Tirar 2d6+3 · Trampa' }).click()
  const log = page.getByRole('list', { name: 'Tiradas de la campaña' })
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
