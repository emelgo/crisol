/**
 * La vista previa de un enlace al pasar el ratón (como la de 5etools, ADR-0033): una ventana flotante, encima de todo
 * (fuera de las cajas, que la recortarían), junto al enlace, con la entrada entera del compendio o el principio del
 * apartado de un capítulo (esa la pinta el lector del libro: books/chapter-text.tsx)
 */
import type { Text } from '@crisol/systems'
import { textOf } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/context.tsx'
import bookLook from '../books/book-look.module.css'
import { ContentText } from '../campaign/content-text.tsx'
import { type ContentScope, useContentScope, useLinkedEntry } from './content-scope.tsx'
import styles from './preview-card.module.css'

/** El texto principal de una entrada: el más largo de sus textos (su descripción, su bloque de estadísticas) */
export function bodyOf(data: Record<string, unknown>, language: 'es' | 'en' = 'es') {
  let best = ''
  for (const [key, value] of Object.entries(data)) {
    if (key === 'name') continue
    const isText = typeof value === 'string' || (value && typeof value === 'object' && !Array.isArray(value))
    const text = isText ? textOf(value as Text, language) : ''
    if (typeof text === 'string' && text.length > best.length) best = text
  }
  return best
}

/** Una entrada del compendio entera, como se ve desde donde está el enlace */
export function EntryPreview({
  scope,
  entry
}: {
  scope: ContentScope | null
  entry: { key: string; name: string; typeLabel: string; systemId: string; campaignId: string | null }
}) {
  const api = useApi()
  const campaignId = scope?.kind === 'campaign' ? scope.campaignId : entry.campaignId
  const full = useQuery({
    queryKey: ['compendium', 'preview', campaignId ?? `sistema:${entry.systemId}`, entry.key],
    queryFn: () =>
      campaignId
        ? api.call('getCampaignContent', { campaignId, keys: [entry.key] })
        : api.call('readSystemCompendium', { systemId: entry.systemId, keys: [entry.key] }),
    staleTime: 60_000
  })
  const item = full.data?.items[0]
  const body = item ? bodyOf(item.data as Record<string, unknown>) : ''
  return (
    <>
      <span className={styles.kind}>{entry.typeLabel}</span>
      <strong className={`${styles.name} ${bookLook.name}`}>{entry.name}</strong>
      {body && (
        <div className={bookLook.book}>
          <ContentText text={body} />
        </div>
      )}
    </>
  )
}

/** Lo de un apartado de un Markdown: desde su título hasta el siguiente del mismo nivel o más; sin él, el principio */
export function sectionOf(markdown: string, section: string | null) {
  const lines = markdown.split('\n')
  const fold = (text: string) =>
    text
      .replace(/\{p\.?\s*\d+\}\s*$/, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('es')
  if (section) {
    const at = lines.findIndex(
      (line) => /^#{1,6}\s/.test(line) && fold(line.replace(/^#{1,6}\s+/, '')) === fold(section)
    )
    if (at >= 0) {
      const level = (/^(#+)/.exec(lines[at] ?? '')?.[1] ?? '#').length
      const end = lines.findIndex((line, i) => i > at && new RegExp(`^#{1,${level}}\\s`).test(line))
      return lines.slice(at, end < 0 ? undefined : end).join('\n')
    }
  }
  return lines.slice(0, 40).join('\n')
}

/** Cuántos bloques (párrafos, recuadros, tablas, imágenes) enseña la vista previa de un apartado, como 5etools */
export const PREVIEW_BLOCKS = 4

/**
 * Lo que enseña la vista previa de un apartado de un capítulo: su título y sus primeros bloques (los separa una línea
 * en blanco; la imagen y su pie van juntos), y si queda más
 */
export function previewOf(markdown: string, section: string | null) {
  const blocks = sectionOf(markdown, section)
    .split(/\n[ \t]*\n/)
    .filter((block) => block.trim())
  const kept: string[] = []
  let shown = 0
  for (const block of blocks) {
    if (shown >= PREVIEW_BLOCKS) break
    kept.push(block)
    // Un título solo no cuenta: lo que importa es lo que va debajo
    if (!/^#{1,6}\s[^\n]*$/.test(block.trim())) shown++
  }
  return { text: kept.join('\n\n'), more: kept.length < blocks.length }
}

/** La vista previa de un enlace del texto de una entrada (`[[@Nombre]]`): la entrada, como se ve desde aquí */
export function LinkedPreview({ name }: { name: string }) {
  const scope = useContentScope()
  const { entry, missing } = useLinkedEntry(name)
  if (missing) return <span className={styles.kind}>{name}</span>
  return entry ? <EntryPreview scope={scope} entry={entry} /> : null
}
