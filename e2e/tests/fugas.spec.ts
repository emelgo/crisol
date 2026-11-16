import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { E2E_PORT } from '../servidor.ts'
import {
  campaignLink,
  campaignPath,
  connectClaude,
  createCampaign,
  gotoLive,
  import5e,
  newPlayer,
  openCampaign,
  openWindow,
  rename,
  slash,
  toWorlds,
  watchNetwork
} from './ayudas.ts'

const BASE = `http://127.0.0.1:${E2E_PORT}`
const REDIRECT = 'https://cliente.example/callback'
const SECRET_CAMPAIGN = 'La Campaña Secreta'
const RENAMED_CAMPAIGN = 'El Secreto del Norte'

/** Todo lo que le llega a una página: respuestas de la API y mensajes del canal en tiempo real */
function capture(page: Page) {
  const pending: Array<Promise<string>> = []
  const frames: string[] = []
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/')) pending.push(response.text().catch(() => ''))
  })
  page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => frames.push(String(payload))))
  return {
    frames,
    all: async () => [...(await Promise.all(pending)), ...frames].join('\n')
  }
}

const secretOf = (link: string) => link.split('/unirse/')[1] ?? ''

test('@fugas una jugadora no recibe nada de lo que no puede ver: ni la campaña B, ni enlaces, ni historial', async ({
  page,
  browser
}) => {
  const firstLink = await campaignLink(page)
  const campaignA = campaignPath(page)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, firstLink, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen

  // El máster, mientras tanto: crea la campaña B, regenera los dos enlaces, cierra y abre las invitaciones y deshace
  await createCampaign(page, SECRET_CAMPAIGN)
  await openCampaign(page, SECRET_CAMPAIGN, 'campana')
  const campaignB = new URL(page.url()).pathname
  const idB = campaignB.split('/').at(-1) ?? ''
  const linkB = await page.getByLabel('Enlace de invitación').inputValue()
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await expect(page.getByLabel('Enlace de invitación')).not.toHaveValue(linkB)
  const newLinkB = await page.getByLabel('Enlace de invitación').inputValue()

  await page.goto(`${campaignA}?panel=ajustes`)
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await expect(page.getByLabel('Enlace de invitación')).not.toHaveValue(firstLink)
  const newLinkA = await page.getByLabel('Enlace de invitación').inputValue()
  // Cada cambio, guardado antes del siguiente (mientras se guarda uno, otro clic se ignora)
  const toggle = page.getByRole('checkbox', { name: 'Invitaciones abiertas' })
  const closing = page.waitForResponse('**/api/actions/setInvitationsOpen')
  await toggle.uncheck()
  await closing
  const opening = page.waitForResponse('**/api/actions/setInvitationsOpen')
  await toggle.check()
  await opening
  await toWorlds(page)
  await rename(page, 'campaña', SECRET_CAMPAIGN, RENAMED_CAMPAIGN)
  await expect(page.getByRole('link', { name: RENAMED_CAMPAIGN })).toBeVisible()
  // Y deshace el renombrado de B desde el historial
  const history = await openWindow(page, 'Historial')
  await history
    .getByRole('button', { name: `Deshacer: renombró la campaña «${SECRET_CAMPAIGN}» a «${RENAMED_CAMPAIGN}»` })
    .click()
  await expect(history.getByRole('list', { name: 'Operaciones' }).getByRole('listitem').first()).toHaveText(/deshizo/)
  await page.goto('/mundos')
  await rename(page, 'mundo', 'Eana', 'Eana (Fateforge)')

  // La jugadora recorre lo suyo y prueba lo ajeno
  await expect.poll(() => captured.frames.some((f) => f.includes('"worlds"'))).toBe(true)
  await player.goto('/mundos')
  await player.getByRole('link', { name: 'Eana (Fateforge)' }).click()
  await expect(player.getByRole('list', { name: 'Tus campañas' }).getByRole('listitem')).toHaveCount(1)
  await player.goto(campaignA)
  // Quién juega, en «La campaña», bajo su ficha
  await player.getByText(/^La campaña: /).click()
  await expect(player.getByRole('list', { name: 'Miembros' })).toBeVisible()
  await player.goto(campaignB)
  await expect(player.getByRole('heading', { name: 'Esta campaña no existe' })).toBeVisible()
  // Lo de B no existe para ella; lo de A que no le toca, se le prohíbe
  for (const [name, data, status] of [
    ['listMembers', { campaignId: idB }, 404],
    ['getInvitation', { campaignId: idB }, 404],
    ['getInvitation', { campaignId: campaignA.split('/').at(-1) }, 403],
    ['listHistory', { worldId: campaignA.split('/')[2] }, 403],
    // Sin organización propia no hay historial que darle
    ['listHistory', {}, 400]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(status)
  }

  const everything = await captured.all()
  expect(everything.length).toBeGreaterThan(0)
  for (const leak of [
    SECRET_CAMPAIGN,
    RENAMED_CAMPAIGN,
    idB,
    ...[firstLink, linkB, newLinkA, newLinkB].map(secretOf)
  ]) {
    expect(everything).not.toContain(leak)
  }
  // Ni rastro del historial
  for (const leak of ['createCampaign', 'regenerateInvitation', 'setInvitationsOpen', 'undoOperation', 'operationId']) {
    expect(everything).not.toContain(leak)
  }
  await player.close()
})

test('@fugas una jugadora conecta su IA (ADR-0017), y una cuenta sin campaña no: aunque fuerce el permiso, no se lo dan', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const created = await page.request.post('/api/auth/oauth2/create-client', {
    headers: { origin: BASE },
    data: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Claude de pruebas' }
  })
  const { client_id } = (await created.json()) as { client_id: string }
  const authorize = new URL('/api/auth/oauth2/authorize', BASE)
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT,
    scope: 'openid profile offline_access',
    state: 'estado',
    code_challenge: createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${BASE}/mcp`
  }).toString()
  const forceConsent = (who: Page) =>
    who.evaluate(async () => {
      const response = await fetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept: true, oauth_query: window.location.search.slice(1) })
      })
      return response.status
    })

  // La jugadora: se le ofrece y se le da (su IA solo lee lo que sabe su campaña: mcp.integration.test.ts)
  const player = await newPlayer(browser, link)
  await player.goto(authorize.toString())
  await expect(player.getByRole('button', { name: 'Permitir', exact: true })).toBeVisible()
  expect(await forceConsent(player)).toBe(200)
  await player.close()

  // Ella misma, fuera de la campaña: ya no
  const outsider = await newPlayer(browser, link, 'Fuera')
  const campaignId = new URL(outsider.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  expect((await outsider.request.post('/api/actions/leaveCampaign', { data: { campaignId } })).status()).toBe(200)
  await outsider.goto(authorize.toString())
  await expect(
    outsider.getByText('Esta cuenta aún no puede conectar una IA: entra antes en una campaña.')
  ).toBeVisible()
  await expect(outsider.getByRole('button', { name: 'Permitir', exact: true })).toHaveCount(0)
  expect(await forceConsent(outsider)).toBe(403)
  await outsider.close()
})

test('@fugas lo que pide la IA del máster solo le llega a él: la cola, sus avisos y lo que se hace al aprobarlo', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await createCampaign(page, SECRET_CAMPAIGN)
  await openCampaign(page, SECRET_CAMPAIGN, 'campana')
  const idB = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const linkB = await page.getByLabel('Enlace de invitación').inputValue()

  // Claude pide regenerar el enlace de B (el máster lo aprueba) y cerrar las invitaciones de A (lo rechaza)
  const claude = await connectClaude(page)
  await gotoLive(page, '/mundos')
  const queue = page.getByRole('region', { name: 'La IA espera tu aprobación' })
  const regenerate = claude.call('enlace_invitacion', { campaignId: idB, change: 'regenerate' })
  await queue.getByRole('button', { name: `Aprobar: generar un enlace nuevo para ${SECRET_CAMPAIGN}` }).click()
  const newLinkB = String((await regenerate).structuredContent?.url)
  const { worlds } = (await claude.call('listar_mundos')).structuredContent as {
    worlds: Array<{ campaigns: Array<{ id: string; name: string }> }>
  }
  const idA = worlds[0]?.campaigns.find((c) => c.name === 'La Marca')?.id
  const close = claude.call('enlace_invitacion', { campaignId: idA, change: 'close' })
  await queue.getByRole('button', { name: 'Rechazar: cerrar las invitaciones de La Marca' }).click()
  await close
  const approvals = (await (await page.request.post('/api/actions/listApprovals', { data: {} })).json()) as {
    recent: Array<{ id: string }>
  }

  // La jugadora: su cola está vacía y la del máster no existe para ella
  await player.goto('/mundos')
  await expect(player.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
  expect(await (await player.request.post('/api/actions/listApprovals', { data: {} })).json()).toEqual({
    pending: [],
    recent: []
  })
  for (const { id } of approvals.recent) {
    for (const name of ['approve', 'reject']) {
      const response = await player.request.post(`/api/actions/${name}`, { data: { approvalId: id } })
      expect(response.status(), name).toBe(404)
    }
  }

  const everything = await captured.all()
  expect(everything.length).toBeGreaterThan(0)
  for (const leak of [SECRET_CAMPAIGN, idB, secretOf(linkB), secretOf(newLinkB), 'enlace_invitacion', 'approvals']) {
    expect(everything).not.toContain(leak)
  }
  await player.close()
})

test('@fugas lo que su campaña no conoce de la wiki no le llega a la jugadora: ni sus páginas, ni su texto, ni sus avisos', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2]
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  // El máster, mientras tanto: crea, renombra y mueve páginas, y deshace
  const master = async (name: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const tower = await master('createPage', { worldId, title: 'La Torre Secreta' })
  const room = await master('createPage', { worldId, title: 'La Sala de los Mapas', parentId: tower.id })
  await master('updatePage', { pageId: tower.id, title: 'La Torre Escondida' })
  await master('movePage', { pageId: room.id, parentId: null })
  const [lastMove] = (await master('listHistory', { worldId })).entries
  await master('undoOperation', { operationId: lastMove.id })

  // Y escribe en el cuerpo de la página, que va por /api/collab
  await page.goto(`/mundos/${worldId}/wiki/${tower.id}`)
  const body = page.getByRole('textbox', { name: 'Texto de la página' })
  await body.click()
  await page.keyboard.type('El faro guarda el mapa de las corrientes.')
  await expect(body.getByText('El faro guarda el mapa de las corrientes.')).toBeVisible()
  // Y un secreto, que va en su propio documento
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await slash(page, 'Secreto')
  await page.getByRole('textbox', { name: 'Texto del secreto' }).click()
  await page.keyboard.type('La Hermandad paga a los guardias.')
  await page.waitForTimeout(2500)

  // Las listas, vacías: su campaña no conoce nada (ADR-0017). La plantilla, una de la cuenta (no hay de serie)
  const pnj = await (await page.request.post('/api/actions/createTemplate', { data: { name: 'PNJ' } })).json()
  for (const [name, data] of [
    ['listPageChildren', { worldId }],
    ['listPageTree', { worldId }],
    ['listRecentPages', { worldId }],
    ['searchWiki', { worldId, query: 'torre' }],
    ['searchWiki', { worldId, template: pnj.id }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
  }
  for (const [name, data] of [
    ['getPage', { pageId: tower.id }],
    ['createPage', { worldId, title: 'Mía' }],
    ['movePage', { pageId: room.id, parentId: null }],
    ['readPage', { pageId: tower.id }],
    ['editPage', { pageId: tower.id, body: { mode: 'append', markdown: 'Mía' } }],
    ['createPages', { worldId, parentId: null, pages: [{ key: 'a', title: 'Mía' }] }],
    ['listPageNames', { worldId }],
    ['getPageLinks', { pageId: tower.id }],
    ['listUnresolvedLinks', { worldId }],
    ['linkMention', { sourcePageId: tower.id, targetPageId: room.id }],
    ['getPageContent', { pageId: tower.id }],
    ['getPageContent', { pageId: tower.id, preview: true }],
    ['listPageVersions', { pageId: tower.id }],
    ['getPageTables', { pageId: tower.id }],
    ['getPageKnowledge', { pageId: tower.id }],
    ['listKnownPages', { worldId }],
    ['listPageTabs', { pageId: tower.id }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(404)
  }
  // Ni las plantillas de la cuenta (ADR-0009), ni su aviso
  const own = await page.request.post('/api/actions/createTemplate', { data: { name: 'La Plantilla Secreta' } })
  expect(own.status()).toBe(200)
  for (const [name, data] of [
    ['listTemplates', {}],
    ['getTemplate', { templateId: (await own.json()).id }],
    ['createTemplate', { name: 'Mía' }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBeGreaterThanOrEqual(400)
    expect(await response.text(), name).not.toContain('La Plantilla Secreta')
  }
  // Ni exportar: ni la wiki ni una página
  for (const data of [{ worldId }, { worldId, pageId: tower.id, children: true }]) {
    const response = await player.request.post('/api/export', { data })
    expect(response.status(), JSON.stringify(data)).toBe(404)
    expect(await response.text()).not.toContain('Torre')
  }

  const everything = await captured.all()
  expect(everything.length).toBeGreaterThan(0)
  for (const leak of [
    'La Torre Secreta',
    'La Torre Escondida',
    'La Sala de los Mapas',
    'mapa de las corrientes',
    'paga a los guardias',
    'La Plantilla Secreta',
    tower.id,
    room.id,
    '"pageContent"'
  ]) {
    expect(everything).not.toContain(leak)
  }
  await player.close()
})

test('@fugas lo que su campaña sabe, sin lo demás: ni secretos sin revelar, ni notas, ni campos ocultos, ni lo de otros (ADR-0017)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)
  const master = async (name: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  // Un personaje suyo y otro del máster en la campaña (con un sistema, para poder hacerlos)
  const systemId = await import5e(page)
  await master('updateCampaign', { campaignId, system: systemId })
  const mine = (
    await (await player.request.post('/api/actions/createCharacter', { data: { campaignId, name: 'Lía' } })).json()
  ).character.id
  const other = (await master('createCharacter', { campaignId, name: 'Bram' })).character.id
  // Aldoria (conocida) con secretos, una nota y un campo oculto; El plan del rey, debajo, nace oculto
  const created = await master('createPages', {
    worldId,
    parentId: null,
    pages: [
      {
        key: 'a',
        title: 'Aldoria',
        markdown: [
          'Un reino antiguo, aliado de [[La Liga Escondida|unos amigos]].',
          '',
          '> [!secreto]',
          '> El rey ha muerto.',
          '',
          '> [!secreto]',
          '> Bram es el heredero.',
          '',
          '%%El máster duda del final%%'
        ].join('\n')
      },
      { key: 'l', title: 'La Liga Escondida' }
    ]
  })
  const aldoria = created.pages.find((p: { title: string }) => p.title === 'Aldoria').id
  const liga = created.pages.find((p: { title: string }) => p.title === 'La Liga Escondida').id
  const full = await master('getPage', { pageId: aldoria })
  await master('setPageProperties', {
    pageId: aldoria,
    properties: [...full.properties, { name: 'Traidor', type: 'text', value: 'El Canciller Gris', hidden: true }]
  })
  await master('setPagePanel', {
    pageId: aldoria,
    blocks: [{ id: 'abcdefgh', type: 'text', title: 'Plan', text: 'Invadir el paso del norte', hidden: true }]
  })
  await master('setKnowledge', { worldId, campaignId, kind: 'page', targetId: aldoria, known: true })
  const plan = await master('createPage', { worldId, title: 'El plan del rey', parentId: aldoria })
  // Un secreto revelado en partida a Bram (no a Lía), con su aviso; el otro, sin revelar
  const { blocks } = await master('getPageContent', { pageId: aldoria })
  const secrets = (blocks as { type: string; attrs?: { documentId?: string } }[]).filter((b) => b.type === 'secret')
  await master('reveal', {
    worldId,
    campaignId,
    kind: 'secret',
    targetId: secrets[1]?.attrs?.documentId,
    characters: [other]
  })
  // Lo que lee la jugadora, por todas las vías
  for (const [name, data] of [
    ['listPageTree', { worldId, levels: 6 }],
    ['listPageChildren', { worldId, parentId: null }],
    ['listRecentPages', { worldId, limit: 20 }],
    ['getPage', { pageId: aldoria }],
    ['getPageContent', { pageId: aldoria }],
    ['getPageContent', { pageId: aldoria, preview: true }],
    ['readPage', { pageId: aldoria, ids: true }],
    ['getPageLinks', { pageId: aldoria }],
    ['getPageTables', { pageId: aldoria }],
    ['listPageTabs', { pageId: aldoria }],
    ['searchWiki', { worldId, query: 'rey' }],
    ['searchWiki', { worldId, query: 'Canciller' }],
    ['searchWiki', { worldId, query: 'heredero' }],
    ['searchWiki', { worldId, query: 'Liga' }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
  }
  for (const pageId of [plan.id, liga]) {
    expect((await player.request.post('/api/actions/getPage', { data: { pageId } })).status()).toBe(404)
  }
  // Y en la web, la página
  await player.goto(`/mundos/${worldId}/campanas/${campaignId}/paginas/${aldoria}`)
  await expect(player.getByRole('heading', { level: 1, name: 'Aldoria' })).toBeVisible()
  await expect(player.getByRole('main')).toContainText('Un reino antiguo')
  // El máster escribe en la página oculta: a ella no le llega
  await master('editPage', { pageId: plan.id, body: { mode: 'append', markdown: 'Quemar el puerto' } })
  // Lía no ve lo de Bram; como Bram, el máster sí
  const asBram = await master('getPageContent', { pageId: aldoria, campaignId, asCharacterId: other })
  expect(JSON.stringify(asBram.blocks)).toContain('Bram es el heredero')
  expect(mine).toBeTruthy()

  const everything = await captured.all()
  expect(everything).toContain('Un reino antiguo')
  for (const leak of [
    'El rey ha muerto',
    'Bram es el heredero',
    'El máster duda',
    'El Canciller Gris',
    'Traidor',
    'Invadir el paso',
    'El plan del rey',
    'Quemar el puerto',
    'La Liga Escondida',
    plan.id,
    liga,
    // El aviso de lo revelado a Bram es solo para su dueño
    '"revealed"',
    secrets[1]?.attrs?.documentId ?? 'sin-secreto'
  ]) {
    expect(everything, leak).not.toContain(leak)
  }
  await player.close()
})

test('@fugas los archivos son de la wiki: la jugadora ni los ve, ni los baja, ni sube, ni sabe que cambian', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2]
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  // El máster sube, renombra y reemplaza un archivo
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('mapa')])
  const raw = { 'content-type': 'application/octet-stream' }
  const uploaded = await page.request.post(
    `/api/files?worldId=${worldId}&name=${encodeURIComponent('Mapa del Tesoro.png')}`,
    {
      data: png,
      headers: raw
    }
  )
  expect(uploaded.status()).toBe(201)
  const file = await uploaded.json()
  await page.request.post('/api/actions/renameFile', { data: { fileId: file.id, name: 'Mapa Escondido.png' } })
  expect((await page.request.put(`/api/files/${file.id}`, { data: png, headers: raw })).status()).toBe(200)

  expect((await player.request.get(`/api/files/${file.id}`)).status()).toBe(404)
  expect((await player.request.put(`/api/files/${file.id}`, { data: png, headers: raw })).status()).toBe(404)
  expect(
    (await player.request.post(`/api/files?worldId=${worldId}&name=Mio.png`, { data: png, headers: raw })).status()
  ).toBe(404)
  for (const [name, data] of [
    ['listFiles', { worldId }],
    ['renameFile', { fileId: file.id, name: 'Mío.png' }],
    ['deleteFile', { fileId: file.id }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(404)
  }

  const everything = await captured.all()
  for (const leak of ['Mapa del Tesoro', 'Mapa Escondido', file.id, '"files"']) expect(everything).not.toContain(leak)
  await player.close()
})

test('@fugas las tiradas privadas solo le llegan a quien tira y al máster (ADR-0010)', async ({ page, browser }) => {
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/')[4] ?? ''
  const ana = await newPlayer(browser, link, 'Ana')
  let seen: ReturnType<typeof capture> | undefined
  const bruno = await newPlayer(browser, link, 'Bruno', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  const roll = async (who: typeof page, formula: string, visibility: string) => {
    const response = await who.request.post('/api/actions/rollDice', { data: { campaignId, formula, visibility } })
    expect(response.status(), formula).toBe(200)
  }
  await roll(page, '1d20 # Iniciativa de todos', 'all')
  await roll(ana, '1d20+7 # Sigilo de Ana', 'master')
  await roll(ana, '1d20 # Corazonada de Ana', 'self')
  await roll(page, '1d20+2 # Emboscada del máster', 'hidden')
  // Y lo que tira su IA (por el MCP), oculta por defecto
  const claude = await connectClaude(page)
  const ai = await claude.call('tirar_dados', { campaignId, formula: '1d8 # Encuentro de la IA' })
  expect(ai.isError, ai.text).toBeFalsy()
  // La pública le llega en vivo; después lee el registro
  await expect.poll(() => captured.frames.some((f) => f.includes('Iniciativa de todos'))).toBe(true)
  const read = await bruno.request.post('/api/actions/listRolls', { data: { campaignId } })
  expect(read.status()).toBe(200)
  // Ni puede tirar en oculto
  const hidden = await bruno.request.post('/api/actions/rollDice', {
    data: { campaignId, formula: '1d20 # Oculta de Bruno', visibility: 'hidden' }
  })
  expect(hidden.status()).toBe(400)

  const everything = await captured.all()
  expect(everything).toContain('Iniciativa de todos')
  for (const leak of ['Sigilo de Ana', 'Corazonada de Ana', 'Emboscada del máster', 'Encuentro de la IA']) {
    expect(everything).not.toContain(leak)
  }
  // Ana ve las suyas, pero no la oculta del máster
  const forAna = await (await ana.request.post('/api/actions/listRolls', { data: { campaignId } })).text()
  expect(forAna).toContain('Sigilo de Ana')
  expect(forAna).toContain('Corazonada de Ana')
  expect(forAna).not.toContain('Emboscada del máster')
  await ana.close()
  await bruno.close()
})

test('@fugas los sistemas de reglas son de la cuenta: la jugadora ni los ve ni sabe que cambian (ADR-0011)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  // El máster hace un sistema y lo cambia
  const { organizations } = await (await page.request.post('/api/actions/listOrganizations', { data: {} })).json()
  const organizationId = organizations[0].id as string
  const created = await (
    await page.request.post('/api/actions/createSystem', { data: { name: 'Sistema Secreto' } })
  ).json()
  const changed = await page.request.post('/api/actions/updateSystem', {
    data: { systemId: created.id, version: 1, name: 'Reglas Escondidas' }
  })
  expect(changed.status()).toBe(200)
  // Y su IA, por el MCP: crea uno con su documento, lo cambia por rutas y lo prueba
  const claude = await connectClaude(page)
  const document = {
    format: 1,
    id: 'x',
    name: 'Sistema de la IA',
    version: '1',
    languages: ['es'],
    types: {
      personaje: {
        document: 'actor',
        label: 'Personaje',
        fields: { vigor: { kind: 'number', label: 'Vigor', help: 'Ayuda que solo ve el máster' } }
      }
    },
    rolls: { atributo: { label: 'Atributo', formula: '2d6 + @vigor' } }
  }
  const made = await claude.call('crear_sistema', { document })
  expect(made.isError, made.text).toBeFalsy()
  const madeId = (made.structuredContent as { id: string }).id
  const edited = await claude.call('cambiar_sistema', {
    systemId: madeId,
    version: 1,
    changes: [{ path: 'types.personaje.fields.vigor.label', value: 'Vigor oculto' }]
  })
  expect(edited.isError, edited.text).toBeFalsy()
  const tried = await claude.call('probar_tirada', { systemId: madeId, roll: 'atributo' })
  expect(tried.isError, tried.text).toBeFalsy()
  // Su contenido, con un nombre que el jugador no debe ver
  const saved = await claude.call('guardar_contenido', {
    systemId: madeId,
    version: 2,
    items: [{ type: 'personaje', key: 'amuleto_secreto', source: null, data: { name: 'Amuleto Secreto de la IA' } }]
  })
  expect(saved.isError, saved.text).toBeFalsy()

  for (const [name, data] of [
    ['listSystems', { organizationId }],
    ['getSystem', { systemId: madeId, organizationId }],
    ['getSystemParts', { systemId: madeId, parts: ['types'], organizationId }],
    ['tryFormula', { systemId: madeId, type: 'personaje', formula: '@vigor', organizationId }],
    ['trySystemRoll', { systemId: madeId, roll: 'atributo', organizationId }],
    ['searchSystemContent', { systemId: madeId, organizationId }],
    ['getSystemContent', { systemId: madeId, keys: ['amuleto_secreto'], organizationId }],
    ['trySystemAction', { systemId: madeId, item: null, action: 'x', organizationId }],
    [
      'putSystemContent',
      { systemId: madeId, version: 3, items: [{ type: 'objeto', key: 'x', source: null, data: { name: 'X' } }] }
    ],
    ['deleteSystemContent', { systemId: madeId, version: 3, keys: ['amuleto_secreto'] }],
    ['getSystem', { systemId: created.id, organizationId }],
    ['updateSystem', { systemId: created.id, version: 2, name: 'Mío' }],
    ['deleteSystem', { systemId: created.id }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(404)
  }

  const everything = await captured.all()
  for (const leak of [
    'Sistema Secreto',
    'Reglas Escondidas',
    created.id,
    '"systems"',
    'Sistema de la IA',
    'Vigor oculto',
    'Amuleto Secreto de la IA',
    'Ayuda que solo ve el máster',
    madeId
  ])
    expect(everything).not.toContain(leak)
  await player.close()
})

test('@fugas los personajes de otro y las tablas del máster: la jugadora no los ve, ni sus tiradas ocultas', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const chosen = await page.request.post('/api/actions/updateCampaign', {
    data: { campaignId, system: await import5e(page), systemChoices: { sources: ['srd521'], duplicates: 'newest' } }
  })
  expect(chosen.status()).toBe(200)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)
  const bruno = await newPlayer(browser, link, 'Bruno')

  // Bruno hace su personaje, lo termina y lo sube
  const mine = await (
    await bruno.request.post('/api/actions/createCharacter', {
      data: { campaignId, name: 'Personaje Secreto de Bruno' }
    })
  ).json()
  const build = {
    scores: { method: 'matriz', base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } },
    picks: [
      { id: 'c1', step: 'clase', key: 'guerrero_2024', level: 1 },
      { id: 'e1', step: 'especie', key: 'enano_2024' },
      { id: 't1', step: 'trasfondo', key: 'acolito_2024' }
    ],
    values: { notas: 'Notas privadas de Bruno' }
  }
  const done = await bruno.request.post('/api/actions/updateCharacter', {
    data: { characterId: mine.character.id, version: 1, build, confirm: 'created' }
  })
  expect(done.status(), await done.text()).toBe(200)
  const version = (await done.json()).character.version as number
  const { versions } = await (
    await bruno.request.post('/api/actions/listCharacterVersions', { data: { characterId: mine.character.id } })
  ).json()

  // El máster: una tabla con una fila secreta, tirada en oculto en la campaña
  const secretPage = await (
    await page.request.post('/api/actions/createPage', { data: { worldId, title: 'Tablas del máster' } })
  ).json()
  const tab = await (
    await page.request.post('/api/actions/createPageTab', {
      data: { pageId: secretPage.id, kind: 'table', name: 'Tabla Secreta' }
    })
  ).json()
  await page.request.post('/api/actions/updateRandomTable', {
    data: { tabId: tab.id, version: 1, rows: [{ id: 'f1', from: 1, to: 1, text: 'Fila Secreta del máster' }] }
  })
  const hidden = await page.request.post('/api/actions/rollOnTable', {
    data: { tabId: tab.id, campaignId, visibility: 'hidden' }
  })
  expect(hidden.status()).toBe(200)

  // La jugadora: su lista no lo trae, y nada de él ni de la tabla responde
  const listed = await (await player.request.post('/api/actions/listCharacters', { data: { campaignId } })).json()
  expect(listed.characters).toEqual([])
  const characterId = mine.character.id as string
  for (const [name, data] of [
    ['getCharacter', { characterId }],
    ['updateCharacter', { characterId, version, name: 'Mío' }],
    ['chooseForCharacter', { characterId, version, values: { notas: 'mías' } }],
    ['listCharacterVersions', { characterId }],
    ['restoreCharacterVersion', { characterId, versionId: versions[0].id, version }],
    ['deleteCharacter', { characterId }],
    ['getRandomTable', { tabId: tab.id }],
    ['updateRandomTable', { tabId: tab.id, version: 2, rows: [] }],
    ['rollOnTable', { tabId: tab.id, campaignId }],
    ['resetTableDraws', { tabId: tab.id, campaignId }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(404)
  }
  // Su registro de tiradas no trae la oculta del máster
  await player.request.post('/api/actions/listRolls', { data: { campaignId } })

  const everything = await captured.all()
  for (const leak of [
    'Personaje Secreto de Bruno',
    'Notas privadas de Bruno',
    characterId,
    'Tabla Secreta',
    'Fila Secreta del máster',
    tab.id
  ])
    expect(everything).not.toContain(leak)
  await bruno.close()
  await player.close()
})

test('@fugas el compendio del mundo es del máster: la jugadora ni lo ve ni sabe que cambia (compendio-mundo)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const systemId = await import5e(page)
  const chosen = await page.request.post('/api/actions/updateCampaign', { data: { campaignId, system: systemId } })
  expect(chosen.status()).toBe(200)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  // El máster guarda algo propio del mundo y copia del sistema
  const saved = await page.request.post('/api/actions/putWorldContent', {
    data: {
      worldId,
      systemId,
      items: [{ type: 'arma', key: 'hoja_secreta', data: { name: { es: 'Hoja Secreta del Valle' } } }]
    }
  })
  expect(saved.status()).toBe(200)
  const copied = await page.request.post('/api/actions/copyContent', {
    data: { worldId, systemId, key: 'guerrero_goblin_2014', to: 'world', name: 'Jefe Escondido' }
  })
  expect(copied.status()).toBe(200)
  const copyKey = (await copied.json()).key as string

  // Lo que lee la campaña no lo trae; lo que lo cambia, para ella no existe
  const compendium = await (
    await player.request.post('/api/actions/getCampaignCompendium', { data: { campaignId } })
  ).json()
  expect(compendium.world).toBeNull()
  const search = await player.request.post('/api/actions/searchCampaignContent', {
    data: { campaignId, query: 'secreta' }
  })
  expect((await search.json()).items).toEqual([])
  const read = await player.request.post('/api/actions/getCampaignContent', {
    data: { campaignId, keys: ['hoja_secreta', copyKey] }
  })
  expect((await read.json()).items).toEqual([])
  for (const [name, data] of [
    ['putWorldContent', { worldId, systemId, items: [{ type: 'arma', key: 'x', data: { name: 'X' } }] }],
    ['deleteWorldContent', { worldId, systemId, keys: ['hoja_secreta'] }],
    ['copyContent', { worldId, systemId, key: 'guerrero_goblin_2014', to: 'world' }],
    ['getContentOrigin', { worldId, systemId, key: copyKey }],
    ['pullContentOrigin', { worldId, systemId, key: copyKey, version: 1, fingerprint: 'x', fields: [] }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(404)
  }

  // Ni por su personaje: no puede ponerle algo del mundo aunque sepa su clave
  const created = await player.request.post('/api/actions/createCharacter', { data: { campaignId, name: 'Curiosa' } })
  const characterId = (await created.json()).character.id as string
  const sneaked = await player.request.post('/api/actions/updateCharacter', {
    data: { characterId, version: 1, play: { items: [{ id: 'x', key: 'hoja_secreta' }] } }
  })
  expect(sneaked.status()).toBe(400)
  expect(await sneaked.text()).not.toContain('Hoja Secreta del Valle')

  const everything = await captured.all()
  for (const leak of ['Hoja Secreta del Valle', 'Jefe Escondido', 'hoja_secreta', copyKey, '"worldContent"'])
    expect(everything).not.toContain(leak)
  await player.close()
})

test('@fugas las criaturas en juego: la jugadora solo ve las que están a la vista, sin sus números; ni el compendio del mundo sin revelar ni los tipos ocultos (compendio-jugadores)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const systemId = await import5e(page)
  const chosen = await page.request.post('/api/actions/updateCampaign', { data: { campaignId, system: systemId } })
  expect(chosen.status()).toBe(200)
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await expect.poll(() => captured.frames.some((f) => f.includes('"hello"'))).toBe(true)

  // El máster pone en juego un goblin a la vista y un jefe oculto con un nombre secreto, les hace daño y tira (oculta)
  const goblin = (
    await (
      await page.request.post('/api/actions/putInPlay', { data: { campaignId, key: 'guerrero_goblin_2014' } })
    ).json()
  ).creatures[0]
  const put = await page.request.post('/api/actions/putInPlay', {
    data: { campaignId, key: 'guerrero_goblin_2014', unique: true, name: 'Señor Oculto', hidden: true }
  })
  expect(put.status()).toBe(200)
  const [boss] = (await put.json()).creatures
  await page.request.post('/api/actions/playCreature', { data: { creatureId: boss.id, version: 1, damage: 2 } })
  await page.request.post('/api/actions/playCreature', { data: { creatureId: goblin.id, version: 1, damage: 2 } })
  const rolled = await page.request.post('/api/actions/rollForCreature', {
    data: { creatureId: boss.id, action: { item: null, key: 'cimitarra', part: 'damage' } }
  })
  const rollId = (await rolled.json()).roll.id as string

  // Lo que ve: el goblin, con su estado en palabras; ni el jefe ni ningún número
  const visible = await player.request.post('/api/actions/listVisibleInPlay', { data: { campaignId } })
  expect(visible.status()).toBe(200)
  const shown = await visible.text()
  expect(shown).toContain('Goblin 1')
  expect(shown).toContain('"hurt"')
  for (const leak of ['Señor Oculto', boss.id, '"life"', '"stats"', '"play"', '"version"'])
    expect(shown).not.toContain(leak)

  for (const [name, data] of [
    ['listInPlay', { campaignId }],
    ['getInPlay', { creatureId: boss.id }],
    ['getInPlay', { creatureId: goblin.id }],
    ['putInPlay', { campaignId, key: 'guerrero_goblin_2014' }],
    ['playCreature', { creatureId: boss.id, version: 2, damage: 1 }],
    ['setCreatureHidden', { creatureId: boss.id, hidden: false }],
    ['rollForCreature', { creatureId: boss.id, action: { item: null, key: 'cimitarra', part: 'attack' } }],
    ['applyRoll', { campaignId, rollId, targets: [{ creatureId: boss.id, multiplier: 1 }] }],
    ['removeFromPlay', { campaignId, creatureIds: [boss.id] }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect([403, 404], name).toContain(response.status())
    expect(await response.text()).not.toContain('Señor Oculto')
  }
  const rolls = await player.request.post('/api/actions/listRolls', { data: { campaignId } })
  expect(await rolls.text()).not.toContain('Señor Oculto')

  // El compendio: una entrada del mundo sin revelar y un tipo oculto no le llegan por ningún lado
  const world = await page.request.post('/api/actions/putWorldContent', {
    data: {
      worldId,
      systemId,
      items: [{ type: 'arma', key: 'hoja_secreta', data: { name: { es: 'Hoja Secreta' }, categoria: 'marcial' } }]
    }
  })
  expect(world.status()).toBe(200)
  await page.request.post('/api/actions/updateCampaign', { data: { campaignId, hiddenTypes: ['criatura'] } })
  for (const [name, data] of [
    ['getCampaignCompendium', { campaignId }],
    ['searchCampaignContent', { campaignId, query: 'secreta' }],
    ['searchCampaignContent', { campaignId, query: 'goblin' }],
    ['browseCampaignContent', { campaignId, type: 'arma' }],
    ['browseCampaignContent', { campaignId, type: 'criatura' }],
    ['getCampaign', { campaignId }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    const text = await response.text()
    for (const leak of ['Hoja Secreta', 'hoja_secreta', 'guerrero_goblin', '"criatura"'])
      expect(text, `${name}: ${leak}`).not.toContain(leak)
  }
  const read = await player.request.post('/api/actions/getCampaignContent', {
    data: { campaignId, keys: ['hoja_secreta', 'guerrero_goblin_2014'] }
  })
  expect(await read.json()).toEqual({ items: [], missing: ['hoja_secreta', 'guerrero_goblin_2014'] })

  // En tiempo real le llega que cambian, sin nombres ni números
  const everything = await captured.all()
  for (const leak of ['Señor Oculto', boss.id, 'Hoja Secreta', '"life"']) expect(everything).not.toContain(leak)
  await player.close()
})

/** La cripta de Varn (como en vision.spec.ts), a 3000 × 2000: la sala de la entrada, cerrada, es lo único que se ve */
const CRIPTA = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'cripta.svg'), 'utf8')
const at = (x: number, y: number) => ({ x, y })
const CRIPTA_WALLS = [
  [at(900, 900), at(900, 700), at(200, 700), at(200, 1300), at(900, 1300), at(900, 1100)],
  [at(900, 900), at(1400, 900), at(1400, 400), at(2200, 400), at(2200, 680)],
  [at(2200, 910), at(2200, 1200), at(1850, 1200)],
  [at(1750, 1200), at(1400, 1200), at(1400, 1100), at(900, 1100)],
  [at(1750, 1200), at(1750, 1300), at(1500, 1300), at(1500, 1800), at(2100, 1800), at(2100, 1300), at(1850, 1300)]
]
const CRIPTA_PORTALS = [
  { a: at(900, 900), b: at(900, 1100), closed: true, window: false },
  { a: at(2200, 680), b: at(2200, 910), closed: true, window: false }
]
/** La sala de la entrada (entre sus muros), con un margen por las celdas de la niebla que pisan la pared */
const ROOM = { x0: 200 - 60, y0: 700 - 60, x1: 900 + 60, y1: 1300 + 60 }
const TILE = 512
/** Si una tesela (nivel, columna, fila) pisa la sala de la entrada */
const touchesRoom = (level: number, x: number, y: number) => {
  const span = TILE * 2 ** level
  return x * span < ROOM.x1 && (x + 1) * span > ROOM.x0 && y * span < ROOM.y1 && (y + 1) * span > ROOM.y0
}

test('@fugas la pantalla de la tele solo recibe lo que ve el grupo, y un jugador no entra en la mesa (ADR-0018)', async ({
  page,
  browser
}) => {
  test.setTimeout(240_000)
  const link = await campaignLink(page)
  const campaignId = new URL(page.url()).pathname.split('/campanas/')[1]?.split('/')[0] ?? ''
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const call = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), `${name}: ${await response.text()}`).toBe(200)
    return response.json()
  }
  const systemId = await import5e(page)
  await call('updateCampaign', { campaignId, system: systemId })
  const pageId = (await call('createPage', { worldId, title: 'Cripta de Varn' })).id
  const tab = await call('createPageTab', { pageId, kind: 'scene', name: 'Cripta de Varn' })
  const sceneId = (await call('getScene', { tabId: tab.id })).id as string
  await call('drawScene', {
    sceneId,
    svg: CRIPTA,
    name: 'Cripta de Varn',
    walls: CRIPTA_WALLS,
    portals: CRIPTA_PORTALS
  })
  // La puerta secreta de la cripta, cerrada: para el grupo, un muro más
  const walls = await call('changeWalls', {
    sceneId,
    walls: { add: [{ a: at(1750, 1200), b: at(1850, 1200), door: 'secret' }] }
  })
  const secretId = (walls.walls as Array<{ id: string; door: string | null }>).find((w) => w.door === 'secret')?.id
  if (!secretId) throw new Error('sin puerta secreta')
  await call('openScene', { campaignId, sceneId })
  await call('presentScene', { campaignId })

  // El grupo en la sala de la entrada; Bram, oculto; un acechador oculto a su lado y el señor de la cripta, tras la secreta
  const lia = (await call('createCharacter', { campaignId, name: 'Lía' })).character.id
  const bram = (await call('createCharacter', { campaignId, name: 'Bram' })).character.id
  await call('placeTokens', { campaignId, sceneId, tokens: [{ characterId: lia, x: 500, y: 1000 }] })
  const hiddenTokens = (
    await call('placeTokens', { campaignId, sceneId, hidden: true, tokens: [{ characterId: bram, x: 400, y: 850 }] })
  ).tokens as Array<{ id: string }>
  const lurker = (
    await call('putInPlay', { campaignId, key: 'guerrero_goblin_2014', unique: true, name: 'Acechador Invisible' })
  ).creatures[0].id as string
  const boss = (
    await call('putInPlay', { campaignId, key: 'jefe_goblin_2024', unique: true, name: 'Señor de la Cripta' })
  ).creatures[0].id as string
  await call('playCreature', { creatureId: boss, version: 1, damage: 2 })
  hiddenTokens.push(
    ...(
      await call('placeTokens', { campaignId, sceneId, hidden: true, tokens: [{ creatureId: lurker, x: 700, y: 900 }] })
    ).tokens
  )
  const bossToken = (
    await call('placeTokens', { campaignId, sceneId, tokens: [{ creatureId: boss, x: 1800, y: 1600 }] })
  ).tokens[0].id as string
  // Una marca a la vista, una del máster a la vista y otra en la cueva, que nadie ha visto
  const text = (x: number, y: number, words: string, hidden = false) => ({
    kind: 'text',
    x,
    y,
    text: words,
    color: '#f1e8d8',
    size: 30,
    hidden
  })
  const marks = (
    await call('changeMarks', {
      campaignId,
      add: [text(550, 1000, 'A la vista'), text(550, 1150, 'Nota del máster', true), text(2600, 1000, 'En la niebla')]
    })
  ).marks as Array<{ id: string; text: string }>
  const markId = (words: string) => marks.find((m) => m.text === words)?.id ?? ''

  // El máster abre la mesa: trocea el mapa y lo sube
  await page.goto(`/mundos/${worldId}/campanas/${campaignId}/mesa`)
  await expect(page.getByRole('application', { name: 'Mesa: Cripta de Varn' })).toBeVisible()
  await expect
    .poll(async () => (await call('getScene', { sceneId })).image.tiles?.levels ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)
  const tiles = (await call('getScene', { sceneId })).image.tiles as { version: string; levels: number }

  // La tele: lo que le llega por su canal y las teselas que pide
  const tv = await page.context().newPage()
  const frames: string[] = []
  const answers: Array<Promise<string>> = []
  const served: string[] = []
  const asked: string[] = []
  const tvNet = watchNetwork(tv)
  tv.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => frames.push(String(payload))))
  tv.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (!path.startsWith('/api/')) return
    asked.push(path)
    if (path.includes('/tiles/')) {
      if (response.status() === 200) served.push(path)
    } else answers.push(response.text().catch(() => ''))
  })
  await tv.goto(`/mundos/${worldId}/campanas/${campaignId}/pantalla`)
  await expect.poll(() => frames.some((f) => f.includes('"type":"screen"') && f.includes('Lía'))).toBe(true)
  await expect.poll(() => served.length, { timeout: 30_000 }).toBeGreaterThan(0)

  // Lo que cambia con la tele abierta: otra nota del máster y el señor que se mueve por la cripta; y una marca a la vista
  await call('changeMarks', { campaignId, add: [text(450, 1200, 'Otra nota', true), text(2700, 400, 'Más niebla')] })
  await call('moveTokens', { campaignId, moves: [{ tokenId: bossToken, x: 1700, y: 1500 }] })
  await call('changeMarks', { campaignId, add: [text(700, 1200, 'Ya se ve')] })
  await expect.poll(() => frames.some((f) => f.includes('Ya se ve'))).toBe(true)
  await tvNet.quiet()

  const everything = [...frames, ...(await Promise.all(answers))].join('\n')
  expect(everything).toContain('A la vista')
  for (const leak of [
    // La puerta secreta, ni que existe; ni muros ni puertas
    secretId,
    '"secret"',
    '"walls"',
    '"door"',
    // Las fichas ocultas y la criatura que no se ve, ni sus puntos de golpe
    'Bram',
    'Acechador Invisible',
    lurker,
    ...hiddenTokens.map((t) => t.id),
    'Señor de la Cripta',
    boss,
    bossToken,
    '"life"',
    // Las marcas del máster y las de la niebla
    'Nota del máster',
    markId('Nota del máster'),
    'Otra nota',
    'En la niebla',
    markId('En la niebla'),
    'Más niebla',
    // Ni su página ni su nombre
    pageId,
    'Cripta de Varn'
  ])
    expect(everything, leak).not.toContain(leak)

  // Las teselas: solo de la escena presentada y que pisan lo que se ve; las demás, ni pidiéndolas
  expect(asked.filter((path) => path.startsWith('/api/scenes/'))).toEqual([])
  const screenTile = (level: number, x: number, y: number) =>
    `/api/campaigns/${campaignId}/screen/tiles/${tiles.version}/${level}/${x}/${y}`
  for (const path of served) {
    const [level, x, y] = path.split('/').slice(-3).map(Number) as [number, number, number]
    expect(path.startsWith(`/api/campaigns/${campaignId}/screen/tiles/`), path).toBe(true)
    expect(touchesRoom(level, x, y), path).toBe(true)
  }
  let denied = 0
  for (let level = 0; level < tiles.levels; level++) {
    const span = TILE * 2 ** level
    for (let x = 0; x * span < 3000; x++)
      for (let y = 0; y * span < 2000; y++) {
        if (touchesRoom(level, x, y)) continue
        const response = await tv.request.get(screenTile(level, x, y))
        expect(response.status(), screenTile(level, x, y)).toBe(404)
        denied++
      }
  }
  expect(denied).toBeGreaterThan(20)
  await tv.close()

  // Un jugador: su Mesa es la proyección del grupo (ADR-0019), así que de la pantalla solo lo que ve el grupo; de la
  // escena, ninguna tesela; y en la sala de la mesa, ni la vista de la tele ni la del máster
  const player = await newPlayer(browser, link, 'Jugadora')
  const playerFrames: string[] = []
  const playerNet = watchNetwork(player)
  player.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => playerFrames.push(String(payload))))
  const outside = (() => {
    for (let x = 0; x * TILE < 3000; x++)
      for (let y = 0; y * TILE < 2000; y++) if (!touchesRoom(0, x, y)) return { x, y }
    throw new Error('sin tesela fuera de la sala')
  })()
  for (const [path, codes] of [
    [screenTile(0, outside.x, outside.y), [404]],
    [`/api/scenes/${sceneId}/tiles/${tiles.version}/0/0/1`, [403, 404]]
  ] as const) {
    const response = await player.request.get(path)
    expect(codes as readonly number[], path).toContain(response.status())
    expect(response.headers()['content-type'] ?? '', path).not.toContain('image/webp')
  }
  for (const view of ['screen', 'master']) {
    const answer = await player.evaluate(
      ({ campaignId, view }) =>
        new Promise<{ code: number; messages: string[] }>((resolve) => {
          const messages: string[] = []
          const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/table`)
          socket.onopen = () => socket.send(JSON.stringify({ type: 'join', campaignId, view }))
          socket.onmessage = (event) => messages.push(String(event.data))
          socket.onclose = (event) => resolve({ code: event.code, messages })
        }),
      { campaignId, view }
    )
    expect(answer.code, view).toBe(4403)
    expect(answer.messages, view).toEqual([JSON.stringify({ type: 'error', code: 'FORBIDDEN' })])
  }
  // Ni abriendo la pantalla de la campaña en su navegador
  await player.goto(`/mundos/${worldId}/campanas/${campaignId}/pantalla`)
  await expect.poll(() => playerFrames.some((f) => f.includes('FORBIDDEN'))).toBe(true)
  await playerNet.quiet()
  const toPlayer = playerFrames.join('\n')
  for (const leak of ['"type":"screen"', '"type":"master"', 'Lía', 'A la vista', sceneId])
    expect(toPlayer, leak).not.toContain(leak)
  await player.close()
})

test('@fugas los calendarios: la jugadora los lee sin las eras solo del máster, por la API ni por el tiempo real (módulo 8)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const worldId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  const definition = {
    yearSuffix: 'RV',
    weekdays: ['Lunden', 'Marden', 'Miden'],
    months: [
      { name: 'Siega', days: 30 },
      { name: 'Vendimia', days: 30 }
    ],
    eras: [
      { name: 'Era de la Corona', start: '0' },
      { name: 'Era del Eclipse', abbreviation: 'EE', start: '1300-Siega-1', hidden: true }
    ]
  }
  const calendar = await api('createCalendar', { worldId, name: 'Calendario de Varn', from: { definition } })
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await gotoLive(player, new URL(player.url()).pathname)
  // Mientras está conectada, el máster añade otra era oculta: el aviso le llega sin decir qué cambió
  await api('updateCalendar', {
    calendarId: calendar.id,
    definition: { ...definition, eras: [...definition.eras, { name: 'Era del Ocaso', start: '2000', hidden: true }] }
  })
  await expect.poll(() => captured.frames.some((f) => f.includes('"calendars"'))).toBe(true)
  // Lo que pide ella, con su sesión: los lee, sin las eras ocultas
  const bodies: string[] = []
  for (const [name, data] of [
    ['listCalendars', { worldId }],
    ['getCalendar', { calendarId: calendar.id }],
    ['describeDate', { calendarId: calendar.id, date: '1300-Siega-2' }],
    ['describeDate', { worldId, date: '2001-Vendimia-3', addDays: 5 }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    bodies.push(await response.text())
  }
  expect(bodies.join('\n')).toContain('Era de la Corona')
  const everything = [await captured.all(), ...bodies].join('\n')
  for (const leak of ['Eclipse', 'Ocaso', '"EE"']) expect(everything).not.toContain(leak)
  // Y no los cambia
  for (const [name, data] of [
    ['updateCalendar', { calendarId: calendar.id, name: 'Mío' }],
    ['deleteCalendar', { calendarId: calendar.id }],
    ['createCalendar', { worldId, name: 'Mío' }]
  ] as const)
    expect((await player.request.post(`/api/actions/${name}`, { data })).status(), name).toBe(404)
  await player.close()
})

test('@fugas las fechas: un campo «Oculto» de fecha no le llega a la jugadora por la API, el tiempo real ni la búsqueda (módulo 8)', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const [, , worldId = '', , campaignId = ''] = campaignPath(page).split('/')
  const api = async (name: string, data: object) => {
    const response = await page.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    return response.json()
  }
  await api('createCalendar', {
    worldId,
    name: 'Calendario de Varn',
    from: {
      definition: {
        yearSuffix: 'RV',
        weekdays: ['Lunden', 'Marden', 'Miden'],
        months: [
          { name: 'Siega', days: 30 },
          { name: 'Vendimia', days: 30 }
        ],
        eras: [{ name: 'Era de la Corona', start: '0' }]
      }
    }
  })
  const port = await api('createPage', { worldId, title: 'Puerto Ceniza' })
  await api('setKnowledge', { worldId, campaignId, kind: 'page', targetId: port.id, known: true })
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, link, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen
  await gotoLive(player, `/mundos/${worldId}/campanas/${campaignId}/paginas/${port.id}`)
  // Mientras ella mira la página, el máster la fecha: una visible y otra oculta
  await api('editPage', {
    pageId: port.id,
    properties: [
      { name: 'Fundación', type: 'date', value: '412-Siega-12' },
      { name: 'Coronación secreta', type: 'date', value: '415-Vendimia-3' }
    ]
  })
  const read = await api('getPage', { pageId: port.id })
  await api('setPageProperties', {
    pageId: port.id,
    properties: read.properties.map((p: { name: string }) => (p.name === 'Fundación' ? p : { ...p, hidden: true }))
  })
  await expect(player.getByRole('main')).toContainText('12 de Siega de 412 RV')
  const bodies: string[] = []
  for (const [name, data] of [
    ['getPage', { pageId: port.id, campaignId }],
    ['readPage', { pageId: port.id, campaignId }],
    ['searchWiki', { worldId, campaignId, query: 'Vendimia' }],
    ['searchWiki', { worldId, campaignId, query: 'Siega' }]
  ] as const) {
    const response = await player.request.post(`/api/actions/${name}`, { data })
    expect(response.status(), name).toBe(200)
    bodies.push(await response.text())
  }
  expect(bodies.join('\n')).toContain('12 de Siega de 412 RV')
  const everything = [await captured.all(), ...bodies].join('\n')
  for (const leak of ['Coronación', 'Vendimia de 415', '415-Vendimia']) expect(everything).not.toContain(leak)
  await player.close()
})
