/**
 * A la escala de Eana (tarea 25): un mundo de 2.400 páginas con enlaces cruzados, secretos y alias, creado solo por el
 * MCP con crear_paginas, de 50 en 50. Cada llamada, en menos de 3 s, y al final ningún enlace sin resolver. Pesa: no va
 * en la CI normal; se lanza con CRISOL_ESCALA=1 (sus números van en el PR)
 */
import { aiRepo, connect } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
})
