/**
 * La portada de un libro (ADR-0021): su imagen de los comunes, encuadrada, con su nombre encima; sin imagen, una tapa
 * de su color (el elegido; sin él, uno que sale de su clave, siempre el mismo) con su nombre. En tarjeta (Libros) o de lomo (el Inicio)
 */
import type { Campaign, World } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import type { CSSProperties, ReactNode } from 'react'
import { useApi } from '../api/context.tsx'
import { colorHex } from '../routes/world-look.ts'
import { coverStyle } from '../wiki/cover-look.ts'
import styles from './book-cover.module.css'

type Cover = { fileId: string; x: number; y: number; zoom?: number | undefined }

export interface CoverBook {
  key: string
  name: string
  edition?: string | null
  cover: Cover | null
  color?: string | null
}

/** El tono de un color (#rrggbb), para la tapa */
function hueOfHex(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}

/** Un tono por libro: el de su color elegido o, sin él, el de su clave */
function hueOf(key: string, color?: string | null) {
  const hex = color ? colorHex(color as World['color']) : null
  if (hex) return hueOfHex(hex)
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

export function BookCover({
  book,
  size = 'card',
  sub,
  badge,
  dim = false
}: {
  book: CoverBook
  size?: 'card' | 'spine'
  /** Debajo del nombre (en la tarjeta): «Importado · 2024» */
  sub?: ReactNode
  /** Arriba a la izquierda: «Del mundo», «Esperando a la IA» */
  badge?: ReactNode
  /** Apagado (no está en la campaña) */
  dim?: boolean
}) {
  const style = { '--hue': hueOf(book.key, book.color) } as CSSProperties
  return (
    <span
      className={[styles.cover, size === 'spine' ? styles.spine : styles.card, dim ? styles.dim : '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      title={size === 'spine' ? book.name : undefined}
      data-book-cover={book.key}
    >
      {book.cover ? (
        <img src={`/api/files/${book.cover.fileId}`} alt="" style={coverStyle(book.cover)} />
      ) : (
        <span className={styles.plain} aria-hidden="true" />
      )}
      {badge && <span className={styles.badge}>{badge}</span>}
      {size === 'card' ? (
        <span className={styles.text}>
          <b>{book.name}</b>
          {sub && <span>{sub}</span>}
        </span>
      ) : (
        !book.cover && <span className={styles.spineName}>{book.name}</span>
      )}
    </span>
  )
}

export type CampaignBook = CoverBook & {
  description: string | null
  requires: string[]
  count: number
  excluded: number
}

/** Los libros que usa una campaña (los ve cualquiera de ella): los de su compendio */
export function useCampaignBooks(campaign: Pick<Campaign, 'id' | 'system'>): (CampaignBook & { on: true })[] {
  const api = useApi()
  const compendium = useQuery({
    queryKey: ['compendium', campaign.id],
    queryFn: () => api.call('getCampaignCompendium', { campaignId: campaign.id }),
    enabled: Boolean(campaign.system)
  })
  return (compendium.data?.sources ?? []).map((source) => ({ ...source, on: true as const }))
}
