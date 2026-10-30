import { customType } from 'drizzle-orm/pg-core'

/** Un vector de búsqueda de Postgres (lo genera la base; no se escribe) */
export const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })
