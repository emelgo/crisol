import { describe, expect, it } from 'vitest'
import { createTablePresence } from './presence.ts'

describe('quién está en la Mesa', () => {
  it('cada persona y forma de mirar, una vez: sus pestañas juntas, desde la primera; activa si alguna está a la vista', () => {
    let t = Date.parse('2026-11-10T20:00:00Z')
    const presence = createTablePresence(() => {
      t += 60_000
      return new Date(t)
    })
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

  it('echar cierra las Mesas de jugador de esa persona en esa campaña, y nada más', () => {
    const presence = createTablePresence()
    const closed: string[] = []
    presence.add('marca', {}, { userId: 'lucia', viewer: 'player', close: () => closed.push('lucia-1') })
    presence.add('marca', {}, { userId: 'lucia', viewer: 'player', close: () => closed.push('lucia-2') })
    presence.add('marca', {}, { userId: 'bruno', viewer: 'player', close: () => closed.push('bruno') })
    presence.add('otra', {}, { userId: 'lucia', viewer: 'player', close: () => closed.push('otra') })
    presence.add('marca', {}, { userId: 'enrique', viewer: 'master', close: () => closed.push('enrique') })
    expect(presence.disconnect('marca', 'lucia')).toBe(2)
    expect(closed).toEqual(['lucia-1', 'lucia-2'])
    expect(presence.disconnect('marca', 'enrique')).toBe(0)
  })

  it('quién tiene abierta la campaña fuera de la Mesa: cada persona una vez; al cambiar, las dos campañas cambian', () => {
    const presence = createTablePresence()
    const [a, b, c] = [{}, {}, {}]
    expect(presence.focus(a, { userId: 'lucia', campaignId: 'marca' })).toEqual(['marca'])
    expect(presence.focus(a, { userId: 'lucia', campaignId: 'marca' })).toEqual([])
    presence.focus(b, { userId: 'lucia', campaignId: 'marca' })
    presence.focus(c, { userId: 'bruno', campaignId: 'marca' })
    expect(presence.inCampaign('marca')).toEqual(['lucia', 'bruno'])
    expect(presence.focus(c, { userId: 'bruno', campaignId: 'otra' })).toEqual(['marca', 'otra'])
    expect(presence.focus(a, { userId: 'lucia', campaignId: null })).toEqual(['marca'])
    expect(presence.inCampaign('marca')).toEqual(['lucia'])
    expect(presence.inCampaign('otra')).toEqual(['bruno'])
  })
})
