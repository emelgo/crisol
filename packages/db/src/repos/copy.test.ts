import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import type { OperationContext } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { documents } from '../schema/documents.ts'
import { operations } from '../schema/history.ts'
import { mapElements, mapPins, maps, pageTabs } from '../schema/maps.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { pages } from '../schema/pages.ts'
import { scenes, sceneTiles } from '../schema/scenes.ts'
import { randomTables } from '../schema/tables.ts'
import { sceneLights, sceneWalls } from '../schema/vision.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import { copyPage, type PageCopy } from './copy.ts'
import * as documentsRepo from './documents.ts'
import { listMarks } from './knowledge.ts'
import * as mapsRepo from './maps.ts'
import * as pagesRepo from './pages.ts'
import * as scenesRepo from './scenes.ts'
import * as tablesRepo from './tables.ts'
import { undoOperation } from './undo.ts'
import { listVersions } from './versions.ts'
import * as visionRepo from './vision.ts'
import * as worldsRepo from './worlds.ts'

describe('duplicar una página con todo lo suyo (ADR-0024)', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  let worldId: string
  const ctx = (action: string, via: OperationContext['via'] = 'ui'): OperationContext => ({
    organizationId,
    actorId: 'u1',
    via,
    action
  })
  const lastOperation = async (action: string) => {
    const found = (await conn.db.select().from(operations)).filter((op) => op.action === action).at(-1)
    if (!found) throw new Error(`sin ${action}`)
    return found
  }
  const page = (title: string, parentId: string | null = null) =>
    pagesRepo.createPage(conn.db, ctx('createPage'), { worldId, title, placement: { parentId } })
  const tab = (
    pageId: string,
    kind: 'map' | 'text' | 'table' | 'scene',
    name: string,
    position: string,
    documentId?: string
  ) =>
    mapsRepo.createTab(conn.db, ctx('createTab'), {
      worldId,
      pageId,
      kind,
      name,
      position,
      documentId: documentId ?? null
    })
  /** Lo mínimo de una copia: sin documentos */
  const plain = (sourceId: string, title: string): PageCopy => ({
    sourceId,
    title,
    body: null,
    separates: [],
    tabDocuments: new Map(),
    hidden: false
  })
  const tabsOf = (pageId: string) =>
    conn.db.select().from(pageTabs).where(eq(pageTabs.pageId, pageId)).orderBy(asc(pageTabs.position))

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_copy'), { max: 2 })
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

  it('la copia va justo detrás de la original, con su fila entera menos lo que pone el historial', async () => {
    const parent = await page('Lugares')
    const source = await page('Ciudad', parent.id)
    const next = await page('Puerto', parent.id)
    const target = await page('Destino')
    await conn.db
      .update(pages)
      .set({
        icon: '🏰',
        properties: [{ id: 'p1', type: 'pages', name: 'Gobernante', value: [target.id] }],
        panel: [{ kind: 'stars', value: 3 }]
      })
      .where(eq(pages.id, source.id))

    const copy = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Ciudad (copia)'))
    expect(copy.title).toBe('Ciudad (copia)')
    const children = await pagesRepo.listChildren(conn.db, worldId, parent.id)
    expect(children.map((c) => c.title)).toEqual(['Ciudad', 'Ciudad (copia)', 'Puerto'])
    const made = await pagesRepo.findPage(conn.db, copy.id)
    expect(made).toMatchObject({
      icon: '🏰',
      parentId: parent.id,
      version: 1,
      // Duplicar deja los enlaces
      properties: [{ id: 'p1', type: 'pages', name: 'Gobernante', value: [target.id] }],
      panel: [{ kind: 'stars', value: 3 }]
    })
    expect(next.id).not.toBe(copy.id)
    // Nace visible: sin marca de «no lo sabe nadie»
    expect(await listMarks(conn.db, { worldId, campaignIds: 'all' })).toEqual([])
  })

  it('una página que no existe no se copia', async () => {
    const missing = crypto.randomUUID()
    await expect(copyPage(conn.db, ctx('copyPage'), plain(missing, 'X'))).rejects.toThrow(`${missing} no existe`)
  })

  it('lleva sus documentos, nace oculta si se pide y apunta su primera versión; deshacerla lo quita todo', async () => {
    const source = await page('Diario')
    const bodyId = crypto.randomUUID()
    const secretId = crypto.randomUUID()
    const result = await copyPage(conn.db, ctx('copyPage', 'ai'), {
      ...plain(source.id, 'Diario 2'),
      body: { id: bodyId, state: new Uint8Array([1, 2, 3]) },
      separates: [{ id: secretId, kind: 'secret', state: new Uint8Array([9]) }],
      hidden: true,
      version: {
        fingerprint: 'huella',
        documents: [{ documentId: bodyId, kind: 'body', state: new Uint8Array([1, 2, 3]), hash: 'h1' }]
      }
    })
    const docs = await conn.db.select().from(documents).where(eq(documents.pageId, result.id))
    expect(docs.map((d) => [d.id, d.kind, [...d.state], d.updatedBy]).toSorted()).toEqual(
      [
        [bodyId, 'body', [1, 2, 3], 'u1'],
        [secretId, 'secret', [9], 'u1']
      ].toSorted()
    )
    const versions = await listVersions(conn.db, result.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ via: 'ai' })
    expect(await listMarks(conn.db, { worldId, campaignIds: 'all' })).toMatchObject([
      { kind: 'page', targetId: result.id, known: false }
    ])

    await undoOperation(conn.db, ctx('undo'), (await lastOperation('copyPage')).id)
    expect(await pagesRepo.findPage(conn.db, result.id)).toBeNull()
    expect(await conn.db.select().from(documents).where(eq(documents.pageId, result.id))).toEqual([])
  })

  it('la versión de una copia que hace el sistema queda como del sistema', async () => {
    const source = await page('Nota')
    const bodyId = crypto.randomUUID()
    const result = await copyPage(conn.db, ctx('copyPage', 'system'), {
      ...plain(source.id, 'Nota 2'),
      body: { id: bodyId, state: new Uint8Array([4]) },
      version: {
        fingerprint: 'f',
        documents: [{ documentId: bodyId, kind: 'body', state: new Uint8Array([4]), hash: 'h' }]
      }
    })
    expect((await listVersions(conn.db, result.id))[0]).toMatchObject({ via: 'system' })
  })

  it('copia sus pestañas en su orden; la de texto, con el documento nuevo que se le da', async () => {
    const source = await page('Ciudad')
    const textDoc = await documentsRepo.createSeparate(conn.db, {
      pageId: source.id,
      worldId,
      kind: 'tab',
      state: new Uint8Array([5]),
      userId: 'u1'
    })
    await tab(source.id, 'map', 'Plano', 'a1')
    await tab(source.id, 'text', 'Historia', 'a0', textDoc)
    const copiedDoc = crypto.randomUUID()
    const result = await copyPage(conn.db, ctx('copyPage'), {
      ...plain(source.id, 'Ciudad 2'),
      tabDocuments: new Map([[textDoc, { id: copiedDoc, state: new Uint8Array([5]) }]])
    })
    const tabs = await tabsOf(result.id)
    expect(tabs.map((t) => [t.name, t.kind, t.position, t.documentId])).toEqual([
      ['Historia', 'text', 'a0', copiedDoc],
      ['Plano', 'map', 'a1', null]
    ])
    expect(await documentsRepo.findSeparate(conn.db, copiedDoc)).toMatchObject({ kind: 'tab' })
    // La original sigue con las suyas
    expect((await tabsOf(source.id)).map((t) => t.documentId)).toEqual([textDoc, null])
  })

  describe('el mapa', () => {
    const withMap = async () => {
      const source = await page('Región')
      const target = await page('Castillo')
      const mapTab = await tab(source.id, 'map', 'Mapa', 'a0')
      const map = await mapsRepo.mapOfTab(conn.db, mapTab.id)
      await mapsRepo.updateMap(conn.db, ctx('updateMap'), map?.id ?? '', { width: 800, height: 600 })
      await mapsRepo.createPin(conn.db, ctx('createPin'), {
        worldId,
        mapId: map?.id ?? '',
        x: 0.25,
        y: 0.5,
        label: 'Castillo',
        pageId: target.id
      })
      await conn.db.insert(mapElements).values({
        worldId,
        mapId: map?.id ?? '',
        kind: 'region',
        geometry: { points: [0, 0, 1, 1] },
        label: 'Bosque',
        pageId: target.id
      })
      return { source, target, map }
    }
    const mapOfPage = async (pageId: string) => {
      const [first] = await tabsOf(pageId)
      const [map] = await conn.db
        .select()
        .from(maps)
        .where(eq(maps.tabId, first?.id ?? ''))
      const pins = await conn.db
        .select()
        .from(mapPins)
        .where(eq(mapPins.mapId, map?.id ?? ''))
      const elements = await conn.db
        .select()
        .from(mapElements)
        .where(eq(mapElements.mapId, map?.id ?? ''))
      return { map, pins, elements }
    }

    it('duplicar copia el mapa con sus pines y sus elementos, que siguen llevando a su página', async () => {
      const { source, target, map } = await withMap()
      const result = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Región 2'))
      const copied = await mapOfPage(result.id)
      expect(copied.map).toMatchObject({ width: 800, height: 600 })
      expect(copied.map?.id).not.toBe(map?.id)
      expect(copied.pins.map((p) => [p.x, p.y, p.label, p.pageId])).toEqual([[0.25, 0.5, 'Castillo', target.id]])
      expect(copied.elements.map((e) => [e.kind, e.label, e.pageId])).toEqual([['region', 'Bosque', target.id]])
    })

    it('sin enlaces (crear desde una plantilla), los pines y elementos se sueltan de su página', async () => {
      const { source } = await withMap()
      const result = await copyPage(conn.db, ctx('copyPage'), { ...plain(source.id, 'Región 2'), links: 'drop' })
      const copied = await mapOfPage(result.id)
      expect(copied.pins.map((p) => [p.label, p.pageId])).toEqual([['Castillo', null]])
      expect(copied.elements.map((e) => [e.label, e.pageId])).toEqual([['Bosque', null]])
    })

    it('un mapa vacío se copia sin pines ni elementos', async () => {
      const source = await page('Vacío')
      await tab(source.id, 'map', 'Mapa', 'a0')
      const result = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Vacío 2'))
      const copied = await mapOfPage(result.id)
      expect(copied.map).toBeDefined()
      expect(copied.pins).toEqual([])
      expect(copied.elements).toEqual([])
    })
  })

  describe('las tablas aleatorias', () => {
    const withTables = async () => {
      const source = await page('Encuentros')
      const elsewhere = await page('Otra')
      const target = await page('Dragón')
      const outer = await tab(elsewhere.id, 'table', 'Ajena', 'a0')
      const main = await tab(source.id, 'table', 'Principal', 'a0')
      const sub = await tab(source.id, 'table', 'Tesoro', 'a1')
      const table = await tablesRepo.tableOfTab(conn.db, main.id)
      await tablesRepo.updateTable(conn.db, ctx('updateTable'), table?.id ?? '', table?.version ?? 1, {
        formula: '1d3',
        rows: [
          { id: 'r1', from: 1, to: 1, text: 'Un dragón', page: target.id },
          { id: 'r2', from: 2, to: 2, text: 'Tesoro', table: sub.id },
          { id: 'r3', from: 3, to: 3, text: 'Otra tabla', table: outer.id }
        ]
      })
      return { source, target, outer }
    }
    const rowsOf = async (pageId: string) => {
      const tabs = await tabsOf(pageId)
      const [table] = await conn.db
        .select()
        .from(randomTables)
        .where(eq(randomTables.tabId, tabs[0]?.id ?? ''))
      return { tabs, table }
    }

    it('duplicar lleva las filas: la que va a otra tabla de la página apunta a su copia', async () => {
      const { source, target, outer } = await withTables()
      const result = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Encuentros 2'))
      const { tabs, table } = await rowsOf(result.id)
      expect(table?.formula).toBe('1d3')
      expect(table?.rows).toEqual([
        { id: 'r1', from: 1, to: 1, text: 'Un dragón', page: target.id },
        { id: 'r2', from: 2, to: 2, text: 'Tesoro', table: tabs[1]?.id },
        { id: 'r3', from: 3, to: 3, text: 'Otra tabla', table: outer.id }
      ])
    })

    it('sin enlaces, se suelta la página y la tabla de otra página, pero no la de la misma', async () => {
      const { source } = await withTables()
      const result = await copyPage(conn.db, ctx('copyPage'), { ...plain(source.id, 'Encuentros 2'), links: 'drop' })
      const { tabs, table } = await rowsOf(result.id)
      expect(table?.rows).toEqual([
        { id: 'r1', from: 1, to: 1, text: 'Un dragón' },
        { id: 'r2', from: 2, to: 2, text: 'Tesoro', table: tabs[1]?.id },
        { id: 'r3', from: 3, to: 3, text: 'Otra tabla', table: null }
      ])
    })
  })

  describe('la escena', () => {
    const withScene = async () => {
      const source = await page('Mazmorra')
      const target = await page('Cripta')
      const sceneTab = await tab(source.id, 'scene', 'Escena', 'a0')
      const scene = await scenesRepo.sceneOfTab(conn.db, sceneTab.id)
      const sceneId = scene?.id ?? ''
      const v1 = crypto.randomUUID()
      await scenesRepo.updateScene(conn.db, ctx('updateScene'), sceneId, {
        width: 1000,
        height: 800,
        tiles: { version: v1, size: 256, levels: 1 }
      })
      await conn.db
        .update(scenes)
        .set({ pins: [{ x: 10, y: 20, label: 'Cripta', pageId: target.id }] })
        .where(eq(scenes.id, sceneId))
      await visionRepo.changeVision(conn.db, ctx('changeVision'), sceneId, {
        walls: { add: [{ ax: 0, ay: 0, bx: 100, by: 0 }] },
        lights: { add: [{ x: 50, y: 50, bright: 10, dim: 20 }] }
      })
      for (const x of [0, 1]) {
        await scenesRepo.putTile(conn.db, { sceneId, version: v1, level: 0, x, y: 0, storageKey: `t${x}`, bytes: 10 })
      }
      // Una de otra versión, que ya no es la suya
      await scenesRepo.putTile(conn.db, {
        sceneId,
        version: crypto.randomUUID(),
        level: 0,
        x: 0,
        y: 0,
        storageKey: 'viejo',
        bytes: 5
      })
      return { source, target, sceneId, v1 }
    }
    const sceneOfPage = async (pageId: string) => {
      const [first] = await tabsOf(pageId)
      const scene = await scenesRepo.sceneOfTab(conn.db, first?.id ?? '')
      const sceneId = scene?.id ?? ''
      return {
        scene,
        walls: await conn.db.select().from(sceneWalls).where(eq(sceneWalls.sceneId, sceneId)),
        lights: await conn.db.select().from(sceneLights).where(eq(sceneLights.sceneId, sceneId)),
        tiles: await conn.db.select().from(sceneTiles).where(eq(sceneTiles.sceneId, sceneId))
      }
    }

    it('duplicar copia la escena con sus muros, luces, pines y las teselas de su versión', async () => {
      const { source, target, sceneId, v1 } = await withScene()
      const result = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Mazmorra 2'))
      const copied = await sceneOfPage(result.id)
      expect(copied.scene?.id).not.toBe(sceneId)
      expect(copied.scene).toMatchObject({ width: 1000, height: 800, tiles: { version: v1 } })
      expect(copied.scene?.pins).toEqual([{ x: 10, y: 20, label: 'Cripta', pageId: target.id }])
      expect(copied.walls.map((w) => [w.ax, w.bx])).toEqual([[0, 100]])
      expect(copied.lights.map((l) => [l.x, l.bright, l.dim])).toEqual([[50, 10, 20]])
      // Las mismas teselas (las mismas claves), solo las de su versión
      expect(copied.tiles.map((t) => [t.version, t.x, t.storageKey]).toSorted()).toEqual([
        [v1, 0, 't0'],
        [v1, 1, 't1']
      ])
    })

    it('sin enlaces, sus pines se sueltan de su página', async () => {
      const { source } = await withScene()
      const result = await copyPage(conn.db, ctx('copyPage'), { ...plain(source.id, 'Mazmorra 2'), links: 'drop' })
      expect((await sceneOfPage(result.id)).scene?.pins).toEqual([{ x: 10, y: 20, label: 'Cripta', pageId: null }])
    })

    it('una escena sin muros, luces ni teselas se copia vacía', async () => {
      const source = await page('Llanura')
      await tab(source.id, 'scene', 'Escena', 'a0')
      const result = await copyPage(conn.db, ctx('copyPage'), plain(source.id, 'Llanura 2'))
      const copied = await sceneOfPage(result.id)
      expect(copied.scene).not.toBeNull()
      expect([copied.walls, copied.lights, copied.tiles]).toEqual([[], [], []])
    })
  })

  describe('a otro sitio (crear desde una plantilla)', () => {
    it('va al mundo y rama que se dicen, con sus cambios, sin enlaces en sus campos y con lo de al lado', async () => {
      const templatePage = await page('PNJ')
      const target = await page('Alguien')
      await conn.db
        .update(pages)
        .set({
          properties: [
            { id: 'p1', type: 'pages', name: 'Facción', value: [target.id] },
            { id: 'p2', type: 'text', name: 'Raza', value: 'Elfo' },
            null
          ]
        })
        .where(eq(pages.id, templatePage.id))
      const other = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
        organizationId,
        name: 'Otro',
        masterId: 'u1'
      })
      const branch = await pagesRepo.createPage(conn.db, ctx('createPage'), {
        worldId: other.id,
        title: 'Gente',
        placement: { parentId: null }
      })
      const first = await pagesRepo.createPage(conn.db, ctx('createPage'), {
        worldId: other.id,
        title: 'Primera',
        placement: { parentId: branch.id }
      })
      const seen: string[] = []
      const result = await copyPage(conn.db, ctx('copyPage'), {
        ...plain(templatePage.id, 'Borin'),
        links: 'drop',
        place: { worldId: other.id, parentId: branch.id, before: first.id },
        overrides: { template: 'plantilla-pnj', templateLine: ['plantilla-pnj'], icon: '🧔' },
        alongside: async (_w, made) => {
          seen.push(made.id)
        }
      })
      expect(seen).toEqual([result.id])
      const [made] = await conn.db.select().from(pages).where(eq(pages.id, result.id))
      expect(made).toMatchObject({
        worldId: other.id,
        parentId: branch.id,
        template: 'plantilla-pnj',
        templateLine: ['plantilla-pnj'],
        icon: '🧔',
        properties: [
          { id: 'p1', type: 'pages', name: 'Facción', value: [] },
          { id: 'p2', type: 'text', name: 'Raza', value: 'Elfo' },
          null
        ]
      })
      expect((await pagesRepo.listChildren(conn.db, other.id, branch.id)).map((c) => c.title)).toEqual([
        'Borin',
        'Primera'
      ])
    })

    it('detrás de una hermana, o al final de lo más alto', async () => {
      const source = await page('Modelo')
      const a = await page('A')
      await page('B')
      const after = await copyPage(conn.db, ctx('copyPage'), {
        ...plain(source.id, 'Tras A'),
        place: { worldId, parentId: null, after: a.id }
      })
      const atEnd = await copyPage(conn.db, ctx('copyPage'), {
        ...plain(source.id, 'Al final'),
        place: { worldId, parentId: null }
      })
      const titles = (await pagesRepo.listChildren(conn.db, worldId, null)).map((c) => c.title)
      expect(titles).toEqual(['Modelo', 'A', 'Tras A', 'B', 'Al final'])
      expect([after.title, atEnd.title]).toEqual(['Tras A', 'Al final'])
    })
  })
})
