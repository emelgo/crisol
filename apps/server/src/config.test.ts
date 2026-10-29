import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const minimal = {
  DATABASE_URL: 'postgres://crisol:crisol@127.0.0.1:54330/crisol',
  VALKEY_URL: 'redis://127.0.0.1:63790'
}

describe('loadConfig', () => {
  it('rellena los valores por defecto: loopback, puerto 8130 y desarrollo', () => {
    expect(loadConfig(minimal)).toEqual({ ...minimal, HOST: '127.0.0.1', PORT: 8130, NODE_ENV: 'development' })
  })

  it('convierte el puerto a número', () => {
    expect(loadConfig({ ...minimal, PORT: '9000' }).PORT).toBe(9000)
  })

  it('falla diciendo qué variable falta', () => {
    expect(() => loadConfig({ VALKEY_URL: minimal.VALKEY_URL })).toThrow('DATABASE_URL')
  })

  it('rechaza una URL de base de datos que no es de Postgres', () => {
    expect(() => loadConfig({ ...minimal, DATABASE_URL: 'mysql://x@y/z' })).toThrow('DATABASE_URL')
  })
})
