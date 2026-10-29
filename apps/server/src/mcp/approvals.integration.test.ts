import { aiRepo, connect, loadMemberships, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext, ActionEnv } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { createRealtime } from '../realtime/hub.ts'
import { TEST_SEAL_KEY } from '../testing.ts'
import { callAsAi, type ToolResult } from './approvals.ts'

const BASE_URL = 'https://crisol.test'

describe('la IA según el modo, y la cola de aprobación', () => {
  let conn: ReturnType<typeof connect>
  let env: ActionEnv
  let world: { id: string }
  let campaign: { id: string }

  const impl = (name: string) => {
    const found = implementationsByName.get(name)
    if (!found) throw new Error(`No existe la acción ${name}`)
    return found
  }
  /** El contexto de una petición, con las pertenencias de ahora */
  const as = async (userId: string, via: 'ui' | 'ai' = 'ui'): Promise<ActionContext> => ({
    ...env,
    actor: actorFrom(userId, await loadMemberships(conn.db, userId)),
    via
  })
  /** Una acción desde la interfaz (o como si la pidiera la IA sin pasar por el MCP) */
  const run = async (name: string, input: object, userId = 'u1', via: 'ui' | 'ai' = 'ui') =>
    impl(name).handler(await as(userId, via), impl(name).action.input.parse(input)) as Promise<Record<string, unknown>>
  /** Lo que pide Claude por la herramienta */
  const ai = (tool: string, name: string, input: object, waitMs = 50) =>
    callAsAi(env, {
      userId: 'u1',
      tool,
      impl: impl(name),
      input: impl(name).action.input.parse(input) as Record<string, unknown>,
      waitMs
    })
  const textOf = (result: ToolResult) => result.content.map((c) => c.text).join('\n')
  const pending = async () => (await aiRepo.listApprovals(conn.db, 'u1', new Date())).pending
  /** Espera a que la petición de la IA esté en la cola */
  const queued = async () => {
    for (let i = 0; i < 100; i++) {
      const [first] = await pending()
      if (first) return first
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('No llegó nada a la cola')
  }
  const operations = () => conn.db.select().from(schema.operations)
  const invitationUrl = async () => (await run('getInvitation', { campaignId: campaign.id })).url

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_approvals'), { max: 4 })
    env = {
      db: conn.db,
      publicUrl: BASE_URL,
      sealKey: TEST_SEAL_KEY,
      realtime: createRealtime(async (userId) => actorFrom(userId, await loadMemberships(conn.db, userId))),
      actions: implementationsByName
    }
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(schema.user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test' },
      { id: 'u2', name: 'Pepe', email: 'p@crisol.test' }
    ])
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: 'u1', role: 'owner' })
    world = (await run('createWorld', { name: 'Eana' })) as { id: string }
    campaign = (await run('createCampaign', { worldId: world.id, name: 'La Marca' })) as { id: string }
  })

  afterAll(async () => {
    await env?.realtime.idle()
    await conn?.close()
  })

  it('en copiloto, crear una campaña se hace sin preguntar y queda en el historial como hecho por la IA', async () => {
    const result = await ai('crear_campana', 'createCampaign', { worldId: world.id, name: 'Los Cuervos' })
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toMatchObject({ name: 'Los Cuervos', role: 'master' })
    expect((await operations()).find((op) => op.details.name === 'Los Cuervos')).toMatchObject({
      action: 'createCampaign',
      actorId: 'u1',
      via: 'ai',
      tool: 'crear_campana'
    })
    expect(await pending()).toEqual([])
  })

  it('en copiloto, regenerar el enlace espera; si se aprueba durante la espera, la herramienta contesta lo hecho', async () => {
    const before = await invitationUrl()
    const call = ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id }, 5000)
    const request = await queued()
    expect(request).toMatchObject({ tool: 'enlace_invitacion', action: 'regenerateInvitation' })
    expect(request.details).toEqual({ campaign: 'La Marca' })

    const approved = await run('approve', { approvalId: request.id })
    expect(approved).toMatchObject({ status: 'done', decidedAt: expect.any(String), error: null })
    const result = await call
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.url).toBe(await invitationUrl())
    expect(result.structuredContent?.url).not.toBe(before)
    expect((await operations()).find((op) => op.action === 'regenerateInvitation')).toMatchObject({
      actorId: 'u1',
      via: 'ai',
      tool: 'enlace_invitacion'
    })
  })

  it('sin decisión durante la espera, contesta «esperando la aprobación» y aprobarla después la hace', async () => {
    const before = await invitationUrl()
    const result = await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id })
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toMatch(/^PENDING_APPROVAL/)
    const [request] = await pending()
    expect(result.structuredContent).toEqual({
      approval: { id: request?.id, status: 'pending', expiresAt: request?.expiresAt.toISOString() }
    })
    expect(await invitationUrl()).toBe(before)

    expect(await run('approve', { approvalId: request?.id })).toMatchObject({ status: 'done' })
    expect(await invitationUrl()).not.toBe(before)
    expect((await operations()).find((op) => op.action === 'regenerateInvitation')?.via).toBe('ai')
  })

  it('rechazada, no se hace y la herramienta lo dice', async () => {
    const before = await invitationUrl()
    const call = ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id }, 5000)
    expect(await run('reject', { approvalId: (await queued()).id })).toMatchObject({ status: 'rejected' })
    const result = await call
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/^REJECTED/)
    expect(await invitationUrl()).toBe(before)
    expect((await operations()).some((op) => op.action === 'regenerateInvitation')).toBe(false)
  })

  it('en solo lectura, consulta pero no escribe ni pide nada', async () => {
    await run('setAiMode', { mode: 'readOnly' })
    expect((await ai('listar_mundos', 'listWorlds', {})).structuredContent).toMatchObject({
      worlds: [expect.objectContaining({ name: 'Eana' })]
    })
    const result = await ai('crear_campana', 'createCampaign', { worldId: world.id, name: 'Los Cuervos' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/^READ_ONLY/)
    expect(await pending()).toEqual([])
    expect((await operations()).some((op) => op.details.name === 'Los Cuervos')).toBe(false)
  })

  it('en asistente, crear una campaña también espera la aprobación', async () => {
    await run('setAiMode', { mode: 'assistant' })
    const result = await ai('crear_campana', 'createCampaign', { worldId: world.id, name: 'Los Cuervos' })
    expect(textOf(result)).toMatch(/^PENDING_APPROVAL/)
    expect((await pending()).map((a) => [a.action, a.details])).toEqual([['createCampaign', { world: 'Eana' }]])
  })

  it('lo que la cuenta no ve no entra en la cola: no existe', async () => {
    const result = await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: crypto.randomUUID() })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/^NOT_FOUND/)
    expect(await pending()).toEqual([])
  })

  it('caducada a las 24 h, ya no se puede aprobar y sale entre las últimas', async () => {
    await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id })
    const [request] = await pending()
    // El reloj, 24 h después: la petición se hizo ayer
    await conn.sql`update approvals set expires_at = ${new Date(Date.now() - 1000).toISOString()}`
    await expect(run('approve', { approvalId: request?.id })).rejects.toThrow('APPROVAL_EXPIRED')
    expect(await run('listApprovals', {})).toMatchObject({
      pending: [],
      recent: [{ id: request?.id, status: 'expired' }]
    })
  })

  it('aprobada cuando ya no se puede hacer, queda como fallida y con el porqué', async () => {
    await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id })
    const [request] = await pending()
    await run('deleteCampaign', { campaignId: campaign.id })
    expect(await run('approve', { approvalId: request?.id })).toMatchObject({ status: 'failed', error: 'NOT_FOUND' })
    await expect(run('approve', { approvalId: request?.id })).rejects.toThrow('ALREADY_DECIDED')
  })

  it('solo la propia cuenta ve y decide lo que pidió su IA', async () => {
    await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id })
    const [request] = await pending()
    expect(await run('listApprovals', {}, 'u2')).toEqual({ pending: [], recent: [] })
    await expect(run('approve', { approvalId: request?.id }, 'u2')).rejects.toThrow('approval')
    await expect(run('reject', { approvalId: request?.id }, 'u2')).rejects.toThrow('approval')
    expect((await pending()).map((a) => a.id)).toEqual([request?.id])
  })

  it('la IA no aprueba lo suyo ni cambia su modo', async () => {
    await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id })
    const [request] = await pending()
    await expect(run('approve', { approvalId: request?.id }, 'u1', 'ai')).rejects.toThrow('ai')
    await expect(run('setAiMode', { mode: 'copilot' }, 'u1', 'ai')).rejects.toThrow('ai')
    expect(await pending()).toHaveLength(1)
  })

  it('en copiloto, deshacer espera, con lo que deshace en el resumen; aprobado, se deshace', async () => {
    const created = (await operations()).find((op) => op.action === 'createCampaign')
    const result = await ai('deshacer', 'undoOperation', { operationId: created?.id })
    expect(textOf(result)).toMatch(/^PENDING_APPROVAL/)
    const listed = (await run('listApprovals', {})) as { pending: Array<{ id: string; details: object }> }
    expect(listed.pending).toEqual([
      expect.objectContaining({
        details: { operation: { action: 'createCampaign', details: { name: 'La Marca', world: 'Eana' } } }
      })
    ])
    expect(await run('approve', { approvalId: listed.pending[0]?.id })).toMatchObject({ status: 'done' })
    expect(await run('listCampaigns', { worldId: world.id })).toEqual({ campaigns: [] })
    expect((await operations()).find((op) => op.action === 'undoOperation')).toMatchObject({
      via: 'ai',
      tool: 'deshacer',
      undoesId: created?.id
    })
  })

  it('lo que devolvió lo aprobado se guarda cifrado: el enlace no queda en claro en la base de datos', async () => {
    const call = ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id }, 5000)
    await run('approve', { approvalId: (await queued()).id })
    const url = String((await call).structuredContent?.url)
    const [row] = await conn.db.select().from(schema.approvals)
    expect(JSON.stringify(row?.result)).not.toContain(url.split('/unirse/')[1])
    expect(row?.result).toEqual({ sealed: expect.any(String) })
  })

  it('con 20 peticiones esperando, no entra otra', async () => {
    for (let i = 0; i < 20; i++) await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id }, 1)
    const result = await ai('enlace_invitacion', 'regenerateInvitation', { campaignId: campaign.id }, 1)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/^TOO_MANY_PENDING/)
    expect(await pending()).toHaveLength(20)
  })

  it('los ajustes dicen el modo y la dirección del conector', async () => {
    expect(await run('getAiSettings', {})).toEqual({ mode: 'copilot', connectorUrl: `${BASE_URL}/mcp` })
    expect(await run('setAiMode', { mode: 'assistant' })).toEqual({
      mode: 'assistant',
      connectorUrl: `${BASE_URL}/mcp`
    })
    expect(await run('getAiSettings', {}, 'u2')).toMatchObject({ mode: 'copilot' })
  })
})
