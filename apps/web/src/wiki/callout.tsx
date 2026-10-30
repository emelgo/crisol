/** Los recuadros en el editor: su rótulo (Nota, Aviso…) arriba, que no se edita, y sus bloques debajo */
import type { CalloutKind } from '@crisol/editor'
import type { Node } from '@tiptap/core'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './callout.module.css'

export function withCalloutView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CalloutView)
    }
  })
}

function CalloutView({ node }: NodeViewProps) {
  const { t } = useTranslation()
  const id = useId()
  const kind = node.attrs.kind as CalloutKind
  return (
    <NodeViewWrapper role="note" aria-labelledby={id} className={styles.callout} data-callout={kind}>
      <div id={id} className={styles.label} contentEditable={false}>
        {t(`callout.${kind}`)}
      </div>
      <NodeViewContent className={styles.content} />
    </NodeViewWrapper>
  )
}
