import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ACTIONS, campaignTableView, defineAction, openApi, updatePage, updateWorld } from './index.ts'

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
      description: '',
      icon: null,
      color: null,
      cover: null,
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

describe('portadas', () => {
  const cover = { fileId: crypto.randomUUID(), x: 30, y: 70, zoom: 1.8 }

  it('la de un mundo guarda el encuadre y el acercamiento', () => {
    const input = updateWorld.input.parse({ worldId: crypto.randomUUID(), cover })
    expect(input.cover).toEqual(cover)
  })

  it('la de una página, también', () => {
    const input = updatePage.input.parse({ pageId: crypto.randomUUID(), cover })
    expect(input.cover).toEqual(cover)
  })

  it('el color de un mundo: uno de los fijos o uno propio', () => {
    const worldId = crypto.randomUUID()
    expect(updateWorld.input.parse({ worldId, color: '#aa3355' }).color).toBe('#aa3355')
    expect(updateWorld.input.parse({ worldId, color: 'wine' }).color).toBe('wine')
    expect(() => updateWorld.input.parse({ worldId, color: 'rojo' })).toThrow()
  })
})

describe('la mesa de una campaña', () => {
  it('lleva siempre su combate: el que hay o null', () => {
    const table = {
      campaignId: crypto.randomUUID(),
      open: null,
      presented: null,
      screenHidden: false,
      camera: { mode: 'follow' },
      tokens: []
    }
    expect(campaignTableView.safeParse(table).success).toBe(false)
    expect(campaignTableView.safeParse({ ...table, combat: null }).success).toBe(true)
  })
})
