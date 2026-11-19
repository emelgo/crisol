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

test('relaciones (módulo 10): el grafo en su ventana (del mundo y de una página), el árbol genealógico como pestaña y un gráfico con su editor', async ({
  page
}) => {
  test.slow()
  await freshOwner(page)
  const worldId = (await apiOf(page)('createWorld', { name: 'Valdren' })).id as string
  const id = await seed(page, worldId)

  // Sin pestaña «Relaciones»: la de antes vuelve al texto
  await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}?pestana=relaciones`)
  const tabs = page.getByRole('navigation', { name: 'Pestañas de la página' })
  await expect(tabs.getByRole('link', { name: 'Texto' })).toHaveAttribute('aria-current', 'page')
  await expect(tabs.getByRole('link', { name: 'Relaciones' })).toHaveCount(0)

  // El grafo del mundo, en su ventana desde la cabecera del árbol, sin cambiar de vista; buscar una página la elige
  await page.getByRole('button', { name: 'Relaciones del mundo' }).click()
  const world = page.getByRole('dialog', { name: 'Relaciones del mundo' })
  await expect(world.getByRole('complementary', { name: 'Filtros' })).toBeVisible()
  await expect(page).toHaveURL(/grafo=mundo/)
  await world.getByRole('combobox', { name: 'Buscar una página' }).fill('dora')
  await page.keyboard.press('Enter')
  await expect(world.getByRole('region', { name: 'Doran de Kharum' })).toContainText('Facción')
  // Escape: primero la ficha, luego la ventana; se sigue en la página
  await page.keyboard.press('Escape')
  await expect(world.getByRole('region', { name: 'Doran de Kharum' })).toHaveCount(0)
  await world.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(world).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/wiki/${id.ilsa}$`))

  // El de la página, desde «Mencionado en»: las directas, con lo que menciona el texto (y, del secreto, discontinuo)
  await page.getByRole('button', { name: 'Ver sus relaciones' }).click()
  const own = page.getByRole('dialog', { name: 'Relaciones de Ilsa de Varn' })
  await expect(own.getByRole('button', { name: 'Guerra de las Brumas' })).toBeVisible()
  await expect(own.getByRole('list', { name: 'Leyenda' })).toContainText('Desde un secreto')
  await own.getByRole('switch', { name: 'Con lo que menciona el texto' }).uncheck()
  await expect(own.getByRole('button', { name: 'Guerra de las Brumas' })).toHaveCount(0)
  await own.getByRole('switch', { name: 'Con lo que menciona el texto' }).check()
  // A dos pasos, los de su facción
  await expect(own.getByRole('button', { name: 'Doran de Kharum' })).toHaveCount(0)
  await own.getByRole('button', { name: 'a dos pasos' }).click()
  await expect(own.getByRole('button', { name: 'Doran de Kharum' })).toBeVisible()
  // «Centrar aquí» la rehace desde otra; Atrás la cierra
  await own.getByRole('button', { name: 'La Orden del Alba', exact: true }).click()
  await own.getByRole('region', { name: 'La Orden del Alba' }).getByRole('button', { name: 'Centrar aquí' }).click()
  await expect(page.getByRole('dialog', { name: 'Relaciones de La Orden del Alba' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // El árbol genealógico, como pestaña: desde los campos de la página…
  await tabs.getByRole('button', { name: 'Pestaña nueva' }).click()
  const create = page.getByRole('dialog', { name: 'Pestaña nueva' })
  await create.getByRole('radio', { name: 'Árbol genealógico' }).check()
  await create.getByRole('button', { name: 'Crear' }).click()
  await page.getByRole('button', { name: 'Empezar desde los campos' }).click()
  for (const name of ['Aldren IV', 'Mirela de Varn', 'Corwen Hale', 'Lia de Varn'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  // …y a mano: un abuelo sin página, desde la ficha de Aldren; luego, su página
  await page.getByRole('button', { name: 'Aldren IV', exact: true }).click()
  const card = page.getByRole('region', { name: 'Aldren IV' })
  await card.getByRole('button', { name: 'Padre o madre', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Padre o madre de Aldren IV' })
  await add.getByRole('combobox').fill('Aldren III')
  await add.getByRole('option', { name: 'Añadir «Aldren III» sin página' }).click()
  const grandpa = page.getByRole('region', { name: 'Aldren III' })
  await expect(grandpa).toContainText('Sin página')
  await expect(grandpa).toContainText('Padre o madre de Aldren IV')
  await grandpa.getByRole('button', { name: 'Crear página' }).click()
  await expect(grandpa.getByRole('button', { name: 'Abrir' })).toBeVisible()
  // Sus líneas cuentan como relaciones: Aldren III ya sale en el grafo de Aldren IV
  const relations = await apiOf(page)('getRelations', { pageId: id.aldren })
  expect(JSON.stringify(relations)).toContain('Aldren III')

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

test('la jugadora en el móvil: el árbol con lo que conoce y el grafo de su página en su ventana', async ({
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
  const tree = await api('createTree', {
    worldId,
    name: 'Familia',
    pageId: id.ilsa,
    nodes: [
      { id: 'ilsa', pageId: id.ilsa },
      { id: 'aldren', pageId: id.aldren },
      { id: 'mirela', pageId: id.mirela },
      { id: 'lia', pageId: id.lia },
      { id: 'abuela', name: 'Abuela Varn' }
    ],
    edges: [
      { from: 'abuela', to: 'aldren', type: 'parent' },
      { from: 'aldren', to: 'ilsa', type: 'parent' },
      { from: 'mirela', to: 'ilsa', type: 'parent' },
      { from: 'ilsa', to: 'lia', type: 'parent' }
    ]
  })

  const player = await newPlayer(browser, link)
  await player.setViewportSize({ width: 375, height: 812 })
  await player.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${id.ilsa}?pestana=${tree.tabId}`)
  for (const name of ['Aldren IV', 'Lia de Varn', 'Abuela Varn'])
    await expect(player.getByRole('button', { name, exact: true })).toBeVisible()
  const main = player.getByRole('main')
  // Ni lo que no conoce, ni editar
  await expect(main).not.toContainText('Mirela de Varn')
  await expect(player.getByRole('button', { name: 'Añadir' })).toHaveCount(0)
  const sideways = () => player.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(await sideways()).toBe(false)
  expect(await axe(player)).toEqual([])
  // El grafo de su página, desde «Mencionado en», con lo que conoce
  await player.getByRole('button', { name: 'Ver sus relaciones' }).click()
  const own = player.getByRole('dialog', { name: 'Relaciones de Ilsa de Varn' })
  await expect(own.getByRole('button', { name: 'Corwen Hale' })).toBeVisible()
  await expect(own).not.toContainText('Mirela de Varn')
  await expect(own).not.toContainText('La Mano Gris')
  expect(await axe(player)).toEqual([])
  await own.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(own).toBeHidden()
  await player.close()
})

test.describe('con el cristal de verdad', () => {
  test.use({ storageState: CON_DESENFOQUE })

  test('el árbol, el organigrama, el grafo en su ventana y el editor del gráfico, sin fallos graves de accesibilidad @a11y', async ({
    page
  }) => {
    test.slow()
    await freshOwner(page)
    const api = apiOf(page)
    const worldId = (await api('createWorld', { name: 'Valdren' })).id as string
    const id = await seed(page, worldId)
    const family = await api('createTree', {
      worldId,
      name: 'Familia',
      pageId: id.ilsa,
      nodes: [
        { id: 'ilsa', pageId: id.ilsa },
        { id: 'aldren', pageId: id.aldren },
        { id: 'abuela', name: 'Abuela Varn' }
      ],
      edges: [
        { from: 'abuela', to: 'aldren', type: 'parent' },
        { from: 'aldren', to: 'ilsa', type: 'parent' }
      ]
    })
    await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}?pestana=${family.tabId}`)
    await expect(page.getByRole('button', { name: 'Abuela Varn' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.getByRole('button', { name: 'Abuela Varn' }).click()
    await expect(page.getByRole('region', { name: 'Abuela Varn' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    const chart = await api('createTree', {
      worldId,
      name: 'Mando',
      pageId: id.orden,
      layout: 'org',
      nodes: [
        { id: 'orden', pageId: id.orden },
        { id: 'oriel', pageId: id.oriel },
        { id: 'doran', pageId: id.doran }
      ],
      edges: [
        { from: 'oriel', to: 'orden', type: 'leads' },
        { from: 'doran', to: 'orden', type: 'member' }
      ]
    })
    await page.goto(`/mundos/${worldId}/wiki/${id.orden}?pestana=${chart.tabId}`)
    await expect(page.getByRole('button', { name: /^Lo dirige, Oriel Vance/ })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}?grafo=mundo`)
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/wiki/${id.ilsa}?grafo=${id.ilsa}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Aldren IV', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Aldren IV' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.goto(`/mundos/${worldId}/wiki/${id.poder}`)
    await page.getByRole('button', { name: 'Editar el gráfico' }).click({ force: true })
    await expect(page.getByRole('region', { name: 'Gráfico' })).toBeVisible()
    expect(await axe(page)).toEqual([])
  })
})
