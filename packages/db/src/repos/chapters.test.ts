import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import type { OperationContext } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { operations } from '../schema/history.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as chaptersRepo from './chapters.ts'
import * as systemsRepo from './systems.ts'
import { undoOperation } from './undo.ts'

describe('capítulos de los libros de un sistema (ADR-0025)', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  let systemId: string
  const ctx = (action: string): OperationContext => ({ organizationId, actorId: 'u1', via: 'ui', action })
  const lastOperation = async (action: string) => {
    const found = (await conn.db.select().from(operations)).filter((op) => op.action === action).at(-1)
    if (!found) throw new Error(`sin ${action}`)
    return found
  }
  const chapter = (source: string, title: string, markdown = `# ${title}`) =>
    chaptersRepo.createChapter(conn.db, ctx('createChapter'), { systemId, source, title, markdown })
  const titles = async (source?: string) =>
    (await chaptersRepo.listChapters(conn.db, systemId, source)).map((c) => `${c.source}:${c.position}:${c.title}`)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_chapters'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
    const system = await systemsRepo.createSystem(conn.db, ctx('createSystem'), {
      id: crypto.randomUUID(),
      organizationId,
      basedOn: null,
      document: { name: 'Mi sistema', sources: [{ id: 'basico' }, { id: 'extra' }] }
    })
    systemId = system.id
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('cada capítulo nuevo va al final de su libro, y cada libro lleva su propia cuenta', async () => {
    await chapter('basico', 'Introducción')
    await chapter('extra', 'Anexo')
    await chapter('basico', 'Combate')
    expect(await titles()).toEqual(['basico:0:Introducción', 'basico:1:Combate', 'extra:0:Anexo'])
    expect(await titles('extra')).toEqual(['extra:0:Anexo'])
    expect(Object.fromEntries(await chaptersRepo.chapterCounts(conn.db, systemId))).toEqual({ basico: 2, extra: 1 })
  })

  it('la lista va sin texto; con texto, para exportar, y uno se encuentra por su id', async () => {
    const made = await chapter('basico', 'Magia', '# Magia\n\nLos conjuros…')
    const [summary] = await chaptersRepo.listChapters(conn.db, systemId)
    expect(summary).not.toHaveProperty('markdown')
    expect((await chaptersRepo.chaptersWithText(conn.db, systemId)).map((c) => c.markdown)).toEqual([
      '# Magia\n\nLos conjuros…'
    ])
    expect(await chaptersRepo.findChapter(conn.db, made.id)).toMatchObject({ title: 'Magia', version: 1 })
    expect(await chaptersRepo.findChapter(conn.db, crypto.randomUUID())).toBeNull()
  })

  it('insertar varios de golpe los numera en el orden dado dentro de cada libro, en una operación', async () => {
    const before = (await conn.db.select().from(operations)).length
    const made = await chaptersRepo.insertChapters(conn.db, ctx('importSystem'), systemId, [
      { source: 'basico', title: 'Uno', markdown: '' },
      { source: 'extra', title: 'A', markdown: '' },
      { source: 'basico', title: 'Dos', markdown: '' }
    ])
    expect(made).toHaveLength(3)
    expect(await titles()).toEqual(['basico:0:Uno', 'basico:1:Dos', 'extra:0:A'])
    expect(await conn.db.select().from(operations)).toHaveLength(before + 1)
  })

  it('insertar ninguno no hace nada', async () => {
    expect(await chaptersRepo.insertChapters(conn.db, ctx('importSystem'), systemId, [])).toEqual([])
    expect(await titles()).toEqual([])
  })

  it('cambiar uno pide su versión: con la buena sube; con una vieja, no pisa nada', async () => {
    const made = await chapter('basico', 'Magia')
    const changed = await chaptersRepo.updateChapter(conn.db, ctx('updateChapter'), made.id, 1, {
      title: 'Hechicería',
      markdown: '# Hechicería'
    })
    expect(changed).toMatchObject({ title: 'Hechicería', markdown: '# Hechicería', version: 2 })
    await expect(
      chaptersRepo.updateChapter(conn.db, ctx('updateChapter'), made.id, 1, { title: 'Otra' })
    ).rejects.toBeInstanceOf(chaptersRepo.ChapterChangedError)
    await expect(
      chaptersRepo.updateChapter(conn.db, ctx('updateChapter'), crypto.randomUUID(), 1, { title: 'Nada' })
    ).rejects.toThrow('El capítulo cambió mientras tanto')
    expect((await chaptersRepo.findChapter(conn.db, made.id))?.title).toBe('Hechicería')
  })

  it('ordenar pone los nombrados delante y el resto detrás en el suyo, sin tocar los que ya estaban', async () => {
    const a = await chapter('basico', 'A')
    const b = await chapter('basico', 'B')
    const c = await chapter('basico', 'C')
    const d = await chapter('basico', 'D')
    const other = await chapter('extra', 'X')
    // Uno de otro libro y uno que no existe no cuentan
    const order = await chaptersRepo.orderChapters(conn.db, ctx('orderChapters'), systemId, 'basico', [
      c.id,
      other.id,
      a.id,
      crypto.randomUUID()
    ])
    expect(order).toEqual([c.id, a.id, b.id, d.id])
    expect(await titles('basico')).toEqual(['basico:0:C', 'basico:1:A', 'basico:2:B', 'basico:3:D'])
    expect(await titles('extra')).toEqual(['extra:0:X'])
    // D ya estaba en su puesto: no cambia de versión
    expect((await chaptersRepo.findChapter(conn.db, d.id))?.version).toBe(1)
    await undoOperation(conn.db, ctx('undo'), (await lastOperation('orderChapters')).id)
    expect(await titles('basico')).toEqual(['basico:0:A', 'basico:1:B', 'basico:2:C', 'basico:3:D'])
  })

  it('borrar uno se deshace desde el historial', async () => {
    const made = await chapter('basico', 'Magia')
    await chaptersRepo.deleteChapter(conn.db, ctx('deleteChapter'), made.id)
    expect(await chaptersRepo.findChapter(conn.db, made.id)).toBeNull()
    await undoOperation(conn.db, ctx('undo'), (await lastOperation('deleteChapter')).id)
    expect(await chaptersRepo.findChapter(conn.db, made.id)).toMatchObject({ title: 'Magia' })
  })

  it('da los ids de los capítulos de un libro', async () => {
    const a = await chapter('basico', 'A')
    const b = await chapter('basico', 'B')
    await chapter('extra', 'X')
    expect((await chaptersRepo.chapterIdsOf(conn.db, systemId, 'basico')).toSorted()).toEqual([a.id, b.id].toSorted())
    expect(await chaptersRepo.chapterIdsOf(conn.db, systemId, 'nada')).toEqual([])
  })

  it('quitar un libro se lleva sus capítulos (y no los de otro); deshacerlo los devuelve', async () => {
    await chapter('basico', 'A')
    await chapter('extra', 'X')
    await chapter('extra', 'Y')
    const system = await systemsRepo.findSystem(conn.db, systemId)
    const result = await systemsRepo.deleteBook(
      conn.db,
      ctx('deleteBook'),
      systemId,
      system?.version ?? 0,
      { name: 'Mi sistema', sources: [{ id: 'basico' }] },
      'extra'
    )
    expect(result.system.document).toEqual({ name: 'Mi sistema', sources: [{ id: 'basico' }] })
    expect(await titles()).toEqual(['basico:0:A'])
    await undoOperation(conn.db, ctx('undo'), (await lastOperation('deleteBook')).id)
    expect(await titles()).toEqual(['basico:0:A', 'extra:0:X', 'extra:1:Y'])
  })
})
