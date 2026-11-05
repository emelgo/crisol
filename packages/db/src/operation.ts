/**
 * El único camino de escritura de las tablas de dominio. Cada operación es una transacción que apunta en el historial
 * cada fila que toca, completa antes y después (to_jsonb de Postgres), y pone la versión y la autoría.
 */
import { eq, getTableName, type InferInsertModel, type InferSelectModel, inArray, sql } from 'drizzle-orm'
import type { Database } from './client.ts'
import { campaignMembers, campaigns } from './schema/campaigns.ts'
import { fileFolders, files } from './schema/files.ts'
import { changes, operations } from './schema/history.ts'
import { invitationLinks } from './schema/invitations.ts'
import { mapElements, mapPins, maps, pageTabs } from './schema/maps.ts'
import { organizationMembers, organizations } from './schema/organizations.ts'
import { pages } from './schema/pages.ts'
import { systemContent, systems } from './schema/systems.ts'
import { tags } from './schema/tags.ts'
import { pageTemplates } from './schema/templates.ts'
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
  page_bodies: pageBodies,
  files,
  file_folders: fileFolders,
  tags,
  page_templates: pageTemplates,
  systems,
  system_content: systemContent,
  page_tabs: pageTabs,
  maps,
  map_pins: mapPins,
  map_elements: mapElements
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
  /** Muchas filas de una tabla, por tandas y en su orden (el contenido de un sistema): igual que insertar una a una */
  insertMany<T extends TrackedTable>(table: T, values: readonly Values<T>[]): Promise<InferSelectModel<T>[]>
  update<T extends TrackedTable>(table: T, id: string, patch: Partial<Values<T>>): Promise<InferSelectModel<T>>
  remove(table: TrackedTable, id: string): Promise<void>
  /** Muchas filas de una tabla, por tandas (al subir un sistema encima de otro): igual que quitarlas una a una (sin ids repetidos) */
  removeMany(table: TrackedTable, ids: readonly string[]): Promise<void>
  /**
   * Deja una fila como la guarda el historial (to_jsonb, con su id y su versión): la actualiza si existe o la vuelve
   * a poner si no. Para deshacer
   */
  restore(table: TrackedTable, row: Json): Promise<void>
  /** Para leer dentro de la misma transacción (y escribir tablas que no son de dominio) */
  read: Transaction
}

type Json = Record<string, unknown>

/**
 * Las columnas que calcula la base (el vector de búsqueda de las páginas): no van al historial ni se escriben al
 * deshacer (Postgres no deja). Se miran una vez por tabla
 */
const generated = new Map<string, Promise<Set<string>>>()
function generatedColumns(tx: Transaction, table: string) {
  let columns = generated.get(table)
  if (!columns) {
    columns = tx
      .execute<{ name: string }>(
        sql`select column_name as name from information_schema.columns
          where table_schema = current_schema() and table_name = ${table} and is_generated = 'ALWAYS'`
      )
      .then((rows) => new Set([...rows].map((row) => row.name)))
    generated.set(table, columns)
  }
  return columns
}

const without = (row: Json, columns: ReadonlySet<string>) =>
  columns.size === 0 ? row : Object.fromEntries(Object.entries(row).filter(([column]) => !columns.has(column)))

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
      const row = rows[0]?.row ?? null
      return row ? without(row, await generatedColumns(tx, table)) : null
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
      async insertMany(table, values) {
        const name = getTableName(table)
        const out: InferSelectModel<typeof table>[] = []
        for (let i = 0; i < values.length; i += ROWS_PER_INSERT) {
          const rows = await tx
            .insert(table)
            .values(
              values
                .slice(i, i + ROWS_PER_INSERT)
                .map((v) => ({ ...v, createdBy: context.actorId, updatedBy: context.actorId })) as InferInsertModel<
                typeof table
              >[]
            )
            .returning()
          // Cómo quedaron, de una vez
          const ids = rows.map((r) => r.id)
          const columns = await generatedColumns(tx, name)
          const after = new Map(
            [
              ...(await tx.execute<{ row: Json }>(
                sql`select to_jsonb(t) as row from ${sql.identifier(name)} t where t.id in ${ids}`
              ))
            ].map(({ row }) => [String(row.id), without(row, columns)])
          )
          for (const row of rows)
            recorded.push({ tableName: name, rowId: row.id, before: null, after: after.get(row.id) ?? null })
          out.push(...(rows as InferSelectModel<typeof table>[]))
        }
        return out
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
      async removeMany(table, ids) {
        const name = getTableName(table)
        const columns = await generatedColumns(tx, name)
        for (let i = 0; i < ids.length; i += ROWS_PER_INSERT) {
          const chunk = ids.slice(i, i + ROWS_PER_INSERT)
          const before = new Map(
            [
              ...(await tx.execute<{ row: Json }>(
                sql`select to_jsonb(t) as row from ${sql.identifier(name)} t where t.id in ${chunk} for update`
              ))
            ].map(({ row }) => [String(row.id), without(row, columns)])
          )
          const missing = chunk.find((id) => !before.has(id))
          if (missing) throw new Error(`No existe ${name} ${missing}`)
          await tx.delete(table).where(inArray(table.id, chunk))
          for (const id of chunk)
            recorded.push({ tableName: name, rowId: id, before: before.get(id) ?? null, after: null })
        }
      },
      async restore(table, given) {
        const name = getTableName(table)
        const row = without(given, await generatedColumns(tx, name))
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
          const columns = Object.keys(row)
          columns.push(...['updated_by', 'updated_at'].filter((column) => !columns.includes(column)))
          const list = sql.join(
            columns.map((column) => sql.identifier(column)),
            sql`, `
          )
          await tx.execute(
            sql`insert into ${target} (${list}) select ${list} from jsonb_populate_record(null::${target}, ${values}::jsonb)`
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
    // En tandas: una operación grande (subir un sistema con miles de documentos) no pasa del tope de parámetros
    const rows = recorded.map((change, index) => ({ ...change, operationId: op.id, seq: index + 1 }))
    for (let i = 0; i < rows.length; i += CHANGES_PER_INSERT)
      await tx.insert(changes).values(rows.slice(i, i + CHANGES_PER_INSERT))
    return result
  })
}

/** Cada cambio lleva 6 valores; Postgres admite 65.535 por consulta */
const CHANGES_PER_INSERT = 2000
/** Filas por consulta al insertar muchas: con sus columnas (unas veinte, como mucho), por debajo del tope */
const ROWS_PER_INSERT = 500

/** El primer ámbito que aparece en los cambios: la fila de esa tabla o la columna que apunta a ella */
function scopeOf(recorded: Change[], table: string, column: string): string | null {
  for (const change of recorded) {
    if (change.tableName === table) return change.rowId
    const value = (change.after ?? change.before)?.[column]
    if (typeof value === 'string') return value
  }
  return null
}
