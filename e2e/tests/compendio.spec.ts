import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, campaignPath, import5e, newPlayer, openCompendiumWindow, settled, toMesa } from './ayudas.ts'

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

test('la campaña en su vista: la jugadora entra, abre el compendio, busca «fireball» y lee las dos versiones', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: {
      campaignId,
      system: await import5e(page),
      systemChoices: { sources: ['srd51', 'srd521'], duplicates: 'both' }
    }
  })
  expect(chosen.status()).toBe(200)

  // El máster, en su Mesa: el compendio en su barra; los dados, en el d20 flotante
  const path = campaignPath(page)
  await toMesa(page)
  await expect(
    page.getByRole('complementary', { name: 'Panel de la mesa' }).getByRole('tab', { name: 'Compendio' })
  ).toBeVisible()
  await expect(page.locator('[data-tour="dados"]')).toBeVisible()

  // La jugadora lo lee en su vista (también está en la barra de su Mesa)
  const player = await newPlayer(browser, link)
  const nav = player.getByRole('navigation', { name: 'Secciones' })
  await player.goto(`${path}/compendio`)
  await expect(player.getByRole('heading', { level: 1, name: 'Compendio' })).toBeVisible()
  await expect(player.getByText('5e · 2014 y 2024')).toBeVisible()
  await player.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('fireball')
  const list = player.getByRole('list', { name: 'Resultados' })
  // Primero lo que se llama así: la de 2024 y la de 2014
  // Cada una con su tipo, su libro y su página (ADR-0021)
  await expect(list.getByRole('button').nth(0)).toHaveText(/^Bola de fuegoConjuro · SRD 5\.2\.1, pág\. \d+2024$/)
  await expect(list.getByRole('button').nth(1)).toHaveText(
    /^Bola de fuegoConjuro · SRD 5\.1(, pág\. \d+)?2014 · Legado$/
  )
  await list.getByRole('button').first().click()
  const article = player.getByRole('article', { name: 'Bola de fuego' })
  await expect(article).toContainText('8d6')
  // Su mecánica, en palabras
  await expect(article.getByRole('region', { name: 'En juego' })).toContainText('8d6 (fuego)')
  const about = player.getByRole('complementary', { name: 'Sobre este documento' })
  await expect(about).toContainText('Fireball')
  await player.screenshot({ path: test.info().outputPath('compendio.png'), fullPage: false })
  await about.getByRole('button', { name: '2014 · Legado' }).click()
  await expect(player.getByRole('complementary', { name: 'Sobre este documento' })).toContainText('2014 · SRD 5.1')

  // Sin buscar, la biblioteca: por edición, sus secciones y sus carpetas (los conjuros, por nivel)
  await player.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('')
  const library = player.getByRole('navigation', { name: 'Biblioteca del compendio' })
  await library.getByRole('button', { name: /^2024/ }).click()
  await library.getByRole('button', { name: /^Conjuros/ }).click()
  await library.getByRole('button', { name: /^Nivel 3/ }).click()
  await expect(library.getByRole('button', { name: 'Bola de fuego' })).toBeVisible()
  // Sus filtros: los conjuros de mago, de evocación
  await library.getByRole('button', { name: 'Filtrar' }).first().click()
  await library.getByRole('combobox', { name: 'Clases' }).selectOption({ label: 'Mago' })
  await library.getByRole('combobox', { name: 'Escuela' }).selectOption({ label: 'Evocación' })
  await expect(library.getByRole('button', { name: 'Bola de fuego' })).toBeVisible()
  await expect(library.getByRole('button', { name: /^Filtrar \(2\)/ })).toBeVisible()
  await player.screenshot({ path: test.info().outputPath('compendio-filtros.png'), fullPage: false })
  await library.getByRole('button', { name: 'Quitar los filtros' }).click()
  await library.getByRole('button', { name: /^Criaturas/ }).click()
  await library.getByRole('button', { name: /^Dragón/ }).click()
  await player.screenshot({ path: test.info().outputPath('compendio-biblioteca.png'), fullPage: false })

  // Una clase, con lo que concede por nivel
  await library
    .getByRole('button', { name: /^Clases/ })
    .first()
    .click()
  await library
    .getByRole('button', { name: /^Clases/ })
    .nth(1)
    .click()
  await library.getByRole('button', { name: 'Bárbaro' }).click()
  await expect(player.getByRole('region', { name: 'Por nivel' })).toContainText('Furia')
  // Lo abierto va en la dirección: al recargar, sigue abierto
  await player.reload()
  await expect(player.getByRole('article', { name: 'Bárbaro' })).toBeVisible()
  await player.screenshot({ path: test.info().outputPath('compendio-clase.png'), fullPage: false })

  // Una tabla de su texto se tira en la campaña: la Bolsa de trucos gris
  await player.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('bolsa de trucos')
  await list.getByRole('button', { name: /^Bolsa de trucos.*2024/ }).click()
  const bag = player.getByRole('article', { name: 'Bolsa de trucos' })
  await bag.getByRole('button', { name: 'Tirar 1d8 en «Criatura»' }).first().click()
  await expect(bag.locator('td[class*="hit"]')).toHaveCount(2)
  await player.screenshot({ path: test.info().outputPath('compendio-tabla.png'), fullPage: false })

  // El máster también lo lee; axe, en claro y en oscuro
  const window = await openCompendiumWindow(page, path)
  await window.getByRole('searchbox', { name: 'Buscar en el compendio' }).fill('aboleth')
  await window.getByRole('list', { name: 'Resultados' }).getByRole('button').first().click()
  await expect(window.getByRole('article', { name: 'Aboleth' })).toContainText('CA 17')
  await accessible(page)
  await page.screenshot({ path: test.info().outputPath('compendio-criatura.png'), fullPage: false })

  // La llama vuelve a Mis mundos
  await nav.getByRole('link', { name: 'Crisol' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
})
