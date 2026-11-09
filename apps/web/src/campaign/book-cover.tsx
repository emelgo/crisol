/**
 * La portada de un libro (ADR-0021): su imagen de los comunes, encuadrada, con su nombre encima; sin imagen, una tapa
 * de su color (sale de su clave, siempre el mismo) con su nombre. En tarjeta (Libros) o de lomo (el Inicio)
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import type { CSSProperties, ReactNode } from 'react'
import { useApi } from '../api/context.tsx'
import { coverStyle } from '../wiki/cover-look.ts'
import styles from './book-cover.module.css'

type Cover = { fileId: string; x: number; y: number; zoom?: number | undefined }

export interface CoverBook {
  key: string
  name: string
  edition?: string | null
  cover: Cover | null
}

/** Un tono por libro: el de su clave */
function hueOf(key: string) {
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
  const style = { '--hue': hueOf(book.key) } as CSSProperties
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
