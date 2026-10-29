import type { RealtimeMessage } from '@crisol/contracts'
import { type Actor, actorFrom } from '@crisol/domain'
import { describe, expect, it, vi } from 'vitest'
import { createRealtime, type RealtimeSocket } from './hub.ts'

const WORLD = 'world-1'
const A = { campaignId: 'campaign-a', worldId: WORLD }
const B = { campaignId: 'campaign-b', worldId: WORLD }

/** Las pertenencias de cada cuenta, que se pueden cambiar a mitad de prueba (como en la base de datos) */
function memberships() {
  const actors = new Map<string, Actor>([
    [
      'master',
      actorFrom('master', {
        organizations: [{ organizationId: 'org', role: 'owner' }],
        worlds: [{ worldId: WORLD, organizationId: 'org', role: 'master' }],
        campaigns: []
      })
    ],
    [
      'player',
      actorFrom('player', {
        organizations: [{ organizationId: 'org', role: 'member' }],
        worlds: [],
        campaigns: [{ ...A, role: 'player' }]
      })
    ]
  ])
  const load = vi.fn(async (userId: string) => {
    const actor = actors.get(userId)
    if (!actor) throw new Error(`sin pertenencias: ${userId}`)
    return actor
  })
  return { actors, load }
}

function socket() {
  const received: RealtimeMessage[] = []
  const s: RealtimeSocket = { send: (data) => received.push(JSON.parse(data)) }
  return { socket: s, received }
}

const changedMembers = (campaignId: string): RealtimeMessage => ({ type: 'changed', what: 'members', campaignId })

describe('el canal en tiempo real', () => {
  it('cada evento llega solo a quien puede verlo, según sus pertenencias de ese momento', async () => {
    const { load } = memberships()
    const realtime = createRealtime(load)
    const master = socket()
    const player = socket()
    realtime.connect('master', master.socket)
    realtime.connect('player', player.socket)

    realtime.publish(
      { to: { capability: 'campaign.read', target: B }, message: changedMembers(B.campaignId) },
      { to: { capability: 'campaign.read', target: A }, message: changedMembers(A.campaignId) },
      { to: { capability: 'campaign.invite', target: A }, message: { type: 'changed', what: 'invitation', ...A } }
    )
    await realtime.idle()
    expect(master.received).toHaveLength(3)
    expect(player.received).toEqual([changedMembers(A.campaignId)])
  })

  it('a una cuenta concreta le llega a todas sus conexiones, y a nadie más', async () => {
    const realtime = createRealtime(memberships().load)
    const tab1 = socket()
    const tab2 = socket()
    const master = socket()
    realtime.connect('player', tab1.socket)
    realtime.connect('player', tab2.socket)
    realtime.connect('master', master.socket)
    realtime.revoke('player', A)
    await realtime.idle()
    expect(tab1.received).toEqual([{ type: 'revoked', ...A }])
    expect(tab2.received).toEqual(tab1.received)
    expect(master.received).toEqual([])
  })

  it('tras perder la pertenencia deja de recibir lo de esa campaña', async () => {
    const { actors, load } = memberships()
    const realtime = createRealtime(load)
    const player = socket()
    realtime.connect('player', player.socket)
    actors.set('player', actorFrom('player', { organizations: [], worlds: [], campaigns: [] }))
    realtime.publish({ to: { capability: 'campaign.read', target: A }, message: changedMembers(A.campaignId) })
    await realtime.idle()
    expect(player.received).toEqual([])
  })

  it('los eventos salen en el orden en que se publican', async () => {
    const { load } = memberships()
    // La primera carga tarda más: aun así, no se adelanta la segunda
    load.mockImplementationOnce(async (userId) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return memberships().actors.get(userId) as Actor
    })
    const realtime = createRealtime(load)
    const player = socket()
    realtime.connect('player', player.socket)
    realtime.publish({ to: { capability: 'campaign.read', target: A }, message: changedMembers('primero') })
    realtime.publish({ to: { userId: 'player' }, message: changedMembers('segundo') })
    await realtime.idle()
    expect(player.received.map((m) => 'campaignId' in m && m.campaignId)).toEqual(['primero', 'segundo'])
  })

  it('las pertenencias se cargan una vez por cuenta y publicación, aunque tenga varias pestañas', async () => {
    const { load } = memberships()
    const realtime = createRealtime(load)
    realtime.connect('player', socket().socket)
    realtime.connect('player', socket().socket)
    realtime.publish(
      { to: { capability: 'campaign.read', target: A }, message: changedMembers(A.campaignId) },
      { to: { capability: 'campaign.read', target: B }, message: changedMembers(B.campaignId) }
    )
    await realtime.idle()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('al desconectarse no le llega nada más, y un fallo no para el canal', async () => {
    const { load } = memberships()
    const onError = vi.fn()
    const realtime = createRealtime(load, onError)
    const player = socket()
    const disconnect = realtime.connect('player', player.socket)
    const broken: RealtimeSocket = {
      send: () => {
        throw new Error('cerrado')
      }
    }
    realtime.connect('master', broken)
    realtime.connect('nadie', socket().socket)
    realtime.publish({ to: { capability: 'campaign.read', target: A }, message: changedMembers(A.campaignId) })
    await realtime.idle()
    expect(player.received).toHaveLength(1)
    expect(onError).toHaveBeenCalledTimes(2)

    disconnect()
    realtime.publish({ to: { userId: 'player' }, message: changedMembers('otra') })
    await realtime.idle()
    expect(player.received).toHaveLength(1)
  })
})
