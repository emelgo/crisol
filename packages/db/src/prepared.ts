/**
 * Consultas preparadas, una por conexión (o transacción): Drizzle monta su SQL una vez y Postgres guarda su análisis.
 * Para las lecturas que la mesa repite en cada refresco: montar la consulta costaba más que la vuelta a la base
 */
import type { Database } from './client.ts'

/** La consulta que hace `build` con esa conexión, montada la primera vez que se pide */
export function prepared<T>(build: (db: Database) => T): (db: Database) => T {
  const made = new WeakMap<Database, T>()
  return (db) => {
    let query = made.get(db)
    if (query === undefined) {
      query = build(db)
      made.set(db, query)
    }
    return query
  }
}
