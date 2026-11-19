/**
 * Los campos de una plantilla, en su panel (ADR-0009), como las propiedades de una página: cada uno con su nombre y su
 * tipo; al abrirlo, su forma (las opciones, a qué plantillas apunta un enlace, los segmentos de un reloj, si va oculto a
 * los jugadores) y para subirlo, bajarlo o quitarlo
 */
import type { PageProperty, RelationRole } from '@crisol/contracts'
import { ChevronDown, ChevronUp, EyeOff, GitFork, Network, Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './editor.module.css'
import { useTemplates } from './picker.tsx'
import { Grip, moved, useReorder } from './reorder.tsx'

/** Cómo se elige el tipo de un campo: los de las propiedades, con el enlace a una sola página aparte */
type FieldKind = 'text' | 'number' | 'boolean' | 'list' | 'page' | 'pages' | 'choice' | 'clock' | 'date'
const KINDS: FieldKind[] = ['text', 'number', 'choice', 'boolean', 'list', 'page', 'pages', 'clock', 'date']

const kindOf = (field: PageProperty): FieldKind => (field.type === 'pages' && field.single ? 'page' : field.type)

/** Los papeles de un campo de enlace (módulo 10): los de Familia y los del Organigrama */
const ROLES: { mode: 'family' | 'org'; roles: RelationRole[] }[] = [
  { mode: 'family', roles: ['parent', 'partner'] },
  { mode: 'org', roles: ['member-of', 'leads'] }
]
const modeOf = (role: RelationRole) => (role === 'parent' || role === 'partner' ? 'family' : 'org')

/** Un id de campo nuevo, con la forma que pide el contrato */
export const newFieldId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (n) => n.toString(16).padStart(2, '0')).join('')

/** El campo con otro tipo: lo de su forma, de cero (o lo que se pueda guardar) */
function retype(field: PageProperty, kind: FieldKind): PageProperty {
  const base = { name: field.name, ...(field.field ? { field: field.field } : {}) }
  switch (kind) {
    case 'text':
      return { ...base, type: 'text', value: '' }
    case 'number':
      return { ...base, type: 'number', value: null }
    case 'boolean':
      return { ...base, type: 'boolean', value: false }
    case 'list':
      return { ...base, type: 'list', value: [] }
    case 'choice':
      return { ...base, type: 'choice', value: '', options: field.type === 'choice' ? field.options : [] }
    case 'clock':
      return { ...base, type: 'clock', value: 0, segments: field.type === 'clock' ? field.segments : 4 }
    // Vacía: los calendarios son de cada mundo
    case 'date':
      return { ...base, type: 'date', value: null }
    case 'page':
    case 'pages': {
      // De una a varias (o al revés), el papel y el nombre al revés se quedan
      const was = field.type === 'pages' ? field : null
      return {
        ...base,
        type: 'pages',
        value: [],
        ...(kind === 'page' ? { single: true } : {}),
        ...(was?.targets ? { targets: was.targets } : {}),
        ...(was?.role ? { role: was.role } : {}),
        ...(was?.inverseName ? { inverseName: was.inverseName } : {})
      }
    }
  }
}

/** Las etiquetas de una página: una lista con este nombre (como en wiki/properties.tsx) */
const TAGS = 'etiquetas'
const isTags = (field: PageProperty) => field.name.trim().toLocaleLowerCase('es') === TAGS

/** La clave de un campo en la lista (su id; los de antes, sin él, su nombre) */
export const fieldKeyOf = (field: PageProperty) => field.field ?? field.name

/**
 * Un campo nuevo desde «Añadir bloque › Propiedad» (de texto) o «› Etiquetas» (la lista de etiquetas, si aún no la
 * tiene; si ya, la suya): los campos y la clave del que se abre
 */
export function withNewField(
  fields: readonly PageProperty[],
  kind: 'tags' | 'property',
  name: string
): { fields: PageProperty[]; key: string } {
  const tags = kind === 'tags' ? fields.find(isTags) : undefined
  if (tags) return { fields: [...fields], key: fieldKeyOf(tags) }
  const field: PageProperty =
    kind === 'tags'
      ? { name: TAGS, field: newFieldId(), type: 'list', value: [] }
      : { name, field: newFieldId(), type: 'text', value: '' }
  return { fields: [...fields, field], key: fieldKeyOf(field) }
}

/**
 * Los campos de la plantilla, en su sitio en el panel, como las propiedades de una página (Enrique, 2026-11-19:
 * unificar el panel de la plantilla con el de una página): sin lista aparte ni «+ Campo» (se añaden con «Añadir bloque ›
 * Propiedad» o «› Etiquetas»), plegados con su nombre y su tipo y, al pulsarlos, sus opciones; se recolocan con sus seis
 * puntos. open: el desplegado (lo lleva el panel, que abre el recién añadido); fresh: el recién añadido, con el foco en
 * su nombre
 */
export function FieldsEditor({
  fields,
  readOnly,
  open,
  fresh,
  onOpen,
  onChange
}: {
  fields: readonly PageProperty[]
  readOnly: boolean
  open: string | null
  fresh?: string | null
  onOpen: (key: string | null) => void
  onChange: (fields: PageProperty[]) => void
}) {
  const { t } = useTranslation()
  const update = (index: number, field: PageProperty) => onChange(fields.map((each, i) => (i === index ? field : each)))
  const reorder = (from: number, to: number) => onChange(moved(fields, from, to))
  const move = (index: number, by: -1 | 1) => reorder(index, index + by)
  const drag = useReorder(reorder)
  if (fields.length === 0) return null
  return (
    <section className={styles.block} aria-label={t('properties.title')} data-properties="">
      <ul className={styles.fields}>
        {fields.map((field, index) => {
          const key = fieldKeyOf(field)
          const expanded = open === key
          return (
            <li key={key} className={styles.field} data-open={expanded || undefined} {...drag.row(index)}>
              {/* Sus seis puntos (arrastrar o Alt y las flechas), su nombre y su tipo; al pulsarlo, su forma */}
              <div className={styles.fieldLine}>
                {!readOnly && (
                  <Grip
                    name={field.name}
                    index={index}
                    count={fields.length}
                    open={expanded}
                    onToggle={() => onOpen(expanded ? null : key)}
                    onMove={reorder}
                    onDragStart={drag.start}
                    onDragEnd={drag.end}
                  />
                )}
                <button
                  type="button"
                  className={styles.fieldRow}
                  aria-expanded={expanded}
                  onClick={() => onOpen(expanded ? null : key)}
                >
                  {field.type === 'pages' && field.role ? (
                    // Con papel: el nombre y, debajo, su tipo; el papel a la derecha (como en el lienzo)
                    <>
                      <span className={styles.fieldStack}>
                        <span className={styles.fieldName}>{field.name}</span>
                        <span className={styles.fieldTypeBelow}>{t(`templateEditor.kinds.${kindOf(field)}`)}</span>
                      </span>
                      <RoleBadge role={field.role} />
                    </>
                  ) : (
                    <>
                      <span className={styles.fieldName}>{field.name}</span>
                      {field.hidden && (
                        <EyeOff size={13} aria-label={t('properties.hidden')} className={styles.hiddenMark} />
                      )}
                      <span className={styles.fieldType}>
                        {field.type === 'clock'
                          ? t('templateEditor.clockOf', { segments: field.segments })
                          : t(`templateEditor.kinds.${kindOf(field)}`)}
                      </span>
                    </>
                  )}
                </button>
              </div>
              {expanded && (
                <FieldShape
                  field={field}
                  readOnly={readOnly}
                  autoFocus={fresh === key}
                  first={index === 0}
                  last={index === fields.length - 1}
                  onChange={(next) => update(index, next)}
                  onMove={(by) => move(index, by)}
                  onRemove={() => onChange(fields.filter((_, i) => i !== index))}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function FieldShape({
  field,
  readOnly,
  autoFocus = false,
  first,
  last,
  onChange,
  onMove,
  onRemove
}: {
  field: PageProperty
  readOnly: boolean
  /** Recién añadido: el foco en su nombre, elegido para escribir encima */
  autoFocus?: boolean
  first: boolean
  last: boolean
  onChange: (field: PageProperty) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const nameId = useId()
  const typeId = useId()
  const optionId = useId()
  const targetId = useId()
  const segmentsId = useId()
  const [name, setName] = useState(field.name)
  const [option, setOption] = useState('')
  const [segmentsText, setSegmentsText] = useState(field.type === 'clock' ? String(field.segments) : '4')
  const templates = useTemplates().data?.templates ?? []
  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== field.name) onChange({ ...field, name: trimmed })
    else setName(field.name)
  }
  return (
    <fieldset className={styles.shape} disabled={readOnly}>
      <legend className={styles.hidden}>{field.name}</legend>
      <label htmlFor={nameId}>{t('templateEditor.name')}</label>
      <input
        id={nameId}
        value={name}
        maxLength={60}
        // biome-ignore lint/a11y/noAutofocus: recién añadido desde «Añadir bloque», se escribe su nombre
        autoFocus={autoFocus}
        onFocus={(event) => {
          if (autoFocus) event.currentTarget.select()
        }}
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <label htmlFor={typeId}>{t('templateEditor.type')}</label>
      <select
        id={typeId}
        value={kindOf(field)}
        onChange={(event) => onChange(retype(field, event.currentTarget.value as FieldKind))}
      >
        {KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`templateEditor.kinds.${kind}`)}
          </option>
        ))}
      </select>
      {field.type === 'choice' && (
        <>
          <span className={styles.label}>{t('templateEditor.options')}</span>
          <div className={styles.chips}>
            {field.options.map((each) => (
              <span key={each} className={styles.chip}>
                {each}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={t('templateEditor.removeOption', { option: each })}
                    onClick={() => onChange({ ...field, options: field.options.filter((o) => o !== each) })}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <>
                <label htmlFor={optionId} className={styles.hidden}>
                  {t('templateEditor.addOption')}
                </label>
                <input
                  id={optionId}
                  className={styles.chipInput}
                  value={option}
                  maxLength={100}
                  placeholder={t('templateEditor.addOption')}
                  onChange={(event) => setOption(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const added = option.trim()
                    if (added && !field.options.includes(added))
                      onChange({ ...field, options: [...field.options, added] })
                    setOption('')
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
      {field.type === 'pages' && (
        <>
          <span className={styles.label}>{t('templateEditor.targets')}</span>
          <div className={styles.chips}>
            {(field.targets ?? []).map((each) => (
              <span key={each} className={styles.chip}>
                {templates.find((template) => template.id === each)?.name ?? each}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={t('templateEditor.removeTarget', {
                      name: templates.find((template) => template.id === each)?.name ?? each
                    })}
                    onClick={() => onChange({ ...field, targets: (field.targets ?? []).filter((o) => o !== each) })}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <>
                <label htmlFor={targetId} className={styles.hidden}>
                  {t('templateEditor.addTarget')}
                </label>
                <select
                  id={targetId}
                  value=""
                  onChange={(event) => {
                    const added = event.currentTarget.value
                    if (added) onChange({ ...field, targets: [...(field.targets ?? []), added] })
                  }}
                >
                  <option value="">{t('templateEditor.addTarget')}</option>
                  {templates
                    .filter((template) => !(field.targets ?? []).includes(template.id))
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                </select>
              </>
            )}
          </div>
        </>
      )}
      {field.type === 'pages' && <RelationShape field={field} readOnly={readOnly} onChange={onChange} />}
      {field.type === 'date' && (
        <>
          <span className={styles.label}>{t('templateEditor.dateOptions')}</span>
          <div className={styles.dateOptions}>
            <label>
              <input
                type="checkbox"
                checked={field.range === true}
                onChange={(event) => {
                  const { range: _was, ...rest } = field
                  onChange(event.currentTarget.checked ? { ...rest, range: true } : rest)
                }}
              />
              {t('templateEditor.range')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={field.offTimeline === true}
                onChange={(event) => {
                  const { offTimeline: _was, ...rest } = field
                  onChange(event.currentTarget.checked ? { ...rest, offTimeline: true } : rest)
                }}
              />
              {t('templateEditor.offTimeline')}
            </label>
          </div>
        </>
      )}
      {field.type === 'clock' && (
        <>
          <label htmlFor={segmentsId}>{t('templateEditor.segments')}</label>
          <input
            id={segmentsId}
            type="number"
            min={2}
            max={12}
            value={segmentsText}
            onChange={(event) => setSegmentsText(event.currentTarget.value)}
            onBlur={() => {
              // De 2 a 12, al salir (así se puede escribir sin que se corrija a cada tecla)
              const segments = Math.min(12, Math.max(2, Math.trunc(Number(segmentsText)) || 2))
              setSegmentsText(String(segments))
              if (segments !== field.segments) onChange({ ...field, segments, value: Math.min(field.value, segments) })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </>
      )}
      {/* Oculto: no les llega a los jugadores aunque vean la página (ADR-0017), como en las propiedades de una página */}
      <div className={styles.dateOptions}>
        <label>
          <input
            type="checkbox"
            checked={field.hidden === true}
            onChange={(event) => {
              const { hidden: _was, ...rest } = field
              onChange(event.currentTarget.checked ? { ...rest, hidden: true } : rest)
            }}
          />
          {t('templateEditor.hidden')}
        </label>
      </div>
      {!readOnly && (
        <div className={styles.shapeActions}>
          <button type="button" disabled={first} onClick={() => onMove(-1)}>
            <ChevronUp size={14} aria-hidden="true" />
            {t('templateEditor.up')}
          </button>
          <button type="button" disabled={last} onClick={() => onMove(1)}>
            <ChevronDown size={14} aria-hidden="true" />
            {t('templateEditor.down')}
          </button>
          <button type="button" className={styles.danger} onClick={onRemove}>
            <Trash2 size={14} aria-hidden="true" />
            {t('templateEditor.removeField')}
          </button>
        </div>
      )}
    </fieldset>
  )
}

/** El papel de un campo, junto a su nombre en la lista: con el dibujo de su modo (Familia u Organigrama) */
function RoleBadge({ role }: { role: RelationRole }) {
  const { t } = useTranslation()
  const Icon = modeOf(role) === 'family' ? GitFork : Network
  return (
    <span className={styles.roleBadge} data-mode={modeOf(role)}>
      <Icon size={12} aria-hidden="true" />
      {t(`templateEditor.roles.${role}`)}
    </span>
  )
}

/**
 * Lo de un campo de enlace en las relaciones (módulo 10): su papel (lo que hace posible el árbol y el organigrama), su
 * nombre al revés y cómo se lee en los dos sentidos
 */
function RelationShape({
  field,
  readOnly,
  onChange
}: {
  field: Extract<PageProperty, { type: 'pages' }>
  readOnly: boolean
  onChange: (field: PageProperty) => void
}) {
  const { t } = useTranslation()
  const roleId = useId()
  const inverseId = useId()
  const [inverse, setInverse] = useState(field.inverseName ?? '')
  const commitInverse = () => {
    const trimmed = inverse.trim()
    if (trimmed === (field.inverseName ?? '')) return setInverse(trimmed)
    const { inverseName: _was, ...rest } = field
    onChange(trimmed ? { ...rest, inverseName: trimmed } : rest)
  }
  const back = inverse.trim() || t('relations.inverseOf', { name: field.name })
  return (
    <>
      <label htmlFor={roleId}>{t('templateEditor.role')}</label>
      <select
        id={roleId}
        value={field.role ?? ''}
        onChange={(event) => {
          const { role: _was, ...rest } = field
          const role = event.currentTarget.value as RelationRole | ''
          // Sin nombre al revés, el de su papel (se puede cambiar o quitar; sin él, «Padres de»)
          const filled = role && !inverse.trim() ? t(`templateEditor.inverseOf.${role}`) : ''
          if (filled) setInverse(filled)
          onChange(role ? { ...rest, role, ...(filled ? { inverseName: filled } : {}) } : rest)
        }}
      >
        <option value="">{t('templateEditor.roles.none')}</option>
        {ROLES.map(({ mode, roles }) => (
          <optgroup key={mode} label={t(`templateEditor.roleModes.${mode}`)}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`templateEditor.roles.${role}`)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <label htmlFor={inverseId}>{t('templateEditor.inverseName')}</label>
      <input
        id={inverseId}
        value={inverse}
        maxLength={60}
        disabled={readOnly}
        placeholder={t('templateEditor.inversePlaceholder', { name: field.name })}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        onChange={(event) => setInverse(event.currentTarget.value)}
        onBlur={commitInverse}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <span className={styles.label}>{t('templateEditor.readsAs')}</span>
      <div className={styles.reads}>
        <p>
          <b className={styles.readSource}>{t('templateEditor.readsSource')}</b>
          <span className={styles.readName}>{field.name}</span>
          <span className={styles.readTarget}>{t('templateEditor.readsTarget')}</span>
        </p>
        <p>
          <b className={styles.readSource}>{t('templateEditor.readsTarget')}</b>
          <span className={styles.readName}>{back}</span>
          <span className={styles.readTarget}>{t('templateEditor.readsSource')}</span>
        </p>
      </div>
    </>
  )
}
