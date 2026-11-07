import { expect, test } from '@playwright/test'
import { createCampaign, createWorld, freshOwner, rename } from './ayudas.ts'

test('en Mis mundos, el máster crea campañas eligiendo su mundo, renombra una y siguen al recargar', async ({
  page
}) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await createWorld(page, 'Costa')
  await expect(page.getByText('Aún no hay campañas')).toBeVisible()

  await createCampaign(page, 'La Marca')
  await createCampaign(page, 'Las Islas', 'Costa')
  // Cada tarjeta por su nombre exacto: la fila de «Nueva campaña» lleva su cuadro, que al cerrarse aún lista
  // «Lo mismo que «Las Islas»» en su desplegable
  const cards = page.getByRole('list', { name: 'Campañas' }).getByRole('listitem')
  const card = (name: string) => cards.filter({ has: page.getByText(name, { exact: true }) })
  await expect(card('La Marca')).toContainText('Eana')
  await expect(card('Las Islas')).toContainText('Costa')

  await rename(page, 'campaña', 'La Marca', 'La Marca del Este')
  const list = page.getByRole('list', { name: 'Campañas' })
  await expect(list.getByText('La Marca del Este')).toBeVisible()

  await page.reload()
  await expect(list.getByText('La Marca del Este')).toBeVisible()
  await expect(list.getByText('Las Islas')).toBeVisible()
  await expect(list.getByText('Máster')).toHaveCount(2)
})
