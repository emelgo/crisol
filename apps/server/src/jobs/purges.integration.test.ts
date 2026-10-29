import { randomUUID } from 'node:crypto'
import { connect, schema, trashRepo, worldsRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type PurgeJobs, startPurges } from './purges.ts'

const VALKEY_URL = process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790'
const DAY = 24 * 60 * 60 * 1000

describe('la purga diaria', () => {
  let conn: ReturnType<typeof connect>
  let jobs: PurgeJobs | undefined
  let organizationId: string

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_jobs'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(schema.user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
  })

  afterEach(async () => {
    await jobs?.close({ obliterate: true })
    jobs = undefined
  })

  afterAll(async () => {
    await conn?.close()
  })

  // Cada prueba, con su propio espacio en Valkey: no se pisan con otras ni con el desarrollo
  const start = (now: () => Date = () => new Date()) =>
    startPurges({ db: conn.db, valkeyUrl: VALKEY_URL, now, prefix: `crisol-prueba-${randomUUID()}` })

  it('queda programada cada día a las 4:00 de Madrid, una sola vez aunque arranque otra instancia', async () => {
    jobs = await start()
    const again = await startPurges({ db: conn.db, valkeyUrl: VALKEY_URL, prefix: jobs.prefix })
    const schedulers = await jobs.queue.getJobSchedulers()
    expect(schedulers).toMatchObject([{ key: 'purga-diaria', pattern: '0 4 * * *', tz: 'Europe/Madrid' }])
    await again.close()
  })

  it('el trabajo purga con su reloj: lo que lleva más de 30 días en la papelera se va', async () => {
    const world = await worldsRepo.createWorldWithMaster(
      conn.db,
      { organizationId, actorId: 'u1', via: 'ui', action: 'createWorld' },
      { organizationId, name: 'Eana', masterId: 'u1' }
    )
    await trashRepo.deleteWorld(conn.db, { organizationId, actorId: 'u1', via: 'ui', action: 'deleteWorld' }, world.id)
    // El reloj simulado: dentro de 31 días
    jobs = await start(() => new Date(Date.now() + 31 * DAY))
    expect(await jobs.runNow()).toMatchObject({ worlds: 1 })
    expect(await conn.db.select().from(schema.worlds)).toEqual([])
  })
})
