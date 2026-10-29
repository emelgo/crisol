import { describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'

const ok = async () => undefined
const down = async () => {
  throw new Error('sin conexión')
}

describe('GET /api/health', () => {
  it('da 200 si Postgres y Valkey responden', async () => {
    const app = buildApp({ checks: { postgres: ok, valkey: ok } })
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', postgres: 'ok', valkey: 'ok' })
  })

  it('da 503 y dice qué servicio falla', async () => {
    const app = buildApp({ checks: { postgres: ok, valkey: down } })
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'down', postgres: 'ok', valkey: 'down' })
  })

  it('da 503 si un servicio no contesta a tiempo', async () => {
    const hangs = () => new Promise<void>(() => undefined)
    const app = buildApp({ checks: { postgres: hangs, valkey: ok }, healthTimeoutMs: 20 })
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ postgres: 'down' })
  })
})
