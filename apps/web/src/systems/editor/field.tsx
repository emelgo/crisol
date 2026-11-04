/**
 * Un campo de un tipo, desplegado: su nombre, su clave (fija una vez guardada), su clase y lo de su clase (rango, valor
 * inicial, opciones, la fórmula de un calculado…), su ayuda y si es del máster. Los problemas que tiene, debajo
 */
import type { Context, Field, Problem, SimpleField, System } from '@crisol/systems'
import { textOf } from '@crisol/systems'
import { type ComponentProps, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProblemList } from '../screen.tsx'
import styles from './editor.module.css'
import { FormulaInput } from './formula-input.tsx'

export const FIELD_KINDS = [
  'number',
  'text',
  'boolean',
  'choice',
  'resource',
  'dice',
  'clock',
  'list',
  'link',
  'derived',
  'group',
  'set',
  'table',
  'items'
] as const satisfies readonly Field['kind'][]

/** Un campo nuevo de esa clase, con lo que esa clase pide */
export function blankField(kind: Field['kind'], label: string, types: System['types']): Field {
  const firstItem = Object.entries(types).find(([, t]) => t.document === 'item')?.[0]
  const firstType = Object.keys(types)[0] ?? 'personaje'
  switch (kind) {
    case 'choice':
      return { kind, label, options: [{ value: 'una', label: 'Una' }] }
    case 'clock':
      return { kind, label, segments: 4 }
    case 'derived':
      return { kind, label, formula: '0' }
    case 'link':
      return { kind, label, to: firstType }
    case 'items':
      return { kind, label, of: firstItem ? [firstItem] : [] }
    case 'group':
      return { kind, label, fields: {} }
    case 'table':
      return { kind, label, columns: { nombre: { kind: 'text', label: 'Nombre' } } }
    case 'set':
      return {
        kind,
        label,
        elements: [{ key: 'uno', label: 'Uno' }],
        fields: { valor: { kind: 'number', label: 'Valor' } }
      }
    default:
      return { kind, label } as Field
  }
}

/** Cambia la clave de una entrada sin moverla de su sitio (el orden de los campos es el de la hoja) */
export function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
}

/** Una clave a partir de un nombre: en minúsculas, sin tildes ni espacios, que no esté ya */
export function keyFrom(label: string, taken: Iterable<string>) {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([^a-z])/, 'x$1')
      .slice(0, 50) || 'campo'
  const used = new Set(taken)
  let key = base
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`
  return key
}

const num = (value: string) => (value.trim() === '' ? undefined : Number(value))

/**
 * La clave de algo (un campo, un tipo, una tirada): se elige hasta guardarlo; después, fija (la usan las fórmulas, las
 * campañas y las hojas). Una que ya existe no se aplica (pisaría la otra): lo dice debajo, y al salir vuelve a la suya
 */
export function KeyField({
  id,
  value,
  fixed,
  taken,
  onChange,
  disabled
}: {
  id: string
  value: string
  fixed: boolean
  /** Si otra ya tiene esa clave */
  taken: (key: string) => boolean
  onChange: (key: string) => void
  disabled?: boolean | undefined
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  const clash = text !== value && taken(text)
  // Si cambia por otro lado (Cancelar, otra pestaña), lo escrito sigue a lo de verdad
  if (seen !== value) {
    setSeen(value)
    if (!clash) setText(value)
  }
  const described = clash ? `${id}-clash` : fixed ? `${id}-note` : undefined
  return (
    <div>
      <label className={styles.label} htmlFor={id}>
        {t('systemEditor.key')}
      </label>
      <input
        id={id}
        className={`${styles.input} ${styles.mono}`}
        value={text}
        readOnly={fixed}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={clash || undefined}
        aria-describedby={described}
        onChange={(event) => {
          const next = event.currentTarget.value
          setText(next)
          if (next !== value && !taken(next)) onChange(next)
        }}
        onBlur={() => setText(value)}
      />
      {clash && (
        <p id={`${id}-clash`} className={styles.explainBad}>
          {t('systemEditor.keyTaken')}
        </p>
      )}
      {fixed && (
        <p id={`${id}-note`} className={styles.hidden}>
          {t('systemEditor.keyFixed')}
        </p>
      )}
    </div>
  )
}

/**
 * Un número que se escribe: lo escrito se ve tal cual (vacío o a medias, como «-») y solo pasa cuando es un número;
 * al salir, vuelve al de verdad
 */
export function NumberText({
  value,
  onValue,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: number; onValue: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (Number(text) !== value) setText(String(value))
  }
  return (
    <input
      {...props}
      type="number"
      value={text}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setText(raw)
        const n = Number(raw)
        if (raw.trim() !== '' && Number.isFinite(n)) onValue(n)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

/**
 * Un texto de una línea por cosa (las opciones, los elementos): mientras se escribe se ve tal cual (sin que el cursor
 * salte ni se coma lo escrito) y cada cambio pasa ya leído; al salir, se ve como quedó
 */
export function LinesInput({
  lines,
  onLines,
  ...props
}: Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'onFocus' | 'onBlur'> & {
  lines: readonly string[]
  onLines: (lines: string[]) => void
}) {
  const joined = lines.join('\n')
  const [text, setText] = useState(joined)
  const [focused, setFocused] = useState(false)
  if (!focused && text !== joined) setText(joined)
  return (
    <textarea
      {...props}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setText(raw)
        onLines(
          raw
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        )
      }}
    />
  )
}

export function FieldEditor({
  fieldKey,
  field,
  saved,
  taken,
  onKey,
  onChange,
  onRemove,
  usedBy,
  system,
  context,
  problems,
  disabled
}: {
  fieldKey: string
  field: Field | SimpleField
  /** Cómo está guardado (si lo está): su clave ya no cambia, ni los valores de sus opciones */
  saved: Field | SimpleField | undefined
  /** Si otro campo ya tiene esa clave */
  taken: (key: string) => boolean
  onKey: (key: string) => void
  onChange: (field: Field) => void
  onRemove: () => void
  /** Dónde se usa (sus fórmulas): quitarlo avisa */
  usedBy: string[]
  system: System
  context: Context
  problems: Problem[]
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const set = (patch: Record<string, unknown>) => onChange({ ...field, ...patch } as Field)
  const typeOptions = Object.entries(system.types).map(([key, type]) => ({
    key,
    label: textOf(type.label) || key,
    document: type.document
  }))
  return (
    <div className={styles.fieldEditor}>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label} htmlFor={`${id}-name`}>
            {t('systemEditor.name')}
          </label>
          <input
            id={`${id}-name`}
            className={styles.input}
            value={textOf(field.label)}
            disabled={disabled}
            onChange={(event) => set({ label: event.currentTarget.value })}
          />
        </div>
        <KeyField
          id={`${id}-key`}
          value={fieldKey}
          fixed={Boolean(saved)}
          taken={taken}
          disabled={disabled}
          onChange={onKey}
        />
        <div>
          <label className={styles.label} htmlFor={`${id}-kind`}>
            {t('systemEditor.fieldKind')}
          </label>
          <select
            id={`${id}-kind`}
            className={styles.input}
            value={field.kind}
            disabled={disabled}
            onChange={(event) =>
              onChange(blankField(event.currentTarget.value as Field['kind'], textOf(field.label), system.types))
            }
          >
            {FIELD_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`systemEditor.kinds.${kind}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-help`}>
            {t('systemEditor.help')}
          </label>
          <input
            id={`${id}-help`}
            className={styles.input}
            value={textOf(field.help)}
            disabled={disabled}
            onChange={(event) => set({ help: event.currentTarget.value || undefined })}
          />
        </div>

        {field.kind === 'number' && (
          <>
            <NumberInput
              id={`${id}-min`}
              label={t('systemEditor.min')}
              value={field.min}
              disabled={disabled}
              onChange={(min) => set({ min })}
            />
            <NumberInput
              id={`${id}-max`}
              label={t('systemEditor.max')}
              value={field.max}
              disabled={disabled}
              onChange={(max) => set({ max })}
            />
            <NumberInput
              id={`${id}-default`}
              label={t('systemEditor.default')}
              value={field.default}
              disabled={disabled}
              onChange={(value) => set({ default: value })}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={field.integer === true}
                disabled={disabled}
                onChange={(event) => set({ integer: event.currentTarget.checked || undefined })}
              />
              {t('systemEditor.integer')}
            </label>
          </>
        )}
        {field.kind === 'text' && (
          <NumberInput
            id={`${id}-maxlen`}
            label={t('systemEditor.maxLength')}
            value={field.max}
            disabled={disabled}
            onChange={(max) => set({ max })}
          />
        )}
        {field.kind === 'clock' && (
          <NumberInput
            id={`${id}-segments`}
            label={t('systemEditor.segments')}
            value={field.segments}
            disabled={disabled}
            onChange={(segments) => set({ segments: segments ?? 4 })}
          />
        )}
        {field.kind === 'resource' && (
          <div className={styles.full}>
            <label className={styles.label} htmlFor={`${id}-rmax`}>
              {t('systemEditor.maxFormula')}
            </label>
            <input
              id={`${id}-rmax`}
              className={styles.input}
              value={field.max === undefined ? '' : String(field.max)}
              disabled={disabled}
              onChange={(event) => {
                const text = event.currentTarget.value
                set({ max: text.trim() === '' ? undefined : /^-?\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : text })
              }}
            />
          </div>
        )}
        {field.kind === 'dice' && (
          <div className={styles.full}>
            <label className={styles.label} htmlFor={`${id}-dice`}>
              {t('systemEditor.default')}
            </label>
            <input
              id={`${id}-dice`}
              className={styles.input}
              value={field.default ?? ''}
              disabled={disabled}
              onChange={(event) => set({ default: event.currentTarget.value || undefined })}
            />
          </div>
        )}
        {field.kind === 'choice' && (
          <div className={styles.full}>
            <label className={styles.label} htmlFor={`${id}-options`}>
              {t('systemEditor.options')}
            </label>
            <LinesInput
              id={`${id}-options`}
              className={styles.input}
              rows={Math.min(8, Math.max(3, field.options.length))}
              lines={field.options.map((o) => textOf(o.label))}
              aria-describedby={`${id}-options-hint`}
              disabled={disabled}
              onLines={(labels) => {
                // El valor de una opción guardada no cambia (lo usan los documentos); el de una nueva sale de su nombre
                const fixed = new Set(saved?.kind === 'choice' ? saved.options.map((o) => o.value) : [])
                const taken: string[] = []
                const options = labels.map((label, i) => {
                  const before = field.options[i]?.value
                  const value = before && fixed.has(before) ? before : keyFrom(label, taken)
                  taken.push(value)
                  return { value, label }
                })
                set({ options })
              }}
            />
            <p id={`${id}-options-hint`} className={styles.note}>
              {t('systemEditor.optionsHint')}
            </p>
          </div>
        )}
        {field.kind === 'link' && (
          <div>
            <label className={styles.label} htmlFor={`${id}-to`}>
              {t('systemEditor.linkTo')}
            </label>
            <select
              id={`${id}-to`}
              className={styles.input}
              value={field.to}
              disabled={disabled}
              onChange={(event) => set({ to: event.currentTarget.value })}
            >
              {typeOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {field.kind === 'items' && (
          <fieldset className={`${styles.full} ${styles.checks}`} disabled={disabled}>
            <legend className={styles.label}>{t('systemEditor.itemsOf')}</legend>
            {typeOptions
              .filter((o) => o.document === 'item')
              .map((o) => (
                <label key={o.key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={field.of.includes(o.key)}
                    onChange={(event) =>
                      set({
                        of: event.currentTarget.checked ? [...field.of, o.key] : field.of.filter((k) => k !== o.key)
                      })
                    }
                  />
                  {o.label}
                </label>
              ))}
          </fieldset>
        )}
        {field.kind === 'set' && (
          <div className={styles.full}>
            <label className={styles.label} htmlFor={`${id}-elements`}>
              {t('systemEditor.elements')}
            </label>
            <LinesInput
              id={`${id}-elements`}
              className={styles.input}
              rows={Math.min(8, Math.max(3, field.elements.length))}
              lines={field.elements.map((e) => `${e.key}: ${textOf(e.label)}`)}
              aria-describedby={`${id}-elements-hint`}
              disabled={disabled}
              onLines={(lines) =>
                set({
                  elements: lines.map((line) => {
                    const [key = '', ...rest] = line.split(':')
                    return { key: key.trim(), label: rest.join(':').trim() || key.trim() }
                  })
                })
              }
            />
            <p id={`${id}-elements-hint`} className={styles.note}>
              {t('systemEditor.elementsHint')}
            </p>
          </div>
        )}
        {field.kind === 'derived' && (
          <div className={styles.full}>
            <FormulaInput
              id={`${id}-formula`}
              label={t('systemEditor.formula')}
              value={field.formula}
              context={context}
              disabled={disabled}
              onChange={(formula) => set({ formula })}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={field.signed === true}
                disabled={disabled}
                onChange={(event) => set({ signed: event.currentTarget.checked || undefined })}
              />
              {t('systemEditor.signed')}
            </label>
          </div>
        )}
        <label className={`${styles.check} ${styles.full}`}>
          <input
            type="checkbox"
            checked={field.master === true}
            disabled={disabled}
            onChange={(event) => set({ master: event.currentTarget.checked || undefined })}
          />
          {t('systemEditor.master')}
        </label>
      </div>
      {problems.length > 0 && <ProblemList problems={problems} />}
      {!disabled && (
        <div className={styles.fieldFoot}>
          {usedBy.length > 0 && (
            <span className={styles.note}>{t('systemEditor.usedBy', { where: usedBy.join(', ') })}</span>
          )}
          <button type="button" className={styles.danger} onClick={onRemove}>
            {t('systemEditor.removeField')}
          </button>
        </div>
      )}
    </div>
  )
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  disabled
}: {
  id: string
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean | undefined
}) {
  return (
    <div>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="number"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(num(event.currentTarget.value))}
      />
    </div>
  )
}
