import { expect, test } from '@playwright/test'
import { campaignLink, import5e, newPlayer, openCompendiumWindow } from './ayudas.ts'

test('el compendio y la partida para los jugadores: dos goblins a la vista y un jefe oculto; el máster lo enseña, oculta las criaturas del compendio y revela una espada del mundo (docs/specs/compendio-jugadores.md)', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const systemId = await import5e(page)
  await api('updateCampaign', { campaignId, system: systemId })
  const ana = await newPlayer(browser, link, 'Ana')

  // Dos goblins a la vista (uno herido) y un jefe oculto
  const goblins = (await api('putInPlay', { campaignId, key: 'guerrero_goblin_2014', count: 2 })).creatures
  await api('playCreature', { creatureId: goblins[0].id, version: goblins[0].version, damage: 2 })
  await api('putInPlay', { campaignId, key: 'guerrero_goblin_2014', unique: true, name: 'Jefe', hidden: true })

  // La jugadora: los goblins con su estado en palabras; ni el jefe ni sus PG
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/en-juego`)
  const group = ana.getByRole('region', { name: 'Goblin', exact: true })
  await expect(group.getByRole('listitem').filter({ hasText: 'Goblin 1' })).toContainText('Con heridas')
  await expect(group.getByRole('listitem').filter({ hasText: 'Goblin 2' })).toContainText('Sin heridas')
  await expect(ana.getByText('Jefe')).toHaveCount(0)
  await expect(ana.getByRole('main')).not.toContainText('/ 7')
  await ana.screenshot({ path: test.info().outputPath('en-juego-jugadora.png'), fullPage: false })

  // El máster lo ve oculto y lo pone a la vista; a ella le aparece
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/en-juego`)
  const eye = page.getByRole('button', { name: 'Oculta a los jugadores: Jefe' })
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: test.info().outputPath('en-juego-master.png'), fullPage: false })
  await eye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'false')
  await expect(ana.getByRole('region', { name: 'Únicas' })).toContainText('Jefe')

  // En los ajustes del compendio oculta las criaturas; a ella se le van del compendio
  const compendium = await openCompendiumWindow(page, `/mundos/${worldId}/campanas/${campaignId}`)
  await compendium.getByRole('button', { name: 'Ajustes del compendio' }).click()
  const settings = page.getByRole('dialog', { name: 'Ajustes del compendio' })
  const creatures = settings.getByRole('switch', { name: 'Criaturas' })
  await creatures.click()
  await expect(creatures).toHaveAttribute('aria-checked', 'false')
  await page.screenshot({ path: test.info().outputPath('ajustes-compendio.png'), fullPage: false })
  await ana.goto(`/mundos/${worldId}/campanas/${campaignId}/compendio`)
  await expect(ana.getByRole('heading', { level: 1, name: 'Compendio' })).toBeVisible()
  await ana.getByRole('searchbox').fill('goblin')
  await expect(ana.getByRole('list', { name: 'Resultados' })).not.toContainText('Guerrero goblin')

  // Una espada del mundo: no la ve hasta que se la revela; entonces, marcada «Del mundo»
  await api('putWorldContent', {
    worldId,
    systemId,
    items: [
      {
        type: 'arma',
        key: 'espada_de_valdren',
        data: { name: { es: 'Espada de Valdren' }, categoria: 'marcial', dano: '1d8', tipo_dano: 'cortante' }
      }
    ]
  })
  await ana.getByRole('searchbox').fill('valdren')
  await expect(ana.getByRole('list', { name: 'Resultados' })).toContainText('Nada con ese nombre')
  await api('reveal', { worldId, campaignId, kind: 'content', targetId: 'espada_de_valdren' })
  // Le llega el aviso; «Leerlo» la abre en el compendio, marcada «Del mundo»
  const notice = ana.getByRole('region', { name: 'Lo nuevo' })
  await expect(notice).toContainText('Espada de Valdren')
  await notice.getByRole('link', { name: 'Leerlo' }).click()
  await expect(ana.getByRole('article', { name: 'Espada de Valdren' })).toBeVisible()
  await ana.getByRole('searchbox').fill('')
  await ana.getByRole('searchbox').fill('valdren')
  const hit = ana
    .getByRole('list', { name: 'Resultados' })
    .getByRole('listitem')
    .filter({ hasText: 'Espada de Valdren' })
  await expect(hit).toContainText('Del mundo')
  await ana.screenshot({ path: test.info().outputPath('compendio-jugadora.png'), fullPage: false })
})
