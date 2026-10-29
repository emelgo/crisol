import { createHash, randomBytes } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { E2E_PORT } from '../servidor.ts'
import { campaignLink, connectClaude, newPlayer } from './ayudas.ts'

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
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByLabel('Nombre de la campaña').fill(SECRET_CAMPAIGN)
  await page.getByRole('button', { name: 'Crear la campaña' }).click()
  await page.getByRole('link', { name: SECRET_CAMPAIGN }).click()
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
  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).uncheck()
  await page.getByRole('checkbox', { name: 'Invitaciones abiertas' }).check()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByRole('button', { name: `Renombrar ${SECRET_CAMPAIGN}` }).click()
  await page.getByLabel(`Nuevo nombre de ${SECRET_CAMPAIGN}`).fill(RENAMED_CAMPAIGN)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('link', { name: RENAMED_CAMPAIGN })).toBeVisible()
  // Y deshace el renombrado de B desde el historial
  await page.getByRole('link', { name: 'Historial' }).click()
  await page
    .getByRole('button', { name: `Deshacer: renombró la campaña «${SECRET_CAMPAIGN}» a «${RENAMED_CAMPAIGN}»` })
    .click()
  await expect(page.getByRole('list', { name: 'Operaciones' }).getByRole('listitem').first()).toHaveText(/deshizo/)
  await page.goto('/mundos')
  await page.getByRole('button', { name: 'Renombrar Eana' }).click()
  await page.getByLabel('Nuevo nombre de Eana').fill('Eana (Fateforge)')
  await page.getByRole('button', { name: 'Guardar' }).click()

  // La jugadora recorre lo suyo y prueba lo ajeno
  await expect.poll(() => captured.frames.some((f) => f.includes('"worlds"'))).toBe(true)
  await player.goto('/mundos')
  await player.getByRole('link', { name: 'Eana (Fateforge)' }).click()
  await expect(player.getByRole('list', { name: 'Campañas' }).getByRole('listitem')).toHaveCount(1)
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
  await expect(player.getByText('De momento solo el propietario puede conectar Claude.')).toBeVisible()
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
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByLabel('Nombre de la campaña').fill(SECRET_CAMPAIGN)
  await page.getByRole('button', { name: 'Crear la campaña' }).click()
  await page.getByRole('link', { name: SECRET_CAMPAIGN }).click()
  const idB = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const linkB = await page.getByLabel('Enlace de invitación').inputValue()

  // Claude pide regenerar el enlace de B (el máster lo aprueba) y cerrar las invitaciones de A (lo rechaza)
  const claude = await connectClaude(page)
  await page.goto('/mundos')
  const queue = page.getByRole('region', { name: 'Claude espera tu aprobación' })
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
