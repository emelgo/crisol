/**
 * Las tablas aleatorias del máster (docs/specs/personajes.md § tablas): la pestaña «Tabla» de una página. Se tiran en
 * el servidor, en una campaña de su mundo, y quedan en su registro de tiradas; sin reemplazo, lo sacado se guarda por
 * campaña
 */
import { getRandomTable, type RandomTable, resetTableDraws, rollOnTable, updateRandomTable } from '@crisol/contracts'
import { tablesRepo } from '@crisol/db'
import { cryptoRoller, rowFor, tableFormula, tableProblems } from '@crisol/dice'
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

/** Tirar en una tabla (y en las suyas): su fila, sin repetir lo sacado si va sin reemplazo */
async function draw(
  ctx: ActionContext,
  table: tablesRepo.TableOfTab,
  campaignId: string,
  depth: number
): Promise<{ result: ReturnType<typeof rolled>; results: { text: string; page: string | null }[] }> {
  const drawn = table.replacement ? [] : await tablesRepo.drawsOf(ctx.db, campaignId, table.id)
  const left = table.rows.filter((r) => !drawn.includes(r.id))
  if (left.length === 0) throw new InvalidRequestError('TABLE_EMPTY', 'ya ha salido todo: reiníciala')
  const formula = tableFormula(table.formula, table.rows)
  let result = rolled(formula)
  let row = rowFor(left, result.total)
  // Lo que ya salió no vuelve: se tira otra vez (y si aun así no, una de las que quedan)
  for (let i = 0; !row && i < 50; i++) {
    result = rolled(formula)
    row = rowFor(left, result.total)
  }
  row ??= left[cryptoRoller(left.length) - 1] ?? null
  if (!row) throw new InvalidRequestError('TABLE_EMPTY', 'la tabla no tiene filas')
  if (!table.replacement) await tablesRepo.addDraws(ctx.db, campaignId, table.id, [row.id])
  const results = [{ text: row.text, page: row.page ?? null }]
  if (row.table && depth < MAX_DEPTH) {
    const nested = await tablesRepo.tableOfTab(ctx.db, row.table)
    if (nested && nested.worldId === table.worldId) {
      const inner = await draw(ctx, nested, campaignId, depth + 1)
      results.push(...inner.results.map((r) => ({ ...r, text: `${nested.name}: ${r.text}` })))
    }
  }
  return { result, results }
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
    // Las tablas anidadas, de este mundo y no ella misma
    for (const r of rows) {
      if (!r.table) continue
      const nested = await tablesRepo.tableOfTab(ctx.db, r.table)
      if (!nested || nested.worldId !== wiki.worldId) problems.push(`No existe la tabla de la fila ${r.from}–${r.to}`)
      else if (r.table === tabId) problems.push(`La fila ${r.from}–${r.to} lleva a esta misma tabla`)
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
    const { result, results } = await draw(ctx, table, campaignId, 0)
    const roll = await saveRoll(ctx, campaign, {
      formula: result.formula,
      label: table.name,
      visibility,
      result: { ...storedOf(result), table: { name: table.name, results } }
    })
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
