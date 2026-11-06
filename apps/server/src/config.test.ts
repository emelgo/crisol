import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const minimal = {
  DATABASE_URL: 'postgres://crisol:crisol@127.0.0.1:54330/crisol',
  VALKEY_URL: 'redis://127.0.0.1:63790',
  AUTH_SECRET: 'a'.repeat(32),
  PUBLIC_URL: 'http://127.0.0.1:5173'
}

describe('loadConfig', () => {
  it('rellena los valores por defecto: loopback, puerto 8130 y desarrollo', () => {
    expect(loadConfig(minimal)).toEqual({
      ...minimal,
      HOST: '127.0.0.1',
      PORT: 8130,
      NODE_ENV: 'development',
      DATA_DIR: 'datos-locales',
      QUEUE_PREFIX: 'crisol',
      MODEL_DIR: expect.stringMatching(/datos-locales\/modelos\/multilingual-e5-small$/)
    })
  })

  it('convierte el puerto a número', () => {
    expect(loadConfig({ ...minimal, PORT: '9000' }).PORT).toBe(9000)
  })

  it('falla diciendo qué variable falta', () => {
    const { DATABASE_URL: _, ...withoutDatabase } = minimal
    expect(() => loadConfig(withoutDatabase)).toThrow('DATABASE_URL')
  })

  it('exige un secreto de sesiones largo', () => {
    expect(() => loadConfig({ ...minimal, AUTH_SECRET: 'corto' })).toThrow('AUTH_SECRET')
  })

  it('rechaza una URL de base de datos que no es de Postgres', () => {
    expect(() => loadConfig({ ...minimal, DATABASE_URL: 'mysql://x@y/z' })).toThrow('DATABASE_URL')
  })
})
