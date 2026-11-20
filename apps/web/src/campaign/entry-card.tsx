/**
 * La ficha de una entrada del compendio, como en 5etools (su tipo la dice en el formato, `card`): su línea de tipo en
 * cursiva, el bloque de datos a dos lados entre dos rayas y los demás campos debajo. La misma en su página, en la vista
 * previa al pasar el ratón y al desplegarla incrustada
 */
import type { ReactNode } from 'react'
import type { ActionOutput } from '../api/client.ts'
import { ContentLine } from './content-text.tsx'
import styles from './entry-card.module.css'

export type Card = NonNullable<ActionOutput<'getCampaignContent'>['items'][number]['card']>

export function EntryCard({
  card,
  onLink,
  preview,
  compact = false,
  withLine = true
}: {
  card: Card
  onLink?: ((name: string) => void) | undefined
  preview?: ((name: string) => ReactNode) | undefined
  /** En la vista previa: los demás campos, en una línea */
  compact?: boolean
  /** Sin su línea de tipo (la página la pone bajo el nombre) */
  withLine?: boolean
}) {
  const line = (text: string) => <ContentLine text={text} onLink={onLink} preview={preview} />
  return (
    <div className={styles.card} data-compact={compact || undefined}>
      {withLine && card.line && <p className={styles.line}>{line(card.line)}</p>}
      {(card.left.length > 0 || card.right.length > 0) && (
        <div className={styles.block}>
          <div className={styles.side}>
            {card.left.map((text) => (
              <p key={text}>{line(text)}</p>
            ))}
          </div>
          <div className={`${styles.side} ${styles.right}`}>
            {card.right.map((text) => (
              <p key={text}>{line(text)}</p>
            ))}
          </div>
        </div>
      )}
      {card.fields.length > 0 && (
        <dl className={styles.fields}>
          {card.fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{line(field.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Su línea de tipo, sola: bajo el nombre, en la página de la entrada */
export function EntryCardLine({ text }: { text: string }) {
  return (
    <p className={styles.line}>
      <ContentLine text={text} />
    </p>
  )
}
