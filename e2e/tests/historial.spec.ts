import { expect, type Page, test } from '@playwright/test'
import { campaignLink, closeWindow, openWindow, openWorld, rename, toWorlds } from './ayudas.ts'

test('el propietario ve en el historial lo que ha hecho, en el mundo y en toda la organización', async ({ page }) => {
  await campaignLink(page)
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  // Las campañas, en Mis mundos; el historial del mundo, dentro de él
  await toWorlds(page)
  await rename(page, 'campaña', 'La Marca', 'La Marca del Este')
  await openWorld(page, 'Eana')

  const history = await openWindow(page, 'Historial')
  await expect(history.getByRole('heading', { level: 1, name: 'Historial de Eana' })).toBeVisible()
  const entries = history.getByRole('list', { name: 'Operaciones' }).getByRole('listitem')
  // Al entrar en el mundo se creó su portada, con su texto de bienvenida
  await expect(entries).toHaveText([
    /^Enrique cambió la página «Eana»/,
    /^Enrique creó la portada del mundo, «Eana»/,
    /^Enrique renombró la campaña «La Marca» a «La Marca del Este».*· web/,
    /^Enrique generó un enlace nuevo para La Marca/,
    /^Enrique creó la campaña «La Marca» en Eana/,
    /^Enrique creó el mundo «Eana»/
  ])
  await closeWindow(history)

  await page.goto('/mundos')
  const all = await openWindow(page, 'Historial')
  await expect(all.getByRole('heading', { level: 1, name: 'Historial' })).toBeVisible()
  const allEntries = all.getByRole('list', { name: 'Operaciones' }).getByRole('listitem')
  await expect(allEntries).toHaveCount(9)
  await expect(allEntries.last()).toHaveText(/^Crisol creó la organización «Fateforge»/)
  await expect(allEntries.filter({ hasText: /^Enrique entró como propietario/ })).toHaveCount(1)
})

test('el máster deshace crear una campaña y lo rehace; si algo cambió después, se le dice qué', async ({ page }) => {
  await campaignLink(page)
  await toWorlds(page)
  let history = await openWindow(page, 'Historial')
  await history.getByRole('button', { name: 'Deshacer: creó la campaña «La Marca» en Eana' }).click()
  const entries = history.getByRole('list', { name: 'Operaciones' }).getByRole('listitem')
  await expect(entries.first()).toHaveText(/^Enrique deshizo: creó la campaña «La Marca» en Eana/)
  await closeWindow(history)
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  // Rehacer: deshacer el deshacer
  history = await openWindow(page, 'Historial')
  await history.getByRole('button', { name: 'Rehacer: creó la campaña «La Marca» en Eana' }).click()
  await expect(entries.first()).toHaveText(/^Enrique rehízo: creó la campaña «La Marca» en Eana/)
  await closeWindow(history)
  await expect(page.getByRole('link', { name: 'La Marca', exact: true })).toBeVisible()

  // Con un cambio posterior, el deshacer de la creación se niega y dice cuál
  await rename(page, 'campaña', 'La Marca', 'La Marca del Este')
  history = await openWindow(page, 'Historial')
  await history.getByRole('button', { name: 'Deshacer: creó la campaña «La Marca» en Eana' }).click()
  const conflict =
    'No se puede deshacer: después, Enrique renombró la campaña «La Marca» a «La Marca del Este». Deshaz eso antes.'
  await expect(history.getByText(conflict)).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(conflict)
})
