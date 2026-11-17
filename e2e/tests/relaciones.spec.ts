import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { CON_DESENFOQUE } from '../sin-desenfoque.ts'
import { campaignLink, campaignPath, freshOwner, newPlayer } from './ayudas.ts'

// WCAG 2.1 AA: cero fallos críticos o graves (CONSTRAINTS.md)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

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
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.target.join(' ')).join(', ')})`)
}

function apiOf(page: Page) {
  return async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
}

const CHART = [
  '## Las casas en 1247',
  '',
  '```chart',
  'type: bar',
  'title: Poder de las casas',
  'labels: [Altamar, Varn, Kharum]',
  'series:',
  '  - title: "1240"',
  '    data: [70, 55, 40]',
  '```',
  ''
].join('\n')

/**
 * Un mundo como el del lienzo del módulo 10: Ilsa con sus padres, su pareja y su hija, su facción (con líder y otro
 * miembro), su lugar, una mención en su texto y otra desde un secreto; y una página con un gráfico
 */
async function seed(page: Page, worldId: string) {
  const api = apiOf(page)
  const created = await api('createPages', {
    worldId,
    parentId: null,
    pages: [
      {
        key: 'ilsa',
        title: 'Ilsa de Varn',
        markdown: 'Heredera tras la [[Guerra de las Brumas]].\n\n> [!secreto]\n> Escribe a [[La Mano Gris]].\n'
      },
      { key: 'aldren', title: 'Aldren IV' },
      { key: 'mirela', title: 'Mirela de Varn' },
      { key: 'corwen', title: 'Corwen Hale' },
      { key: 'lia', title: 'Lia de Varn' },
      { key: 'orden', title: 'La Orden del Alba' },
      { key: 'oriel', title: 'Oriel Vance' },
      { key: 'doran', title: 'Doran de Kharum' },
      { key: 'puerto', title: 'Puerto Ceniza' },
      { key: 'guerra', title: 'Guerra de las Brumas' },
      { key: 'mano', title: 'La Mano Gris' },
      { key: 'poder', title: 'Poder de las casas', markdown: CHART }
    ]
  })
  const id = Object.fromEntries((created.pages as { key: string; id: string }[]).map((p) => [p.key, p.id])) as Record<
    string,
    string
  >
  const pages = (name: string, value: string[], extra: object = {}) => ({ name, type: 'pages', value, ...extra })
  const set = (pageId: string | undefined, properties: object[]) => api('setPageProperties', { pageId, properties })
  await set(id.ilsa, [
    { name: 'Rol', type: 'text', value: 'Princesa de Altamar' },
    pages('Padres', [id.aldren ?? '', id.mirela ?? ''], { role: 'parent', inverseName: 'Hijos' }),
    pages('Pareja', [id.corwen ?? ''], { role: 'partner', inverseName: 'Pareja' }),
    pages('Facción', [id.orden ?? ''], { role: 'member-of', inverseName: 'Miembros', single: true }),
    pages('Lugar', [id.puerto ?? ''], { single: true })
  ])
  await set(id.lia, [pages('Padres', [id.ilsa ?? '', id.corwen ?? ''], { role: 'parent', inverseName: 'Hijos' })])
  await set(id.orden, [pages('Líder', [id.oriel ?? ''], { role: 'leads', inverseName: 'Dirige', single: true })])
  await set(id.oriel, [{ name: 'Rol', type: 'text', value: 'Gran Maestre' }])
  await set(id.doran, [
    pages('Facción', [id.orden ?? ''], { role: 'member-of', inverseName: 'Miembros', single: true })
  ])
  return id
}

test('relaciones (módulo 10): la pestaña en Familia, Enlaces y Organigrama, el grafo del mundo y un gráfico con su editor', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const worldId = (await apiOf(page)('createWorld', { name: 'Valdren' })).id as string
  const id = await seed(page, worldId)

  // La pestaña, tras las demás; se abre en Familia (tiene padres y pareja)
  await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}`)
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await tabs.getByRole('link', { name: 'Relaciones' }).click()
  const modes = page.getByRole('toolbar', { name: 'Modo' })
  await expect(modes.getByRole('button', { name: 'Familia' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Ilsa de Varn, Princesa de Altamar' })).toBeVisible()
  for (const name of ['Aldren IV', 'Mirela de Varn', 'Corwen Hale', 'Lia de Varn'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  // En Familia, el panel se pliega solo
  await expect(page.getByRole('button', { name: 'Desplegar el panel' })).toBeVisible()

  // Enlaces: con lo que menciona y, del secreto, discontinuo (el máster); «Solo campos» quita las menciones
  await modes.getByRole('button', { name: 'Enlaces' }).click()
  await expect(page.getByRole('button', { name: 'Guerra de las Brumas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'La Mano Gris' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Leyenda' })).toContainText('Desde un secreto')
  await page.getByRole('switch', { name: 'Solo campos' }).check()
  await expect(page.getByRole('button', { name: 'Guerra de las Brumas' })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Solo campos' }).uncheck()
  // Pulsar una página saca su ficha; «Centrar aquí» rehace el grafo desde ella
  await page.getByRole('button', { name: 'La Orden del Alba', exact: true }).click()
  const card = page.getByRole('region', { name: 'La Orden del Alba' })
  await expect(card).toContainText('Miembros')
  await card.getByRole('button', { name: 'Centrar aquí' }).click()
  await expect(page.getByRole('button', { name: 'Volver a Ilsa de Varn' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Doran de Kharum' })).toBeVisible()
  await page.getByRole('button', { name: 'Volver a Ilsa de Varn' }).click()
  // El modo se recuerda (sin plantilla, el de las páginas sin plantilla)
  await page.reload()
  await expect(page.getByRole('toolbar', { name: 'Modo' }).getByRole('button', { name: 'Enlaces' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  // El organigrama de la facción: quien la dirige y sus miembros (sin plantilla, como Ilsa: se abre en el modo elegido
  // para las páginas sin plantilla, Enlaces)
  await page.goto(`/mundos/${worldId}/wiki/${id.orden}?pestana=relaciones`)
  const orgModes = page.getByRole('toolbar', { name: 'Modo' })
  await expect(orgModes.getByRole('button', { name: 'Enlaces' })).toHaveAttribute('aria-pressed', 'true')
  await orgModes.getByRole('button', { name: 'Organigrama' }).click()
  await expect(page.getByRole('button', { name: 'Lo dirige, Oriel Vance, Gran Maestre' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Doran de Kharum/ })).toBeVisible()

  // El grafo del mundo, desde la cabecera del árbol; buscar una página la elige
  await page.getByRole('link', { name: 'Relaciones del mundo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Relaciones' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Buscar una página' }).fill('dora')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Doran de Kharum' })).toContainText('Facción')

  // Un gráfico escrito en Markdown se pinta; al elegirlo, su editor ocupa el panel
  await page.goto(`/mundos/${worldId}/wiki/${id.poder}`)
  await expect(page.getByRole('img', { name: 'Gráfico de Barras: 1240' })).toBeVisible()
  const editor = page.getByRole('region', { name: 'Gráfico' })
  // Con la máquina cargada, la página aún se estaba colocando (el foco va al título al llegar) y se llevaba la
  // elección: se pulsa el lápiz hasta que el editor sale
  await expect(async () => {
    if (!(await editor.isVisible()))
      await page.getByRole('button', { name: 'Editar el gráfico' }).click({ force: true, timeout: 2000 })
    await expect(editor).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20_000 })
  await editor.getByRole('button', { name: 'Tarta' }).click()
  await expect(page.getByRole('img', { name: 'Gráfico de Tarta: 1240' })).toBeVisible()
  await editor.getByRole('button', { name: 'Ver YAML' }).click()
  await expect(editor.getByRole('textbox', { name: 'YAML del gráfico' })).toHaveValue(/type: pie/)
  await editor.getByRole('button', { name: 'Cerrar el editor del gráfico' }).click()
  await expect(editor).toHaveCount(0)
  // Y vuelve a Markdown como un ```chart, con el tipo nuevo (lo guarda el texto en vivo, al poco)
  await expect
    .poll(async () => ((await apiOf(page)('readPage', { pageId: id.poder })) as { markdown: string }).markdown)
    .toMatch(/```chart\ntype: pie\ntitle: Poder de las casas\nlabels: \[Altamar, Varn, Kharum\]/)
})

test('la jugadora en el móvil: la pestaña con lo que conoce, en palabras y a pantalla entera al ampliar', async ({
  page,
  browser
}) => {
  test.slow()
  const link = await campaignLink(page)
  const [, , worldId = '', , campaignId = ''] = campaignPath(page).split('/')
  const id = await seed(page, worldId)
  const api = apiOf(page)
  for (const key of ['ilsa', 'aldren', 'corwen', 'lia', 'orden', 'guerra'])
    await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: id[key], known: true })

  const player = await newPlayer(browser, link)
  await player.setViewportSize({ width: 375, height: 812 })
  await player.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id.ilsa}?pestana=relaciones`)
  const modes = player.getByRole('group', { name: 'Modo' })
  await modes.getByRole('button', { name: 'Enlaces' }).click()
  const words = player.locator('dl[aria-label="En palabras"]')
  await expect(words.getByRole('button', { name: 'Aldren IV' })).toBeVisible()
  const main = player.getByRole('main')
  // Ni lo que no conoce, ni la mención desde el secreto
  for (const hidden of ['Mirela de Varn', 'Puerto Ceniza', 'La Mano Gris']) await expect(main).not.toContainText(hidden)
  const sideways = () => player.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(await sideways()).toBe(false)
  expect(await axe(player)).toEqual([])
  // A pantalla entera, la ficha de la elegida sube desde abajo
  await player.getByRole('button', { name: 'Ampliar' }).click()
  const wide = player.getByRole('dialog', { name: 'Relaciones de Ilsa de Varn' })
  await wide.getByRole('button', { name: 'Corwen Hale' }).click()
  await expect(wide.getByRole('region', { name: 'Corwen Hale' }).getByRole('button', { name: 'Abrir' })).toBeVisible()
  expect(await axe(player)).toEqual([])
  await wide.getByRole('button', { name: 'Cerrar' }).first().press('Escape')
  // La familia, en filas
  await modes.getByRole('button', { name: 'Familia' }).click()
  await expect(player.getByRole('region', { name: 'Padres' })).toContainText('Aldren IV')
  await expect(main).not.toContainText('Mirela de Varn')
  await player.close()
})

test.describe('con el cristal de verdad', () => {
  test.use({ storageState: CON_DESENFOQUE })

  test('la pestaña en sus tres modos, el grafo del mundo y el editor del gráfico, sin fallos graves de accesibilidad @a11y', async ({
    page
  }) => {
    test.slow()
    await freshOwner(page)
    const worldId = (await apiOf(page)('createWorld', { name: 'Valdren' })).id as string
    const id = await seed(page, worldId)
    await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}?pestana=relaciones`)
    const modes = page.getByRole('toolbar', { name: 'Modo' })
    await expect(modes).toBeVisible()
    expect(await axe(page)).toEqual([])
    await modes.getByRole('button', { name: 'Enlaces' }).click()
    await page.getByRole('button', { name: 'Aldren IV', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Aldren IV' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await modes.getByRole('button', { name: 'Organigrama' }).click()
    await expect(page.getByRole('button', { name: /^Lo dirige, Oriel Vance/ })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/relaciones`)
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/wiki/${id.poder}`)
    await page.getByRole('button', { name: 'Editar el gráfico' }).click({ force: true })
    await expect(page.getByRole('region', { name: 'Gráfico' })).toBeVisible()
    expect(await axe(page)).toEqual([])
  })
})
