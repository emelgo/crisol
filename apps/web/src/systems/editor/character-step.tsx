/**
 * Paso 1 del editor, «¿Qué tiene un personaje?» (lienzo de la tanda 8): los campos del personaje, cada uno en su fila
 * (su nombre, su clase con palabras de mesa y un resumen), que se despliega para cambiarlo. Se añaden con las seis de
 * siempre o con «Más»; se suben, se bajan y se quitan (con «Deshacer» un momento)
 */
import type { Field, FieldKind, Language, Problem, System } from '@crisol/systems'
import { characterType, formulaText, textOf } from '@crisol/systems'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { type ComponentProps, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from '../../components/announcer.tsx'
import { focusAfterRemoving, focusOnMount } from '../../components/focus.ts'
import { NumberText } from '../../components/number-text.tsx'
import { Help } from './help.tsx'
import { blankField, keyFor, MAIN_KINDS, MORE_KINDS, summaryOf, withText } from './kinds.ts'
import styles from './rules.module.css'
import type { Change } from './rules-editor.tsx'

export function CharacterStep({
  system,
  language,
  change,
  onAdded,
  problems
}: {
  system: System
  language: Language
  change: Change
  /** Lo recién añadido, para marcarlo en la ficha de ejemplo */
  onAdded: (key: string) => void
  problems: Problem[]
}) {
  const { t } = useTranslation()
  const type = characterType(system)
  if (!type) return <p className={styles.muted}>{t('rules.character.noType')}</p>
  return (
    <>
      {/* Con unas características y algo que se gasta (la vida), ya se juega: se dice cuando es verdad */}
      {Object.values(system.types[type]?.fields ?? {}).some((f) => f.kind === 'set') &&
        Object.values(system.types[type]?.fields ?? {}).some((f) => f.kind === 'resource') && (
          <p className={styles.enough}>{t('rules.character.enough')}</p>
        )}
      <FieldsList
        system={system}
        typeKey={type}
        language={language}
        change={change}
        onAdded={onAdded}
        problems={problems}
      />
    </>
  )
}

/** Los campos de un tipo (el personaje, las armas…): cada uno en su fila, y añadir con palabras de mesa */
export function FieldsList({
  system,
  typeKey,
  language,
  change,
  onAdded,
  problems = []
}: {
  system: System
  typeKey: string
  language: Language
  change: Change
  onAdded?: (key: string) => void
  problems?: Problem[]
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const [open, setOpen] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const read = (formula: string) => formulaText(formula, { system, type: typeKey, language })
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
    setFresh(key)
    setMore(false)
    onAdded?.(key)
  }
  const move = (key: string, delta: -1 | 1) => {
    const at = fields.findIndex(([k]) => k === key)
    const to = at + delta
    if (at < 0 || to < 0 || to >= fields.length) return
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
    // El foco sigue en su botón (o en el otro, si llegó arriba o abajo) y se dice dónde quedó
    requestAnimationFrame(() => focusMoved(list.current, `campo-${typeKey}-${key}`, delta))
    announce(t('rules.movedTo', { name: textOf(fields[at]?.[1].label, language), at: to + 1, of: fields.length }))
  }
  const remove = (key: string, item: Element | null) => {
    const back = focusAfterRemoving(item)
    change(
      (draft) => {
        const target = draft.types[typeKey]
        if (target) delete target.fields[key]
      },
      t('rules.removed', { name: textOf(system.types[typeKey]?.fields[key]?.label, language) })
    )
    requestAnimationFrame(back)
  }
  return (
    <>
      <ul className={styles.rows} ref={list}>
        {fields.map(([key, field], index) => (
          <li key={key}>
            <FieldRow
              id={`campo-${typeKey}-${key}`}
              fieldKey={key}
              field={field}
              language={language}
              read={read}
              issues={problems.filter(
                (p) =>
                  p.path === `types.${typeKey}.fields.${key}` || p.path.startsWith(`types.${typeKey}.fields.${key}.`)
              )}
              focusName={fresh === key}
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
              onRemove={(item) => remove(key, item)}
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
  id,
  fieldKey,
  field,
  language,
  read,
  issues,
  focusName,
  open,
  first,
  last,
  onToggle,
  onChange,
  onMove,
  onRemove
}: {
  id: string
  fieldKey: string
  field: Field
  language: Language
  read: (formula: string) => string
  issues: Problem[]
  focusName: boolean
  open: boolean
  first: boolean
  last: boolean
  onToggle: () => void
  onChange: (next: Field) => void
  onMove: (delta: -1 | 1) => void
  onRemove: (item: Element | null) => void
}) {
  const { t } = useTranslation()
  const bodyId = useId()
  const errorId = useId()
  const summary = summaryOf(field, language, (key, values) => t(key as 'rules.summary.range', values ?? {}), read)
  const name = textOf(field.label, language) || fieldKey
  return (
    <div className={styles.row} data-open={open || undefined} id={id}>
      <button type="button" className={styles.rowHead} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className={styles.rowName}>
          {name}
          {field.help && <small>{textOf(field.help, language)}</small>}
        </span>
        <span className={styles.rowKind}>{t(`rules.kinds.${field.kind}.name`)}</span>
        <span className={styles.rowSummary}>{summary}</span>
        {issues.some((p) => p.severity === 'error') && (
          <span className={styles.stepWarn} title={t('rules.stepHasProblems')}>
            <span className={styles.srOnly}>{t('rules.stepHasProblems')}</span>
          </span>
        )}
        <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
      </button>
      {open && (
        <div id={bodyId} className={styles.rowBody}>
          <FieldForm
            field={field}
            language={language}
            onChange={onChange}
            focusName={focusName}
            errorId={issues.length > 0 ? errorId : undefined}
          />
          {issues.length > 0 && (
            <ul id={errorId} className={styles.fieldErrors}>
              {issues.map((p) => (
                <li key={`${p.path}-${p.message}`} className={styles.fieldError}>
                  {p.message}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.rowTools}>
            <button
              type="button"
              data-move="up"
              aria-label={t('rules.upNamed', { name })}
              disabled={first}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={14} aria-hidden="true" />
              {t('rules.up')}
            </button>
            <button
              type="button"
              data-move="down"
              aria-label={t('rules.downNamed', { name })}
              disabled={last}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={14} aria-hidden="true" />
              {t('rules.down')}
            </button>
            <button
              type="button"
              className={styles.danger}
              aria-label={t('rules.removeNamed', { name })}
              onClick={(event) => onRemove(event.currentTarget.closest('li'))}
            >
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
  onChange,
  focusName = false,
  errorId
}: {
  field: Field
  language: Language
  onChange: (next: Field) => void
  /** Recién añadido: el foco, a su nombre */
  focusName?: boolean
  /** Sus avisos, debajo: los campos que fallan apuntan a ellos */
  errorId?: string
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
            ref={focusName ? focusOnMount : undefined}
            value={textOf(field.label, language)}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => set({ label: withText(field.label, event.currentTarget.value, language) })}
          />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={ids.help}>{t('rules.field.help')}</label>
            <Help topic="help" />
          </div>
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
            <div className={styles.labelRow}>
              <label htmlFor={ids.max}>{t('rules.field.resourceMax')}</label>
              <Help topic="formula" />
            </div>
            <TrimmedText id={ids.max} value={field.max} numeric autoComplete="off" onValue={(max) => set({ max })} />
          </div>
        </div>
      )}
      {field.kind === 'derived' && (
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={ids.formula}>{t('rules.field.formula')}</label>
            <Help topic="derived" />
          </div>
          <input
            id={ids.formula}
            value={field.formula}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={errorId}
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
            <NumberText id={ids.max} min={1} max={20} value={field.lines ?? 1} onValue={(lines) => set({ lines })} />
          </div>
        </div>
      )}
      {field.kind === 'set' && <NamedList field={field} kind="elements" language={language} onChange={onChange} />}
      {field.kind === 'set' && <SetInside field={field} language={language} onChange={onChange} />}
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
  const list = useRef<HTMLUListElement>(null)
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
      <ul ref={list}>
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
              onClick={(event) => {
                const back = focusAfterRemoving(event.currentTarget.closest('li'))
                write(items.filter((i) => i.id !== item.id))
                requestAnimationFrame(back)
              }}
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
          // El foco, al nombre del nuevo, ya escogido para escribir encima
          requestAnimationFrame(() => {
            const input = list.current?.querySelector<HTMLInputElement>('li:last-child input')
            input?.focus()
            input?.select()
          })
        }}
      >
        <Plus size={14} aria-hidden="true" />
        {t(kind === 'elements' ? 'rules.field.addElement' : 'rules.field.addOption')}
      </button>
    </fieldset>
  )
}

/**
 * Lo que tiene cada uno de un conjunto (su valor y, si se quiere, su modificador): sus nombres y quitarlos; añadir
 * una cifra o lo que se calcula de ella, con el modificador típico ya escrito
 */
function SetInside({
  field,
  language,
  onChange
}: {
  field: Extract<Field, { kind: 'set' }>
  language: Language
  onChange: (next: Field) => void
}) {
  const { t } = useTranslation()
  const inside = Object.entries(field.fields)
  const number = inside.find(([, f]) => f.kind === 'number')?.[0]
  const write = (fields: typeof field.fields) => onChange({ ...field, fields })
  return (
    <fieldset className={styles.named}>
      <legend>{t('rules.field.inside')}</legend>
      <ul>
        {inside.map(([key, sub]) => (
          <li key={key}>
            <input
              aria-label={t('rules.field.insideName', { kind: t(`rules.kinds.${sub.kind}.name`) })}
              value={textOf(sub.label, language)}
              autoComplete="off"
              onChange={(event) =>
                write({
                  ...field.fields,
                  [key]: { ...sub, label: withText(sub.label, event.currentTarget.value, language) }
                })
              }
            />
            <span className={styles.insideKind}>{t(`rules.kinds.${sub.kind}.name`)}</span>
            <button
              type="button"
              aria-label={t('rules.field.removeItem', { name: textOf(sub.label, language) })}
              disabled={inside.length <= 1}
              onClick={(event) => {
                const back = focusAfterRemoving(event.currentTarget.closest('li'))
                write(Object.fromEntries(inside.filter(([k]) => k !== key)))
                requestAnimationFrame(back)
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            const label = t('rules.kinds.number.new')
            write({
              ...field.fields,
              [keyFor(label, Object.keys(field.fields))]: { kind: 'number', label, default: 10 }
            })
          }}
        >
          <Plus size={14} aria-hidden="true" />
          {t('rules.kinds.number.name')}
        </button>
        {number && !inside.some(([, f]) => f.kind === 'derived') && (
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              write({
                ...field.fields,
                [keyFor('mod', Object.keys(field.fields))]: {
                  kind: 'derived',
                  label: t('rules.field.modifier'),
                  formula: `floor((@este.${number} - 10) / 2)`,
                  signed: true
                }
              })
            }
          >
            <Plus size={14} aria-hidden="true" />
            {t('rules.field.addModifier')}
          </button>
        )}
      </div>
    </fieldset>
  )
}

/**
 * Tras subir o bajar una fila: el foco, a su mismo botón en su sitio nuevo; si llegó arriba o abajo (y ese botón se
 * desactiva), al otro
 */
export function focusMoved(list: Element | null, rowId: string, delta: -1 | 1) {
  const row = rowId ? document.getElementById(rowId) : null
  const scope = row ?? list
  const same = scope?.querySelector<HTMLButtonElement>(`[data-move="${delta < 0 ? 'up' : 'down'}"]`)
  const other = scope?.querySelector<HTMLButtonElement>(`[data-move="${delta < 0 ? 'down' : 'up'}"]`)
  ;(same && !same.disabled ? same : other)?.focus()
}

/**
 * Un texto que se guarda sin espacios de más (y, con `numeric`, una cifra como cifra) sin comerse los que se van
 * escribiendo: lo escrito se ve tal cual mientras diga lo mismo que lo guardado; si lo guardado cambia por otro lado
 * (deshacer), se ve eso
 */
export function TrimmedText({
  value,
  onValue,
  numeric = false,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string | number | undefined
  onValue: (value: string | number | undefined) => void
  numeric?: boolean
}) {
  const [typed, setTyped] = useState<string | null>(null)
  const parse = (raw: string) => {
    const text = raw.trim()
    return text === '' ? undefined : numeric && /^-?\d+$/.test(text) ? Number(text) : text
  }
  return (
    <input
      {...props}
      value={typed !== null && parse(typed) === value ? typed : String(value ?? '')}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setTyped(raw)
        onValue(parse(raw))
      }}
    />
  )
}
