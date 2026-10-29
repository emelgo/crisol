import { type Row, type RowChange, staleChange, undoBlocker, undoSteps } from '@crisol/domain'
import { asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, TRACKED_TABLES, type Transaction } from '../operation.ts'
import { changes, operations } from '../schema/history.ts'

export type UndoResult =
  | { status: 'undone'; operationId: string; applied: RowChange[] }
  /** by: la operación posterior que lo impide (null si no se sabe: una fila sin historial) */
  | { status: 'conflict'; by: string | null }
  | { status: 'already-undone' }
  | { status: 'not-undoable' }
  | { status: 'not-found' }

/** Algo posterior lo impide: se tira la transacción entera, para no dejar nada a medias */
class UndoConflict extends Error {
  readonly by: string | null
  constructor(by: string | null) {
    super('conflicto al deshacer')
    this.by = by
  }
}

type Ref = { tableName: string; rowId: string }

function trackedTable(name: string) {
  const table = TRACKED_TABLES[name as keyof typeof TRACKED_TABLES]
  if (!table) throw new Error(`No se puede deshacer en ${name}`)
  return table
}

/** La fila como está ahora, bloqueada hasta el final de la transacción */
async function currentRow(tx: Transaction, { tableName, rowId }: Ref): Promise<Row | null> {
  const rows = await tx.execute<{ row: Row }>(
    sql`select to_jsonb(t) as row from ${sql.identifier(tableName)} t where t.id = ${rowId} for update`
  )
  return rows[0]?.row ?? null
}

/** La última operación posterior a la dada que tocó la fila */
async function laterOperation(tx: Transaction, { tableName, rowId }: Ref, after: string) {
  const rows = await tx.execute<{ id: string }>(sql`
    select c.operation_id as id from changes c join operations o on o.id = c.operation_id
    where c.table_name = ${tableName} and c.row_id = ${rowId}
      and o.created_at > (select created_at from operations where id = ${after})
    order by o.created_at desc limit 1`)
  return rows[0]?.id ?? null
}

/** La operación que puso esa fila (la última vez, si se quitó y volvió) */
async function creatorOf(tx: Transaction, { tableName, rowId }: Ref) {
  const rows = await tx.execute<{ id: string }>(sql`
    select c.operation_id as id from changes c join operations o on o.id = c.operation_id
    where c.table_name = ${tableName} and c.row_id = ${rowId} and c.before is null
    order by o.created_at desc limit 1`)
  return rows[0]?.id ?? null
}

/** Una fila que apunta a esta (clave ajena): quitarla se la llevaría por delante */
async function dependentRow(tx: Transaction, { tableName, rowId }: Ref): Promise<Ref | null> {
  const references = await tx.execute<{ table_name: string; column_name: string }>(sql`
    select cl.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = ${tableName}::regclass and array_length(c.conkey, 1) = 1`)
  for (const reference of references) {
    const rows = await tx.execute<{ id: string }>(sql`
      select to_jsonb(x)->>'id' as id from ${sql.identifier(reference.table_name)} x
      where x.${sql.identifier(reference.column_name)} = ${rowId} limit 1`)
    const found = rows[0]
    if (found) return { tableName: reference.table_name, rowId: found.id }
  }
  return null
}

/** Otra fila con los mismos valores en algo que tiene que ser único: volver a poner esta chocaría */
async function duplicateRow(tx: Transaction, tableName: string, row: Row): Promise<Ref | null> {
  const uniques = await tx.execute<{ columns: string[] }>(sql`
    select array_agg(a.attname::text order by k.ord) as columns
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.conrelid = ${tableName}::regclass and c.contype = 'u'
    group by c.oid`)
  const table = sql.identifier(tableName)
  for (const { columns } of uniques) {
    const of = (alias: string) =>
      sql.join(
        columns.map((column) => sql`${sql.identifier(alias)}.${sql.identifier(column)}`),
        sql`, `
      )
    const rows = await tx.execute<{ id: string }>(sql`
      select x.id::text as id from ${table} x, jsonb_populate_record(null::${table}, ${JSON.stringify(row)}::jsonb) r
      where (${of('x')}) = (${of('r')}) and x.id <> r.id limit 1`)
    const found = rows[0]
    if (found) return { tableName, rowId: found.id }
  }
  return null
}

/**
 * Deshace una operación con una operación nueva, enlazada a ella, que a su vez se puede deshacer. Si algo de lo que
 * tocó se cambió después, o deshacerlo se llevaría por delante algo posterior, no toca nada y dice qué operación fue.
 */
export async function undoOperation(db: Database, context: OperationContext, operationId: string): Promise<UndoResult> {
  const [target] = await db.select().from(operations).where(eq(operations.id, operationId))
  if (!target) return { status: 'not-found' }
  try {
    const result = await operation(
      db,
      {
        ...context,
        organizationId: target.organizationId,
        ...(target.worldId ? { worldId: target.worldId } : {}),
        details: { action: target.action, details: target.details },
        undoes: operationId
      },
      async (w): Promise<UndoResult> => {
        // Bloqueada: dos deshacer de la misma operación a la vez no se cuelan
        const [locked] = await w.read.select().from(operations).where(eq(operations.id, operationId)).for('update')
        if (!locked) return { status: 'not-found' }
        const blocker = undoBlocker(locked)
        if (blocker === 'ALREADY_UNDONE') return { status: 'already-undone' }
        if (blocker === 'NOT_UNDOABLE') return { status: 'not-undoable' }

        const list: RowChange[] = (
          await w.read.select().from(changes).where(eq(changes.operationId, operationId)).orderBy(asc(changes.seq))
        ).map((c) => ({
          tableName: c.tableName,
          rowId: c.rowId,
          before: c.before as Row | null,
          after: c.after as Row | null
        }))
        const now = new Map<string, Row | null>()
        for (const change of list) now.set(`${change.tableName}/${change.rowId}`, await currentRow(w.read, change))
        const stale = staleChange(list, (tableName, rowId) => now.get(`${tableName}/${rowId}`) ?? null)
        if (stale) throw new UndoConflict(await laterOperation(w.read, stale, operationId))

        const applied: RowChange[] = []
        for (const step of undoSteps(list)) {
          const table = trackedTable(step.tableName)
          if (step.kind === 'remove') {
            const dependent = await dependentRow(w.read, step)
            if (dependent) throw new UndoConflict(await creatorOf(w.read, dependent))
            const before = now.get(`${step.tableName}/${step.rowId}`) ?? null
            await w.remove(table, step.rowId)
            applied.push({ tableName: step.tableName, rowId: step.rowId, before, after: null })
          } else {
            const duplicate = await duplicateRow(w.read, step.tableName, step.row)
            if (duplicate) throw new UndoConflict(await creatorOf(w.read, duplicate))
            const rowId = String(step.row.id)
            await w.restore(table, step.row)
            applied.push({
              tableName: step.tableName,
              rowId,
              before: now.get(`${step.tableName}/${rowId}`) ?? null,
              after: step.row
            })
          }
        }
        return { status: 'undone', operationId: '', applied }
      }
    )
    if (result.status !== 'undone') return result
    const [undo] = await db.select({ id: operations.id }).from(operations).where(eq(operations.undoesId, operationId))
    return { ...result, operationId: undo?.id ?? '' }
  } catch (error) {
    if (error instanceof UndoConflict) return { status: 'conflict', by: error.by }
    throw error
  }
}
