/**
 * Las fechas que usan un calendario o unos meses suyos (ADR-0029): borrar un calendario con fechas o quitarle un mes
 * con fechas se impide. Cada capacidad que guarda fechas añade aquí su fuente: `fechas` (las propiedades de las
 * páginas) y `cronologias` (los eventos). Hasta entonces no hay ninguna, y la cuenta es 0
 */
import type { Database } from '@crisol/db'

export interface DateSource {
  /** Cuántas fechas de ese calendario hay (solo de esos meses, si se dicen) */
  count: (db: Database, calendarId: string, monthIds?: readonly string[]) => Promise<number>
}

export const DATE_SOURCES: DateSource[] = []

/** Cuántas fechas usan el calendario (o esos meses suyos), entre todas las fuentes */
export async function datesInUse(db: Database, calendarId: string, monthIds?: readonly string[]): Promise<number> {
  if (monthIds?.length === 0) return 0
  const counts = await Promise.all(DATE_SOURCES.map((source) => source.count(db, calendarId, monthIds)))
  return counts.reduce((sum, n) => sum + n, 0)
}
