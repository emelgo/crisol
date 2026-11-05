/**
 * El texto de un documento del contenido (las reglas, los conjuros, las criaturas), en el Markdown sencillo que traen:
 * párrafos, títulos, negrita, cursiva, listas y tablas. Se construye con elementos de React, nunca con HTML: sus textos
 * son datos
 */
import { Fragment, type ReactNode } from 'react'
import styles from './content-text.module.css'

/** Cada parte de un texto fijo con su id: su sitio no cambia */
const withIds = <T,>(parts: readonly T[], key: string) => parts.map((part, i) => ({ id: `${key}-${i}`, part }))

/** Negrita (**…**) y cursiva (*…* o _…_) dentro de una línea */
function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g
  let last = 0
  let n = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const [, bold, italic, underscored] = match
    const id = `${key}-${n++}`
    if (bold !== undefined) parts.push(<strong key={id}>{inline(bold, id)}</strong>)
    else parts.push(<em key={id}>{italic ?? underscored}</em>)
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Las celdas de una fila de tabla: | a | b | */
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

const isRule = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim())

function table(lines: readonly string[], key: string): ReactNode {
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
            {head.map(({ id, part }) => (
              <th key={id} scope="col">
                {inline(part, id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, part: row }) => (
            <tr key={id}>
              {row.map((cell) => (
                <td key={cell.id}>{inline(cell.part, cell.id)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function block(text: string, key: string): ReactNode {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
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
    return table(lines, key)
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

export function ContentText({ text }: { text: string }) {
  const blocks = withIds(
    text.split(/\n\s*\n/).filter((b) => b.trim() !== ''),
    'b'
  )
  return <div className={styles.text}>{blocks.map(({ id, part }) => block(part, id))}</div>
}
