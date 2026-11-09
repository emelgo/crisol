/** Un documento del contenido como sale de la base de datos (aparte, para que las capas no dependan de los sistemas) */
import type { ContentItem } from '@crisol/systems'

/** Un documento del contenido guardado, con lo que tenga (su concepto, su mecánica y su página, si los hay) */
export const contentOf = (row: {
  type: string
  key: string
  source: string | null
  data: Record<string, unknown>
  concept: string | null
  mechanics: Record<string, unknown> | null
  ref: Record<string, unknown> | null
  img?: string | null
  table?: Record<string, unknown> | null
  review?: unknown
}): ContentItem =>
  ({
    type: row.type,
    key: row.key,
    source: row.source,
    data: row.data,
    ...(row.concept !== null ? { concept: row.concept } : {}),
    ...(row.mechanics !== null ? { mechanics: row.mechanics } : {}),
    ...(row.ref !== null ? { ref: row.ref } : {}),
    ...(row.img ? { img: row.img } : {}),
    ...(row.table ? { table: row.table } : {}),
    // Pendiente de revisar (ADR-0021): lo que lee el contenido se lo salta
    ...(row.review ? { review: row.review } : {})
  }) as ContentItem
