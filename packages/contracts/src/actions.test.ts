import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ACTIONS, defineAction, openApi } from './index.ts'

describe('acciones', () => {
  it('cada acción tiene un nombre único', () => {
    const names = ACTIONS.map((a) => a.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('defineAction conserva la definición tal cual', () => {
    const ping = defineAction({
      name: 'ping',
      kind: 'read',
      description: 'Prueba',
      input: z.object({}),
      output: z.object({})
    })
    expect(ping.kind).toBe('read')
  })

  it('un nombre de mundo se recorta y no puede quedar vacío', () => {
    const createWorld = ACTIONS.find((a) => a.name === 'createWorld')
    expect(createWorld?.input.safeParse({ name: '  Eana  ' })).toMatchObject({ success: true, data: { name: 'Eana' } })
    expect(createWorld?.input.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('la salida deja fuera lo que no está en el contrato', () => {
    const renameWorld = ACTIONS.find((a) => a.name === 'renameWorld')
    const row = {
      id: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      name: 'Eana',
      role: 'master',
      version: 2
    }
    expect(renameWorld?.output.parse({ ...row, createdBy: 'u1', secreto: 'x' })).toEqual(row)
  })
})

describe('openApi', () => {
  it('describe cada acción como POST /api/actions/<name> con sus esquemas', () => {
    const doc = openApi(ACTIONS) as { paths: Record<string, { post: { operationId: string } }> }
    expect(Object.keys(doc.paths)).toEqual(ACTIONS.map((a) => `/api/actions/${a.name}`))
    expect(doc.paths['/api/actions/createWorld']?.post.operationId).toBe('createWorld')
  })
})
