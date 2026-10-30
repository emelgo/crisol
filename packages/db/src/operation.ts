/**
 * El único camino de escritura de las tablas de dominio. Cada operación es una transacción que apunta en el historial
 * cada fila que toca, completa antes y después (to_jsonb de Postgres), y pone la versión y la autoría.
 */
import { eq, getTableName, type InferInsertModel, type InferSelectModel, sql } from 'drizzle-orm'
import type { Database } from './client.ts'
import { campaignMembers, campaigns } from './schema/campaigns.ts'
import { changes, operations } from './schema/history.ts'
import { invitationLinks } from './schema/invitations.ts'
import { organizationMembers, organizations } from './schema/organizations.ts'
import { pages } from './schema/pages.ts'
import { pageBodies } from './schema/versions.ts'
import { worldMembers, worlds } from './schema/worlds.ts'

/** Tablas de dominio: las que pasan por el historial, por su nombre en SQL */
export const TRACKED_TABLES = {
  organizations,
  organization_members: organizationMembers,
  worlds,
  world_members: worldMembers,
  campaigns,
  campaign_members: campaignMembers,
  invitation_links: invitationLinks,
  pages,
  page_bodies: pageBodies
}

export type TrackedTable = (typeof TRACKED_TABLES)[keyof typeof TRACKED_TABLES]
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/** Columnas que pone operation(), nunca quien escribe */
type Managed = 'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
type Values<T extends TrackedTable> = Omit<InferInsertModel<T>, Managed>

export interface OperationContext {
  /** Si falta, se deduce de los cambios (al crear una organización, la propia) */
  organizationId?: string
  /** Si falta, se deduce de los cambios; hay que darlo cuando no lo llevan (los miembros de una campaña) */
  worldId?: string
  /** La cuenta que lo pidió (null: el sistema) */
  actorId: string | null
  via: 'ui' | 'ai' | 'system'
  /** La herramienta MCP, si lo pidió la IA */
  tool?: string | null
  /** La acción que se hizo (createWorld…) y sus datos, para el texto del historial */
  action: string
  details?: Record<string, unknown>
  /** La operación que deshace esta: quedan enlazadas en las dos direcciones */
  undoes?: string
}

export interface Writer {
  insert<T extends TrackedTable>(table: T, values: Values<T>): Promise<InferSelectModel<T>>
  update<T extends TrackedTable>(table: T, id: string, patch: Partial<Values<T>>): Promise<InferSelectModel<T>>
  remove(table: TrackedTable, id: string): Promise<void>
  /**
   * Deja una fila como la guarda el historial (to_jsonb, con su id y su versión): la actualiza si existe o la vuelve
   * a poner si no. Para deshacer
   */
  restore(table: TrackedTable, row: Json): Promise<void>
  /** Para leer dentro de la misma transacción (y escribir tablas que no son de dominio) */
  read: Transaction
}

type Json = Record<string, unknown>

interface Change {
  tableName: string
  rowId: string
  before: Json | null
  after: Json | null
}

export async function operation<R>(
  db: Database | Transaction,
  context: OperationContext,
  fn: (writer: Writer) => Promise<R>
): Promise<R> {
  return db.transaction(async (tx) => {
    const recorded: Change[] = []
    // Las filas tal cual quedan en la base de datos, con los nombres de columna de SQL
    const snapshot = async (table: string, id: string, lock = false) => {
      const rows = await tx.execute<{ row: Json }>(
        sql`select to_jsonb(t) as row from ${sql.identifier(table)} t where t.id = ${id} ${lock ? sql`for update` : sql``}`
      )
      return rows[0]?.row ?? null
    }
    const existing = async (table: string, id: string) => {
      const row = await snapshot(table, id, true)
      if (!row) throw new Error(`No existe ${table} ${id}`)
      return row
    }

    const writer: Writer = {
      read: tx,
      async insert(table, values) {
        const name = getTableName(table)
        const [row] = await tx
          .insert(table)
          .values({ ...values, createdBy: context.actorId, updatedBy: context.actorId } as InferInsertModel<
            typeof table
          >)
          .returning()
        if (!row) throw new Error(`No se pudo crear en ${name}`)
        recorded.push({ tableName: name, rowId: row.id, before: null, after: await snapshot(name, row.id) })
        return row as InferSelectModel<typeof table>
      },
      async update(table, id, patch) {
        const name = getTableName(table)
        const before = await existing(name, id)
        const [row] = await tx
          .update(table)
          .set({ ...patch, version: sql`${table.version} + 1`, updatedBy: context.actorId, updatedAt: new Date() })
          .where(eq(table.id, id))
          .returning()
        if (!row) throw new Error(`No existe ${name} ${id}`)
        recorded.push({ tableName: name, rowId: id, before, after: await snapshot(name, id) })
        return row as InferSelectModel<typeof table>
      },
      async remove(table, id) {
        const name = getTableName(table)
        const before = await existing(name, id)
        await tx.delete(table).where(eq(table.id, id))
        recorded.push({ tableName: name, rowId: id, before, after: null })
      },
      async restore(table, row) {
        const name = getTableName(table)
        const id = String(row.id)
        const before = await snapshot(name, id, true)
        // Quien lo deja así es quien deshace, ahora; lo demás (versión incluida) es la fila tal como estaba
        const values = JSON.stringify({ ...row, updated_by: context.actorId, updated_at: new Date().toISOString() })
        const target = sql.identifier(name)
        if (before) {
          const columns = Object.keys(row).filter((column) => column !== 'id')
          columns.push(...['updated_by', 'updated_at'].filter((column) => !columns.includes(column)))
          const list = (alias: string) =>
            sql.join(
              columns.map((column) => sql`${sql.identifier(alias)}.${sql.identifier(column)}`),
              sql`, `
            )
          await tx.execute(
            sql`update ${target} t set (${sql.join(
              columns.map((column) => sql.identifier(column)),
              sql`, `
            )}) = (select ${list('r')} from jsonb_populate_record(null::${target}, ${values}::jsonb) r) where t.id = ${id}`
          )
        } else {
          await tx.execute(
            sql`insert into ${target} select * from jsonb_populate_record(null::${target}, ${values}::jsonb)`
          )
        }
        recorded.push({ tableName: name, rowId: id, before, after: await snapshot(name, id) })
      }
    }

    const result = await fn(writer)
    if (recorded.length === 0) return result
    const organizationId = context.organizationId ?? scopeOf(recorded, 'organizations', 'organization_id')
    if (!organizationId) throw new Error(`No se sabe de qué organización es la operación ${context.action}`)
    const [op] = await tx
      .insert(operations)
      .values({
        organizationId,
        worldId: context.worldId ?? scopeOf(recorded, 'worlds', 'world_id'),
        actorId: context.actorId,
        via: context.via,
        tool: context.tool ?? null,
        action: context.action,
        details: context.details ?? {},
        undoesId: context.undoes ?? null,
        // La hora de ahora, no la del principio de la transacción: una que esperó a un bloqueo queda detrás de la que
        // lo tenía, y así el historial (y deshacer, que busca lo posterior) va en el orden en que pasaron las cosas
        createdAt: sql`clock_timestamp()`
      })
      .returning({ id: operations.id })
    if (!op) throw new Error('No se pudo guardar la operación')
    if (context.undoes) await tx.update(operations).set({ undoneById: op.id }).where(eq(operations.id, context.undoes))
    await tx
      .insert(changes)
      .values(recorded.map((change, index) => ({ ...change, operationId: op.id, seq: index + 1 })))
    return result
  })
}

/** El primer ámbito que aparece en los cambios: la fila de esa tabla o la columna que apunta a ella */
function scopeOf(recorded: Change[], table: string, column: string): string | null {
  for (const change of recorded) {
    if (change.tableName === table) return change.rowId
    const value = (change.after ?? change.before)?.[column]
    if (typeof value === 'string') return value
  }
  return null
}
