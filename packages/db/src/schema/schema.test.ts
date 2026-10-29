import { createTableRelationsHelpers, extractTablesRelationalConfig, getTableName, is, Table } from 'drizzle-orm'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from './index.ts'

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, Table))
const names = new Set(tables.map((table) => getTableName(table)))

describe('esquema', () => {
  it('cada clave ajena apunta a una tabla del esquema', () => {
    for (const table of tables) {
      for (const fk of getTableConfig(table).foreignKeys) {
        expect(names, `${getTableName(table)} → ${getTableName(fk.reference().foreignTable)}`).toContain(
          getTableName(fk.reference().foreignTable)
        )
      }
    }
  })

  it('las relaciones (las de Better Auth) se resuelven entre tablas del esquema', () => {
    const { tables: config } = extractTablesRelationalConfig(schema, createTableRelationsHelpers)
    const relations = Object.values(config).flatMap((table) => Object.values(table.relations))
    expect(relations.length).toBeGreaterThan(0)
    for (const relation of relations) expect(names).toContain(getTableName(relation.referencedTable))
  })
})
