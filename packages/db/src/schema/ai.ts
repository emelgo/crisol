import type { AiMode, StoredApprovalStatus } from '@crisol/domain'
import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

const MODES = ['readOnly', 'assistant', 'copilot'] as const satisfies readonly AiMode[]
const STATUSES = [
  'pending',
  'approved',
  'done',
  'failed',
  'rejected'
] as const satisfies readonly StoredApprovalStatus[]

/** El modo de IA de cada cuenta. Sin fila, el de por defecto. Es un ajuste de la cuenta: no pasa por el historial */
export const aiSettings = pgTable(
  'ai_settings',
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    mode: text({ enum: MODES }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [check('ai_settings_mode', sql`${t.mode} in ('readOnly', 'assistant', 'copilot')`)]
)

/**
 * Lo que la IA pidió y espera la aprobación de la cuenta que la conectó. No es un dato de dominio: al aprobarse, la
 * acción se hace como cualquier otra y queda en el historial
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** La herramienta MCP y la acción del contrato, con su entrada ya validada */
    tool: text().notNull(),
    action: text().notNull(),
    input: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Los nombres de lo que toca (mundo, campaña) en el momento de pedirlo, para el resumen */
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: text({ enum: STATUSES }).notNull().default('pending'),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    decidedAt: timestamp({ withTimezone: true }),
    /** Lo que devolvió la acción al hacerse, o el código del error si no se pudo */
    result: jsonb().$type<Record<string, unknown>>(),
    error: text()
  },
  (t) => [
    index().on(t.userId, t.createdAt),
    check('approvals_status', sql`${t.status} in ('pending', 'approved', 'done', 'failed', 'rejected')`)
  ]
)

/**
 * Los tokens de acceso personales (ADR-0033): para los guiones que cargan mucho de una vez (un sistema entero, la wiki
 * de un mundo) por `/api/actions`. Valen como la cuenta y se guardan solo por su huella (SHA-256): el token entero se ve
 * una vez, al crearlo. Son un ajuste de la cuenta: crearlos y quitarlos no pasa por el historial (lo que se hace con
 * ellos, sí)
 */
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** La huella del token, en hexadecimal */
    hash: text().notNull().unique(),
    /** Su principio (crisol_pat_ y unos caracteres), para reconocerlo en la lista */
    prefix: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.userId, t.createdAt)]
)
