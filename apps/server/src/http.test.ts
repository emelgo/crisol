import { describe, expect, it } from 'vitest'
import { redactSecrets } from './http.ts'

describe('redactSecrets', () => {
  it('quita de la URL los secretos de los enlaces de invitación y de arranque', () => {
    expect(redactSecrets('/unirse/AbC123_-x')).toBe('/unirse/…')
    expect(redactSecrets('/api/join/AbC123?x=1')).toBe('/api/join/…?x=1')
    expect(redactSecrets('/arranque/zzz')).toBe('/arranque/…')
    expect(redactSecrets('/api/bootstrap/zzz')).toBe('/api/bootstrap/…')
  })

  it('lo demás, tal cual', () => {
    expect(redactSecrets('/api/actions/listWorlds')).toBe('/api/actions/listWorlds')
    expect(redactSecrets('/mundos/123/campanas/456')).toBe('/mundos/123/campanas/456')
  })
})
