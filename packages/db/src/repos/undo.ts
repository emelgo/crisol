import { type Row, type RowChange, restoredRow, staleChange, undoBlocker, undoSteps } from '@crisol/domain'
import { asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, TRACKED_TABLES, type Transaction } from '../operation.ts'
import { changes, operations } from '../schema/history.ts'

/** Lo que cambió el deshacer: cada fila antes y después */
export type AppliedChange = RowChange

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

/**
 * Una fila de dominio que apunta a esta (clave ajena): quitarla se la llevaría por delante. Las de fuera del historial
 * (preferencias, estado de Yjs, índices) cuelgan con borrado en cascada y no cuentan: se van con ella (ADR-0003)
 */
async function dependentRow(tx: Transaction, { tableName, rowId }: Ref): Promise<Ref | null> {
  const references = await tx.execute<{ table_name: string; column_name: string }>(sql`
    select cl.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = ${tableName}::regclass and array_length(c.conkey, 1) = 1`)
  for (const reference of references) {
    if (!(reference.table_name in TRACKED_TABLES)) continue
    const rows = await tx.execute<{ id: string }>(sql`
      select to_jsonb(x)->>'id' as id from ${sql.identifier(reference.table_name)} x
      where x.${sql.identifier(reference.column_name)} = ${rowId} limit 1`)
    const found = rows[0]
    if (found) return { tableName: reference.table_name, rowId: found.id }
  }
  return null
}

/** La operación que quitó esa fila (la última vez) */
async function removerOf(tx: Transaction, { tableName, rowId }: Ref) {
  const rows = await tx.execute<{ id: string }>(sql`
    select c.operation_id as id from changes c join operations o on o.id = c.operation_id
    where c.table_name = ${tableName} and c.row_id = ${rowId} and c.after is null
    order by o.created_at desc limit 1`)
  return rows[0]?.id ?? null
}

/**
 * Una fila a la que esta apunta (clave ajena) y que ya no está: volver a ponerla fallaría. Devuelve la de la tabla de
 * dominio, para decir quién la quitó; una de fuera (una cuenta ya borrada) va sin historial
 */
async function missingParent(tx: Transaction, tableName: string, row: Row): Promise<Ref | null> {
  const references = await tx.execute<{ column_name: string; parent_table: string; parent_column: string }>(sql`
    select a.attname as column_name, p.relname as parent_table, pa.attname as parent_column
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_class p on p.oid = c.confrelid
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f' and c.conrelid = ${tableName}::regclass and array_length(c.conkey, 1) = 1`)
  for (const reference of references) {
    const value = row[reference.column_name]
    if (value === null || value === undefined) continue
    const rows = await tx.execute(sql`
      select 1 from ${sql.identifier(reference.parent_table)} x
      where x.${sql.identifier(reference.parent_column)}::text = ${String(value)} limit 1`)
    if (rows.length === 0) return { tableName: reference.parent_table, rowId: String(value) }
  }
  return null
}

/**
 * Si la cuenta sigue en la organización por otra campaña o mundo, sin contar lo que quita este mismo deshacer:
 * entonces no se le quita la pertenencia a ella (la misma regla que al expulsar o salir)
 */
async function stillInOrganization(tx: Transaction, row: Row, removing: readonly string[]) {
  const ids = sql`array[${sql.join(
    [...removing, '00000000-0000-0000-0000-000000000000'].map((id) => sql`${id}`),
    sql`, `
  )}]::uuid[]`
  const rows = await tx.execute(sql`
    select 1 from campaign_members cm join campaigns c on c.id = cm.campaign_id join worlds w on w.id = c.world_id
    where cm.user_id = ${String(row.user_id)} and w.organization_id = ${String(row.organization_id)}
      and cm.id <> all(${ids})
    union all
    select 1 from world_members wm join worlds w on w.id = wm.world_id
    where wm.user_id = ${String(row.user_id)} and w.organization_id = ${String(row.organization_id)}
      and wm.id <> all(${ids})
    limit 1`)
  return rows.length > 0
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
        const steps = undoSteps(list)
        const removing = steps.flatMap((step) => (step.kind === 'remove' ? [step.rowId] : []))
        for (const step of steps) {
          const table = trackedTable(step.tableName)
          if (step.kind === 'remove') {
            const dependent = await dependentRow(w.read, step)
            if (dependent) throw new UndoConflict(await creatorOf(w.read, dependent))
            const before = await currentRow(w.read, step)
            // Quien entró en la organización con esta campaña y sigue en otra, sigue en ella
            if (step.tableName === 'organization_members' && before?.role === 'member') {
              if (await stillInOrganization(w.read, before, removing)) continue
            }
            await w.remove(table, step.rowId)
            applied.push({ tableName: step.tableName, rowId: step.rowId, before, after: null })
          } else {
            const rowId = String(step.row.id)
            const current = await currentRow(w.read, { tableName: step.tableName, rowId })
            const row = restoredRow(current, step.row, step.after)
            const duplicate = await duplicateRow(w.read, step.tableName, row)
            if (duplicate) throw new UndoConflict(await creatorOf(w.read, duplicate))
            const parent = await missingParent(w.read, step.tableName, row)
            if (parent) throw new UndoConflict(await removerOf(w.read, parent))
            await w.restore(table, row)
            applied.push({ tableName: step.tableName, rowId, before: current, after: row })
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
