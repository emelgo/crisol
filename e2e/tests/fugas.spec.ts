import { createHash, randomBytes } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { E2E_PORT } from '../servidor.ts'
import {
  campaignLink,
  connectClaude,
  createCampaign,
  gotoLive,
  newPlayer,
  openWindow,
  rename,
  slash,
  toWorlds
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
  const campaignA = new URL(page.url()).pathname
  let seen: ReturnType<typeof capture> | undefined
  const player = await newPlayer(browser, firstLink, 'Jugadora', (p) => {
    seen = capture(p)
  })
  if (!seen) throw new Error('sin captura')
  const captured = seen

  // El máster, mientras tanto: crea la campaña B, regenera los dos enlaces, cierra y abre las invitaciones y deshace
  await createCampaign(page, SECRET_CAMPAIGN)
  await page.getByRole('link', { name: SECRET_CAMPAIGN, exact: true }).click()
  const campaignB = new URL(page.url()).pathname
  const idB = campaignB.split('/').at(-1) ?? ''
  const linkB = await page.getByLabel('Enlace de invitación').inputValue()
  await page.getByRole('button', { name: 'Nuevo enlace' }).click()
  await page.getByRole('button', { name: 'Generar el nuevo' }).click()
  await expect(page.getByLabel('Enlace de invitación')).not.toHaveValue(linkB)
  const newLinkB = await page.getByLabel('Enlace de invitación').inputValue()

  await page.goto(campaignA)
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

test('@fugas una jugadora no puede conectar Claude: no se le ofrece y, aunque fuerce el permiso, no se lo dan', async ({
  page,
  browser
}) => {
  const link = await campaignLink(page)
  const created = await page.request.post('/api/auth/oauth2/create-client', {
    headers: { origin: BASE },
    data: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Claude de pruebas' }
  })
  const { client_id } = (await created.json()) as { client_id: string }
  const player = await newPlayer(browser, link)

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
  await player.goto(authorize.toString())
  await expect(player.getByText('De momento solo el propietario puede conectar una IA.')).toBeVisible()
  await expect(player.getByRole('button', { name: 'Permitir', exact: true })).toHaveCount(0)

  // Forzando el permiso con la consulta firmada de la página: el servidor no lo da
  const status = await player.evaluate(async () => {
    const response = await fetch('/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accept: true, oauth_query: window.location.search.slice(1) })
    })
    return response.status
  })
  expect(status).toBe(403)
  await player.close()
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
  await page.getByRole('link', { name: SECRET_CAMPAIGN, exact: true }).click()
  const idB = new URL(page.url()).pathname.split('/').at(-1) ?? ''
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

test('@fugas la wiki es solo del máster: a la jugadora no le llegan ni sus páginas ni sus avisos', async ({
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

  for (const [name, data] of [
    ['listPageChildren', { worldId }],
    ['listPageTree', { worldId }],
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
    ['searchWiki', { worldId, query: 'torre' }],
    ['getPageTables', { pageId: tower.id }],
    ['searchWiki', { worldId, template: 'pnj' }]
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
    '"pages"'
  ]) {
    expect(everything).not.toContain(leak)
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

  for (const [name, data] of [
    ['listSystems', { organizationId }],
    ['getSystem', { systemId: madeId, organizationId }],
    ['getSystemParts', { systemId: madeId, parts: ['types'], organizationId }],
    ['tryFormula', { systemId: madeId, type: 'personaje', formula: '@vigor', organizationId }],
    ['trySystemRoll', { systemId: madeId, roll: 'atributo', organizationId }],
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
    'Ayuda que solo ve el máster',
    madeId
  ])
    expect(everything).not.toContain(leak)
  await player.close()
})
