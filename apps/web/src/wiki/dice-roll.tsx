/**
 * La tirada escrita en una página: una píldora con su dado y su fórmula. Pulsarla tira (en la campaña elegida en la
 * ficha de dados). Elegida con el teclado, o recién puesta desde «/», abre su cuadro para cambiar la tirada y su nombre;
 * con el ratón, con el lápiz que sale al pasar. Una que no se entiende sale marcada y no tira
 */
import { describeFormula } from '@crisol/dice'
import type { Node } from '@tiptap/core'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Dices, Pencil } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { explain } from '../dice/formula.ts'
import { useRollHere } from '../dice/roll-here.ts'
import styles from './dice-roll.module.css'

export function withDiceRollView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(DiceRollView, {
        as: 'span',
        // Lo de dentro (la píldora, el lápiz y su cuadro) es suyo: el editor ni lo elige ni escribe en ello
        stopEvent: ({ event }) => event.target instanceof Element && Boolean(event.target.closest('[data-dice-ui]')),
        ignoreMutation: () => true
      })
    }
  })
}

function DiceRollView({ node, editor, getPos, selected, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const id = useId()
  const rollHere = useRollHere()
  const [editing, setEditing] = useState(false)
  const formula = String(node.attrs.formula ?? '')
  const label = (node.attrs.label as string | null) || null
  const written = label ? `${formula} # ${label}` : formula
  const explained = explain(written)
  // Al elegirla (con el teclado, o recién puesta) se abre su cuadro, que sigue abierto mientras se escribe en él
  useEffect(() => {
    if (selected && editor.isEditable) setEditing(true)
  }, [selected, editor])
  const open = editor.isEditable && editing
  // Cerrar el cuadro: el cursor, justo después de la tirada
  const close = () => {
    setEditing(false)
    const position = typeof getPos === 'function' ? getPos() : undefined
    if (position !== undefined)
      editor
        .chain()
        .focus()
        .setTextSelection(position + node.nodeSize)
        .run()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault()
      close()
    }
  }
  return (
    <NodeViewWrapper as="span" className={styles.wrap} contentEditable={false}>
      <span data-dice-ui="">
        <button
          type="button"
          className={explained.ok ? styles.chip : styles.wrong}
          aria-disabled={!explained.ok}
          aria-label={
            // El nombre empieza por lo que se ve (la fórmula), para quien lo dice en voz alta
            explained.ok
              ? label
                ? t('diceRoll.rollNamed', { formula, label })
                : t('diceRoll.roll', { formula })
              : `${formula}: ${t('diceRoll.wrong', { why: explained.text })}`
          }
          title={explained.ok ? (label ?? describeFormula(formula)) : explained.text}
          onClick={() => {
            if (explained.ok) void rollHere(written)
          }}
        >
          <Dices size={14} aria-hidden="true" />
          {formula}
        </button>
        {editor.isEditable && (
          <button
            type="button"
            className={styles.edit}
            aria-label={t('diceRoll.change')}
            aria-expanded={open}
            onClick={() => (open ? close() : setEditing(true))}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        )}
        {open && (
          <span className={styles.pop} role="dialog" aria-label={t('diceRoll.title')}>
            <label className={styles.label} htmlFor={`${id}-formula`}>
              {t('diceRoll.formula')}
            </label>
            <input
              id={`${id}-formula`}
              className={styles.input}
              value={formula}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!explained.ok}
              aria-describedby={`${id}-explained`}
              onChange={(event) => updateAttributes({ formula: event.currentTarget.value })}
              onKeyDown={onKeyDown}
            />
            <span id={`${id}-explained`} className={explained.ok ? styles.explained : styles.explainedWrong}>
              {explained.text}
            </span>
            <label className={styles.label} htmlFor={`${id}-label`}>
              {t('diceRoll.label')}
            </label>
            <input
              id={`${id}-label`}
              className={styles.input}
              value={label ?? ''}
              maxLength={80}
              placeholder={t('diceRoll.optional')}
              onChange={(event) => updateAttributes({ label: event.currentTarget.value || null })}
              onKeyDown={onKeyDown}
            />
            <button type="button" className={styles.done} onClick={close}>
              {t('diceRoll.done')}
            </button>
          </span>
        )}
      </span>
    </NodeViewWrapper>
  )
}
