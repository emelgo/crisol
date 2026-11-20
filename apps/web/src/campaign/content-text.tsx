/**
 * El texto de un documento del contenido (las reglas, los conjuros, las criaturas), en el Markdown sencillo que traen:
 * párrafos, títulos, negrita, cursiva, listas y tablas. Se construye con elementos de React, nunca con HTML: sus textos
 * son datos
 */
import { type ContentTable, diceTableOf } from '@crisol/systems'
import { BookOpen, Dices } from 'lucide-react'
import { createContext, Fragment, type ReactNode, useContext, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DiceChip } from '../wiki/dice-roll.tsx'
import { FloatingCard } from '../wiki/floating-card.tsx'
import styles from './content-text.module.css'

/** Cada parte de un texto fijo con su id: su sitio no cambia */
const withIds = <T,>(parts: readonly T[], key: string) => parts.map((part, i) => ({ id: `${key}-${i}`, part }))

/** Abrir la entrada que nombra un enlace (`[[@Nombre]]`, `[[@tipo/Nombre]]`, `[[@clave]]`); sin él, solo su texto */
const ContentLinks = createContext<((name: string) => void) | null>(null)
/** Su vista previa al pasar el ratón (la entrada entera, ADR-0033), si quien pinta el texto la da */
const ContentPreviews = createContext<((name: string) => ReactNode) | null>(null)

/** Lo que se lee de un enlace: su texto propio o su nombre (sin el tipo delante) */
const linkText = (name: string, label: string | undefined) =>
  label?.trim() || (name.includes('/') ? name.slice(name.indexOf('/') + 1) : name).trim()

/** Un enlace a una entrada del compendio (o una ficha incrustada, `![[@…]]`, como enlace): se abre al pulsarlo */
function ContentRef({ name, label, embed }: { name: string; label: string | undefined; embed: boolean }) {
  const open = useContext(ContentLinks)
  const preview = useContext(ContentPreviews)
  const text = linkText(name, label)
  const id = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Al pasar el ratón, tras un momento; al salir (del enlace y de la ventana), otro momento
  const hover = (inside: boolean) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(inside), inside ? 300 : 200)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!open) return <span className={styles.ref}>{text}</span>
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={styles.ref}
        data-embed={embed || undefined}
        aria-describedby={shown && preview ? id : undefined}
        onClick={() => open(name.trim())}
        onMouseEnter={() => preview && hover(true)}
        onMouseLeave={() => preview && hover(false)}
        onFocus={() => preview && setShown(true)}
        onBlur={() => setShown(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setShown(false)
        }}
      >
        {embed && <BookOpen size={13} aria-hidden="true" />}
        {text}
      </button>
      {shown && preview && (
        <FloatingCard anchor={anchor.current} id={id} onEnter={() => hover(true)} onLeave={() => hover(false)}>
          {preview(name.trim())}
        </FloatingCard>
      )}
    </>
  )
}

/** Enlaces (`[[@…]]`, `![[@…]]`), negrita (**…**) y cursiva (*…* o _…_) dentro de una línea */
function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /`dice:([^`]*)`|(!?)\[\[@([^\]\n]+?)\]\]|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g
  let last = 0
  let n = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const [, dice, bang, link, bold, italic, underscored] = match
    const id = `${key}-${n++}`
    if (dice !== undefined) {
      // Una tirada escrita (`dice: 2d6+3`, `dice: 1d20+7|+7`, `dice: 1d6 # Nombre`): se pulsa y tira (ADR-0033)
      const hash = dice.indexOf('#')
      const head = hash < 0 ? dice : dice.slice(0, hash)
      const bar = head.indexOf('|')
      parts.push(
        <DiceChip
          key={id}
          formula={(bar < 0 ? head : head.slice(0, bar)).trim()}
          label={hash < 0 ? null : dice.slice(hash + 1).trim() || null}
          display={bar < 0 ? null : head.slice(bar + 1).trim() || null}
        />
      )
    } else if (link !== undefined) {
      // En una tabla, la barra del texto propio va escapada (`[[@X\|texto]]`)
      const [name = '', ...label] = link.split(/\\?\|/)
      parts.push(<ContentRef key={id} name={name} label={label.join('|') || undefined} embed={bang === '!'} />)
    } else if (bold !== undefined) parts.push(<strong key={id}>{inline(bold, id)}</strong>)
    else parts.push(<em key={id}>{inline(italic ?? underscored ?? '', id)}</em>)
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Las celdas de una fila de tabla: | a | b |; una barra escapada (`\|`, la de un enlace) no parte la celda */
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||(?<!\\)\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim())

const isRule = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim())

/** Una tabla de tirar: su botón (con lo que se tira) y, si ya salió algo, dónde está */
interface Rollable {
  dice: ContentTable
  label: string
  busy: boolean
  onRoll: () => void
  hit: { line: number; column: number; width: number } | null
}

function table(lines: readonly string[], key: string, rollable: Rollable | null = null): ReactNode {
  const head = withIds(cells(lines[0] ?? ''), `${key}-h`)
  const rows = withIds(
    lines.slice(2).map((line, r) => withIds(cells(line), `${key}-${r}`)),
    `${key}-r`
  )
  return (
    <div key={key} className={styles.tableBox}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map(({ id, part }, i) => (
              <th key={id} scope="col">
                {i === 0 && rollable ? (
                  <button
                    type="button"
                    className={styles.roll}
                    aria-label={rollable.label}
                    aria-disabled={rollable.busy || undefined}
                    onClick={() => {
                      if (!rollable.busy) rollable.onRoll()
                    }}
                  >
                    <Dices size={14} aria-hidden="true" />
                    {inline(part, id)}
                  </button>
                ) : (
                  inline(part, id)
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, part: row }, line) => (
            <tr key={id}>
              {row.map((cell, column) => {
                // Lo que salió, marcado: su línea y sus columnas (en una tabla en dos mitades, solo la suya)
                const hit = rollable?.hit
                const on = hit && hit.line === line && column >= hit.column && column < hit.column + hit.width
                return (
                  <td key={cell.id} className={on ? styles.hit : undefined}>
                    {inline(cell.part, cell.id)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Los tipos de recuadro por su nombre en Markdown (los de Obsidian en inglés también) */
const CALLOUTS: Record<string, string> = {
  nota: 'note',
  note: 'note',
  info: 'note',
  consejo: 'tip',
  tip: 'tip',
  aviso: 'warning',
  warning: 'warning',
  peligro: 'danger',
  danger: 'danger',
  leer: 'read-aloud',
  'leer-en-voz-alta': 'read-aloud',
  cita: 'quote',
  quote: 'quote',
  cite: 'quote',
  secreto: 'secret'
}
const CALLOUT_HEAD = /^ {0,3}> ?\[!([^\]|]+)((?:\|[^\]]*)?)\][+-]?[ \t]*(.*)$/

/**
 * Un recuadro (`> [!nota] Título`, `> [!cita]`, `> [!leer]`, `> [!secreto]` para el máster) o una cita (`> …`): su
 * título, su página (`|p5`) y lo de dentro, que se lee como el resto del texto
 */
function quoted(lines: readonly string[], key: string, rollableOf: (lines: readonly string[]) => Rollable | null) {
  const head = CALLOUT_HEAD.exec(lines[0] ?? '')
  const inner = (head ? lines.slice(1) : lines).map((l) => l.replace(/^ {0,3}> ?/, '')).join('\n')
  const body = withIds(
    inner.split(/\n\s*\n/).filter((b) => b.trim() !== ''),
    `${key}-q`
  ).map(({ id, part }) => block(part, id, rollableOf))
  if (!head)
    return (
      <blockquote key={key} className={styles.quote}>
        {body}
      </blockquote>
    )
  const kind = CALLOUTS[(head[1] ?? '').trim().toLocaleLowerCase('es')] ?? 'note'
  const options = (head[2] ?? '').split('|').map((o) => o.trim())
  const page = options.map((o) => /^p\.?(\d{1,4})$/.exec(o)?.[1]).find(Boolean)
  const title = (head[3] ?? '').trim()
  return (
    <div key={key} className={styles.callout} data-callout={kind}>
      <CalloutHead kind={kind} title={title} page={page ?? null} />
      {body}
    </div>
  )
}

type CalloutName = 'note' | 'tip' | 'warning' | 'danger' | 'read-aloud' | 'quote' | 'secret'

function CalloutHead({ kind, title, page }: { kind: string; title: string; page: string | null }) {
  const { t } = useTranslation()
  return (
    // Un secreto siempre lleva su rótulo: lo ve el máster y tiene que saber que es suyo
    <div className={styles.calloutTitle} data-titled={title || page || kind === 'secret' ? '' : undefined}>
      <span>{title || (page ? '' : t(`callout.${kind as CalloutName}`))}</span>
      {page && <span className={styles.page}>p{page}</span>}
    </div>
  )
}

function block(text: string, key: string, rollableOf: (lines: readonly string[]) => Rollable | null): ReactNode {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  if (lines.length > 0 && /^ {0,3}>/.test(lines[0] ?? '')) return quoted(text.split('\n'), key, rollableOf)
  const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0] ?? '')
  if (heading && lines.length === 1) {
    // El título del documento es el de la página: los de dentro, de 3 para abajo
    const level = Math.max(3, Math.min(6, heading[1]?.length ?? 3))
    const Tag = `h${level}` as 'h3'
    return (
      <Tag key={key} className={styles.heading}>
        {inline(heading[2] ?? '', key)}
      </Tag>
    )
  }
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    return (
      <ul key={key} className={styles.list}>
        {withIds(lines, key).map(({ id, part }) => (
          <li key={id}>{inline(part.replace(/^\s*[-*]\s+/, ''), id)}</li>
        ))}
      </ul>
    )
  }
  if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|')) && isRule(lines[1] ?? '')) {
    return table(lines, key, rollableOf(lines))
  }
  // Un párrafo: sus líneas seguidas, una bajo otra
  return (
    <p key={key} className={styles.paragraph}>
      {withIds(lines, key).map(({ id, part }, i) => (
        <Fragment key={id}>
          {i > 0 && <br />}
          {inline(part, id)}
        </Fragment>
      ))}
    </p>
  )
}

/**
 * El texto de un documento. Con `onRoll` (en el compendio de una campaña), sus tablas de tirar llevan su botón: se tira
 * en el servidor (`onRoll`, con su orden entre las de tirar) y lo que sale queda marcado
 */
export function ContentText({
  text,
  onRoll,
  onLink,
  preview
}: {
  text: string
  onRoll?: (table: number) => Promise<number | null>
  /** Abrir la entrada que nombra un enlace del texto (`[[@…]]`); sin él, los enlaces son solo texto */
  onLink?: (name: string) => void
  /** Su vista previa al pasar el ratón */
  preview?: (name: string) => ReactNode
}) {
  const { t } = useTranslation()
  const [hit, setHit] = useState<{ table: number; line: number; column: number; width: number } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const blocks = withIds(
    text.split(/\n\s*\n/).filter((b) => b.trim() !== ''),
    'b'
  )
  // Cada tabla de tirar, con su orden entre ellas (el que entiende el servidor)
  let next = 0
  const rollableOf = (lines: readonly string[]): Rollable | null => {
    const dice = onRoll ? diceTableOf(lines.map((l) => l.trim())) : null
    if (!dice || !onRoll) return null
    const index = next++
    const what = dice.header[1]?.replace(/[*_]/g, '') ?? ''
    return {
      dice,
      label: t('compendium.rollTable', { formula: dice.formula, what }),
      busy: busy === index,
      hit: hit?.table === index ? hit : null,
      onRoll: () => {
        setBusy(index)
        void onRoll(index)
          .then((row) => {
            const found = row === null ? null : dice.rows[row]
            setHit(found ? { table: index, line: found.line, column: found.column, width: found.cells.length } : null)
          })
          .finally(() => setBusy(null))
      }
    }
  }
  return (
    <ContentLinks.Provider value={onLink ?? null}>
      <ContentPreviews.Provider value={preview ?? null}>
        <div className={styles.text}>{blocks.map(({ id, part }) => block(part, id, rollableOf))}</div>
      </ContentPreviews.Provider>
    </ContentLinks.Provider>
  )
}

/** Una línea de texto de una entrada (la de su ficha): sus enlaces, sus tiradas, su negrita y su cursiva, sin párrafo */
export function ContentLine({
  text,
  onLink,
  preview
}: {
  text: string
  onLink?: ((name: string) => void) | undefined
  preview?: ((name: string) => ReactNode) | undefined
}) {
  return (
    <ContentLinks.Provider value={onLink ?? null}>
      <ContentPreviews.Provider value={preview ?? null}>{inline(text, 'l')}</ContentPreviews.Provider>
    </ContentLinks.Provider>
  )
}
