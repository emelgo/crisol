/**
 * A la escala de Eana (tarea 25): un mundo de 2.400 páginas con enlaces cruzados, secretos y alias, creado solo por el
 * MCP con crear_paginas, de 50 en 50. Cada llamada, en menos de 3 s, y al final ningún enlace sin resolver. Pesa: no va
 * en la CI normal; se lanza con CRISOL_ESCALA=1 (sus números van en el PR)
 */
import { aiRepo, connect, loadMemberships } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ActionContext } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { createRealtime } from '../realtime/hub.ts'
import { startServer } from '../server.ts'
import { TEST_AUTH_SECRET, testDataDir } from '../testing.ts'
import { mcpTestHelpers } from './test-client.ts'

const PORT = 8133
const BASE = `http://127.0.0.1:${PORT}`
const PAGES = Number(process.env.CRISOL_ESCALA_PAGINAS ?? 2400)
const BATCH = 50
const KINDS = ['Lugar', 'Personaje', 'Facción', 'Criatura', 'Objeto', 'Suceso']
const WORDS = ['faro', 'puerto', 'dragón', 'montaña', 'ciudad', 'guerra', 'elfos', 'barco', 'cueva', 'reina', 'niebla']

const title = (i: number) => `${KINDS[i % KINDS.length]} ${String(i).padStart(4, '0')}`
const word = (i: number) => WORDS[i % WORDS.length]

/** Una página mediana: alias y etiquetas, tres párrafos con enlaces a otras (también a las que aún no existen) y un secreto */
function pageMarkdown(i: number) {
  const links = [1, 7, 131, 977].map((step) => `[[${title((i + step) % PAGES)}]]`)
  const text = (n: number) =>
    `${'La costa de Eana guarda faros, puertos y dragones que nadie ha contado. '.repeat(3)}Junto a ${links[n]} y ${links[n + 1]}, el ${word(i + n)} de siempre.`
  return [
    '---',
    'alias:',
    `  - "${word(i)} ${i}"`,
    'etiquetas:',
    `  - ${KINDS[i % KINDS.length]?.toLowerCase()}/${word(i)}`,
    '---',
    text(0),
    '',
    `## Historia`,
    '',
    text(1),
    '',
    text(2),
    '',
    '> [!secreto]',
    `> Lo que no saben los jugadores de ${title(i)}: ${word(i + 3)}.`
  ].join('\n')
}

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

describe.skipIf(!process.env.CRISOL_ESCALA)('a la escala de Eana', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  let conn: ReturnType<typeof connect>
  const { connected, api, closeClients } = mcpTestHelpers(
    BASE,
    () => server,
    () => conn
  )

  beforeAll(async () => {
    const url = await freshTestDatabase('crisol_test_escala')
    conn = connect(url, { max: 2 })
    server = await startServer({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT,
      DATABASE_URL: url,
      VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790',
      QUEUE_PREFIX: 'crisol-test',
      MODEL_DIR: '/sin-modelo',
      AUTH_SECRET: TEST_AUTH_SECRET,
      PUBLIC_URL: BASE,
      DATA_DIR: testDataDir()
    })
  })

  afterAll(async () => {
    await closeClients()
    await server?.stop()
    await conn?.close()
  })

  it('2.400 páginas por crear_paginas, de 50 en 50: cada llamada en menos de 3 s y todos los enlaces resueltos', async () => {
    const { userId, cookie, call } = await connected()
    await aiRepo.setAiMode(conn.db, userId, 'copilot')
    const world = (await call<{ id: string }>('crear_mundo', { name: 'Eana' })).data
    const times: number[] = []
    for (let start = 0; start < PAGES; start += BATCH) {
      // Cada tanda, una página con 49 subpáginas
      const pages = Array.from({ length: BATCH }, (_, n) => ({
        key: `p${start + n}`,
        ...(n > 0 ? { parent: `p${start}` } : {}),
        title: title(start + n),
        markdown: pageMarkdown(start + n)
      }))
      const began = performance.now()
      const result = await call('crear_paginas', { worldId: world.id, parentId: null, pages })
      times.push(performance.now() - began)
      expect(result.isError, result.text.slice(0, 300)).toBeFalsy()
    }
    const unresolved = await api<{ links: unknown[] }>(cookie, 'listUnresolvedLinks', { worldId: world.id })
    const searchStart = performance.now()
    const search = await call<{ total: number }>('buscar_paginas', { worldId: world.id, query: 'dargon' })
    const searchTime = performance.now() - searchStart
    const treeStart = performance.now()
    const tree = await call<{ pages: unknown[] }>('ver_arbol', { worldId: world.id, levels: 2 })
    const treeTime = performance.now() - treeStart
    process.stderr.write(
      `escala: ${times.length} llamadas, mediana ${Math.round(median(times))} ms, máxima ${Math.round(Math.max(...times))} ms; ` +
        `búsqueda ${Math.round(searchTime)} ms (${search.data.total} páginas); árbol ${Math.round(treeTime)} ms (${tree.data.pages.length})\n`
    )
    expect(Math.max(...times)).toBeLessThan(3000)
    expect(unresolved.links).toEqual([])
    expect(search.data.total).toBeGreaterThan(0)
  }, 900_000)

  it('las tablas que se llenan solas con 5.000 páginas: el 95 % en menos de 150 ms (módulo 2)', async () => {
    const { cookie, call } = await connected()
    const world = (await call<{ id: string }>('crear_mundo', { name: 'Eana' })).data
    const FACTIONS = 100
    const factions = Array.from({ length: FACTIONS }, (_, i) => ({
      key: `f${i}`,
      title: `Facción ${i}`,
      template: 'faccion'
    }))
    const created = await api<{ pages: { key: string; id: string }[] }>(cookie, 'createPages', {
      worldId: world.id,
      parentId: null,
      pages: factions.slice(0, 50)
    })
    const more = await api<{ pages: { key: string; id: string }[] }>(cookie, 'createPages', {
      worldId: world.id,
      parentId: null,
      pages: factions.slice(50)
    })
    const factionIds = [...created.pages, ...more.pages].map((p) => p.id)
    // 4.900 PNJ, cada uno de una facción (unos 49 por facción), con sus columnas
    for (let start = 0; start < 4900; start += 50) {
      const pages = Array.from({ length: 50 }, (_, n) => {
        const i = start + n
        return {
          key: `p${i}`,
          title: `PNJ ${i}`,
          template: 'pnj',
          markdown: `---\nFacción: "[[${factionIds[i % FACTIONS]}]]"\nRol: Rol ${i % 7}\nEstado: Vive\n---\n`
        }
      })
      await api(cookie, 'createPages', { worldId: world.id, parentId: null, pages })
    }
    const times: number[] = []
    for (const pageId of factionIds.slice(0, 60)) {
      const began = performance.now()
      const tables = await api<{ tables: { rows: unknown[] }[] }>(cookie, 'getPageTables', { pageId })
      times.push(performance.now() - began)
      expect(tables.tables[0]?.rows.length).toBe(49)
    }
    const sorted = [...times].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    process.stderr.write(
      `escala: tablas con 5.000 páginas, mediana ${Math.round(median(times))} ms, p95 ${Math.round(p95)} ms\n`
    )
    expect(p95).toBeLessThan(150)
  }, 900_000)

  it('50 páginas desde plantilla por crear_paginas, enlazadas entre sí: en menos de 3 s (módulo 2)', async () => {
    const { userId, call } = await connected()
    await aiRepo.setAiMode(conn.db, userId, 'copilot')
    const world = (await call<{ id: string }>('crear_mundo', { name: 'Eana' })).data
    const pages = [
      ...Array.from({ length: 25 }, (_, i) => ({
        key: `pnj${i}`,
        title: `PNJ ${i}`,
        template: 'PNJ',
        markdown: `---\nFacción: "[[Facción ${i}]]"\nEstado: Vive\n---\n`
      })),
      ...Array.from({ length: 25 }, (_, i) => ({ key: `f${i}`, title: `Facción ${i}`, template: 'faccion' }))
    ]
    const began = performance.now()
    const result = await call('crear_paginas', { worldId: world.id, parentId: null, pages })
    const time = performance.now() - began
    process.stderr.write(`escala: 50 páginas desde plantilla en ${Math.round(time)} ms\n`)
    expect(result.isError, result.text.slice(0, 300)).toBeFalsy()
    expect(time).toBeLessThan(3000)
  })

  it('tirar dados en una campaña con su registro lleno: el 95 % en menos de 50 ms (módulo 3)', async () => {
    const { cookie, call } = await connected()
    const world = (await call<{ id: string }>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<{ id: string }>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    // El límite es de 60 por minuto y persona: el registro se llena directo en la tabla, y se mide al tirar
    await conn.sql`
      insert into dice_rolls (campaign_id, world_id, user_id, formula, visibility, result, created_at)
      select ${campaign.id}, ${world.id}, (select user_id from campaign_members where campaign_id = ${campaign.id} limit 1),
        '1d20', 'all', '{"total": 10, "detail": "1d20 → [10] = 10", "critical": null, "dice": []}'::jsonb,
        now() - interval '1 day'
      from generate_series(1, 20000)
    `
    // En el servidor: la acción de tirar, con su base de datos (sin la red ni la sesión, que son de cualquier petición)
    const [owner] = await conn.sql<
      { user_id: string }[]
    >`select user_id from campaign_members where campaign_id = ${campaign.id} limit 1`
    const userId = owner?.user_id ?? ''
    const realtime = createRealtime(async () => actorFrom(userId, await loadMemberships(conn.db, userId)))
    const rollDice = implementationsByName.get('rollDice')
    if (!rollDice) throw new Error('sin rollDice')
    const inServer: number[] = []
    for (let i = 0; i < 50; i++) {
      // Como en la API, las pertenencias se leen en cada petición (y el límite por minuto deja 60)
      if (i === 30)
        await conn.sql`update dice_rolls set created_at = now() - interval '1 day' where created_at > now() - interval '1 minute'`
      const ctx = {
        db: conn.db,
        publicUrl: BASE,
        sealKey: Buffer.alloc(32),
        realtime,
        actions: implementationsByName,
        actor: actorFrom(userId, await loadMemberships(conn.db, userId)),
        via: 'ui'
      } satisfies ActionContext
      const began = performance.now()
      await rollDice.handler(ctx, { campaignId: campaign.id, formula: '2d20kh1+5 # Ataque', visibility: 'all' })
      inServer.push(performance.now() - began)
    }
    await conn.sql`update dice_rolls set created_at = now() - interval '1 day' where created_at > now() - interval '1 minute'`
    // Y entera, por la API, para el informe
    const times: number[] = []
    for (let i = 0; i < 50; i++) {
      const began = performance.now()
      await api(cookie, 'rollDice', { campaignId: campaign.id, formula: '2d20kh1+5 # Ataque', visibility: 'all' })
      times.push(performance.now() - began)
    }
    // Lo que tarda cualquier petición (la sesión, las pertenencias, la red local): una que solo lee la campaña
    const base: number[] = []
    for (let i = 0; i < 50; i++) {
      const began = performance.now()
      await api(cookie, 'getCampaign', { campaignId: campaign.id })
      base.push(performance.now() - began)
    }
    const p95 = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length * 0.95)] ?? 0
    process.stderr.write(
      `escala: tirar con 20.000 tiradas, en el servidor mediana ${Math.round(median(inServer))} ms, p95 ${Math.round(p95(inServer))} ms; ` +
        `por la API, mediana ${Math.round(median(times))} ms, p95 ${Math.round(p95(times))} ms; ` +
        `una petición que solo lee, mediana ${Math.round(median(base))} ms, p95 ${Math.round(p95(base))} ms\n`
    )
    expect(p95(inServer)).toBeLessThan(50)
  }, 300_000)

  it('un sistema de 2 MB por el MCP: crearlo, validarlo, cambiarlo por rutas y verlo por partes, cada vez en menos de 3 s (módulo 3)', async () => {
    const { call } = await connected()
    const help = 'Una ayuda larga para que el sistema pese lo que pesa uno de verdad. '.repeat(6)
    const types: Record<string, unknown> = {}
    for (let t = 0; t < 34; t++) {
      const fields: Record<string, unknown> = {}
      for (let f = 0; f < 120; f++)
        fields[`f${f}`] =
          f % 4 === 0
            ? { kind: 'derived', label: `F${f}`, help, formula: `@f${f + 1} + 1` }
            : { kind: 'number', label: `F${f}`, help, min: 0, max: 99 }
      types[`t${t}`] = { document: t === 0 ? 'actor' : 'item', label: `Tipo ${t}`, fields }
    }
    const document = { format: 1, id: 'grande', name: 'Grande', version: '1', languages: ['es'], types, rolls: {} }
    const bytes = Buffer.byteLength(JSON.stringify(document))
    expect(bytes).toBeGreaterThan(1.8 * 1024 * 1024)
    const timed = async <T>(run: () => Promise<T>) => {
      const began = performance.now()
      const value = await run()
      return { value, ms: performance.now() - began }
    }
    const checked = await timed(() => call<{ valid: boolean }>('validar_sistema', { document }))
    expect(checked.value.data.valid).toBe(true)
    const created = await timed(() => call<{ id: string }>('crear_sistema', { document }))
    expect(created.value.isError).toBeFalsy()
    const id = created.value.data.id
    const changed = await timed(() =>
      call<{ system: { version: number } }>('cambiar_sistema', {
        systemId: id,
        version: 1,
        changes: [{ path: 'types.t0.fields.f1.max', value: 50 }]
      })
    )
    expect(changed.value.data.system.version).toBe(2)
    const parts = await timed(() =>
      call<{ parts: Record<string, unknown> }>('ver_sistema', { systemId: id, parts: ['types.t0.fields.f1'] })
    )
    expect(parts.value.data.parts['types.t0.fields.f1']).toMatchObject({ max: 50 })
    const whole = await timed(() => call<{ document: unknown }>('ver_sistema', { systemId: id }))
    expect(Buffer.byteLength(JSON.stringify(whole.value.data.document))).toBeGreaterThan(1.8 * 1024 * 1024)
    const times = { validar: checked.ms, crear: created.ms, cambiar: changed.ms, partes: parts.ms, entero: whole.ms }
    process.stderr.write(
      `escala: un sistema de ${(bytes / 1024 / 1024).toFixed(2)} MB por el MCP, ${Object.entries(times)
        .map(([what, ms]) => `${what} ${Math.round(ms)} ms`)
        .join(', ')}\n`
    )
    for (const ms of Object.values(times)) expect(ms).toBeLessThan(3000)
  }, 120_000)
})
