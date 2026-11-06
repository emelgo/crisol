/**
 * Las tablas aleatorias del máster (docs/specs/personajes.md § tablas): la pestaña «Tabla» de una página. Se tiran en
 * el servidor, en una campaña de su mundo, y quedan en su registro de tiradas; sin reemplazo, lo sacado se guarda por
 * campaña
 */
import { getRandomTable, type RandomTable, resetTableDraws, rollOnTable, updateRandomTable } from '@crisol/contracts'
import { pagesRepo, tablesRepo } from '@crisol/db'
import { cryptoRoller, type RangeRow, rowFor, tableFormula, tableProblems } from '@crisol/dice'
import { NotFoundError } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { rolled, saveRoll, storedOf } from './dice.ts'
import { authorizedTab } from './maps.ts'
import { implement } from './registry.ts'

/** Tablas dentro de tablas: como mucho tantas */
const MAX_DEPTH = 5

const tableView = (table: tablesRepo.TableOfTab): RandomTable => ({
  tabId: table.tabId,
  name: table.name,
  pageId: table.pageId,
  formula: table.formula,
  replacement: table.replacement,
  rows: table.rows.map((r) => ({ ...r, page: r.page ?? null, table: r.table ?? null })),
  version: table.version
})

/** La tabla de una pestaña que se puede ver (la de una página de la wiki) */
async function readableTable(ctx: ActionContext, tabId: string, capability: 'page.read' | 'page.write' = 'page.read') {
  const found = await authorizedTab(ctx, capability, tabId)
  const table = await tablesRepo.tableOfTab(ctx.db, tabId)
  if (!table) throw new NotFoundError('table')
  return { ...found, table }
}

export interface Drawn {
  result: { formula: string; total: number; detail: string; critical: 'high' | 'low' | null; dice: StoredDie[] }
  results: { text: string; page: string | null }[]
  /** Lo que sale de cada tabla sin reemplazo: se apunta al guardar la tirada */
  draws: { tableId: string; rowId: string }[]
}
type StoredDie = { sides: number | 'F'; value: number; kept: boolean }

/** Una fila de las que quedan, al azar por lo que ocupa cada una (sin reemplazo, cuando lo tirado ya salió) */
function amongLeft<R extends RangeRow>(rows: readonly R[]) {
  const width = (r: { from: number; to: number }) => Math.max(1, r.to - r.from + 1)
  const total = rows.reduce((n, r) => n + width(r), 0)
  let n = cryptoRoller(total) - 1
  for (const r of rows) {
    if (n < width(r)) return { row: r, value: r.from + n }
    n -= width(r)
  }
  return null
}

/** Tirar en una tabla (y en las suyas), sin apuntar nada: lo sacado se apunta al guardar la tirada */
/**
 * Tira en una tabla (la pestaña «Tabla» de la wiki o una del compendio): su fórmula y la fila de lo que sale, entre las
 * que no se han sacado. Si lo tirado ya salió (o no cae en ninguna), una de las que quedan, por lo que ocupa
 */
export function pickRow<R extends RangeRow>(
  table: { name: string; formula?: string | null; rows: readonly R[] },
  drawn: readonly string[]
): { result: Drawn['result']; row: R } {
  const left = table.rows.filter((r) => !drawn.includes(r.id))
  if (left.length === 0)
    throw new InvalidRequestError('TABLE_EMPTY', `ya ha salido todo en «${table.name}»: reiníciala`)
  const formula = tableFormula(table.formula, table.rows)
  const rolledResult = rolled(formula)
  const row = rowFor(left, rolledResult.total)
  if (row) return { result: { ...storedOf(rolledResult), formula: rolledResult.formula }, row }
  const picked = amongLeft(left)
  if (!picked) throw new InvalidRequestError('TABLE_EMPTY', 'la tabla no tiene filas')
  return {
    row: picked.row,
    result: {
      formula,
      total: picked.value,
      detail: `${rolledResult.detail} → ${picked.value} (sin repetir)`,
      critical: null,
      dice: []
    }
  }
}

async function draw(
  ctx: ActionContext,
  table: tablesRepo.TableOfTab,
  campaignId: string,
  depth: number
): Promise<Drawn> {
  const drawn = table.replacement ? [] : await tablesRepo.drawsOf(ctx.db, campaignId, table.id)
  const { result, row } = pickRow(table, drawn)
  const results = [{ text: row.text, page: row.page ?? null }]
  const draws = table.replacement ? [] : [{ tableId: table.id, rowId: row.id }]
  if (row.table && depth < MAX_DEPTH) {
    const nested = await tablesRepo.tableOfTab(ctx.db, row.table)
    if (nested && nested.worldId === table.worldId) {
      const inner = await draw(ctx, nested, campaignId, depth + 1)
      results.push(...inner.results.map((r) => ({ ...r, text: `${nested.name}: ${r.text}` })))
      draws.push(...inner.draws)
    }
  }
  return { result, results, draws }
}

/** Las tablas a las que lleva una (y las suyas): si alguna vuelve a ella, hay un ciclo */
async function reaches(ctx: ActionContext, from: readonly { table?: string | null }[], target: string, depth = 0) {
  if (depth > MAX_DEPTH) return false
  for (const r of from) {
    if (!r.table) continue
    if (r.table === target) return true
    const next = await tablesRepo.tableOfTab(ctx.db, r.table)
    if (next && (await reaches(ctx, next.rows, target, depth + 1))) return true
  }
  return false
}

export const tableActions = [
  implement(getRandomTable, async (ctx, { tabId, campaignId }) => {
    const { table, wiki } = await readableTable(ctx, tabId)
    let drawn: string[] = []
    if (campaignId) {
      const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
      if (campaign.worldId !== wiki.worldId)
        throw new InvalidRequestError('BAD_CAMPAIGN', 'esa campaña es de otro mundo')
      drawn = await tablesRepo.drawsOf(ctx.db, campaignId, table.id)
    }
    return { table: tableView(table), drawn }
  }),

  implement(updateRandomTable, async (ctx, { tabId, version, ...patch }) => {
    const { table, page, wiki } = await readableTable(ctx, tabId, 'page.write')
    const rows = patch.rows ?? table.rows
    const formula = patch.formula === undefined ? table.formula : patch.formula
    const problems = tableProblems(formula, rows)
    if (new Set(rows.map((r) => r.id)).size !== rows.length) problems.push('Hay filas con el mismo id')
    // Las tablas anidadas, de este mundo y sin volver a esta; las páginas, de este mundo y fuera de la papelera
    for (const r of rows) {
      if (r.table) {
        const nested = await tablesRepo.tableOfTab(ctx.db, r.table)
        if (!nested || nested.worldId !== wiki.worldId) problems.push(`No existe la tabla de la fila ${r.from}–${r.to}`)
        else if (r.table === tabId || (await reaches(ctx, nested.rows, tabId)))
          problems.push(`La fila ${r.from}–${r.to} lleva de vuelta a esta tabla`)
      }
      if (r.page) {
        const linked = await pagesRepo.findPage(ctx.db, r.page)
        if (!linked || linked.worldId !== wiki.worldId)
          problems.push(`No existe la página de la fila ${r.from}–${r.to}`)
      }
    }
    if (problems.length > 0) throw new InvalidRequestError('BAD_TABLE', problems.join('. '))
    try {
      await tablesRepo.updateTable(
        ctx.db,
        historyContext(ctx, 'updateRandomTable', { name: table.name, title: page.title }, wiki),
        table.id,
        version,
        {
          ...(patch.formula !== undefined ? { formula: patch.formula || null } : {}),
          ...(patch.replacement !== undefined ? { replacement: patch.replacement } : {}),
          ...(patch.rows
            ? { rows: patch.rows.map((r) => ({ ...r, page: r.page ?? null, table: r.table ?? null })) }
            : {})
        }
      )
    } catch (error) {
      if (error instanceof tablesRepo.TableChangedError)
        throw new InvalidRequestError('TABLE_CHANGED', 'la ha cambiado otro mientras tanto: vuelve a leerla')
      throw error
    }
    const fresh = await tablesRepo.tableOfTab(ctx.db, tabId)
    if (!fresh) throw new NotFoundError('table')
    return { table: tableView(fresh) }
  }),

  implement(rollOnTable, async (ctx, { tabId, campaignId, visibility }) => {
    const { table, wiki } = await readableTable(ctx, tabId)
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    if (campaign.worldId !== wiki.worldId) throw new InvalidRequestError('BAD_CAMPAIGN', 'esa campaña es de otro mundo')
    const { result, results, draws } = await draw(ctx, table, campaignId, 0)
    const { formula, ...stored } = result
    const roll = await saveRoll(ctx, campaign, {
      formula,
      label: table.name,
      visibility,
      result: { ...stored, table: { name: table.name, results } }
    })
    // Ya en el registro: lo sacado, apuntado (si la tirada no se guardó, nada se gastó)
    for (const d of draws) await tablesRepo.addDraws(ctx.db, campaignId, d.tableId, [d.rowId])
    return { roll, drawn: await tablesRepo.drawsOf(ctx.db, campaignId, table.id) }
  }),

  implement(resetTableDraws, async (ctx, { tabId, campaignId }) => {
    const { table, wiki } = await readableTable(ctx, tabId)
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    if (campaign.worldId !== wiki.worldId) throw new InvalidRequestError('BAD_CAMPAIGN', 'esa campaña es de otro mundo')
    await tablesRepo.resetDraws(ctx.db, campaignId, table.id)
    return { ok: true as const }
  })
]
