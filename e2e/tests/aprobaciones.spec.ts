import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { campaignLink, connectClaude } from './ayudas.ts'

type Overview = { worlds: Array<{ id: string; name: string; campaigns: Array<{ id: string; name: string }> }> }

/** Eana con La Marca, y Claude conectado: devuelve sus ids, el enlace y con qué llamar a Claude */
async function withClaude(page: Page) {
  const link = await campaignLink(page)
  const campaignPage = page.url()
  const claude = await connectClaude(page)
  const { worlds } = (await claude.call('listar_mundos')).structuredContent as Overview
  const world = worlds[0]
  const campaign = world?.campaigns[0]
  if (!world || !campaign) throw new Error('Falta Eana o La Marca')
  return { link, campaignPage, claude, worldId: world.id, campaignId: campaign.id }
}

test('Claude crea una campaña sin preguntar; regenerar el enlace aparece en la cola al momento y, aprobado, se hace', async ({
  page
}) => {
  const { link, campaignPage, claude, worldId, campaignId } = await withClaude(page)

  // En copiloto, crear no espera: la campaña sale en el mundo sin recargar
  await page.goto(`/mundos/${worldId}`)
  await expect(page.getByRole('link', { name: 'La Marca' })).toBeVisible()
  const created = await claude.call('crear_campana', { worldId, name: 'Los Cuervos' })
  expect(created.isError).toBeFalsy()
  await expect(page.getByRole('link', { name: 'Los Cuervos' })).toBeVisible()

  // Regenerar el enlace afecta a los jugadores: espera, y la petición aparece en menos de 2 s
  await page.goto(campaignPage)
  await expect(page.getByLabel('Enlace de invitación')).toHaveValue(link)
  const asked = claude.call('enlace_invitacion', { campaignId, change: 'regenerate' })
  const queue = page.getByRole('region', { name: 'Claude espera tu aprobación' })
  await expect(queue.getByText('Claude quiere generar un enlace nuevo para La Marca')).toBeVisible({ timeout: 2000 })
  await queue.getByText('Detalle').click()
  await expect(queue.getByText('Herramienta: enlace_invitacion')).toBeVisible()

  await queue.getByRole('button', { name: 'Aprobar: generar un enlace nuevo para La Marca' }).click()
  await expect(page.getByText('Hecho: generar un enlace nuevo para La Marca')).toBeVisible()
  const result = await asked
  const url = String(result.structuredContent?.url)
  expect(url).not.toBe(link)
  await expect(page.getByLabel('Enlace de invitación')).toHaveValue(url)
  await expect(queue.getByRole('heading')).toHaveCount(0)

  // En el historial, como hecho por Claude con su herramienta
  await page.goto('/historial')
  const history = page.getByRole('list', { name: 'Operaciones' })
  await expect(history.getByRole('listitem').first()).toContainText('generó un enlace nuevo para La Marca')
  await expect(history.getByRole('listitem').first()).toContainText('Claude (enlace_invitacion)')
})

test('rechazado, no se hace; en solo lectura, Claude ya no cambia nada', async ({ page }) => {
  const { claude, campaignId } = await withClaude(page)
  await page.goto('/mundos')

  const asked = claude.call('enlace_invitacion', { campaignId, change: 'close' })
  const queue = page.getByRole('region', { name: 'Claude espera tu aprobación' })
  await queue.getByRole('button', { name: 'Rechazar: cerrar las invitaciones de La Marca' }).click()
  await expect(page.getByText('Rechazado: cerrar las invitaciones de La Marca')).toBeVisible()
  const rejected = await asked
  expect(rejected.isError).toBe(true)
  expect(rejected.text).toMatch(/^REJECTED/)
  expect((await claude.call('enlace_invitacion', { campaignId })).structuredContent).toMatchObject({ open: true })

  await page.getByRole('link', { name: 'IA', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Últimas peticiones' })).toContainText(
    'Rechazado: cerrar las invitaciones de La Marca'
  )
  await page.getByRole('radio', { name: /^Solo lectura/ }).check()
  await expect(page.getByText('Guardado')).toBeVisible()
  const refused = await claude.call('crear_mundo', { name: 'Otro' })
  expect(refused.text).toMatch(/^READ_ONLY/)
  expect((await claude.call('listar_mundos')).structuredContent).toMatchObject({
    worlds: [expect.objectContaining({ name: 'Eana' })]
  })
})

test('la cola y los ajustes de IA, en los dos temas @a11y', async ({ page }) => {
  const { claude, campaignId } = await withClaude(page)
  const check = async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${colorScheme} ${v.id}: ${v.help}`)).toEqual([])
    }
  }
  await page.goto('/ia')
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes de IA' })).toBeVisible()
  const asked = claude.call('enlace_invitacion', { campaignId, change: 'regenerate' })
  const queue = page.getByRole('region', { name: 'Claude espera tu aprobación' })
  await queue.getByText('Detalle').click()
  await expect(queue.getByText('Herramienta: enlace_invitacion')).toBeVisible()
  await check()
  await queue.getByRole('button', { name: 'Rechazar: generar un enlace nuevo para La Marca' }).click()
  await asked
  await expect(page.getByRole('list', { name: 'Últimas peticiones' })).toBeVisible()
  await check()
})
