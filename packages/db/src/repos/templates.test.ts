import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import type { OperationContext } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { operations } from '../schema/history.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { pages } from '../schema/pages.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as mapsRepo from './maps.ts'
import * as pagesRepo from './pages.ts'
import * as templatesRepo from './templates.ts'
import { undoOperation } from './undo.ts'
import * as worldsRepo from './worlds.ts'

describe('plantillas como páginas (ADR-0024)', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  const ctx = (action: string): OperationContext => ({ organizationId, actorId: 'u1', via: 'ui', action })
  const lastOperation = async (action: string) => {
    const found = (await conn.db.select().from(operations)).filter((op) => op.action === action).at(-1)
    if (!found) throw new Error(`sin ${action}`)
    return found
  }

  /** Una plantilla con su página en el mundo de las plantillas */
  const template = async (name: string, values: { folderId?: string | null; icon?: string | null } = {}) => {
    const world = await worldsRepo.templatesWorld(conn.db, organizationId)
    const id = crypto.randomUUID()
    return templatesRepo.createTemplateWithPage(conn.db, ctx('createTemplate'), {
      worldId: world.id,
      page: { title: name, icon: values.icon ?? null },
      template: {
        id,
        organizationId,
        basedOn: null,
        line: [id],
        name,
        icon: '📄',
        fields: [],
        panel: [],
        skeleton: '',
        folderId: values.folderId ?? null
      }
    })
  }
  const folder = (name: string, parentId: string | null = null) =>
    templatesRepo.createTemplateFolder(conn.db, ctx('createTemplateFolder'), { organizationId, parentId, name })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_templates'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
  })

  afterAll(async () => {
    await conn?.close()
  })

  describe('el mundo de las plantillas', () => {
    it('se crea la primera vez y después se reutiliza, sin máster ni historial', async () => {
      const first = await worldsRepo.templatesWorld(conn.db, organizationId)
      const second = await worldsRepo.templatesWorld(conn.db, organizationId)
      expect(second.id).toBe(first.id)
      expect(await worldsRepo.findWorld(conn.db, first.id)).toMatchObject({ name: 'Plantillas', purpose: 'templates' })
      expect(await worldsRepo.listMemberWorlds(conn.db, 'u1')).toEqual([])
      expect(await conn.db.select().from(operations)).toEqual([])
    })

    it('dos peticiones a la vez acaban en el mismo mundo', async () => {
      const [a, b] = await Promise.all([
        worldsRepo.templatesWorld(conn.db, organizationId),
        worldsRepo.templatesWorld(conn.db, organizationId)
      ])
      expect(a.id).toBe(b.id)
    })
  })

  describe('crear y cambiar', () => {
    it('crea su página y su ficha en una sola operación, y la página dice de qué plantilla es', async () => {
      const made = await template('PNJ', { icon: '🧙' })
      expect(made.pageId).not.toBeNull()
      const page = await pagesRepo.findPage(conn.db, made.pageId ?? '')
      expect(page).toMatchObject({ title: 'PNJ', icon: '🧙', parentId: null })
      expect(await templatesRepo.templateOfPage(conn.db, made.pageId ?? '')).toMatchObject({ id: made.id, name: 'PNJ' })
      expect((await conn.db.select().from(operations)).filter((op) => op.action === 'createTemplate')).toHaveLength(1)
    })

    it('una página que no es de ninguna plantilla, o de una apartada, no da plantilla', async () => {
      const made = await template('PNJ')
      const world = await worldsRepo.templatesWorld(conn.db, organizationId)
      const loose = await pagesRepo.createPage(conn.db, ctx('createPage'), {
        worldId: world.id,
        title: 'Suelta',
        placement: { parentId: null }
      })
      expect(await templatesRepo.templateOfPage(conn.db, loose.id)).toBeUndefined()
      await templatesRepo.deleteTemplate(conn.db, ctx('deleteTemplate'), made.id)
      expect(await templatesRepo.templateOfPage(conn.db, made.pageId ?? '')).toBeUndefined()
    })

    it('cambiar el título de su página renombra también la ficha', async () => {
      const made = await template('PNJ')
      const updated = await templatesRepo.updateTemplatePage(conn.db, ctx('updateTemplate'), {
        templateId: made.id,
        pageId: made.pageId ?? '',
        page: { title: 'Personaje no jugador', properties: [{ id: 'f1', type: 'text', name: 'Raza', value: '' }] }
      })
      expect(updated).toMatchObject({ name: 'Personaje no jugador', version: 2 })
      expect(await pagesRepo.findPage(conn.db, made.pageId ?? '')).toMatchObject({
        title: 'Personaje no jugador',
        properties: [{ id: 'f1', type: 'text', name: 'Raza', value: '' }]
      })
    })

    it('sin cambios en la página, la ficha conserva su nombre y la página no se toca', async () => {
      const made = await template('PNJ')
      const [before] = await conn.db
        .select()
        .from(pages)
        .where(eq(pages.id, made.pageId ?? ''))
      const updated = await templatesRepo.updateTemplatePage(conn.db, ctx('updateTemplate'), {
        templateId: made.id,
        pageId: made.pageId ?? '',
        page: {}
      })
      expect(updated.name).toBe('PNJ')
      const [after] = await conn.db
        .select()
        .from(pages)
        .where(eq(pages.id, made.pageId ?? ''))
      expect(after?.version).toBe(before?.version)
    })

    it('cambiar solo el icono no renombra la ficha', async () => {
      const made = await template('Lugar')
      const updated = await templatesRepo.updateTemplatePage(conn.db, ctx('updateTemplate'), {
        templateId: made.id,
        pageId: made.pageId ?? '',
        page: { icon: '🏰' }
      })
      expect(updated.name).toBe('Lugar')
      expect((await pagesRepo.findPage(conn.db, made.pageId ?? ''))?.icon).toBe('🏰')
    })
  })

  describe('carpetas y orden', () => {
    it('las carpetas salen por nombre sin mirar mayúsculas, y se buscan por su id', async () => {
      const b = await folder('bestias')
      await folder('Aliados')
      await folder('Ciudades', b.id)
      expect((await templatesRepo.listTemplateFolders(conn.db, organizationId)).map((f) => f.name)).toEqual([
        'Aliados',
        'bestias',
        'Ciudades'
      ])
      expect(await templatesRepo.findTemplateFolder(conn.db, b.id)).toMatchObject({ name: 'bestias', parentId: null })
      expect(await templatesRepo.findTemplateFolder(conn.db, crypto.randomUUID())).toBeNull()
    })

    it('templateFoldersIn distingue las de lo más alto de las de dentro de otra', async () => {
      const top = await folder('Gente')
      const inner = await folder('Nobles', top.id)
      expect((await templatesRepo.templateFoldersIn(conn.db, organizationId, null)).map((f) => f.id)).toEqual([top.id])
      expect((await templatesRepo.templateFoldersIn(conn.db, organizationId, top.id)).map((f) => f.id)).toEqual([
        inner.id
      ])
    })

    it('un nombre no se repite entre hermanas, aunque cambien las mayúsculas', async () => {
      await folder('Gente')
      await expect(folder('gente')).rejects.toThrow()
    })

    it('cambiar una carpeta guarda a la vez los puestos de sus hermanas', async () => {
      const a = await folder('A')
      const b = await folder('B')
      const c = await folder('C')
      const changed = await templatesRepo.updateTemplateFolder(
        conn.db,
        ctx('updateTemplateFolder'),
        c.id,
        { position: 'a0', color: 'wine', icon: '🗡️' },
        [
          { id: a.id, position: 'a1' },
          { id: b.id, position: 'a2' }
        ]
      )
      expect(changed).toMatchObject({ position: 'a0', color: 'wine', icon: '🗡️' })
      const order = await templatesRepo.templateFoldersIn(conn.db, organizationId, null)
      expect(Object.fromEntries(order.map((f) => [f.name, f.position]))).toEqual({ A: 'a1', B: 'a2', C: 'a0' })
      // Una sola operación: deshacerla devuelve las tres como estaban
      await undoOperation(conn.db, ctx('undo'), (await lastOperation('updateTemplateFolder')).id)
      const back = await templatesRepo.templateFoldersIn(conn.db, organizationId, null)
      expect(back.every((f) => f.position === null)).toBe(true)
    })

    it('mover una plantilla la cambia de carpeta y ordena a la vez sus hermanas', async () => {
      const place = await folder('Gente')
      const a = await template('Aldeano', { folderId: place.id })
      const b = await template('Bardo', { folderId: place.id })
      const moving = await template('Caballero')
      expect((await templatesRepo.templatesIn(conn.db, organizationId, null)).map((t) => t.id)).toEqual([moving.id])
      const moved = await templatesRepo.moveTemplate(
        conn.db,
        ctx('moveTemplate'),
        moving.id,
        { folderId: place.id, position: 'a1' },
        [
          { id: a.id, position: 'a0' },
          { id: b.id, position: 'a2' }
        ]
      )
      expect(moved).toMatchObject({ folderId: place.id, position: 'a1' })
      const inside = await templatesRepo.templatesIn(conn.db, organizationId, place.id)
      expect(inside.toSorted((x, y) => (x.position ?? '').localeCompare(y.position ?? ''))).toEqual([
        { id: a.id, name: 'Aldeano', position: 'a0' },
        { id: moving.id, name: 'Caballero', position: 'a1' },
        { id: b.id, name: 'Bardo', position: 'a2' }
      ])
      expect(await templatesRepo.templatesIn(conn.db, organizationId, null)).toEqual([])
    })

    it('templatesIn da el nombre de su página (el que se ve) y deja fuera las apartadas', async () => {
      const kept = await template('PNJ')
      const gone = await template('Viejo')
      await conn.db
        .update(pages)
        .set({ title: 'Personaje' })
        .where(eq(pages.id, kept.pageId ?? ''))
      await templatesRepo.deleteTemplate(conn.db, ctx('deleteTemplate'), gone.id)
      expect(await templatesRepo.templatesIn(conn.db, organizationId, null)).toEqual([
        { id: kept.id, name: 'Personaje', position: null }
      ])
    })

    it('sin página, templatesIn da el nombre de la ficha', async () => {
      const id = crypto.randomUUID()
      await templatesRepo.createTemplate(conn.db, ctx('createTemplate'), {
        id,
        organizationId,
        basedOn: null,
        line: [id],
        name: 'Antigua',
        icon: '📄',
        fields: [],
        panel: [],
        skeleton: ''
      })
      expect(await templatesRepo.templatesIn(conn.db, organizationId, null)).toEqual([
        { id, name: 'Antigua', position: null }
      ])
    })

    it('borrar una carpeta quita las de dentro y aparta sus plantillas; deshacerlo lo devuelve todo', async () => {
      const top = await folder('Gente')
      const inner = await folder('Nobles', top.id)
      const deepest = await folder('Reyes', inner.id)
      const other = await folder('Lugares')
      const a = await template('Aldeano', { folderId: top.id })
      const k = await template('Rey', { folderId: deepest.id })
      const outside = await template('Ciudad', { folderId: other.id })
      await templatesRepo.moveTemplate(conn.db, ctx('moveTemplate'), a.id, { folderId: top.id, position: 'a0' })

      const count = await templatesRepo.deleteTemplateFolder(conn.db, ctx('deleteTemplateFolder'), top.id)
      expect(count).toBe(2)
      expect((await templatesRepo.listTemplateFolders(conn.db, organizationId)).map((f) => f.name)).toEqual(['Lugares'])
      expect((await templatesRepo.listTemplates(conn.db, organizationId)).map((t) => t.id)).toEqual([outside.id])
      const apart = await templatesRepo.listTemplates(conn.db, organizationId, true)
      expect(apart.map((t) => [t.id, t.folderId, t.position])).toEqual([
        [a.id, null, null],
        [k.id, null, null]
      ])
      // Sus páginas no cambian
      expect(await pagesRepo.findPage(conn.db, a.pageId ?? '')).not.toBeNull()

      await undoOperation(conn.db, ctx('undo'), (await lastOperation('deleteTemplateFolder')).id)
      expect((await templatesRepo.listTemplateFolders(conn.db, organizationId)).map((f) => f.name)).toEqual([
        'Gente',
        'Lugares',
        'Nobles',
        'Reyes'
      ])
      expect(await templatesRepo.findTemplate(conn.db, k.id)).toMatchObject({ folderId: deepest.id, deletedAt: null })
      expect(await templatesRepo.findTemplate(conn.db, a.id)).toMatchObject({ folderId: top.id, position: 'a0' })
    })

    it('borrar una carpeta vacía no aparta nada', async () => {
      const empty = await folder('Vacía')
      expect(await templatesRepo.deleteTemplateFolder(conn.db, ctx('deleteTemplateFolder'), empty.id)).toBe(0)
      expect(await templatesRepo.findTemplateFolder(conn.db, empty.id)).toBeNull()
    })
  })

  describe('usos y pestañas', () => {
    it('cuenta las páginas de los mundos que usan cada plantilla, sin la papelera ni el mundo de las plantillas', async () => {
      const npc = await template('PNJ')
      const place = await template('Lugar')
      const unused = await template('Facción')
      const eana = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      const made: string[] = []
      for (const title of ['Ana', 'Berto', 'Carla', 'Ciudad']) {
        const page = await pagesRepo.createPage(conn.db, ctx('createPage'), {
          worldId: eana.id,
          title,
          placement: { parentId: null }
        })
        made.push(page.id)
      }
      const [ana, berto, carla, city] = made
      for (const id of [ana, berto, carla]) {
        await conn.db
          .update(pages)
          .set({ template: npc.id })
          .where(eq(pages.id, id ?? ''))
      }
      await conn.db
        .update(pages)
        .set({ template: place.id })
        .where(eq(pages.id, city ?? ''))
      // Una en la papelera no cuenta
      await pagesRepo.deletePageTree(conn.db, ctx('deletePage'), carla ?? '')
      // La página de la propia plantilla (en el mundo oculto) tampoco
      await conn.db
        .update(pages)
        .set({ template: npc.id })
        .where(eq(pages.id, npc.pageId ?? ''))

      const uses = await templatesRepo.templateUses(conn.db, organizationId, [npc.id, place.id, unused.id])
      expect(Object.fromEntries(uses)).toEqual({ [npc.id]: 2, [place.id]: 1 })
      expect((await templatesRepo.templateUses(conn.db, organizationId, [])).size).toBe(0)
    })

    it('da las pestañas de cada página en su orden, y nada si no se piden', async () => {
      const npc = await template('PNJ')
      const place = await template('Lugar')
      const world = await worldsRepo.templatesWorld(conn.db, organizationId)
      const tab = (pageId: string, name: string, kind: 'map' | 'table', position: string) =>
        mapsRepo.createTab(conn.db, ctx('createTab'), { worldId: world.id, pageId, kind, name, position })
      const second = await tab(npc.pageId ?? '', 'Tesoro', 'table', 'a1')
      const first = await tab(npc.pageId ?? '', 'Mapa', 'map', 'a0')
      const map = await tab(place.pageId ?? '', 'Plano', 'map', 'a0')

      const byPage = await templatesRepo.tabsOfPages(conn.db, [npc.pageId ?? '', place.pageId ?? ''])
      expect(byPage.get(npc.pageId ?? '')).toEqual([
        { id: first.id, name: 'Mapa', kind: 'map' },
        { id: second.id, name: 'Tesoro', kind: 'table' }
      ])
      expect(byPage.get(place.pageId ?? '')).toEqual([{ id: map.id, name: 'Plano', kind: 'map' }])
      expect((await templatesRepo.tabsOfPages(conn.db, [])).size).toBe(0)
    })
  })
})
