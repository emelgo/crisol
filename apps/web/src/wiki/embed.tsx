/**
 * Una página incrustada en el editor: lo de dentro, en solo lectura, como lo da la API (con sus incrustados hasta tres
 * niveles). Se elige y se mueve como un bloque; para cambiarla, se va a su página
 */

import { Link } from '@tanstack/react-router'
import type { JSONContent, Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { ContentView } from './content.tsx'
import styles from './embed.module.css'
import { PageLinksContext, stateOf } from './page-links.tsx'
import { usePageContent } from './preview.tsx'

export function withPageEmbedView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(EmbedView)
    }
  })
}

function EmbedView({ node, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const links = useContext(PageLinksContext)
  const title = String(node.attrs.title ?? '')
  const anchor = (node.attrs.anchor as string | null) || null
  const target = stateOf(links, (node.attrs.pageId as string | null) ?? null, title)
  const worldId = links?.worldId ?? ''
  const content = usePageContent(worldId, target.state === 'ok' ? target.page.id : null, anchor, false)
  const shown = target.state === 'ok' ? `${target.page.title}${anchor ? ` · ${anchor}` : ''}` : title
  return (
    <NodeViewWrapper
      as="section"
      aria-label={t('embed.of', { title: shown })}
      className={styles.embed}
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <div className={styles.title}>
        {target.state === 'ok' ? (
          <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: target.page.id }}>
            {shown}
          </Link>
        ) : (
          shown
        )}
      </div>
      {target.state === 'missing' && <p className={styles.note}>{t('embed.pending', { title })}</p>}
      {target.state === 'broken' && <p className={styles.note}>{t('embed.missing')}</p>}
      {target.state === 'ok' &&
        (content.data ? (
          <ContentView blocks={content.data.blocks as JSONContent[]} worldId={worldId} />
        ) : (
          <p className={styles.note}>{t('embed.loading')}</p>
        ))}
    </NodeViewWrapper>
  )
}
