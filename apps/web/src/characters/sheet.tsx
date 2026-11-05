/**
 * La ficha mínima de un personaje (docs/specs/personajes.md § creador): sus valores calculados, en cualquier sistema.
 * Los conjuntos (las características, las habilidades) como tablas; los números, en recuadros; lo que lleva, por
 * tipo. La hoja de verdad, por bloques, es de `hoja`
 */
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import styles from './sheet.module.css'

type State = ActionOutput<'getCharacter'>['state']

const shown = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && value !== '') || typeof value === 'boolean'
const text = (value: unknown) =>
  typeof value === 'boolean' ? (value ? '✓' : '') : Array.isArray(value) ? value.join(', ') : String(value)

export function MinimalSheet({ state }: { state: State }) {
  const { t } = useTranslation()
  const sheet = state.sheet
  // Los calculados y, de los números, los que no están a 0 (los bonos sin usar no se ven)
  const numbers = state.fields.filter(
    (f) => typeof sheet[f.key] === 'number' && (f.kind === 'derived' || (f.kind === 'number' && sheet[f.key] !== 0))
  )
  const sets = state.fields.filter((f) => f.kind === 'set' && f.elements && f.columns)
  const lists = state.fields.filter(
    (f) => f.kind === 'list' && Array.isArray(sheet[f.key]) && (sheet[f.key] as unknown[]).length > 0
  )
  // Lo que lleva, en los campos de objetos que lo admiten (los rasgos, los conjuros): lo concedido o elegido
  const carried = state.items.filter((item) => item.from)
  const groups = state.fields
    .filter((f) => f.kind === 'items' && f.of)
    .map((f) => ({ field: f, items: carried.filter((item) => f.of?.includes(item.type)) }))
    .filter((g) => g.items.length > 0)
  return (
    <div className={styles.sheet}>
      <ul className={styles.tiles} aria-label={t('characterSheet.values')}>
        {numbers.map((f) => (
          <li key={f.key} className={styles.tile}>
            <span className={styles.tileLabel}>{f.label}</span>
            <span className={styles.tileValue}>{String(sheet[f.key])}</span>
          </li>
        ))}
      </ul>
      {sets.map((set) => {
        const values = (sheet[set.key] ?? {}) as Record<string, Record<string, unknown>>
        const columns = (set.columns ?? []).filter((c) =>
          (set.elements ?? []).some((e) => shown(values[e.key]?.[c.key]))
        )
        if (columns.length === 0) return null
        return (
          <section key={set.key} className={styles.set} aria-labelledby={`set-${set.key}`}>
            <h2 id={`set-${set.key}`}>{set.label}</h2>
            <div className={styles.tableBox}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className={styles.hidden}>{set.label}</span>
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} scope="col">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(set.elements ?? []).map((e) => (
                    <tr key={e.key}>
                      <th scope="row">{e.label}</th>
                      {columns.map((c) => {
                        const v = values[e.key]?.[c.key]
                        return <td key={c.key}>{shown(v) ? text(v) : ''}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      {lists.map((f) => (
        <p key={f.key} className={styles.list}>
          <span className={styles.tileLabel}>{f.label}</span> {text(sheet[f.key])}
        </p>
      ))}
      {groups.map(({ field, items }) => (
        <section key={field.key} className={styles.set} aria-labelledby={`items-${field.key}`}>
          <h2 id={`items-${field.key}`}>{field.label}</h2>
          <ul className={styles.names}>
            {items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
