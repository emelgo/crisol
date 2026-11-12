/**
 * La ficha de ejemplo del editor (lienzo de la tanda 8): un personaje de prueba con los campos del borrador, calculado
 * aquí con el mismo motor que el servidor (evaluate), para ver al momento lo que sale. Sus valores de partida son de
 * ejemplo (las características, variadas), no los de nadie
 */
import { characterType, evaluate, type Field, type Language, type System, textOf } from '@crisol/systems'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './rules.module.css'

/** Cuántos campos se ven, como mucho: es una muestra, no la hoja entera */
const LIMIT = 12

/** Valores de ejemplo para un conjunto (las características): variados, como los de un personaje de verdad */
const SAMPLE = [14, 12, 13, 10, 11, 9, 15, 8]

/**
 * Lo que se escribe en la ficha de ejemplo: el primer conjunto (las características), variado; lo demás, con lo que
 * traiga de partida (rellenar también las habilidades daría cifras de otro mundo)
 */
export function sampleData(fields: Record<string, Field>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    if (field.kind !== 'set' || Object.keys(data).length > 0) continue
    const numbers = Object.entries(field.fields).filter(([, f]) => f.kind === 'number')
    if (numbers.length === 0) continue
    const [first] = numbers
    if (!first) continue
    data[key] = Object.fromEntries(field.elements.map((e, i) => [e.key, { [first[0]]: SAMPLE[i % SAMPLE.length] }]))
  }
  return data
}

const shown = (value: unknown) =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'number'
      ? String(Math.round(value * 100) / 100)
      : typeof value === 'boolean'
        ? value
          ? '✓'
          : '—'
        : Array.isArray(value)
          ? value.join(', ')
          : String(value)

const signed = (value: unknown) => (typeof value === 'number' && value >= 0 ? `+${value}` : shown(value))

export function ExampleSheet({
  system,
  language,
  fresh
}: {
  system: System
  language: Language
  fresh: string | null
}) {
  const { t } = useTranslation()
  const type = characterType(system)
  const result = useMemo(() => {
    if (!type) return null
    const fields = system.types[type]?.fields ?? {}
    try {
      return { fields, out: evaluate(system, type, { data: sampleData(fields) }, { language }) }
    } catch {
      return null
    }
  }, [system, type, language])
  if (!type || !result) return <p className={styles.muted}>{t('rules.example.none')}</p>
  const { fields, out } = result
  const value = (path: string) => out.computed[path]?.value ?? out.values[path]
  // Lo de dentro de un conjunto va anidado: el valor de un elemento
  const nested = (key: string, element: string, sub: string) =>
    (out.values[key] as Record<string, Record<string, unknown>> | undefined)?.[element]?.[sub]
  return (
    <div className={styles.example}>
      {Object.entries(fields)
        .slice(0, LIMIT)
        .map(([key, field]) => {
          const label = textOf(field.label, language)
          if (field.kind === 'set') {
            const sub = Object.entries(field.fields)
            const main = sub.find(([, f]) => f.kind === 'number')?.[0]
            const derived = sub.find(([, f]) => f.kind === 'derived')?.[0]
            return (
              <div key={key} className={styles.exBlock} data-fresh={fresh === key || undefined}>
                <span className={styles.exLabel}>{label}</span>
                <div className={styles.exSet}>
                  {field.elements.map((e) => (
                    <div key={e.key} className={styles.exStat} title={textOf(e.label, language)}>
                      {/* Su abreviatura (o su nombre, cortado con «…»); entero para el lector de pantalla */}
                      <small aria-hidden="true">{textOf(e.abbr ?? e.label, language)}</small>
                      <span className={styles.srOnly}>{textOf(e.label, language)}</span>
                      <strong>{main ? shown(nested(key, e.key, main)) : '—'}</strong>
                      {derived && <em>{signed(value(`${key}.${e.key}.${derived}`))}</em>}
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          if (field.kind === 'resource') {
            const max = value(`${key}.max`)
            return (
              <div key={key} className={styles.exRow} data-fresh={fresh === key || undefined}>
                <span className={styles.exLabel}>{label}</span>
                <span className={styles.exBar} aria-hidden="true">
                  <i />
                </span>
                <span className={styles.exValue}>
                  {shown(max)} / {shown(max)}
                </span>
              </div>
            )
          }
          if (field.kind === 'group' || field.kind === 'table' || field.kind === 'items') return null
          return (
            <div key={key} className={styles.exRow} data-fresh={fresh === key || undefined}>
              <span className={styles.exLabel}>{label}</span>
              <span className={styles.exValue}>
                {field.kind === 'derived' && field.signed ? signed(value(key)) : shown(value(key))}
              </span>
            </div>
          )
        })}
      {Object.keys(fields).length > LIMIT && (
        <p className={styles.muted}>{t('rules.example.more', { count: Object.keys(fields).length - LIMIT })}</p>
      )}
      {Object.keys(fields).length === 0 && <p className={styles.muted}>{t('rules.example.empty')}</p>}
    </div>
  )
}
