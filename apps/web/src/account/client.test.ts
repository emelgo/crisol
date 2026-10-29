import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAccountClient, errorCode } from './client.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

describe('errorCode', () => {
  it('traduce los estados de Better Auth', () => {
    expect(errorCode(401)).toBe('INVALID_CREDENTIALS')
    expect(errorCode(429)).toBe('TOO_MANY_REQUESTS')
    expect(errorCode(500)).toBe('UNKNOWN')
    expect(errorCode(undefined)).toBe('UNKNOWN')
  })
})

describe('arranque con la API real', () => {
  const input = { secret: 'abc', name: 'Enrique', email: 'e@crisol.test', password: 'una-clave-larga' }

  it('bootstrapInfo devuelve la organización o null', async () => {
    vi.stubGlobal('fetch', respond(200, { organizationName: 'Crisol' }))
    expect(await createAccountClient().bootstrapInfo('abc')).toEqual({ organizationName: 'Crisol' })
    vi.stubGlobal('fetch', respond(404, { code: 'INVALID_LINK' }))
    expect(await createAccountClient().bootstrapInfo('abc')).toBeNull()
  })

  it('redeemBootstrap devuelve el código del servidor si falla', async () => {
    vi.stubGlobal('fetch', respond(409, { code: 'EMAIL_TAKEN' }))
    expect(await createAccountClient().redeemBootstrap(input)).toEqual({ ok: false, code: 'EMAIL_TAKEN' })
  })

  it('redeemBootstrap sin código usa el del estado HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no es JSON', { status: 429 }))
    )
    expect(await createAccountClient().redeemBootstrap(input)).toEqual({ ok: false, code: 'TOO_MANY_REQUESTS' })
  })

  it('redeemBootstrap envía los datos por POST', async () => {
    const fetch = respond(201, { userId: 'u1' })
    vi.stubGlobal('fetch', fetch)
    expect(await createAccountClient().redeemBootstrap(input)).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/bootstrap', expect.objectContaining({ method: 'POST' }))
  })
})

describe('OAuth con la API real', () => {
  const routed = (routes: Record<string, unknown>) =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://127.0.0.1')
      const body = routes[url.pathname]
      return new Response(JSON.stringify(body ?? {}), {
        status: body === undefined ? 404 : 200,
        headers: { 'content-type': 'application/json' }
      })
    })

  it('al entrar para autorizar una aplicación, sigue a la autorización', async () => {
    vi.stubGlobal('fetch', routed({ '/api/auth/sign-in/email': { redirect: true, url: '/oauth/consentimiento?x=1' } }))
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    expect(await createAccountClient().signIn('e@crisol.test', 'una-clave-larga')).toEqual({
      ok: true,
      redirected: true
    })
    expect(assign).toHaveBeenCalledWith('/oauth/consentimiento?x=1')
  })

  it('al entrar sin más, no redirige', async () => {
    vi.stubGlobal('fetch', routed({ '/api/auth/sign-in/email': { token: 't', user: { id: 'u1' } } }))
    expect(await createAccountClient().signIn('e@crisol.test', 'una-clave-larga')).toEqual({
      ok: true,
      redirected: false
    })
  })

  it('el consentimiento vuelve a la aplicación', async () => {
    vi.stubGlobal(
      'fetch',
      routed({ '/api/auth/oauth2/consent': { redirect: true, url: 'https://claude.ai/callback?code=c' } })
    )
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    expect(await createAccountClient().consent(true)).toEqual({ ok: true, redirected: true })
    expect(assign).toHaveBeenCalledWith('https://claude.ai/callback?code=c')
  })

  it('el nombre de la aplicación sale de sus datos públicos', async () => {
    vi.stubGlobal('fetch', routed({ '/api/auth/oauth2/public-client': { client_name: 'Claude' } }))
    expect(await createAccountClient().oauthClientName('https://claude.ai/x')).toBe('Claude')
    vi.stubGlobal('fetch', routed({}))
    expect(await createAccountClient().oauthClientName('https://claude.ai/x')).toBeNull()
  })

  it('si falla el consentimiento, da el código del error', async () => {
    vi.stubGlobal('fetch', routed({}))
    expect(await createAccountClient().consent(true)).toEqual({ ok: false, code: 'UNKNOWN' })
  })
})
