/**
 * Un campo de un tipo, desplegado: su nombre, su clave (fija una vez guardada), su clase y lo de su clase (rango, valor
 * inicial, opciones, la fórmula de un calculado…), su ayuda y si es del máster. Los problemas que tiene, debajo
 */
import type { Context, Field, Problem, SimpleField, System } from '@crisol/systems'
import { textOf } from '@crisol/systems'
import { useId } from 'react'
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

export function FieldEditor({
  fieldKey,
  field,
  fixedKey,
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
  /** Ya guardada: no se cambia */
  fixedKey: boolean
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
        <div>
          <label className={styles.label} htmlFor={`${id}-key`}>
            {t('systemEditor.key')}
          </label>
          <input
            id={`${id}-key`}
            className={styles.input}
            value={fieldKey}
            readOnly={fixedKey}
            disabled={disabled}
            aria-describedby={fixedKey ? `${id}-key-note` : undefined}
            onChange={(event) => onKey(event.currentTarget.value)}
          />
          {fixedKey && (
            <p id={`${id}-key-note`} className={styles.note}>
              {t('systemEditor.keyFixed')}
            </p>
          )}
        </div>
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
            placeholder={t('systemEditor.optional')}
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
            <textarea
              id={`${id}-options`}
              className={styles.input}
              rows={Math.min(8, Math.max(3, field.options.length))}
              value={field.options.map((o) => textOf(o.label)).join('\n')}
              aria-describedby={`${id}-options-hint`}
              disabled={disabled}
              onChange={(event) => {
                const labels = event.currentTarget.value.split('\n')
                const taken: string[] = []
                const options = labels.map((label) => {
                  const known = field.options.find((o) => textOf(o.label) === label)
                  const value = known?.value ?? keyFrom(label || 'opcion', taken)
                  taken.push(value)
                  return { value, label: label || ' ' }
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
            <textarea
              id={`${id}-elements`}
              className={styles.input}
              rows={Math.min(8, Math.max(3, field.elements.length))}
              value={field.elements.map((e) => `${e.key}: ${textOf(e.label)}`).join('\n')}
              aria-describedby={`${id}-elements-hint`}
              disabled={disabled}
              onChange={(event) =>
                set({
                  elements: event.currentTarget.value.split('\n').map((line) => {
                    const [key = '', ...rest] = line.split(':')
                    return { key: key.trim(), label: rest.join(':').trim() || key.trim() || ' ' }
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
