import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { CON_DESENFOQUE } from '../sin-desenfoque.ts'
import { campaignLink, freshOwner, openAccountWindow } from './ayudas.ts'

test('la portada: la imagen, «Entrar», «Tengo una invitación» (pegar el enlace lleva a la campaña) y lo que hay dentro', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const context = await browser.newContext()
  const guest = await context.newPage()
  await guest.goto('/')
  await expect(guest.getByRole('heading', { level: 1, name: 'Crisol' })).toBeVisible()
  await expect(guest.getByRole('region', { name: 'Lo que hay dentro' }).getByRole('heading')).toHaveText([
    'El mundo',
    'La Mesa',
    'La ficha'
  ])
  await expect(guest.getByRole('link', { name: 'Entrar' }).last()).toHaveAttribute('href', '/entrar')
  const { violations } = await new AxeBuilder({ page: guest })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([])

  await guest.getByRole('button', { name: 'Tengo una invitación' }).click()
  const field = guest.getByRole('textbox', { name: 'El enlace de la invitación' })
  await expect(field).toBeFocused()
  // Lo que no es un enlace de invitación lo dice
  await field.fill('hola')
  await guest.getByRole('button', { name: 'Seguir' }).click()
  await expect(guest.getByRole('alert')).toHaveText('Ese enlace no es una invitación.')
  await field.fill(link)
  await guest.getByRole('button', { name: 'Seguir' }).click()
  await expect(guest).toHaveURL(new URL(link).pathname)
  await context.close()
})

test.describe('con el cristal', () => {
  // Esta mira el fondo de ambiente: empieza con él (las demás pruebas van sin desenfoque)
  test.use({ storageState: CON_DESENFOQUE })

  test('«Sin desenfoque» en Ajustes: sin fondo de ambiente, en este aparato y para la próxima vez', async ({
    page
  }) => {
    await freshOwner(page)
    await expect(page.locator('[data-ambiente]')).toBeAttached()
    const settings = await openAccountWindow(page, 'Ajustes')
    await settings.getByRole('checkbox', { name: 'Sin desenfoque' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-plain', '')
    await expect(page.locator('[data-ambiente]')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-plain', '')
    await expect(page.locator('[data-ambiente]')).toHaveCount(0)
  })
})
