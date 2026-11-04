import { systemFull } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { FILE_BYTES, FORMAT, toFile } from '@crisol/systems'
import { cinco, fronteras } from '@crisol/systems/fixtures'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { MAX_SYSTEMS } from './systems.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('los sistemas de reglas', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const organization = async (userId: string, name: string) => {
    const [org] = await conn.db.insert(schema.organizations).values({ name }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db.insert(schema.organizationMembers).values({ organizationId: org.id, userId, role: 'owner' })
    return org.id
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_systems'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    await organization(owner.userId, 'Fateforge')
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('los de serie: el 5e y «En blanco», enteros y de solo lectura', async () => {
    const { systems } = await ok200('listSystems', {})
    expect(systems).toEqual([
      expect.objectContaining({ id: '5e', name: '5e', builtIn: true, version: 1, basedOn: null, campaigns: [] }),
      expect.objectContaining({
        id: 'blank',
        name: 'En blanco',
        builtIn: true,
        version: 1,
        basedOn: null,
        campaigns: []
      })
    ])
    const blank = await ok200('getSystem', { systemId: 'blank' })
    expect(systemFull.safeParse(blank).success).toBe(true)
    expect(blank.document).toMatchObject({ id: 'blank', dice: { default: '1d20', critical: 'd20' } })
    expect((await code('getSystem', { systemId: 'nada' })).status).toBe(404)
    expect((await code('getSystem', { systemId: crypto.randomUUID() })).status).toBe(404)
  })

  it('crear uno copiando «En blanco», cambiarlo con su versión y copiar el propio', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    expect(created).toMatchObject({
      name: 'Fronteras',
      builtIn: false,
      version: 1,
      basedOn: { id: 'blank', name: 'En blanco', version: 1 }
    })
    expect(created.document.id).toBe(created.id)

    const { system, warnings } = await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    expect(warnings).toEqual([])
    expect(system).toMatchObject({ id: created.id, version: 2, release: '7' })
    expect(system.types.map((t: { key: string }) => t.key)).toEqual(['personaje', 'objeto', 'movimiento'])
    expect(system.rolls).toEqual([{ key: 'atributo', label: 'Atributo' }])
    // Su id es el suyo, aunque el documento diga otro
    expect(system.document.id).toBe(created.id)

    const renamed = await ok200('updateSystem', { systemId: created.id, version: 2, name: 'Fronteras del norte' })
    expect(renamed.system).toMatchObject({ name: 'Fronteras del norte', version: 3 })

    const copy = await ok200('createSystem', { name: 'Fronteras de Eana', from: created.id })
    expect(copy.basedOn).toEqual({ id: created.id, name: 'Fronteras del norte', version: 3 })
    expect(copy.document.types).toEqual(system.document.types)
    const list = (await ok200('listSystems', {})).systems.map((s: { name: string }) => s.name)
    expect(list).toEqual(['5e', 'En blanco', 'Fronteras del norte', 'Fronteras de Eana'])
  })

  it('el contenido del 5e: buscarlo, leerlo, copiarlo con su mecánica y bajarlo', async () => {
    const found = await ok200('searchSystemContent', { systemId: '5e', query: 'espada larga' })
    expect(found).toEqual({
      total: 2,
      items: [
        expect.objectContaining({ key: 'espada_larga_2014', name: 'Espada larga', edition: '2014', legacy: true }),
        expect.objectContaining({ key: 'espada_larga_2024', name: 'Espada larga', edition: '2024', legacy: false })
      ]
    })
    const newest = await ok200('searchSystemContent', {
      systemId: '5e',
      type: 'armadura',
      duplicates: 'newest',
      language: 'en'
    })
    expect(newest.total).toBe(13)
    expect(newest.items.map((h: { name: string }) => h.name)).toContain('Chain Mail')
    const read = await ok200('getSystemContent', { systemId: '5e', keys: ['cota_de_malla_2024', 'nada'] })
    expect(read.missing).toEqual(['nada'])
    expect(read.items).toEqual([
      expect.objectContaining({
        key: 'cota_de_malla_2024',
        concept: 'cota_de_malla',
        ref: { pages: { en: 92, es: 100 } },
        mechanics: expect.objectContaining({ automation: 'full' })
      })
    ])
    const total = (await ok200('listSystems', {})).systems[0].content
    expect(total).toBeGreaterThan(100)

    // La copia lleva todo el contenido, también su mecánica, y se busca igual (de la base de datos)
    const copy = await ok200('createSystem', { name: 'Eana', from: '5e' })
    expect(copy).toMatchObject({ content: total, basedOn: { id: '5e', version: 1 } })
    const inCopy = await ok200('searchSystemContent', { systemId: copy.id, query: 'cota de malla', editions: ['2014'] })
    expect(inCopy).toMatchObject({
      total: 1,
      items: [{ key: 'cota_de_malla_2014', concept: 'cota_de_malla', automation: 'full' }]
    })
    const copied = await ok200('getSystemContent', { systemId: copy.id, keys: ['cota_de_malla_2014'] })
    expect(copied.items[0].mechanics.effects).toHaveLength(3)

    // Bajarlo lleva el contenido; subirlo en otra cuenta, también con su mecánica
    const exported = await ok200('exportSystem', { systemId: '5e' })
    expect(exported.file.content).toHaveLength(total)
    const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    await organization(other.userId, 'Otra')
    const { system } = await ok200('importSystem', { file: exported.file }, other.cookie)
    const back = await ok200('getSystemContent', { systemId: system.id, keys: ['espada_larga_2024'] }, other.cookie)
    expect(back.items[0]).toMatchObject({
      concept: 'espada_larga',
      data: { maestria: 'debilitar' },
      ref: { pages: { en: 91 } }
    })
    // Otra cuenta no ve el contenido de este
    expect((await code('searchSystemContent', { systemId: copy.id }, other.cookie)).status).toBe(404)
  })

  it('no se pisa lo que cambió otro, ni se guarda lo que tiene errores; los avisos vuelven', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    expect(await code('updateSystem', { systemId: created.id, version: 1, name: 'Otro' })).toEqual({
      status: 400,
      code: 'SYSTEM_CHANGED'
    })
    const broken = structuredClone(fronteras)
    Object.assign(broken.types.personaje?.fields.defensa as object, { formula: '7 + @vigr' })
    expect(await code('updateSystem', { systemId: created.id, version: 2, document: broken })).toEqual({
      status: 400,
      code: 'SYSTEM_INVALID'
    })
    const unknown = structuredClone(fronteras) as typeof fronteras & Record<string, unknown>
    unknown.icono = 'brujula'
    const { warnings, system } = await ok200('updateSystem', { systemId: created.id, version: 2, document: unknown })
    expect(warnings).toEqual([expect.objectContaining({ path: 'icono', severity: 'warning' })])
    // Lo desconocido se conserva
    expect(system.document.icono).toBe('brujula')
    expect(await code('updateSystem', { systemId: created.id, version: 3 })).toEqual({
      status: 400,
      code: 'NOTHING_TO_CHANGE'
    })
  })

  it('deshacer un cambio y borrar (también se deshace)', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    const history = async () => (await ok200('listHistory', {})).entries as { id: string; action: string }[]
    const change = (await history()).find((e) => e.action === 'updateSystem')
    expect((await ok200('undoOperation', { operationId: change?.id })).status).toBe('undone')
    expect((await ok200('getSystem', { systemId: created.id })).types).toEqual([
      expect.objectContaining({ key: 'personaje', fields: 0 })
    ])

    expect(await ok200('deleteSystem', { systemId: created.id })).toEqual({ id: created.id, name: 'Fronteras' })
    expect((await code('getSystem', { systemId: created.id })).status).toBe(404)
    expect((await ok200('listSystems', {})).systems.filter((s: { builtIn: boolean }) => !s.builtIn)).toEqual([])
    const deletion = (await history()).find((e) => e.action === 'deleteSystem')
    await ok200('undoOperation', { operationId: deletion?.id })
    expect((await ok200('getSystem', { systemId: created.id })).name).toBe('Fronteras')
  })

  it('los de serie no se cambian ni se borran; uno de otra cuenta, ni se ve', async () => {
    expect((await code('updateSystem', { systemId: crypto.randomUUID(), version: 1, name: 'x' })).status).toBe(404)
    expect((await code('deleteSystem', { systemId: crypto.randomUUID() })).status).toBe(404)
    const created = await ok200('createSystem', { name: 'Fronteras' })
    const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    await organization(other.userId, 'Otra cuenta')
    expect((await code('getSystem', { systemId: created.id }, other.cookie)).status).toBe(404)
    expect((await code('createSystem', { name: 'Copia', from: created.id }, other.cookie)).status).toBe(404)
    // Ni se dice que existe
    expect((await code('updateSystem', { systemId: created.id, version: 1, name: 'Mío' }, other.cookie)).status).toBe(
      404
    )
    expect((await code('deleteSystem', { systemId: created.id }, other.cookie)).status).toBe(404)
    expect((await ok200('listSystems', {}, other.cookie)).systems.map((s: { id: string }) => s.id)).toEqual([
      '5e',
      'blank'
    ])
  })

  it(`como mucho ${MAX_SYSTEMS} por cuenta`, async () => {
    for (let i = 0; i < MAX_SYSTEMS; i++) await ok200('createSystem', { name: `S${i}` })
    expect(await code('createSystem', { name: 'Uno más' })).toEqual({ status: 400, code: 'TOO_MANY_SYSTEMS' })
  })

  describe('bajar y subir', () => {
    const anillo = {
      type: 'objeto',
      key: 'anillo',
      source: 'srd51',
      data: { name: 'Anillo de protección', bono_ca: 1 }
    }

    it('ida y vuelta, también en otra cuenta, con su contenido', async () => {
      const created = await ok200('createSystem', { name: 'Fronteras' })
      await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
      const exported = await ok200('exportSystem', { systemId: created.id })
      expect(exported.name).toBe('fronteras.crisol-system.json')
      expect(exported.file).toMatchObject({ kind: 'crisol-system', format: FORMAT, content: [] })

      const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
      await organization(other.userId, 'Otra cuenta')
      const { system } = await ok200('importSystem', { file: exported.file }, other.cookie)
      expect(system).toMatchObject({ name: 'Fronteras', basedOn: null, version: 1, content: 0 })
      expect(system.id).not.toBe(created.id)
      expect(system.document.types).toEqual(JSON.parse(JSON.stringify(fronteras.types)))

      const withContent = await ok200('importSystem', { file: toFile(cinco, [anillo]) })
      expect(withContent.system).toMatchObject({ name: '5e de prueba', content: 1 })
      const again = await ok200('exportSystem', { systemId: withContent.system.id })
      expect(again.file.content).toEqual([anillo])
      // Los de serie también se bajan
      expect((await ok200('exportSystem', { systemId: 'blank' })).name).toBe('en-blanco.crisol-system.json')
    })

    it('un archivo roto, de otra versión o demasiado grande no guarda nada', async () => {
      const broken = structuredClone(fronteras)
      Object.assign(broken.types.personaje?.fields.defensa as object, { formula: '@defensa' })
      expect(await code('importSystem', { file: toFile(broken, []) })).toEqual({ status: 400, code: 'SYSTEM_INVALID' })
      expect(await code('importSystem', { file: { ...toFile(fronteras, []), format: FORMAT + 1 } })).toEqual({
        status: 400,
        code: 'SYSTEM_INVALID'
      })
      expect(await code('importSystem', { file: toFile(cinco, [{ ...anillo, type: 'arma' }]) })).toEqual({
        status: 400,
        code: 'SYSTEM_INVALID'
      })
      const tooBig = await call('importSystem', {
        file: toFile(cinco, [{ ...anillo, data: { name: 'x', relleno: 'x'.repeat(FILE_BYTES + 2 * 1024 * 1024) } }])
      })
      expect(tooBig.statusCode).toBe(413)
      expect((await ok200('listSystems', {})).systems.filter((s: { builtIn: boolean }) => !s.builtIn)).toEqual([])
    })

    it('sin sesión, un cuerpo grande ni se lee', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/importSystem',
        payload: { file: { relleno: 'x'.repeat(5 * 1024 * 1024) } },
        headers: { origin: BASE_URL }
      })
      expect(response.statusCode).toBe(401)
    })

    it('subir encima de uno propio: su documento y su contenido, con la versión que se tenía', async () => {
      const { system } = await ok200('importSystem', { file: toFile(cinco, [anillo]) })
      const replaced = await ok200('importSystem', {
        file: toFile(fronteras, []),
        into: { systemId: system.id, version: system.version }
      })
      expect(replaced.system).toMatchObject({ id: system.id, name: 'Fronteras', version: 2, content: 0 })
      expect(
        await code('importSystem', { file: toFile(fronteras, []), into: { systemId: system.id, version: 1 } })
      ).toEqual({
        status: 400,
        code: 'SYSTEM_CHANGED'
      })
    })

    it('un sistema grande (1,5 MB) se guarda', async () => {
      const created = await ok200('createSystem', { name: 'Grande' })
      const document = structuredClone(fronteras) as typeof fronteras
      const help = 'Una ayuda larga. '.repeat(25)
      for (let t = 0; t < 34; t++)
        document.types[`t${t}`] = {
          document: 'item',
          label: `Tipo ${t}`,
          fields: Object.fromEntries(
            Array.from({ length: 100 }, (_, f) => [`f${f}`, { kind: 'number', label: `F${f}`, help }])
          )
        }
      expect(JSON.stringify(document).length).toBeGreaterThan(1.5 * 1024 * 1024)
      expect((await ok200('updateSystem', { systemId: created.id, version: 1, document })).system.types).toHaveLength(
        37
      )
    })
  })

  describe('la campaña con su sistema', () => {
    let worldId: string
    beforeEach(async () => {
      worldId = (await ok200('createWorld', { name: 'Eana' })).id
    })
    const fronterasSystem = async () => {
      const created = await ok200('createSystem', { name: 'Fronteras' })
      return (await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })).system
    }

    it('se elige al crearla, con lo que se elige de él completo; sin sistema, null', async () => {
      const blank = await ok200('createCampaign', { worldId, name: 'La Marca', system: 'blank' })
      expect(blank.system).toEqual({ id: 'blank', name: 'En blanco', defaultRoll: '1d20', critical: 'd20' })
      expect(blank.systemChoices).toEqual({ sources: [], duplicates: 'newest', language: 'es', settings: {} })
      const none = await ok200('createCampaign', { worldId, name: 'Sin reglas' })
      expect(none).toMatchObject({ system: null, systemChoices: null })
      const listed = (await ok200('listCampaigns', { worldId })).campaigns
      expect(listed.map((c: { system: { name: string } | null }) => c.system?.name ?? null)).toEqual([
        'En blanco',
        null
      ])
      expect((await ok200('getCampaign', { campaignId: blank.id })).campaign.system.name).toBe('En blanco')
      const worlds = (await ok200('listWorldsWithCampaigns', {})).worlds
      expect(worlds[0].campaigns[0].system.id).toBe('blank')
    })

    it('el 5e, con sus ediciones, lo que está en las dos y sus reglas; sin ninguna fuente, no', async () => {
      const campaign = await ok200('createCampaign', { worldId, name: 'La Marca' })
      const chosen = await ok200('updateCampaign', {
        campaignId: campaign.id,
        system: '5e',
        systemChoices: { sources: ['srd51'], duplicates: 'both', settings: { reglas: 'e2014' } }
      })
      expect(chosen.systemChoices).toEqual({
        sources: ['srd51'],
        duplicates: 'both',
        language: 'es',
        settings: { reglas: 'e2014', multiclase_mixta: false }
      })
      expect(await code('updateCampaign', { campaignId: campaign.id, systemChoices: { sources: [] } })).toEqual({
        status: 400,
        code: 'BAD_SYSTEM_CHOICES'
      })
    })

    it('se cambia en sus ajustes, con sus elecciones; lo que no vale, no', async () => {
      const system = await fronterasSystem()
      const campaign = await ok200('createCampaign', { worldId, name: 'Los páramos' })
      const chosen = await ok200('updateCampaign', { campaignId: campaign.id, system: system.id })
      expect(chosen.system).toEqual({ id: system.id, name: 'Fronteras', defaultRoll: '2d6', critical: 'none' })
      expect(chosen.systemChoices).toEqual({
        sources: [],
        duplicates: 'newest',
        language: 'es',
        settings: { avance: 8 }
      })
      const changed = await ok200('updateCampaign', {
        campaignId: campaign.id,
        systemChoices: { settings: { avance: 10 } }
      })
      expect(changed.systemChoices.settings).toEqual({ avance: 10 })
      expect(
        await code('updateCampaign', { campaignId: campaign.id, systemChoices: { settings: { avance: 'diez' } } })
      ).toEqual({
        status: 400,
        code: 'BAD_SYSTEM_CHOICES'
      })
      expect(await code('updateCampaign', { campaignId: campaign.id, system: 'nada' })).toEqual({
        status: 400,
        code: 'BAD_SYSTEM'
      })
      expect(await code('updateCampaign', { campaignId: campaign.id, system: crypto.randomUUID() })).toEqual({
        status: 400,
        code: 'BAD_SYSTEM'
      })
      const removed = await ok200('updateCampaign', { campaignId: campaign.id, system: null })
      expect(removed).toMatchObject({ system: null, systemChoices: null })
      expect(await code('updateCampaign', { campaignId: campaign.id, systemChoices: { language: 'es' } })).toEqual({
        status: 400,
        code: 'NO_SYSTEM'
      })
    })

    it('el sistema de otra cuenta no vale', async () => {
      const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
      await organization(other.userId, 'Otra cuenta')
      const theirs = await ok200('createSystem', { name: 'Ajeno' }, other.cookie)
      const campaign = await ok200('createCampaign', { worldId, name: 'La Marca' })
      expect(await code('updateCampaign', { campaignId: campaign.id, system: theirs.id })).toEqual({
        status: 400,
        code: 'BAD_SYSTEM'
      })
    })

    it('al tirar, los críticos son los del sistema de la campaña', async () => {
      const system = await fronterasSystem()
      const d20 = await ok200('createCampaign', { worldId, name: 'Con d20', system: 'blank' })
      const none = await ok200('createCampaign', { worldId, name: 'Sin críticos', system: system.id })
      // Con 100 d20, un 20 o un 1 sale casi seguro: con la regla del d20 hay crítico o pifia; sin críticos, nunca
      const withRule = await ok200('rollDice', { campaignId: d20.id, formula: '100d20' })
      expect(withRule.roll.critical).not.toBeNull()
      const without = await ok200('rollDice', { campaignId: none.id, formula: '100d20' })
      expect(without.roll.critical).toBeNull()
    })

    it('un sistema que usa una campaña no se borra; la lista dice cuáles lo usan', async () => {
      const system = await fronterasSystem()
      const campaign = await ok200('createCampaign', { worldId, name: 'Los páramos', system: system.id })
      expect(await code('deleteSystem', { systemId: system.id })).toEqual({ status: 400, code: 'SYSTEM_IN_USE' })
      const listed = (await ok200('listSystems', {})).systems.find((s: { id: string }) => s.id === system.id)
      expect(listed.campaigns).toEqual([{ id: campaign.id, name: 'Los páramos' }])
      expect((await ok200('getSystem', { systemId: system.id })).campaigns).toEqual([
        { id: campaign.id, name: 'Los páramos' }
      ])
      await ok200('updateCampaign', { campaignId: campaign.id, system: null })
      expect((await ok200('deleteSystem', { systemId: system.id })).name).toBe('Fronteras')
    })
  })

  it('cambiar por rutas: todo o nada, con la versión; lo que no vale dice su ruta', async () => {
    const { system } = await ok200('importSystem', { file: toFile(fronteras, []) })
    const { system: changed } = await ok200('updateSystem', {
      systemId: system.id,
      version: 1,
      changes: [
        { path: 'types.personaje.fields.defensa.formula', value: '8 + @vigor' },
        { path: 'rolls.atributo.modes[1]', remove: true },
        { path: 'rolls.dano', value: { label: 'Daño', formula: '1d6 + @vigor' } }
      ]
    })
    expect(changed.version).toBe(2)
    expect(changed.document.types.personaje.fields.defensa.formula).toBe('8 + @vigor')
    expect(changed.document.rolls.atributo.modes).toHaveLength(1)
    expect(changed.rolls.map((r: { key: string }) => r.key)).toEqual(['atributo', 'dano'])
    // Con un error, nada: ni el primer cambio (cada problema, con su ruta, lo lee la IA: en las pruebas del MCP)
    const bad = await call('updateSystem', {
      systemId: system.id,
      version: 2,
      changes: [
        { path: 'name', value: 'Otro' },
        { path: 'types.personaje.fields.carga.formula', value: '3 + @nada' }
      ]
    })
    expect(bad.json()).toMatchObject({ code: 'SYSTEM_INVALID' })
    expect(
      (await code('updateSystem', { systemId: system.id, version: 2, changes: [{ path: 'rolls.nada', remove: true }] }))
        .code
    ).toBe('BAD_SYSTEM_CHANGE')
    expect(
      (await code('updateSystem', { systemId: system.id, version: 2, changes: [{ path: '__proto__.x', value: 1 }] }))
        .code
    ).toBe('BAD_SYSTEM_CHANGE')
    expect(
      (await code('updateSystem', { systemId: system.id, version: 1, changes: [{ path: 'name', value: 'Otro' }] })).code
    ).toBe('SYSTEM_CHANGED')
    expect((await ok200('getSystem', { systemId: system.id })).name).toBe('Fronteras')
  })

  it('ver unas partes, validar sin guardar y probar una fórmula y una tirada', async () => {
    const { system } = await ok200('importSystem', { file: toFile(fronteras, []) })
    const parts = await ok200('getSystemParts', { systemId: system.id, parts: ['rolls.atributo.bands', 'dice'] })
    expect(parts).toMatchObject({ id: system.id, version: 1, builtIn: false, parts: { dice: { default: '2d6' } } })
    expect(parts.parts['rolls.atributo.bands']).toHaveLength(3)
    expect((await code('getSystemParts', { systemId: system.id, parts: ['nada'] })).code).toBe('BAD_SYSTEM_PATH')
    expect((await ok200('getSystemParts', { systemId: 'blank', parts: ['dice'] })).builtIn).toBe(true)

    const broken = structuredClone(fronteras) as unknown as {
      types: { personaje: { fields: { defensa: { formula: string } } } }
    }
    broken.types.personaje.fields.defensa.formula = '7 + @vigr'
    const checked = await ok200('checkSystem', { document: broken })
    expect(checked.valid).toBe(false)
    expect(checked.problems[0]).toEqual({
      path: 'types.personaje.fields.defensa.formula',
      where: 'Personaje › Defensa › Fórmula',
      message: 'No existe «@vigr» en Personaje. ¿Quizás «@vigor»?',
      severity: 'error'
    })
    expect((await ok200('checkSystem', { document: toFile(fronteras, []) })).valid).toBe(true)

    const formula = await ok200('tryFormula', {
      systemId: system.id,
      type: 'personaje',
      formula: '@defensa',
      document: {
        data: { vigor: 2 },
        items: [{ id: 'escudo', type: 'objeto', name: 'Escudo', data: { equipado: true, defensa: 1 } }]
      }
    })
    expect(formula).toMatchObject({ type: 'number', value: 10, problems: [] })
    expect(formula.terms).toEqual([{ label: 'Defensa', value: 10, kind: 'field' }])
    expect(
      (await ok200('tryFormula', { systemId: system.id, type: 'personaje', formula: '@nada' })).problems[0].message
    ).toMatch(/No existe «@nada»/)

    const rolled = await ok200('trySystemRoll', {
      systemId: system.id,
      roll: 'atributo',
      element: 'vigor',
      mode: 'ventaja',
      document: { data: { vigor: 3 } }
    })
    expect(rolled.label).toBe('Atributo · Vigor')
    expect(rolled.formula).toBe('3d6kh2+3[Vigor]')
    expect(rolled.modeApplied).toBe(true)
    expect(['Éxito total', 'Éxito con coste', 'Fallo']).toContain(rolled.band.label)
    expect(rolled.critical).toBeNull()
    expect((await code('trySystemRoll', { systemId: system.id, roll: 'nada' })).code).toBe('BAD_ROLL')
    expect((await code('trySystemRoll', { systemId: system.id, roll: 'atributo', type: 'nada' })).code).toBe(
      'BAD_SYSTEM_TYPE'
    )
    // Lo de otra cuenta no se ve
    const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    await organization(other.userId, 'Otra')
    expect(
      (await code('tryFormula', { systemId: system.id, type: 'personaje', formula: '1' }, other.cookie)).status
    ).toBe(404)
    expect((await code('getSystemParts', { systemId: system.id, parts: ['dice'] }, other.cookie)).status).toBe(404)
  })

  it('validar pide poder ver sistemas: quien no tiene cuenta propia ni mundos no valida nada', async () => {
    const stranger = await signUpTestUser(auth, { name: 'Nadie', email: 'nadie@crisol.test' })
    expect((await call('checkSystem', { document: fronteras }, stranger.cookie)).statusCode).not.toBe(200)
    expect((await call('checkSystem', { document: fronteras })).statusCode).toBe(200)
  })

  it('el tope de sistemas se cuenta en la transacción: muchos a la vez no se pasan', async () => {
    for (let i = 0; i < MAX_SYSTEMS - 2; i++) await ok200('createSystem', { name: `S${i}` })
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => call('createSystem', { name: `A la vez ${i}` }))
    )
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(2)
    expect(results.filter((r) => r.json().code === 'TOO_MANY_SYSTEMS')).toHaveLength(4)
    const { systems } = await ok200('listSystems', {})
    expect(systems.filter((s: { builtIn: boolean }) => !s.builtIn)).toHaveLength(MAX_SYSTEMS)
  })
})
