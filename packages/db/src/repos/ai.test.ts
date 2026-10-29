import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { approvals } from '../schema/ai.ts'
import { user } from '../schema/auth.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as aiRepo from './ai.ts'
import { purge } from './trash.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('modos de IA y cola de aprobación', () => {
  let conn: ReturnType<typeof connect>
  const now = new Date('2026-10-29T10:00:00Z')
  const at = (ms: number) => new Date(now.getTime() + ms)

  /** Lo que pide la IA de Enrique: regenerar el enlace de La Marca */
  const request = (overrides: Partial<Parameters<typeof aiRepo.createApproval>[1]> = {}) =>
    aiRepo.createApproval(conn.db, {
      userId: 'u1',
      tool: 'enlace_invitacion',
      action: 'regenerateInvitation',
      input: { campaignId: crypto.randomUUID() },
      details: { campaign: 'La Marca' },
      now,
      ...overrides
    })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_ai'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test' },
      { id: 'u2', name: 'Pepe', email: 'p@crisol.test' }
    ])
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('sin ajuste, copiloto; el modo se cambia por cuenta', async () => {
    expect(await aiRepo.findAiMode(conn.db, 'u1')).toBe('copilot')
    expect(await aiRepo.setAiMode(conn.db, 'u1', 'readOnly')).toBe('readOnly')
    expect(await aiRepo.setAiMode(conn.db, 'u1', 'assistant')).toBe('assistant')
    expect(await aiRepo.findAiMode(conn.db, 'u1')).toBe('assistant')
    expect(await aiRepo.findAiMode(conn.db, 'u2')).toBe('copilot')
  })

  it('una petición entra pendiente y caduca a las 24 h', async () => {
    const created = await request()
    expect(created).toMatchObject({ status: 'pending', decidedAt: null, expiresAt: at(DAY) })
    expect((await aiRepo.listApprovals(conn.db, 'u1', at(DAY - 1))).pending.map((a) => a.id)).toEqual([created.id])
    const later = await aiRepo.listApprovals(conn.db, 'u1', at(DAY))
    expect(later.pending).toEqual([])
    expect(later.recent.map((a) => a.id)).toEqual([created.id])
  })

  it('cada cuenta ve solo sus peticiones', async () => {
    const mine = await request()
    expect(await aiRepo.findApproval(conn.db, 'u2', mine.id)).toBeNull()
    expect(await aiRepo.listApprovals(conn.db, 'u2', now)).toEqual({ pending: [], recent: [] })
    expect(await aiRepo.decideApproval(conn.db, { userId: 'u2', approvalId: mine.id, decision: 'approved', now })).toBe(
      null
    )
    expect((await aiRepo.findApproval(conn.db, 'u1', mine.id))?.status).toBe('pending')
  })

  it('se decide una sola vez: de dos aprobaciones a la vez, gana una', async () => {
    const created = await request()
    const decide = () =>
      aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: created.id, decision: 'approved', now })
    const results = await Promise.all([decide(), decide()])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(results.find(Boolean)).toMatchObject({ status: 'approved', decidedAt: now })
    expect(
      await aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: created.id, decision: 'rejected', now })
    ).toBeNull()
  })

  it('lo caducado ya no se puede aprobar', async () => {
    const created = await request()
    expect(
      await aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: created.id, decision: 'approved', now: at(DAY) })
    ).toBeNull()
  })

  it('al acabar se guarda lo que devolvió o el error, y pasa a las últimas', async () => {
    const done = await request()
    const failed = await request({ now: at(HOUR) })
    const rejected = await request({ now: at(2 * HOUR) })
    for (const id of [done.id, failed.id]) {
      await aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: id, decision: 'approved', now: at(3 * HOUR) })
    }
    await aiRepo.decideApproval(conn.db, {
      userId: 'u1',
      approvalId: rejected.id,
      decision: 'rejected',
      now: at(3 * HOUR)
    })
    await aiRepo.finishApproval(conn.db, done.id, { status: 'done', result: { url: 'https://crisol.test/unirse/x' } })
    await aiRepo.finishApproval(conn.db, failed.id, { status: 'failed', error: 'FORBIDDEN' })

    expect(await aiRepo.findApproval(conn.db, 'u1', done.id)).toMatchObject({
      status: 'done',
      result: { url: 'https://crisol.test/unirse/x' },
      error: null
    })
    const { pending, recent } = await aiRepo.listApprovals(conn.db, 'u1', at(3 * HOUR))
    expect(pending).toEqual([])
    // De la más reciente a la más antigua
    expect(recent.map((a) => [a.id, a.status, a.error])).toEqual([
      [rejected.id, 'rejected', null],
      [failed.id, 'failed', 'FORBIDDEN'],
      [done.id, 'done', null]
    ])
  })

  it('las pendientes salen por orden de llegada y las últimas tienen tope', async () => {
    const first = await request()
    const second = await request({ now: at(HOUR) })
    expect((await aiRepo.listApprovals(conn.db, 'u1', at(2 * HOUR))).pending.map((a) => a.id)).toEqual([
      first.id,
      second.id
    ])
    expect((await aiRepo.listApprovals(conn.db, 'u1', at(3 * DAY), 1)).recent.map((a) => a.id)).toEqual([second.id])
  })

  it('lo aprobado que se quedó haciéndose (un reinicio a medias) pasa a fallido', async () => {
    const stuck = await request()
    const recent = await request()
    await aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: stuck.id, decision: 'approved', now })
    await aiRepo.decideApproval(conn.db, { userId: 'u1', approvalId: recent.id, decision: 'approved', now: at(HOUR) })
    expect(await aiRepo.failInterruptedApprovals(conn.db, at(1))).toBe(1)
    expect(await aiRepo.findApproval(conn.db, 'u1', stuck.id)).toMatchObject({ status: 'failed', error: 'INTERRUPTED' })
    expect((await aiRepo.findApproval(conn.db, 'u1', recent.id))?.status).toBe('approved')
    // La purga diaria también, pasada una hora
    expect(await purge(conn.db, at(2 * HOUR + 1))).toMatchObject({ interrupted: 1 })
    expect((await aiRepo.findApproval(conn.db, 'u1', recent.id))?.status).toBe('failed')
  })

  it('la purga diaria se lleva las peticiones de más de 90 días', async () => {
    await request({ now: new Date(now.getTime() - 91 * DAY) })
    const recent = await request({ now: new Date(now.getTime() - 89 * DAY) })
    expect(await purge(conn.db, now)).toMatchObject({ approvals: 1 })
    expect((await conn.db.select().from(approvals)).map((a) => a.id)).toEqual([recent.id])
  })
})
