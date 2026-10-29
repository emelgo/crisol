import { describe, expect, it } from 'vitest'
import { ApiError } from './client.ts'
import { shouldRetry } from './errors.ts'

describe('shouldRetry', () => {
  it('no repite lo que el servidor rechaza: no va a cambiar', () => {
    expect(shouldRetry(0, new ApiError('NOT_FOUND', 404))).toBe(false)
    expect(shouldRetry(0, new ApiError('FORBIDDEN', 403))).toBe(false)
  })

  it('repite hasta tres veces los fallos del servidor o de la red', () => {
    expect(shouldRetry(0, new ApiError('UNKNOWN', 503))).toBe(true)
    expect(shouldRetry(2, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetry(3, new TypeError('Failed to fetch'))).toBe(false)
  })
})
