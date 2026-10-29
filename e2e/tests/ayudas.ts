import { createHash, randomBytes } from 'node:crypto'
import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { type Browser, expect, type Page } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'

export const owner = { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' }

/** Base de datos vacía y el propietario con su cuenta recién creada y la sesión abierta en `page` */
export async function freshOwner(page: Page) {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    await resetDatabase(conn.sql)
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Fateforge' })
    await page.goto(`/arranque/${secret}`)
    await page.getByLabel('Nombre').fill(owner.name)
    await page.getByLabel('Email').fill(owner.email)
    await page.getByLabel('Contraseña').fill(owner.password)
    await page.getByRole('button', { name: 'Crear la cuenta' }).click()
    await expect(page.getByText(`Hola, ${owner.name}`)).toBeVisible()
  } finally {
    await conn.close()
  }
}

/** El propietario crea Eana y La Marca; devuelve el enlace de invitación (con `page` en la campaña) */
export async function campaignLink(page: Page) {
  await freshOwner(page)
  await page.goto('/mundos')
  await page.getByLabel('Nombre del mundo').fill('Eana')
  await page.getByRole('button', { name: 'Crear el mundo' }).click()
  await page.getByRole('link', { name: 'Eana' }).click()
  await page.getByLabel('Nombre de la campaña').fill('La Marca')
  await page.getByRole('button', { name: 'Crear la campaña' }).click()
  await page.getByRole('link', { name: 'La Marca' }).click()
  return page.getByLabel('Enlace de invitación').inputValue()
}

/**
 * Una jugadora nueva entra con el enlace creando su cuenta; queda en la campaña, en su propia página. onPage recibe la
 * página antes de abrir nada (para escuchar lo que le llega)
 */
export async function newPlayer(browser: Browser, link: string, name = 'Jugadora', onPage?: (page: Page) => void) {
  const player = await browser.newPage()
  onPage?.(player)
  await player.goto(link)
  await player.getByLabel('Nombre').fill(name)
  await player.getByLabel('Email').fill(`${name.toLowerCase()}@crisol.test`)
  await player.getByLabel('Contraseña').fill('una-clave-larga')
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  return player
}

/**
 * Abre `path` y espera a que el canal en tiempo real de la página esté conectado (llega su saludo): lo que pase
 * después (lo que pide Claude, un cambio de otra pestaña) se ve sin recargar
 */
export async function gotoLive(page: Page, path: string) {
  const hello = page.waitForEvent('websocket').then((socket) => socket.waitForEvent('framereceived'))
  await page.goto(path)
  await hello
}

const REDIRECT = 'https://cliente.example/callback'

/** Lo que contesta una herramienta MCP */
export interface ToolResult {
  content: Array<{ type: string; text?: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/**
 * Conecta «Claude» con la cuenta de la sesión de `page`, como claude.ai: un cliente OAuth público (registrado a mano;
 * claude.ai usa CIMD), el permiso en la web y el código canjeado con PKCE. Devuelve con qué llamar a las herramientas.
 * Deja `page` en la vuelta del permiso: hay que volver a abrir lo que se quiera ver
 */
export async function connectClaude(page: Page) {
  const base = new URL(page.url()).origin
  const created = await page.request.post('/api/auth/oauth2/create-client', {
    headers: { origin: base },
    data: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Claude de pruebas' }
  })
  const { client_id } = (await created.json()) as { client_id: string }

  let callback: URL | undefined
  await page.route('https://cliente.example/**', (route) => {
    callback = new URL(route.request().url())
    return route.fulfill({ status: 200, body: 'ok' })
  })
  const verifier = randomBytes(32).toString('base64url')
  const authorize = new URL('/api/auth/oauth2/authorize', base)
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT,
    scope: 'openid profile offline_access',
    state: 'estado',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${base}/mcp`
  }).toString()
  await page.goto(authorize.toString())
  await page.getByRole('button', { name: 'Permitir', exact: true }).click()
  await expect.poll(() => callback?.searchParams.get('code')).toBeTruthy()

  // Como claude.ai, desde su servidor: sin la sesión del navegador. Con fetch y no con un contexto de Playwright, que
  // habría que soltar y, soltado al cerrarse la página, chocaba con la prueba siguiente (que vuelve a trazarlos todos)
  const token = await fetch(`${base}/api/auth/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: callback?.searchParams.get('code') ?? '',
      redirect_uri: REDIRECT,
      client_id,
      code_verifier: verifier,
      resource: `${base}/mcp`
    })
  })
  const { access_token } = (await token.json()) as { access_token: string }

  /** Una herramienta por el protocolo de 2025, como claude.ai. La respuesta viene en JSON o en un flujo SSE */
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult & { text: string }> => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${access_token}`,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-06-18'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(30_000)
    })
    const body = await response.text()
    const json = body.startsWith('{') ? body : (body.split('\n').find((l) => l.startsWith('data:')) ?? '').slice(5)
    const { result, error } = JSON.parse(json) as { result?: ToolResult; error?: unknown }
    if (!result) throw new Error(`${name}: ${response.status} ${JSON.stringify(error ?? body)}`)
    return { ...result, text: result.content.map((c) => c.text ?? '').join('\n') }
  }
  return { call }
}
