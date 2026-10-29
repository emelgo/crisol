import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'

const ok = async () => undefined

describe('la web compilada', () => {
  let webDir: string

  beforeAll(() => {
    webDir = mkdtempSync(join(tmpdir(), 'web-'))
    mkdirSync(join(webDir, 'assets'))
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Crisol</title>')
    writeFileSync(join(webDir, 'assets', 'index-abc123.js'), 'console.log(1)')
  })

  afterAll(() => {
    rmSync(webDir, { recursive: true, force: true })
  })

  const app = () => buildApp({ checks: { postgres: ok, valkey: ok }, webDir })

  it('sirve index.html en la raíz, sin caché', async () => {
    const response = await app().inject({ method: 'GET', url: '/' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('<title>Crisol</title>')
    expect(response.headers['cache-control']).toBe('no-cache')
  })

  it('sirve los recursos con nombre con huella como inmutables', async () => {
    const response = await app().inject({ method: 'GET', url: '/assets/index-abc123.js' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('devuelve index.html en cualquier ruta de la app, para que la resuelva el navegador', async () => {
    const response = await app().inject({ method: 'GET', url: '/mundos/eana' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('<title>Crisol</title>')
  })

  it('una ruta de la API que no existe da 404 en JSON, no la web', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/no-existe' })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ statusCode: 404 })
  })

  it('un recurso que falta da 404, no la web', async () => {
    const response = await app().inject({ method: 'GET', url: '/assets/no-existe.js' })
    expect(response.statusCode).toBe(404)
  })
})
