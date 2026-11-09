import { describe, expect, it } from 'vitest'
import { createTablePresence } from './presence.ts'

describe('quién está en la Mesa', () => {
  it('cada persona y forma de mirar, una vez: sus pestañas juntas, desde la primera; activa si alguna está a la vista', () => {
    let t = Date.parse('2026-11-10T20:00:00Z')
    const presence = createTablePresence(() => new Date((t += 60_000)))
    const [a, b, c, d] = [{}, {}, {}, {}]
    presence.add('marca', a, { userId: 'enrique', viewer: 'master' })
    presence.add('marca', b, { userId: 'lucia', viewer: 'player' })
    presence.add('marca', c, { userId: 'enrique', viewer: 'master' })
    presence.add('marca', d, { userId: 'enrique', viewer: 'screen' })
    expect(presence.setActive('marca', b, false)).toBe(true)
    expect(presence.setActive('marca', b, false)).toBe(false)
    expect(presence.setActive('marca', a, false)).toBe(true)
    expect(presence.list('marca')).toEqual([
      { userId: 'enrique', viewer: 'master', since: '2026-11-10T20:01:00.000Z', active: true, tabs: 2 },
      { userId: 'lucia', viewer: 'player', since: '2026-11-10T20:02:00.000Z', active: false, tabs: 1 },
      { userId: 'enrique', viewer: 'screen', since: '2026-11-10T20:04:00.000Z', active: true, tabs: 1 }
    ])
    for (const key of [a, b, c, d]) presence.remove('marca', key)
    expect(presence.list('marca')).toEqual([])
    expect(presence.list('otra')).toEqual([])
  })
})
