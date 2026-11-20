/** Los recuadros en el editor: su rótulo (Nota, Aviso…) arriba, que no se edita, y sus bloques debajo */
import type { CalloutKind } from '@crisol/editor'
import type { Node } from '@tiptap/core'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './callout.module.css'

export function withCalloutView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CalloutView)
    }
  })
}

function CalloutView({ node, editor, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const id = useId()
  const kind = node.attrs.kind as CalloutKind
  const title = (node.attrs.title as string | null) || null
  // Su título se escribe en su sitio; al salir del campo, se guarda (vacío: el nombre de su tipo)
  const [draft, setDraft] = useState(title ?? '')
  useEffect(() => setDraft(title ?? ''), [title])
  return (
    <NodeViewWrapper role="note" aria-labelledby={id} className={styles.callout} data-callout={kind}>
      <div id={id} className={styles.label} contentEditable={false} data-titled={title ? '' : undefined}>
        {editor.isEditable ? (
          <input
            className={styles.titleInput}
            value={draft}
            placeholder={t(`callout.${kind}`)}
            aria-label={t('callout.title', { kind: t(`callout.${kind}`) })}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={() => {
              const next = draft.trim() || null
              if (next !== title) updateAttributes({ title: next })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        ) : (
          (title ?? t(`callout.${kind}`))
        )}
      </div>
      <NodeViewContent className={styles.content} />
    </NodeViewWrapper>
  )
}
