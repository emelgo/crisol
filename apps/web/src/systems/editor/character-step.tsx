/**
 * Paso 1 del editor, «¿Qué tiene un personaje?» (lienzo de la tanda 8): los campos del personaje, cada uno en su fila
 * (su nombre, su clase con palabras de mesa y un resumen), que se despliega para cambiarlo. Se añaden con las seis de
 * siempre o con «Más»; se suben, se bajan y se quitan (con «Deshacer» un momento)
 */
import type { Field, FieldKind, Language, System } from '@crisol/systems'
import { characterType, textOf } from '@crisol/systems'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Help } from './help.tsx'
import { blankField, keyFor, MAIN_KINDS, MORE_KINDS, summaryOf, withText } from './kinds.ts'
import styles from './rules.module.css'
import type { Change } from './rules-editor.tsx'

export function CharacterStep({
  system,
  language,
  change,
  onAdded
}: {
  system: System
  language: Language
  change: Change
  /** Lo recién añadido, para marcarlo en la ficha de ejemplo */
  onAdded: (key: string) => void
}) {
  const { t } = useTranslation()
  const type = characterType(system)
  if (!type) return <p className={styles.muted}>{t('rules.character.noType')}</p>
  return (
    <>
      <p className={styles.enough}>{t('rules.character.enough')}</p>
      <FieldsList system={system} typeKey={type} language={language} change={change} onAdded={onAdded} />
    </>
  )
}

/** Los campos de un tipo (el personaje, las armas…): cada uno en su fila, y añadir con palabras de mesa */
export function FieldsList({
  system,
  typeKey,
  language,
  change,
  onAdded
}: {
  system: System
  typeKey: string
  language: Language
  change: Change
  onAdded?: (key: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const fields = Object.entries(system.types[typeKey]?.fields ?? {})
  const add = (kind: FieldKind) => {
    const label = t(`rules.kinds.${kind}.new`)
    // La clave, con lo de ahora (el cambio se aplica después)
    const key = keyFor(label, Object.keys(system.types[typeKey]?.fields ?? {}))
    change((draft) => {
      const target = draft.types[typeKey]
      if (target) target.fields[key] = blankField(kind, label)
    })
    setOpen(key)
    setMore(false)
    onAdded?.(key)
  }
  const move = (key: string, delta: -1 | 1) =>
    change((draft) => {
      const target = draft.types[typeKey]
      if (!target) return
      const entries = Object.entries(target.fields)
      const at = entries.findIndex(([k]) => k === key)
      const to = at + delta
      if (at < 0 || to < 0 || to >= entries.length) return
      const [moved] = entries.splice(at, 1)
      if (moved) entries.splice(to, 0, moved)
      target.fields = Object.fromEntries(entries)
    })
  const remove = (key: string) =>
    change(
      (draft) => {
        const target = draft.types[typeKey]
        if (target) delete target.fields[key]
      },
      t('rules.removed', { name: textOf(system.types[typeKey]?.fields[key]?.label, language) })
    )
  return (
    <>
      <ul className={styles.rows}>
        {fields.map(([key, field], index) => (
          <li key={key}>
            <FieldRow
              fieldKey={key}
              field={field}
              language={language}
              open={open === key}
              first={index === 0}
              last={index === fields.length - 1}
              onToggle={() => setOpen((now) => (now === key ? null : key))}
              onChange={(next) =>
                change((draft) => {
                  const target = draft.types[typeKey]
                  if (target) target.fields[key] = next
                })
              }
              onMove={(delta) => move(key, delta)}
              onRemove={() => remove(key)}
            />
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <span className={styles.addLabel}>{t('rules.add')}</span>
        {MAIN_KINDS.map((kind) => (
          <button key={kind} type="button" className={styles.addButton} onClick={() => add(kind)}>
            <Plus size={14} aria-hidden="true" />
            {t(`rules.kinds.${kind}.name`)}
          </button>
        ))}
        <button type="button" className={styles.addButton} aria-expanded={more} onClick={() => setMore((now) => !now)}>
          {t('rules.more')}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      {more && (
        <div className={styles.add}>
          {MORE_KINDS.map((kind) => (
            <button key={kind} type="button" className={styles.addButton} onClick={() => add(kind)}>
              <Plus size={14} aria-hidden="true" />
              {t(`rules.kinds.${kind}.name`)}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function FieldRow({
  fieldKey,
  field,
  language,
  open,
  first,
  last,
  onToggle,
  onChange,
  onMove,
  onRemove
}: {
  fieldKey: string
  field: Field
  language: Language
  open: boolean
  first: boolean
  last: boolean
  onToggle: () => void
  onChange: (next: Field) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const bodyId = useId()
  const summary = summaryOf(field, language, (key, values) => t(key as 'rules.summary.range', values ?? {}))
  return (
    <div className={styles.row} data-open={open || undefined} id={`campo-${fieldKey}`}>
      <button type="button" className={styles.rowHead} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className={styles.rowName}>
          {textOf(field.label, language) || fieldKey}
          {field.help && <small>{textOf(field.help, language)}</small>}
        </span>
        <span className={styles.rowKind}>{t(`rules.kinds.${field.kind}.name`)}</span>
        <span className={styles.rowSummary}>{summary}</span>
        <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
      </button>
      {open && (
        <div id={bodyId} className={styles.rowBody}>
          <FieldForm field={field} language={language} onChange={onChange} />
          <div className={styles.rowTools}>
            <button type="button" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp size={14} aria-hidden="true" />
              {t('rules.up')}
            </button>
            <button type="button" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown size={14} aria-hidden="true" />
              {t('rules.down')}
            </button>
            <button type="button" className={styles.danger} onClick={onRemove}>
              <Trash2 size={14} aria-hidden="true" />
              {t('rules.remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Lo de un campo: su nombre, su ayuda y lo de su clase */
export function FieldForm({
  field,
  language,
  onChange
}: {
  field: Field
  language: Language
  onChange: (next: Field) => void
}) {
  const { t } = useTranslation()
  const ids = { name: useId(), help: useId(), min: useId(), max: useId(), start: useId(), formula: useId() }
  const number = (value: string) => (value.trim() === '' ? undefined : Number(value))
  const set = (patch: Partial<Record<string, unknown>>) => onChange({ ...field, ...patch } as Field)
  return (
    <div className={styles.form}>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor={ids.name}>{t('rules.field.name')}</label>
          <input
            id={ids.name}
            value={textOf(field.label, language)}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => set({ label: withText(field.label, event.currentTarget.value, language) })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.help}>
            {t('rules.field.help')}
            <Help topic="help" />
          </label>
          <input
            id={ids.help}
            value={textOf(field.help, language)}
            maxLength={200}
            autoComplete="off"
            placeholder={t('rules.field.helpHint')}
            onChange={(event) => {
              const text = event.currentTarget.value
              set({ help: text ? withText(field.help, text, language) : undefined })
            }}
          />
        </div>
      </div>
      {field.kind === 'number' && (
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor={ids.start}>{t('rules.field.start')}</label>
            <input
              id={ids.start}
              type="number"
              value={field.default ?? ''}
              onChange={(event) => set({ default: number(event.currentTarget.value) })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.min}>{t('rules.field.min')}</label>
            <input
              id={ids.min}
              type="number"
              value={field.min ?? ''}
              onChange={(event) => set({ min: number(event.currentTarget.value) })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.max}>{t('rules.field.max')}</label>
            <input
              id={ids.max}
              type="number"
              value={field.max ?? ''}
              onChange={(event) => set({ max: number(event.currentTarget.value) })}
            />
          </div>
        </div>
      )}
      {field.kind === 'resource' && (
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor={ids.max}>
              {t('rules.field.resourceMax')}
              <Help topic="formula" />
            </label>
            <input
              id={ids.max}
              value={field.max ?? ''}
              autoComplete="off"
              onChange={(event) => {
                const text = event.currentTarget.value.trim()
                set({ max: text === '' ? undefined : /^-?\d+$/.test(text) ? Number(text) : text })
              }}
            />
          </div>
        </div>
      )}
      {field.kind === 'derived' && (
        <div className={styles.field}>
          <label htmlFor={ids.formula}>
            {t('rules.field.formula')}
            <Help topic="derived" />
          </label>
          <input
            id={ids.formula}
            value={field.formula}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => set({ formula: event.currentTarget.value })}
          />
        </div>
      )}
      {field.kind === 'text' && (
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor={ids.max}>{t('rules.field.lines')}</label>
            <input
              id={ids.max}
              type="number"
              min={1}
              max={20}
              value={field.lines ?? 1}
              onChange={(event) => set({ lines: number(event.currentTarget.value) })}
            />
          </div>
        </div>
      )}
      {field.kind === 'set' && <NamedList field={field} kind="elements" language={language} onChange={onChange} />}
      {field.kind === 'choice' && <NamedList field={field} kind="options" language={language} onChange={onChange} />}
    </div>
  )
}

/** Los elementos de un conjunto (Fuerza, Agilidad…) o las opciones de una elección: sus nombres, en una lista */
function NamedList({
  field,
  kind,
  language,
  onChange
}: {
  field: Extract<Field, { kind: 'set' } | { kind: 'choice' }>
  kind: 'elements' | 'options'
  language: Language
  onChange: (next: Field) => void
}) {
  const { t } = useTranslation()
  const items =
    kind === 'elements' && field.kind === 'set'
      ? field.elements.map((e) => ({ id: e.key, label: e.label }))
      : field.kind === 'choice'
        ? field.options.map((o) => ({ id: o.value, label: o.label }))
        : []
  const write = (next: { id: string; label: Field['label'] }[]) => {
    if (field.kind === 'set')
      onChange({
        ...field,
        elements: next.map((n) => ({
          ...(field.elements.find((e) => e.key === n.id) ?? {}),
          key: n.id,
          label: n.label
        }))
      })
    else if (field.kind === 'choice')
      onChange({ ...field, options: next.map((n) => ({ value: n.id, label: n.label })) })
  }
  return (
    <fieldset className={styles.named}>
      <legend>{t(kind === 'elements' ? 'rules.field.elements' : 'rules.field.options')}</legend>
      <ul>
        {items.map((item, index) => (
          <li key={item.id}>
            <input
              aria-label={t('rules.field.itemName', { n: index + 1 })}
              value={textOf(item.label, language)}
              autoComplete="off"
              onChange={(event) =>
                write(
                  items.map((i) =>
                    i.id === item.id ? { ...i, label: withText(i.label, event.currentTarget.value, language) } : i
                  )
                )
              }
            />
            <button
              type="button"
              aria-label={t('rules.field.removeItem', { name: textOf(item.label, language) })}
              disabled={items.length <= 1}
              onClick={() => write(items.filter((i) => i.id !== item.id))}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => {
          const label = t('rules.field.newItem')
          write([
            ...items,
            {
              id: keyFor(
                label,
                items.map((i) => i.id)
              ),
              label
            }
          ])
        }}
      >
        <Plus size={14} aria-hidden="true" />
        {t(kind === 'elements' ? 'rules.field.addElement' : 'rules.field.addOption')}
      </button>
    </fieldset>
  )
}
