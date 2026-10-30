/**
 * Lo de otra página pintado en solo lectura, a partir del JSON que da la API (la vista previa y los incrustados): sin
 * editor ni Yjs. Los títulos no son encabezados (no se meten en el índice de la página que los enseña)
 */

import { Link } from '@tanstack/react-router'
import type { JSONContent } from '@tiptap/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import callout from './callout.module.css'
import styles from './content.module.css'
import editor from './editor.module.css'
import separate from './separate.module.css'

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
            <Link key={key} to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: node.attrs.pageId }}>
              {text}
            </Link>
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

function Block({ node, worldId }: { node: JSONContent; worldId: string }): ReactNode {
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
      return (
        <section
          aria-label={t(node.type === 'secret' ? 'separate.secret' : 'separate.note')}
          className={node.type === 'secret' ? separate.secret : separate.note}
        >
          <div className={separate.label}>
            {t(node.type === 'secret' ? 'separate.secretHint' : 'separate.noteHint')}
          </div>
          {children}
        </section>
      )
    case 'pageEmbed':
      return <EmbeddedFrame node={node} worldId={worldId} />
    default:
      return null
  }
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
          <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId }}>
            {title}
          </Link>
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
