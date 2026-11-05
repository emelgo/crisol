import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, newPlayer, settled } from './ayudas.ts'

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

const shot = (page: Page, name: string) =>
  page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: false })

test('una jugadora hace su personaje de 5e con el creador, lo termina y lo sube de nivel; el máster vuelve a una versión', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1] ?? ''
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: { campaignId, system: '5e', systemChoices: { sources: ['srd521'], duplicates: 'newest' } }
  })
  expect(chosen.status()).toBe(200)

  const player = await newPlayer(browser, link)
  const nav = player.getByRole('navigation', { name: 'Secciones' })
  await nav.getByRole('link', { name: 'Personajes' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'Personajes' })).toBeVisible()
  await player.getByRole('button', { name: 'Personaje nuevo' }).click()
  const dialog = player.getByRole('dialog', { name: 'Personaje nuevo' })
  await dialog.getByLabel('Nombre').fill('Thora')
  await dialog.getByRole('button', { name: 'Crear el personaje' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'Thora' })).toBeVisible()

  // La clase: elegir guerrero, y lo que hay que elegir sale marcado
  const steps = player.getByRole('navigation', { name: 'Pasos' })
  await expect(steps.getByRole('button', { name: /Clase/ })).toHaveAttribute('aria-current', 'step')
  await player.getByRole('button', { name: 'Guerrero', exact: true }).click()
  await expect(player.getByRole('heading', { level: 2, name: 'Guerrero' })).toBeVisible()
  await shot(player, 'creador-clase')
  // Las habilidades, en el panel de la derecha
  await player
    .getByRole('button', { name: /Habilidades/ })
    .first()
    .click()
  const panel = player.getByRole('complementary', { name: 'Habilidades' })
  await panel.getByLabel('Atletismo').check()
  await panel.getByLabel('Intimidación').check()
  await expect(panel).toContainText('2 de 2')
  await shot(player, 'creador-eleccion')
  await panel.getByRole('button', { name: 'Cerrar' }).click()

  // La especie y el trasfondo
  await steps.getByRole('button', { name: /Especie/ }).click()
  await player.getByRole('button', { name: 'Enano', exact: true }).click()
  await expect(player.getByRole('heading', { level: 2, name: 'Enano' })).toBeVisible()
  await steps.getByRole('button', { name: /Trasfondo/ }).click()
  await player.getByRole('button', { name: 'Acólito', exact: true }).click()
  await expect(player.getByRole('heading', { level: 2, name: 'Acólito' })).toBeVisible()

  // Las características, por la matriz estándar
  await steps.getByRole('button', { name: /Características/ }).click()
  const values: [string, string][] = [
    ['Fuerza', '15'],
    ['Destreza', '14'],
    ['Constitución', '13'],
    ['Inteligencia', '12'],
    ['Sabiduría', '10'],
    ['Carisma', '8']
  ]
  for (const [ability, value] of values) await player.getByLabel(ability).selectOption(value)
  await expect(player.getByRole('row', { name: /Fuerza/ })).toContainText('15')
  await shot(player, 'creador-caracteristicas')

  // Terminar: deja la versión «Creado · Nivel 1» y lleva a la ficha
  const finish = player.getByRole('button', { name: 'Terminar' })
  await expect(finish).toBeEnabled()
  await finish.click()
  await expect(player.getByText('Guardado')).toBeVisible()
  await player.getByRole('navigation', { name: 'Vistas del personaje' }).getByRole('button', { name: 'Ficha' }).click()
  const versions = player.getByRole('complementary', { name: 'Versiones' })
  await expect(versions).toContainText('Creado · Nivel 1')
  await shot(player, 'ficha')

  // Subir a nivel 2 y confirmarlo
  await player
    .getByRole('navigation', { name: 'Vistas del personaje' })
    .getByRole('button', { name: 'Creador' })
    .click()
  await steps.getByRole('button', { name: /Clase/ }).click()
  await player.getByLabel('Nivel', { exact: true }).selectOption('2')
  await player.getByRole('button', { name: 'Confirmar el nivel 2' }).click()
  await player.getByRole('navigation', { name: 'Vistas del personaje' }).getByRole('button', { name: 'Ficha' }).click()
  await expect(versions.getByRole('listitem').first()).toContainText('Nivel 2Actual')

  // El máster ve a Thora, y la vuelve a su versión de nivel 1
  const sections = page.getByRole('navigation', { name: 'Secciones' })
  await sections.getByRole('link', { name: 'Personajes' }).click()
  await expect(page.getByRole('link', { name: 'Thora' })).toBeVisible()
  await shot(page, 'personajes')
  await page.getByRole('link', { name: 'Thora' }).click()
  await page.getByRole('complementary', { name: 'Versiones' }).getByRole('button', { name: 'Restaurar' }).click()
  await page
    .getByRole('dialog', { name: /Restaurar/ })
    .getByRole('button', { name: 'Restaurar' })
    .click()
  await expect(page.getByRole('main')).toContainText('Guerrero 1')
  await accessible(page)
})
