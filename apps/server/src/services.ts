import type { Connection } from '@crisol/db'
import type { Redis } from 'ioredis'
import type { HealthChecks } from './health.ts'

/** Comprobaciones de salud de los servicios de los que depende el servidor */
export function serviceChecks(db: Connection, valkey: Redis): HealthChecks {
  return {
    postgres: async () => {
      await db.sql`select 1`
    },
    valkey: async () => {
      await valkey.ping()
    }
  }
}
