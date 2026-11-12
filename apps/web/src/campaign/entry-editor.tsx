/**
 * Cambiar el compendio en la app (ADR-0015): crear, cambiar y borrar sus entradas (el nombre, los campos de su tipo y
 * su texto), en un sistema de la cuenta (su propietario) o en el compendio del mundo (quien lo lleva,
 * docs/specs/compendio-mundo.md). Su mecánica sigue siendo cosa de la IA
 */
import { type Language, TABLE_TYPE, type TableEntry, type Text, textOf } from '@crisol/systems'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import formStyles from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import styles from './entry-editor.module.css'
import { emptyTable, TableRowsField, tableErrors } from './entry-table.tsx'

type Compendium = ActionOutput<'getCampaignCompendium'>
export type Editable = NonNullable<Compendium['editable']>
type EditableType = Editable['types'][number]

/** Dónde se escribe: el sistema de la cuenta (con su versión) o el compendio del mundo */
export type EntryTarget =
  | { layer: 'system'; systemId: string; version: number; types: EditableType[] }
  | { layer: 'world'; worldId: string; systemId: string; types: EditableType[] }
type Item = ActionOutput<'getCampaignContent'>['items'][number]
type Value = string | boolean | string[]

/** Un texto en el idioma de la campaña: si ya era de dos idiomas, se cambia solo el suyo */
function withText(old: unknown, value: string, language: Language): unknown {
  if (typeof old === 'string') return value
  return { ...((old as Record<string, string> | undefined) ?? {}), [language]: value }
}

/** Lo que se ve al abrirlo: cada campo como se escribe */
function initialValue(field: EditableType['fields'][number], value: unknown, language: Language): Value {
  if (field.kind === 'boolean') return value === true
  if (field.kind === 'list') {
    const list = Array.isArray(value) ? value.map(String) : []
    return field.options ? list : list.join(', ')
  }
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return textOf(value as Text, language)
  return String(value)
}

/** Una clave nueva a partir del nombre: sin tildes ni espacios, y con algo al azar para no pisar otra */
export function keyFor(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${slug || 'entrada'}-${Math.random().toString(36).slice(2, 6)}`
}

/** Los datos de la entrada con lo escrito: lo vacío se quita */
export function dataWith(
  type: EditableType,
  old: Record<string, unknown>,
  written: { name: string; values: Record<string, Value>; text: string },
  language: Language
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...old, name: withText(old.name, written.name.trim(), language) }
  for (const field of type.fields) {
    const value = written.values[field.key]
    if (value === undefined) continue
    if (field.kind === 'boolean') data[field.key] = value === true
    else if (field.kind === 'list') {
      const list = Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((each) => each.trim())
            .filter(Boolean)
      if (list.length > 0) data[field.key] = list
      else delete data[field.key]
    } else if (value === '') delete data[field.key]
    else if (field.kind === 'number') data[field.key] = Number(value)
    else if (field.kind === 'text') data[field.key] = withText(old[field.key], String(value), language)
    else data[field.key] = value
  }
  if (type.text) {
    if (written.text.trim()) data[type.text] = withText(old[type.text], written.text, language)
    else delete data[type.text]
  }
  return data
}

export function EntryEditor({
  campaignId,
  targets,
  language,
  item,
  source = null,
  onSaved,
  onClose
}: {
  campaignId: string
  /** El libro de una nueva (en el sistema, el que se está viendo): sin él, sin libro */
  source?: string | null
  /** Dónde se puede escribir (la primera, de entrada); al cambiar una que ya está, solo la suya */
  targets: EntryTarget[]
  language: Language
  /** La que se cambia; sin ella, una nueva */
  item: Item | null
  onSaved: (key: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const typeId = useId()
  const whereId = useId()
  const textId = useId()
  const [where, setWhere] = useState(0)
  const target = targets[where] ?? targets[0]
  const types = target?.types ?? []
  const [typeKey, setTypeKey] = useState(item?.type ?? types[0]?.key ?? '')
  const type = types.find((each) => each.key === typeKey)
  const [name, setName] = useState(item ? textOf(item.data.name as Text, language) : '')
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(
      (types.find((each) => each.key === item?.type)?.fields ?? []).map((field) => [
        field.key,
        initialValue(field, item?.data[field.key], language)
      ])
    )
  )
  const [text, setText] = useState(() => {
    const field = types.find((each) => each.key === item?.type)?.text
    return field ? textOf(item?.data[field] as Text | undefined, language) : ''
  })
  // Una tabla: sus filas (si la entrada no las tenía, una para empezar)
  const [table, setTableState] = useState<TableEntry>(() => item?.table ?? emptyTable())
  // Una «Tabla» de antes (su tabla, en el texto) no gana filas si no se tocan
  const [tableTouched, setTableTouched] = useState(false)
  const setTable = (next: TableEntry) => {
    setTableState(next)
    setTableTouched(true)
  }
  const sendTable = !item || Boolean(item.table) || tableTouched
  const blocked = typeKey === TABLE_TYPE && sendTable && tableErrors(table).length > 0
  const save = useMutation({
    mutationFn: async () => {
      if (!type || !target) throw new Error('sin tipo')
      const key = item?.key ?? keyFor(name)
      const data = dataWith(type, item?.data ?? {}, { name, values, text }, language)
      const kept = {
        type: type.key,
        key,
        ...(item?.concept ? { concept: item.concept } : {}),
        data,
        ...(item?.mechanics ? { mechanics: item.mechanics } : {}),
        ...(item?.ref ? { ref: item.ref } : {}),
        ...(item?.img ? { img: item.img } : {}),
        ...(type.key === TABLE_TYPE && sendTable
          ? {
              table: {
                ...(table.formula?.trim() ? { formula: table.formula.trim() } : {}),
                ...(table.replacement === false ? { replacement: false } : {}),
                rows: table.rows
              }
            }
          : {})
      }
      if (target.layer === 'world')
        await api.call('putWorldContent', {
          worldId: target.worldId,
          systemId: target.systemId,
          items: [{ ...kept, ...(item?.world ? { version: item.world.version } : {}) }]
        })
      else
        await api.call('putSystemContent', {
          systemId: target.systemId,
          version: target.version,
          items: [{ ...kept, source: item ? (item.source ?? null) : source }]
        })
      return key
    },
    onSuccess: async (key) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['compendium', campaignId] }),
        // Lo que trae cada libro (su cuenta, en el Inicio del sistema)
        ...(target?.layer === 'system'
          ? [client.invalidateQueries({ queryKey: ['systemBooks', target.systemId] })]
          : [])
      ])
      onSaved(key)
      dialog.current?.close()
    }
  })
  const set = (key: string, value: Value) => setValues((all) => ({ ...all, [key]: value }))
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <h2 id={titleId}>{item ? t('compendium.editTitle', { name }) : t('compendium.newTitle')}</h2>
        {!item && targets.length > 1 && (
          <div className={formStyles.field}>
            <label htmlFor={whereId}>{t('compendium.where')}</label>
            <select
              id={whereId}
              value={where}
              onChange={(event) => {
                const next = Number(event.currentTarget.value)
                setWhere(next)
                // El tipo, si el otro sitio no lo tiene, el primero suyo
                const kinds = targets[next]?.types ?? []
                if (!kinds.some((each) => each.key === typeKey)) {
                  setTypeKey(kinds[0]?.key ?? '')
                  setValues({})
                }
              }}
            >
              {targets.map((each, i) => (
                <option key={each.layer} value={i}>
                  {each.layer === 'world' ? t('compendium.whereWorld') : t('compendium.whereSystem')}
                </option>
              ))}
            </select>
          </div>
        )}
        {!item && (
          <div className={formStyles.field}>
            <label htmlFor={typeId}>{t('compendium.type')}</label>
            <select
              id={typeId}
              value={typeKey}
              onChange={(event) => {
                setTypeKey(event.currentTarget.value)
                setValues({})
              }}
            >
              {types.map((each) => (
                <option key={each.key} value={each.key}>
                  {each.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <Field
          label={t('compendium.name')}
          value={name}
          required
          maxLength={200}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          data-autofocus=""
          onChange={(event) => setName(event.currentTarget.value)}
        />
        {type && type.fields.length > 0 && (
          <div className={styles.fields}>
            {type.fields.map((field) => (
              <FieldInput
                key={`${type.key}-${field.key}`}
                field={field}
                value={values[field.key] ?? initialValue(field, undefined, language)}
                onChange={(value) => set(field.key, value)}
              />
            ))}
          </div>
        )}
        {type?.text && (
          <div className={formStyles.field}>
            <label htmlFor={textId}>{t('compendium.text')}</label>
            <textarea
              id={textId}
              className={styles.text}
              rows={type.key === TABLE_TYPE ? 4 : 12}
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
            />
          </div>
        )}
        {type?.key === TABLE_TYPE && <TableRowsField table={table} onChange={setTable} />}
        <FormError message={save.error ? errorText(save.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={formStyles.button} busy={save.isPending} disabled={blocked}>
            {t('compendium.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('compendium.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Un campo de su tipo, según su clase: número, sí o no, una opción, varias o texto */
function FieldInput({
  field,
  value,
  onChange
}: {
  field: EditableType['fields'][number]
  value: Value
  onChange: (value: Value) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  if (field.kind === 'boolean')
    return (
      <label className={styles.check}>
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.currentTarget.checked)} />
        {field.label}
      </label>
    )
  if (field.kind === 'list' && field.options) {
    const chosen = Array.isArray(value) ? value : []
    return (
      <fieldset className={styles.group}>
        <legend>{field.label}</legend>
        {field.options.map((option) => (
          <label key={option.value} className={styles.check}>
            <input
              type="checkbox"
              checked={chosen.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...chosen, option.value]
                    : chosen.filter((each) => each !== option.value)
                )
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    )
  }
  if (field.kind === 'choice' && field.options)
    return (
      <div className={formStyles.field}>
        <label htmlFor={id}>{field.label}</label>
        <select id={id} value={String(value)} onChange={(event) => onChange(event.currentTarget.value)}>
          <option value="">{t('compendium.noValue')}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  return (
    <Field
      label={field.label}
      type={field.kind === 'number' ? 'number' : 'text'}
      step={field.kind === 'number' ? 'any' : undefined}
      value={String(value)}
      hint={field.kind === 'list' ? t('compendium.listHint') : undefined}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

/** Borrar una entrada: se pregunta antes */
export function DeleteEntry({
  campaignId,
  target,
  item,
  name,
  onDeleted,
  onClose
}: {
  campaignId: string
  target: EntryTarget
  item: Item
  name: string
  onDeleted: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const remove = useMutation({
    mutationFn: () =>
      target.layer === 'world'
        ? api.call('deleteWorldContent', { worldId: target.worldId, systemId: target.systemId, keys: [item.key] })
        : api.call('deleteSystemContent', { systemId: target.systemId, version: target.version, keys: [item.key] }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['compendium', campaignId] })
      onDeleted()
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('compendium.deleteTitle', { name })}</h2>
        <p className={dialogStyles.description}>
          {target.layer === 'world' ? t('compendium.deleteWorldText') : t('compendium.deleteText')}
        </p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton
            className={formStyles.button}
            busy={remove.isPending}
            data-autofocus=""
            onClick={() => remove.mutate()}
          >
            {t('compendium.delete')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('compendium.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
