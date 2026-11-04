/**
 * «Probar», al lado del editor (docs/specs/sistemas.md § editor): un documento de prueba del tipo elegido, con sus
 * valores y los objetos que lleva (equipados o no). Al cambiarlos, cada valor calculado con su desglose, al momento; y
 * sus tiradas, que tira el servidor sin apuntarlas (tryDice), con su franja
 */

import { formatDice } from '@crisol/dice'
import {
  bandOf,
  type DocumentItem,
  evaluate,
  type Field,
  prepareRoll,
  RollError,
  rollsOf,
  type System,
  textOf
} from '@crisol/systems'
import { useMutation } from '@tanstack/react-query'
import { Dices, Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { BusyButton } from '../../components/busy-button.tsx'
import { NumberText } from './field.tsx'
import styles from './try.module.css'

type Data = Record<string, unknown>

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

export function TryPanel({ system, typeKey }: { system: System; typeKey: string }) {
  const { t } = useTranslation()
  const id = useId()
  const type = system.types[typeKey]
  const [data, setData] = useState<Data>({})
  const [items, setItems] = useState<DocumentItem[]>([])
  const result = useMemo(
    () => (type ? evaluate(system, typeKey, { data, items }) : null),
    [system, typeKey, type, data, items]
  )
  if (!type || !result) return null
  const fields = Object.entries(type.fields)
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }))
  const itemTypes = fields.flatMap(([, f]) => (f.kind === 'items' ? f.of : []))
  // Lo calculado: los calculados, los números guardados que reciben bonos (con su desglose) y los conjuntos con
  // calculados en sus elementos
  const shownComputed = fields.filter(
    ([key, f]) =>
      f.kind === 'derived' ||
      (f.kind === 'number' && result.computed[key]) ||
      (f.kind === 'set' && Object.values(f.fields).some((sub) => sub.kind === 'derived'))
  )
  if (fields.length === 0) return <p className={styles.empty}>{t('systemTry.none')}</p>

  return (
    <div className={styles.try}>
      <p className={styles.sec}>{t('systemTry.values')}</p>
      <div className={styles.values}>
        {fields.map(([key, field]) => (
          <ValueInput
            key={key}
            id={`${id}-${key}`}
            field={field}
            value={data[key]}
            computed={result.values[key]}
            onChange={(v) => set(key, v)}
          />
        ))}
      </div>

      {itemTypes.length > 0 && (
        <>
          <p className={styles.sec}>{t('systemTry.items')}</p>
          <ul className={styles.items}>
            {items.map((item) => (
              <TryItem
                key={item.id}
                item={item}
                system={system}
                onChange={(next) => setItems((list) => list.map((i) => (i.id === item.id ? next : i)))}
                onRemove={() => setItems((list) => list.filter((i) => i.id !== item.id))}
              />
            ))}
          </ul>
          {[...new Set(itemTypes)].map((itemType) => (
            <button
              key={itemType}
              type="button"
              className={styles.add}
              onClick={() =>
                setItems((list) => [
                  ...list,
                  {
                    id: crypto.randomUUID(),
                    type: itemType,
                    name: t('systemTry.newItem', { type: textOf(system.types[itemType]?.label) || itemType }),
                    data: {}
                  }
                ])
              }
            >
              <Plus size={14} aria-hidden="true" />
              <span className={styles.hidden}>{t('systemTry.add')} </span>
              {t('systemTry.addItem', { type: textOf(system.types[itemType]?.label) || itemType })}
            </button>
          ))}
        </>
      )}

      {shownComputed.length > 0 && <p className={styles.sec}>{t('systemTry.computed')}</p>}
      <ul className={styles.computed}>
        {shownComputed
          .filter(([, f]) => f.kind !== 'set')
          .map(([key, field]) => {
            const value = result.computed[key]
            return (
              <li key={key} className={styles.derived}>
                <div className={styles.head}>
                  <span className={styles.name}>{textOf(field.label) || key}</span>
                  {value?.error ? (
                    <span className={styles.error}>{value.error}</span>
                  ) : (
                    <span className={styles.big}>
                      {typeof value?.value === 'number'
                        ? field.kind === 'derived' && field.signed
                          ? signed(value.value)
                          : value.value
                        : String(value?.value ?? '—')}
                    </span>
                  )}
                </div>
                {value && value.terms.length > 0 && (
                  <ul className={styles.terms} aria-label={t('systemTry.from', { name: textOf(field.label) || key })}>
                    {value.terms.map((term, i) => (
                      <li
                        key={`${term.label}-${i}`}
                        className={
                          term.kind === 'bonus' ? styles.bonus : term.kind === 'override' ? styles.override : undefined
                        }
                      >
                        <b>{i === 0 && term.value >= 0 ? term.value : signed(term.value)}</b>
                        <span>{term.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        {fields.map(([key, field]) =>
          field.kind === 'set' && Object.values(field.fields).some((f) => f.kind === 'derived') ? (
            <li key={key} className={styles.derived}>
              <span className={styles.name}>{textOf(field.label) || key}</span>
              <ul className={styles.chips}>
                {field.elements.map((element) => {
                  const values =
                    (result.values[key] as Record<string, Record<string, unknown>> | null)?.[element.key] ?? {}
                  const shown = Object.entries(field.fields)
                    .filter(([, f]) => f.kind === 'derived')
                    .map(([sub, f]) => {
                      const v = values[sub]
                      return typeof v === 'number'
                        ? f.kind === 'derived' && f.signed
                          ? signed(v)
                          : String(v)
                        : String(v ?? '—')
                    })
                  return (
                    <li key={element.key}>
                      {textOf(element.abbr) || textOf(element.label)} <b>{shown.join(' · ')}</b>
                    </li>
                  )
                })}
              </ul>
            </li>
          ) : null
        )}
      </ul>
      {result.problems.length > 0 && (
        <ul className={styles.stored}>
          {result.problems.map((p) => (
            <li key={`${p.path}:${p.message}`}>
              {p.path}: {p.message}
            </li>
          ))}
        </ul>
      )}

      <TryRolls system={system} typeKey={typeKey} data={data} items={items} />
    </div>
  )
}

/** El valor de prueba de un campo guardado, según su clase (los calculados no se escriben) */
function ValueInput({
  id,
  field,
  value,
  computed,
  onChange
}: {
  id: string
  field: Field
  value: unknown
  computed: unknown
  onChange: (value: unknown) => void
}) {
  const { t } = useTranslation()
  const label = textOf(field.label)
  switch (field.kind) {
    case 'number':
    case 'clock':
      return (
        <div className={styles.value}>
          <label htmlFor={id}>{label}</label>
          <NumberText
            id={id}
            value={typeof value === 'number' ? value : typeof computed === 'number' ? computed : 0}
            onValue={onChange}
          />
        </div>
      )
    case 'boolean':
      return (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value === true || (value === undefined && computed === true)}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          {label}
        </label>
      )
    case 'choice':
      return (
        <div className={styles.value}>
          <label htmlFor={id}>{label}</label>
          <select
            id={id}
            value={String(value ?? computed ?? '')}
            onChange={(event) => onChange(event.currentTarget.value)}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {textOf(o.label)}
              </option>
            ))}
          </select>
        </div>
      )
    case 'resource': {
      const current = (value ?? {}) as { value?: number }
      return (
        <div className={styles.value}>
          <label htmlFor={id}>{label}</label>
          <NumberText id={id} value={current.value ?? 0} onValue={(n) => onChange({ ...current, value: n })} />
        </div>
      )
    }
    case 'set': {
      const stored = Object.entries(field.fields).filter(([, f]) => f.kind === 'number')
      if (stored.length === 0) return null
      const current = (value ?? {}) as Record<string, Record<string, number>>
      return (
        <fieldset className={styles.set}>
          <legend>{label}</legend>
          {field.elements.map((element) =>
            stored.map(([sub, f]) => {
              const shown = (computed as Record<string, Record<string, unknown>> | null)?.[element.key]?.[sub]
              return (
                <div key={`${element.key}-${sub}`} className={styles.value}>
                  <label htmlFor={`${id}-${element.key}-${sub}`}>
                    {stored.length > 1 ? `${textOf(element.label)} · ${textOf(f.label)}` : textOf(element.label)}
                  </label>
                  <NumberText
                    id={`${id}-${element.key}-${sub}`}
                    value={current[element.key]?.[sub] ?? (typeof shown === 'number' ? shown : 0)}
                    onValue={(n) =>
                      onChange({ ...current, [element.key]: { ...(current[element.key] ?? {}), [sub]: n } })
                    }
                  />
                </div>
              )
            })
          )}
        </fieldset>
      )
    }
    case 'text':
      return (
        <div className={styles.value}>
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            value={String(value ?? '')}
            placeholder={t('systemEditor.optional')}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </div>
      )
    default:
      return null
  }
}

/** Un objeto de prueba, con lo que se puede marcar o contar de él (equipado, su bono…) */
function TryItem({
  item,
  system,
  onChange,
  onRemove
}: {
  item: DocumentItem
  system: System
  onChange: (item: DocumentItem) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const type = system.types[item.type]
  const fields = Object.entries(type?.fields ?? {}).filter(([, f]) => f.kind === 'boolean' || f.kind === 'number')
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <label htmlFor={`${id}-name`} className={styles.hidden}>
          {t('systemTry.itemName')}
        </label>
        <input
          id={`${id}-name`}
          className={styles.itemName}
          value={item.name}
          onChange={(event) => onChange({ ...item, name: event.currentTarget.value })}
        />
        <button
          type="button"
          className={styles.remove}
          aria-label={t('systemTry.removeItem', { name: item.name })}
          onClick={onRemove}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.itemFields}>
        {fields.map(([key, field]) =>
          field.kind === 'boolean' ? (
            <label key={key} className={styles.check}>
              <input
                type="checkbox"
                checked={item.data[key] === true}
                onChange={(event) => onChange({ ...item, data: { ...item.data, [key]: event.currentTarget.checked } })}
              />
              {textOf(field.label)}
            </label>
          ) : (
            <div key={key} className={styles.value}>
              <label htmlFor={`${id}-${key}`}>{textOf(field.label)}</label>
              <NumberText
                id={`${id}-${key}`}
                value={typeof item.data[key] === 'number' ? (item.data[key] as number) : 0}
                onValue={(n) => onChange({ ...item, data: { ...item.data, [key]: n } })}
              />
            </div>
          )
        )}
      </div>
    </li>
  )
}

/** Las tiradas del tipo: por qué, el modo y el objetivo; las tira el servidor, sin apuntarlas */
function TryRolls({
  system,
  typeKey,
  data,
  items
}: {
  system: System
  typeKey: string
  data: Data
  items: DocumentItem[]
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const id = useId()
  const rolls = rollsOf(system, typeKey)
  const [choice, setChoice] = useState<Record<string, { element?: string; mode?: string; target?: number | null }>>({})
  const [shown, setShown] = useState<{
    key: string
    label: string
    total: number
    detail: string
    band: string | null
    critical: string | null
  } | null>(null)
  const roll = useMutation({
    mutationFn: async (key: string) => {
      const options = choice[key] ?? {}
      const entry = rolls.find((r) => r.key === key)
      const element = options.element ?? entry?.elements[0]?.key
      const prepared = prepareRoll(system, typeKey, { data, items }, key, {
        ...options,
        ...(element ? { element } : {})
      })
      const done = await api.call('tryDice', {
        formula: formatDice(prepared.tree).replace(/×/g, '*'),
        critical: prepared.critical
      })
      const first = done.dice.find((d) => typeof d.sides === 'number' && d.kept)
      const band = bandOf(prepared, { total: done.total, natural: first?.value ?? null }, options.target ?? null)
      return {
        key,
        label: prepared.label,
        total: done.total,
        detail: done.detail,
        band: band?.label ?? null,
        critical: done.critical
      }
    },
    onSuccess: setShown
  })
  if (rolls.length === 0) return null
  return (
    <>
      <p className={styles.sec}>{t('systemTry.rolls')}</p>
      <ul className={styles.rolls}>
        {rolls.map((r) => {
          const options = choice[r.key] ?? {}
          const pick = (patch: Partial<typeof options>) =>
            setChoice((c) => ({ ...c, [r.key]: { ...options, ...patch } }))
          return (
            <li key={r.key} className={styles.roll}>
              <span className={styles.rollName}>{r.label}</span>
              {r.elements.length > 0 && (
                <>
                  <label htmlFor={`${id}-${r.key}-el`} className={styles.hidden}>
                    {t('systemTry.by', { roll: r.label })}
                  </label>
                  <select
                    id={`${id}-${r.key}-el`}
                    value={options.element ?? r.elements[0]?.key}
                    onChange={(event) => pick({ element: event.currentTarget.value })}
                  >
                    {r.elements.map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {r.modes.length > 0 && (
                <>
                  <label htmlFor={`${id}-${r.key}-mode`} className={styles.hidden}>
                    {t('systemTry.mode', { roll: r.label })}
                  </label>
                  <select
                    id={`${id}-${r.key}-mode`}
                    value={options.mode ?? ''}
                    onChange={(event) =>
                      pick(event.currentTarget.value ? { mode: event.currentTarget.value } : { mode: undefined })
                    }
                  >
                    <option value="">{t('systemTry.normal')}</option>
                    {r.modes.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {r.target !== 'none' && (
                <>
                  <label htmlFor={`${id}-${r.key}-target`} className={styles.hidden}>
                    {t('systemTry.target', { roll: r.label })}
                  </label>
                  <input
                    id={`${id}-${r.key}-target`}
                    className={styles.target}
                    type="number"
                    placeholder={t('systemTry.targetShort')}
                    value={options.target ?? ''}
                    onChange={(event) =>
                      pick({ target: event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber })
                    }
                  />
                </>
              )}
              <BusyButton
                type="button"
                className={styles.go}
                busy={roll.isPending && roll.variables === r.key}
                onClick={() => roll.mutate(r.key)}
              >
                <Dices size={14} aria-hidden="true" />
                {t('systemTry.roll', { roll: r.label })}
              </BusyButton>
            </li>
          )
        })}
      </ul>
      <div className={styles.result} aria-live="polite">
        {roll.error && (
          <p className={styles.error}>{roll.error instanceof RollError ? roll.error.message : errorText(roll.error)}</p>
        )}
        {shown && !roll.error && (
          <>
            <div className={styles.line}>
              <span className={styles.big}>{shown.total}</span>
              <span className={styles.band}>{shown.band ?? shown.label}</span>
            </div>
            <p className={styles.detail}>{shown.detail}</p>
            <p className={styles.notRecorded}>{t('systemTry.notRecorded')}</p>
          </>
        )}
      </div>
    </>
  )
}
