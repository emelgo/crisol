/**
 * Los bloques de hoja en la vista sencilla: discretos. Los saltos, una raya con su rótulo solo al editar; el statblock,
 * un marco; la nota lateral, como un recuadro con su lado; «a lo ancho», sus bloques con un rótulo al editar; y el
 * índice, los títulos de la página como enlaces (en la hoja llevará el número de página)
 */
import type { Node } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './sheet-blocks.module.css'

const VIEWS: Record<string, (props: NodeViewProps) => React.ReactNode> = {
  pageBreak: BreakView,
  columnBreak: BreakView,
  statblock: StatblockView,
  sidenote: SidenoteView,
  wideBlock: WideView,
  tableOfContents: TocView
}

export function withSheetView(node: Node) {
  const view = VIEWS[node.name]
  if (!view) return node
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(view)
    }
  })
}

function BreakView({ node, editor, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const label = t(node.type.name === 'pageBreak' ? 'sheet.pageBreak' : 'sheet.columnBreak')
  return (
    <NodeViewWrapper
      className={styles.break}
      data-break={node.type.name === 'pageBreak' ? 'page' : 'column'}
      data-selected={selected || undefined}
      hidden={!editor.isEditable}
      contentEditable={false}
    >
      <span className={styles.breakLabel}>{label}</span>
    </NodeViewWrapper>
  )
}

function StatblockView() {
  const { t } = useTranslation()
  const id = useId()
  return (
    <NodeViewWrapper role="group" aria-labelledby={id} className={styles.statblock} data-statblock="">
      <div id={id} className={styles.label} contentEditable={false}>
        {t('sheet.statblock')}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

function SidenoteView({ node, editor, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const id = useId()
  const side = node.attrs.side === 'left' ? 'left' : 'right'
  return (
    <NodeViewWrapper as="aside" aria-labelledby={id} className={styles.sidenote}>
      <div className={styles.head} contentEditable={false}>
        <span id={id} className={styles.label}>
          {t('sheet.sidenote', { side: t(`sheet.sides.${side}`) })}
        </span>
        {editor.isEditable && (
          <button
            type="button"
            className={styles.side}
            onClick={() => updateAttributes({ side: side === 'left' ? 'right' : 'left' })}
          >
            {t(side === 'left' ? 'sheet.toRight' : 'sheet.toLeft')}
          </button>
        )}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

function WideView({ editor }: NodeViewProps) {
  const { t } = useTranslation()
  return (
    <NodeViewWrapper className={editor.isEditable ? styles.wide : undefined} data-wide-block="">
      {editor.isEditable && (
        <div className={styles.label} contentEditable={false}>
          {t('sheet.wide')}
        </div>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

/** Los títulos del documento, con su id de bloque y su nivel */
export function headingsOf(doc: PMNode) {
  const found: { id: string; text: string; level: number }[] = []
  doc.forEach((child) => {
    if (child.type.name === 'heading' && child.textContent.trim()) {
      found.push({ id: String(child.attrs.id ?? ''), text: child.textContent, level: Number(child.attrs.level ?? 1) })
    }
  })
  return found
}

function TocView({ editor, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const [headings, setHeadings] = useState(() => headingsOf(editor.state.doc))
  // Al día con lo que se escribe
  useEffect(() => {
    const update = () => setHeadings(headingsOf(editor.state.doc))
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])
  const go = (id: string) => {
    const target = editor.view.dom.querySelector(`[data-id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({ block: 'start' })
  }
  return (
    <NodeViewWrapper
      as="nav"
      aria-label={t('sheet.toc')}
      className={styles.toc}
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <div className={styles.label}>{t('sheet.toc')}</div>
      {headings.length === 0 ? (
        <p className={styles.empty}>{t('sheet.tocEmpty')}</p>
      ) : (
        <ol className={styles.tocList}>
          {headings.map((heading) => (
            <li key={heading.id || heading.text} style={{ paddingInlineStart: `${(heading.level - 1) * 1.25}rem` }}>
              <a
                href={`#${heading.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  go(heading.id)
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  )
}
