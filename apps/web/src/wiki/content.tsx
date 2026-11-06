/**
 * Lo de otra página pintado en solo lectura, a partir del JSON que da la API (la vista previa y los incrustados): sin
 * editor ni Yjs. Los títulos no son encabezados (no se meten en el índice de la página que los enseña)
 */

import type { JSONContent } from '@tiptap/core'
import { createContext, type ReactNode, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import callout from './callout.module.css'
import styles from './content.module.css'
import editor from './editor.module.css'
import { FileEmbedBlock } from './file-embed.tsx'
import { PageLink, useReadAs } from './read-as.tsx'
import separate from './separate.module.css'
import sheet from './sheet-blocks.module.css'

type Marks = NonNullable<JSONContent['marks']>

function withMarks(text: ReactNode, marks: Marks, key: string): ReactNode {
  return marks.reduce<ReactNode>((inner, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong key={key}>{inner}</strong>
      case 'italic':
        return <em key={key}>{inner}</em>
      case 'underline':
        return <u key={key}>{inner}</u>
      case 'strike':
        return <s key={key}>{inner}</s>
      case 'code':
        return <code key={key}>{inner}</code>
      case 'link':
        return (
          <a key={key} href={String(mark.attrs?.href ?? '')} target="_blank" rel="noopener noreferrer nofollow">
            {inner}
          </a>
        )
      default:
        return inner
    }
  }, text)
}

function Inline({ nodes, worldId }: { nodes: JSONContent[]; worldId: string }) {
  return (
    <>
      {nodes.map((node, i) => {
        const key = String(i)
        if (node.type === 'text') return <span key={key}>{withMarks(node.text ?? '', node.marks ?? [], key)}</span>
        if (node.type === 'hardBreak') return <br key={key} />
        if (node.type === 'pageLink') {
          const text = String(node.attrs?.label || node.attrs?.title || '')
          return typeof node.attrs?.pageId === 'string' ? (
            <PageLink key={key} worldId={worldId} pageId={node.attrs.pageId}>
              {text}
            </PageLink>
          ) : (
            <span key={key} className={styles.missing}>
              {text}
            </span>
          )
        }
        return null
      })}
    </>
  )
}

export function Block({ node, worldId }: { node: JSONContent; worldId: string }): ReactNode {
  const { t } = useTranslation()
  const children = (node.content ?? []).map((child, i) => <Block key={String(i)} node={child} worldId={worldId} />)
  const inline = <Inline nodes={node.content ?? []} worldId={worldId} />
  switch (node.type) {
    case 'paragraph':
      return <p>{inline}</p>
    case 'heading':
      return <p className={styles.heading}>{inline}</p>
    case 'bulletList':
      return <ul>{children}</ul>
    case 'orderedList':
      return <ol>{children}</ol>
    case 'listItem':
      return <li>{children}</li>
    case 'taskList':
      return <ul className={styles.tasks}>{children}</ul>
    case 'taskItem':
      return (
        <li>
          <span className={styles.check}>{t(node.attrs?.checked ? 'content.done' : 'content.todo')}</span>
          <div>{children}</div>
        </li>
      )
    case 'blockquote':
      return <blockquote>{children}</blockquote>
    case 'codeBlock':
      return (
        <pre>
          <code>{(node.content ?? []).map((child) => child.text ?? '').join('')}</code>
        </pre>
      )
    case 'horizontalRule':
      return <hr />
    case 'table':
      return (
        <table className={styles.table}>
          <tbody>{children}</tbody>
        </table>
      )
    case 'tableRow':
      return <tr>{children}</tr>
    case 'tableHeader':
      return <th>{children}</th>
    case 'tableCell':
      return <td>{children}</td>
    case 'callout': {
      const kind = String(node.attrs?.kind ?? 'note')
      return (
        <div role="note" aria-label={t(`callout.${kind as 'note'}`)} className={callout.callout} data-callout={kind}>
          <div className={callout.label}>{t(`callout.${kind as 'note'}`)}</div>
          <div className={callout.content}>{children}</div>
        </div>
      )
    }
    case 'box':
      return <div className={styles.box}>{children}</div>
    case 'secret':
    case 'note':
      return <SeparateBlock node={node}>{children}</SeparateBlock>
    case 'pageEmbed':
      return <EmbeddedFrame node={node} worldId={worldId} />
    case 'fileEmbed':
      return <FileEmbedBlock node={node} />
    // Los de hoja, como en la vista sencilla sin editar: los saltos y el índice no se ven
    case 'statblock':
      return (
        <section aria-label={t('sheet.statblock')} className={sheet.statblock} data-statblock="">
          {children}
        </section>
      )
    case 'sidenote':
      return (
        <aside
          aria-label={t('sheet.sidenote', { side: t(`sheet.sides.${node.attrs?.side === 'left' ? 'left' : 'right'}`) })}
          className={sheet.sidenote}
        >
          {children}
        </aside>
      )
    case 'wideBlock':
      return <div>{children}</div>
    case 'pageBreak':
    case 'columnBreak':
    case 'tableOfContents':
      return null
    default:
      return null
  }
}

/** Los secretos recién revelados a quien lee (docs/specs/revelar.md): salen con «Nuevo» */
export const NewSecretsContext = createContext<ReadonlySet<string>>(new Set())

function SeparateBlock({ node, children }: { node: JSONContent; children: ReactNode }) {
  const { t } = useTranslation()
  const fresh = useContext(NewSecretsContext)
  const readAs = useReadAs()
  const isNew = node.type === 'secret' && fresh.has(String(node.attrs?.documentId ?? ''))
  return (
    <section
      aria-label={t(node.type === 'secret' ? 'separate.secret' : 'separate.note')}
      className={node.type === 'secret' ? separate.secret : separate.note}
      data-new={isNew || undefined}
    >
      <div className={separate.label}>
        {/* Leyendo como jugador, un secreto que se ve es uno revelado (no «solo lo ves tú») */}
        {t(node.type === 'note' ? 'separate.noteHint' : readAs ? 'separate.revealedHint' : 'separate.secretHint')}
        {isNew && <span className={styles.newBadge}>{t('playerPages.new')}</span>}
      </div>
      {children}
    </section>
  )
}

/** Un incrustado dentro de lo que se enseña: lo abrió el servidor, o dice por qué no */
export function EmbeddedFrame({ node, worldId }: { node: JSONContent; worldId: string }) {
  const { t } = useTranslation()
  const pageId = typeof node.attrs?.pageId === 'string' ? node.attrs.pageId : null
  const title = String(node.attrs?.title ?? '')
  const reason = node.attrs?.cycle ? 'cycle' : node.attrs?.tooDeep ? 'tooDeep' : node.attrs?.missing ? 'missing' : null
  return (
    <section aria-label={t('embed.of', { title })} className={styles.embed}>
      <div className={styles.embedTitle}>
        {pageId ? (
          <PageLink worldId={worldId} pageId={pageId}>
            {title}
          </PageLink>
        ) : (
          title
        )}
      </div>
      {reason ? (
        <p className={styles.note}>{t(`embed.${reason}`)}</p>
      ) : (
        <ContentView blocks={node.content ?? []} worldId={worldId} />
      )}
    </section>
  )
}

/** Unos bloques, en solo lectura */
export function ContentView({ blocks, worldId }: { blocks: JSONContent[]; worldId: string }) {
  return (
    <div className={`${editor.prose} ${styles.content}`}>
      {blocks.map((block, i) => (
        <Block key={String(i)} node={block} worldId={worldId} />
      ))}
    </div>
  )
}
