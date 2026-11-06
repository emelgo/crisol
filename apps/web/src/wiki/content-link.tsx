/**
 * El enlace de una página a una entrada del compendio (`[[@Goblin jefe]]`, docs/specs/criaturas.md § wiki): su nombre,
 * y al pasar el ratón o al elegirlo (en el móvil, al tocarlo) su tarjeta, con unas cifras suyas y «Abrir», que la abre
 * en el compendio de una campaña del mundo con su sistema. Si no está en el compendio, se ve como por resolver
 */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { BookOpen } from 'lucide-react'
import { useContext, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import styles from './content-link.module.css'
import { PageLinksContext } from './links-context.ts'

export function withContentLinkView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ContentLinkView, { as: 'span' })
    }
  })
}

function ContentLinkView({ node, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const links = useContext(PageLinksContext)
  const cardId = useId()
  const worldId = links?.worldId ?? ''
  const name = String(node.attrs.name ?? '')
  const label = (node.attrs.label as string | null) || null
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const linked = useQuery({
    queryKey: ['compendium', 'linked', worldId, name],
    queryFn: () => api.call('getLinkedContent', { worldId, name }),
    enabled: Boolean(worldId && name),
    staleTime: 30_000
  })
  const entry = linked.data?.entry ?? null
  const missing = linked.data !== undefined && !entry
  const show = Boolean(entry) && (hovering || pinned || selected)
  const hover = (inside: boolean) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHovering(inside), inside ? 300 : 200)
  }
  const open = () => {
    if (!entry?.campaignId) return
    void navigate({
      to: '/mundos/$worldId/campanas/$campaignId/compendio',
      params: { worldId, campaignId: entry.campaignId },
      search: { ver: entry.key }
    })
  }
  return (
    <NodeViewWrapper
      as="span"
      className={styles.wrapper}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
    >
      {entry?.campaignId ? (
        <a
          href={`/mundos/${worldId}/campanas/${entry.campaignId}/compendio?ver=${encodeURIComponent(entry.key)}`}
          className={styles.link}
          data-content-link=""
          aria-describedby={show ? cardId : undefined}
          onClick={(event) => {
            event.preventDefault()
            // En lo táctil, el primer toque enseña la tarjeta
            if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !pinned) setPinned(true)
            else open()
          }}
        >
          <BookOpen size={13} aria-hidden="true" />
          {label ?? name}
        </a>
      ) : (
        <span
          className={styles.link}
          data-content-link=""
          data-state={missing ? 'missing' : 'loading'}
          title={missing ? t('contentLink.missing', { name: label ?? name }) : undefined}
        >
          <BookOpen size={13} aria-hidden="true" />
          {label ?? name}
        </span>
      )}
      {show && entry && (
        <span id={cardId} role="tooltip" className={styles.card} contentEditable={false}>
          <span className={styles.kind}>
            {entry.world ? t('contentLink.world', { type: entry.typeLabel }) : entry.typeLabel}
          </span>
          <strong className={styles.name}>{entry.name}</strong>
          {entry.lines.length > 0 && (
            <span className={styles.lines}>
              {entry.lines.map((line) => (
                <span key={line.label} className={styles.line}>
                  <span className={styles.label}>{line.label}</span> {line.value}
                </span>
              ))}
            </span>
          )}
          {entry.campaignId && (
            <button
              type="button"
              className={styles.open}
              onMouseDown={(event) => event.preventDefault()}
              onClick={open}
            >
              {t('contentLink.open')}
            </button>
          )}
        </span>
      )}
    </NodeViewWrapper>
  )
}
