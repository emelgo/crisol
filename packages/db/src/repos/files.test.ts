import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import type { OperationContext } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { operations } from '../schema/history.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as documentsRepo from './documents.ts'
import * as filesRepo from './files.ts'
import * as pagesRepo from './pages.ts'
import * as tagsRepo from './tags.ts'
import { undoOperation } from './undo.ts'
import * as worldsRepo from './worlds.ts'

describe('archivos, sus carpetas y sus etiquetas', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  let worldId: string
  const ctx = (action: string): OperationContext => ({ organizationId, actorId: 'u1', via: 'ui', action })
  const lastOperation = async (action: string) => {
    const found = (await conn.db.select().from(operations)).filter((op) => op.action === action).at(-1)
    if (!found) throw new Error(`sin ${action}`)
    return found
  }
  const file = (name: string, folderId: string | null = null) =>
    filesRepo.createFile(conn.db, ctx('uploadFile'), {
      organizationId,
      worldId,
      folderId,
      name,
      kind: 'image',
      mime: 'image/png',
      size: 10,
      hash: crypto.randomUUID(),
      storageKey: crypto.randomUUID()
    })
  const folder = (name: string, parentId: string | null = null) =>
    filesRepo.createFolder(conn.db, ctx('createFolder'), { organizationId, worldId, parentId, name })
  const positions = (rows: { name: string; position: string | null }[]) =>
    Object.fromEntries(rows.map((row) => [row.name, row.position]))

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_files'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
    const world = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    worldId = world.id
  })

  afterAll(async () => {
    await conn?.close()
  })

  describe('mover y ordenar', () => {
    it('mover un archivo lo mete en la carpeta y guarda a la vez los puestos de sus hermanos', async () => {
      const place = await folder('Mapas')
      const a = await file('a.png', place.id)
      const b = await file('b.png', place.id)
      const moving = await file('c.png')
      const moved = await filesRepo.moveFile(
        conn.db,
        ctx('moveFile'),
        moving.id,
        { folderId: place.id, position: 'a1' },
        [
          { id: a.id, position: 'a0' },
          { id: b.id, position: 'a2' }
        ]
      )
      expect(moved).toMatchObject({ folderId: place.id, position: 'a1' })
      expect(positions(await filesRepo.filesIn(conn.db, { worldId }, place.id))).toEqual({
        'a.png': 'a0',
        'b.png': 'a2',
        'c.png': 'a1'
      })
      expect(await filesRepo.filesIn(conn.db, { worldId }, null)).toEqual([])
      // Una operación: deshacerla devuelve los tres como estaban
      await undoOperation(conn.db, ctx('undo'), (await lastOperation('moveFile')).id)
      expect(positions(await filesRepo.filesIn(conn.db, { worldId }, place.id))).toEqual({
        'a.png': null,
        'b.png': null
      })
    })

    it('meter varios en una carpeta los deja detrás y por nombre, archivos y carpetas', async () => {
      const target = await folder('Destino')
      const sub = await folder('Sub')
      const f = await file('f.png')
      await filesRepo.moveFile(conn.db, ctx('moveFile'), f.id, { folderId: null, position: 'a5' })
      await filesRepo.updateFolder(conn.db, ctx('updateFolder'), sub.id, { position: 'a3' })
      await filesRepo.moveItems(conn.db, ctx('moveFiles'), {
        fileIds: [f.id],
        folderIds: [sub.id],
        folderId: target.id
      })
      expect(await filesRepo.filesIn(conn.db, { worldId }, target.id)).toEqual([
        { id: f.id, name: 'f.png', position: null }
      ])
      expect(await filesRepo.foldersIn(conn.db, { worldId }, target.id)).toEqual([
        { id: sub.id, name: 'Sub', position: null }
      ])
      expect((await filesRepo.foldersIn(conn.db, { worldId }, null)).map((x) => x.name)).toEqual(['Destino'])
    })

    it('cambiar una carpeta guarda también los puestos de sus hermanas', async () => {
      const a = await folder('A')
      const b = await folder('B')
      const changed = await filesRepo.updateFolder(
        conn.db,
        ctx('updateFolder'),
        b.id,
        { position: 'a0', color: 'wine', icon: '🗺️' },
        [{ id: a.id, position: 'a1' }]
      )
      expect(changed).toMatchObject({ position: 'a0', color: 'wine', icon: '🗺️' })
      expect(positions(await filesRepo.foldersIn(conn.db, { worldId }, null))).toEqual({ A: 'a1', B: 'a0' })
    })
  })

  describe('borrar', () => {
    it('borrar una carpeta quita las de dentro y manda sus archivos a la papelera; deshacerlo lo devuelve', async () => {
      const top = await folder('Mapas')
      const inner = await folder('Viejos', top.id)
      const loose = await file('suelto.png')
      const a = await file('a.png', top.id)
      const b = await file('b.png', inner.id)
      await filesRepo.moveFile(conn.db, ctx('moveFile'), a.id, { folderId: top.id, position: 'a0' })

      expect(await filesRepo.deleteFolder(conn.db, ctx('deleteFolder'), top.id)).toBe(2)
      expect(await filesRepo.findFolder(conn.db, top.id)).toBeNull()
      expect(await filesRepo.findFolder(conn.db, inner.id)).toBeNull()
      expect((await filesRepo.listFiles(conn.db, { worldId })).map((f) => f.id)).toEqual([loose.id])
      // En la papelera, fuera de su carpeta y sin su puesto
      expect(await filesRepo.findFile(conn.db, a.id, { trashed: true })).toMatchObject({
        folderId: null,
        position: null
      })

      await undoOperation(conn.db, ctx('undo'), (await lastOperation('deleteFolder')).id)
      expect(await filesRepo.findFolder(conn.db, inner.id)).toMatchObject({ parentId: top.id })
      expect(await filesRepo.findFile(conn.db, a.id)).toMatchObject({ folderId: top.id, position: 'a0' })
      expect(await filesRepo.findFile(conn.db, b.id)).toMatchObject({ folderId: inner.id })
    })

    it('borrar a la vez archivos sueltos y una carpeta cuenta cada archivo una vez', async () => {
      const place = await folder('Mapas')
      const inside = await file('dentro.png', place.id)
      const loose = await file('suelto.png')
      const kept = await file('queda.png')
      const count = await filesRepo.trashItems(conn.db, ctx('deleteFiles'), {
        fileIds: [loose.id, inside.id],
        folderIds: [place.id]
      })
      expect(count).toBe(2)
      expect((await filesRepo.listFiles(conn.db, { worldId })).map((f) => f.id)).toEqual([kept.id])
    })

    it('borrar solo archivos no toca las carpetas', async () => {
      const place = await folder('Mapas')
      const loose = await file('suelto.png')
      expect(await filesRepo.trashItems(conn.db, ctx('deleteFiles'), { fileIds: [loose.id], folderIds: [] })).toBe(1)
      expect(await filesRepo.findFolder(conn.db, place.id)).not.toBeNull()
    })
  })

  describe('etiquetas', () => {
    it('ordenarlas guarda el puesto de las guardadas y guarda las que no lo estaban, en una operación', async () => {
      await tagsRepo.createRow(conn.db, ctx('createTag'), { organizationId, name: 'Lugar', color: 'wine' })
      const before = (await conn.db.select().from(operations)).length
      await tagsRepo.setPositions(conn.db, ctx('moveTag'), organizationId, [
        { name: 'lugar', position: 'a1' },
        { name: 'Gente', position: 'a0' }
      ])
      expect(await conn.db.select().from(operations)).toHaveLength(before + 1)
      const rows = await tagsRepo.listRows(conn.db, organizationId)
      expect(rows.map((r) => [r.name, r.color, r.position]).toSorted()).toEqual([
        ['Gente', null, 'a0'],
        ['Lugar', 'wine', 'a1']
      ])
    })

    it('renombrar a una que ya existe se queda con esa y le pasa el color si no tenía', async () => {
      await tagsRepo.createRow(conn.db, ctx('createTag'), { organizationId, name: 'Ciudad', color: 'teal' })
      await tagsRepo.createRow(conn.db, ctx('createTag'), { organizationId, name: 'Pueblo', color: null })
      await tagsRepo.retag(conn.db, ctx('renameTag'), organizationId, 'Ciudad', 'Pueblo')
      expect((await tagsRepo.listRows(conn.db, organizationId)).map((r) => [r.name, r.color])).toEqual([
        ['Pueblo', 'teal']
      ])
    })

    it('renombrar a una que ya tiene color le deja el suyo', async () => {
      await tagsRepo.createRow(conn.db, ctx('createTag'), { organizationId, name: 'Ciudad', color: 'teal' })
      await tagsRepo.createRow(conn.db, ctx('createTag'), { organizationId, name: 'Pueblo', color: 'wine' })
      await tagsRepo.retag(conn.db, ctx('renameTag'), organizationId, 'Ciudad', 'Pueblo')
      expect((await tagsRepo.listRows(conn.db, organizationId)).map((r) => [r.name, r.color])).toEqual([
        ['Pueblo', 'wine']
      ])
    })

    it('renombrar sin cambiar de madre conserva el puesto; cambiar de madre lo pierde (sus hijas, el suyo no)', async () => {
      await tagsRepo.setPositions(conn.db, ctx('moveTag'), organizationId, [
        { name: 'lugar', position: 'a0' },
        { name: 'lugar/ciudad', position: 'a1' },
        { name: 'lugar/ciudad/barrio', position: 'a2' }
      ])
      await tagsRepo.retag(conn.db, ctx('renameTag'), organizationId, 'lugar/ciudad', 'lugar/urbe')
      expect(positions(await tagsRepo.listRows(conn.db, organizationId))).toEqual({
        lugar: 'a0',
        'lugar/urbe': 'a1',
        'lugar/urbe/barrio': 'a2'
      })
      await tagsRepo.retag(conn.db, ctx('moveTag'), organizationId, 'lugar/urbe', 'sitio/urbe')
      expect(positions(await tagsRepo.listRows(conn.db, organizationId))).toEqual({
        lugar: 'a0',
        'sitio/urbe': null,
        'sitio/urbe/barrio': 'a2'
      })
    })

    it('deja a cada archivo sus etiquetas, todos en una operación que se deshace de una vez', async () => {
      const a = await file('a.png')
      const b = await file('b.png')
      await tagsRepo.setManyFileTags(conn.db, ctx('tagFiles'), [
        { id: a.id, tags: ['mapa'] },
        { id: b.id, tags: ['mapa', 'ciudad'] }
      ])
      expect((await filesRepo.findFile(conn.db, a.id))?.tags).toEqual(['mapa'])
      expect((await filesRepo.findFile(conn.db, b.id))?.tags).toEqual(['mapa', 'ciudad'])
      await undoOperation(conn.db, ctx('undo'), (await lastOperation('tagFiles')).id)
      expect((await filesRepo.findFile(conn.db, a.id))?.tags).toEqual([])
      expect((await filesRepo.findFile(conn.db, b.id))?.tags).toEqual([])
    })
  })

  describe('barrido de documentos', () => {
    it('recorre todos los documentos por tandas, en orden de id, y cambia el estado de uno', async () => {
      const ids: string[] = []
      for (let n = 0; n < 5; n++) {
        const page = await pagesRepo.createPage(conn.db, ctx('createPage'), {
          worldId,
          title: `P${n}`,
          placement: { parentId: null }
        })
        ids.push(
          await documentsRepo.createSeparate(conn.db, {
            pageId: page.id,
            worldId,
            kind: 'secret',
            state: new Uint8Array([n]),
            userId: 'u1'
          })
        )
      }
      const batches: string[][] = []
      for await (const rows of documentsRepo.allStates(conn.db, 2)) batches.push(rows.map((row) => row.id))
      expect(batches.map((batch) => batch.length)).toEqual([2, 2, 1])
      expect(batches.flat()).toEqual(ids.toSorted())

      const target = ids[0] ?? ''
      await documentsRepo.replaceState(conn.db, target, new Uint8Array([42]))
      expect([...((await documentsRepo.findSeparate(conn.db, target))?.state ?? [])]).toEqual([42])
    })

    it('sin documentos no da ninguna tanda', async () => {
      const batches = []
      for await (const rows of documentsRepo.allStates(conn.db)) batches.push(rows)
      expect(batches).toEqual([])
    })
  })
})
