import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { E2E_PORT } from '../servidor.ts'
import { createWorld, freshOwner, owner, signOut } from './ayudas.ts'

const BASE = `http://127.0.0.1:${E2E_PORT}`
// Como la de claude.ai: HTTPS. La prueba la intercepta para leer el código
const REDIRECT = 'https://cliente.example/callback'

test('el propietario conecta una aplicación por OAuth y esta lista sus mundos por MCP', async ({ page, request }) => {
  await freshOwner(page)
  await createWorld(page, 'Eana')

  // claude.ai se registra solo por CIMD; aquí, como en la prueba del servidor, el propietario registra un cliente
  const created = await page.request.post('/api/auth/oauth2/create-client', {
    headers: { origin: BASE },
    data: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Claude de pruebas' }
  })
  const { client_id } = (await created.json()) as { client_id: string }
  await signOut(page)
  await expect(page).toHaveURL('/entrar')

  let callback: URL | undefined
  await page.route('https://cliente.example/**', (route) => {
    callback = new URL(route.request().url())
    return route.fulfill({ status: 200, body: 'ok' })
  })
  const verifier = randomBytes(32).toString('base64url')
  const authorize = new URL('/api/auth/oauth2/authorize', BASE)
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT,
    scope: 'openid profile offline_access',
    state: 'estado',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${BASE}/mcp`
  }).toString()

  // Sin sesión: primero entrar, luego el consentimiento
  await page.goto(authorize.toString())
  await expect(page).toHaveURL(/\/entrar\?/)
  await page.getByLabel('Email').fill(owner.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(owner.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Conectar Claude de pruebas' })).toBeVisible()
  await page.getByRole('button', { name: 'Permitir', exact: true }).click()
  await expect.poll(() => callback?.searchParams.get('code')).toBeTruthy()
  expect(callback?.searchParams.get('state')).toBe('estado')

  const token = await request.post('/api/auth/oauth2/token', {
    form: {
      grant_type: 'authorization_code',
      code: callback?.searchParams.get('code') ?? '',
      redirect_uri: REDIRECT,
      client_id,
      code_verifier: verifier,
      resource: `${BASE}/mcp`
    }
  })
  const { access_token } = (await token.json()) as { access_token: string }

  const mcp = await request.post('/mcp', {
    headers: {
      authorization: `Bearer ${access_token}`,
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18'
    },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'listar_mundos', arguments: {} } }
  })
  expect(mcp.status()).toBe(200)
  expect(await mcp.text()).toContain('Eana')
})
