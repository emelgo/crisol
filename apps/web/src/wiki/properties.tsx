import type { Page, PageProperty } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import styles from './properties.module.css'
import tagStyles from './tags.module.css'
import { TagsField, tagDot, useTagColor } from './tags.tsx'

/** La propiedad de las etiquetas */
const isTagsName = (name: string) => name.trim().toLocaleLowerCase('es') === 'etiquetas'

type PropertyType = PageProperty['type']
const TYPES: PropertyType[] = ['text', 'number', 'boolean', 'list', 'pages']
/** Las reservadas, con su tipo: se ofrecen para añadirlas de un clic */
const RESERVED = [
  { name: 'alias', type: 'list' },
  { name: 'etiquetas', type: 'list' },
  { name: 'resumen', type: 'text' }
] as const

/** Los títulos de las páginas de la wiki por su id (para las propiedades que enlazan páginas) */
function usePageTitles(worldId: string) {
  const api = useApi()
  const tree = useQuery({
    queryKey: ['pages', worldId, 'tree', 6],
    queryFn: () => api.call('listPageTree', { worldId, levels: 6 })
  })
  return tree.data?.pages ?? []
}

/** Una propiedad mientras se edita: los textos tal como se escriben, y su valor se saca al guardar */
interface Draft {
  key: string
  name: string
  type: PropertyType
  text: string
  checked: boolean
  pages: string[]
  /** Las etiquetas escritas aún sin poner: van con las demás al guardar */
  pending?: string
}

const toDraft = (property: PageProperty): Draft => ({
  key: crypto.randomUUID(),
  name: property.name,
  type: property.type,
  text:
    property.type === 'list'
      ? property.value.join(', ')
      : property.type === 'text' || property.type === 'number'
        ? String(property.value)
        : '',
  checked: property.type === 'boolean' ? property.value : false,
  pages: property.type === 'pages' ? property.value : []
})

/** La propiedad que sale de un borrador, o null si su valor no se puede leer (un número que no lo es) */
function fromDraft(draft: Draft): PageProperty | null {
  const name = draft.name.trim()
  switch (draft.type) {
    case 'text':
      return { name, type: 'text', value: draft.text }
    case 'number': {
      const value = Number(draft.text.replace(',', '.'))
      return draft.text.trim() !== '' && Number.isFinite(value) ? { name, type: 'number', value } : null
    }
    case 'boolean':
      return { name, type: 'boolean', value: draft.checked }
    case 'list':
      return {
        name,
        type: 'list',
        value: [
          ...draft.text.split(','),
          ...(draft.pending ?? '').split(',').map((item) => item.replace(/\s/g, '').replace(/^#/, ''))
        ]
          .map((item) => item.trim())
          .filter((item, i, all) => item && all.indexOf(item) === i)
      }
    case 'pages':
      return { name, type: 'pages', value: draft.pages }
  }
}

/** El valor de una propiedad, para leer */
function PropertyValue({ property, worldId }: { property: PageProperty; worldId: string }) {
  const { t } = useTranslation()
  const titles = usePageTitles(worldId)
  const colorOf = useTagColor()
  switch (property.type) {
    case 'number':
      return <>{property.value.toLocaleString('es')}</>
    case 'boolean':
      return <>{t(property.value ? 'properties.yes' : 'properties.no')}</>
    case 'list':
      // Las etiquetas, con su color, llevan a buscar las páginas que la llevan
      if (isTagsName(property.name)) {
        return (
          <ul className={tagStyles.chips}>
            {property.value.map((tag) => (
              <li key={tag}>
                <Link
                  to="/mundos/$worldId/buscar"
                  params={{ worldId }}
                  search={{ etiqueta: tag }}
                  className={`${tagStyles.chip} ${tagStyles.chipLink}`}
                  style={tagDot(colorOf(tag))}
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )
      }
      return (
        <ul className={styles.chips}>
          {property.value.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'pages':
      return (
        <ul className={styles.chips}>
          {property.value.map((id) => (
            <li key={id}>
              <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: id }}>
                {titles.find((p) => p.id === id)?.title ?? t('properties.unknownPage')}
              </Link>
            </li>
          ))}
        </ul>
      )
    default:
      return <>{property.value}</>
  }
}

/**
 * Las propiedades de la página abierta, siempre editables en el sitio (como en el Crisol antiguo): tocar un nombre o
 * un valor lo cambia; Intro o salir del campo lo guarda, Escape lo deshace. Sin «Guardar» ni «Cancelar». Con la página
 * bloqueada, solo se leen
 */
export function PageProperties({ page }: { page: Page }) {
  const { t } = useTranslation()
  if (page.locked) {
    if (page.properties.length === 0) return null
    return (
      <section aria-label={t('properties.title')} className={styles.properties}>
        <dl className={styles.list}>
          {page.properties.map((property) => (
            <div key={property.name} className={styles.row}>
              <dt>{property.name}</dt>
              <dd>
                <PropertyValue property={property} worldId={page.worldId} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }
  return <InlineProperties page={page} />
}

const sameProperties = (a: readonly PageProperty[], b: readonly PageProperty[]) =>
  JSON.stringify(a) === JSON.stringify(b)

function InlineProperties({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const box = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<Draft[]>(() => page.properties.map(toDraft))
  const [invalid, setInvalid] = useState<string | null>(null)
  // La fila recién añadida, para llevarle el foco (al nombre, o al valor si ya lo trae)
  const [fresh, setFresh] = useState<{ key: string; to: 'name' | 'value' } | null>(null)
  const save = useMutation({
    mutationFn: (properties: PageProperty[]) => api.call('setPageProperties', { pageId: page.id, properties }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  // Lo que llega de fuera (otra pestaña, la IA) entra si no se está escribiendo aquí
  useEffect(() => {
    if (!box.current?.contains(document.activeElement)) setRows(page.properties.map(toDraft))
  }, [page.properties])
  const commit = (next: Draft[]) => {
    setRows(next)
    const properties = next.filter((row) => row.name.trim()).map(fromDraft)
    const broken = properties.indexOf(null)
    if (broken >= 0) {
      setInvalid(t('properties.badNumber', { name: next.filter((row) => row.name.trim())[broken]?.name ?? '' }))
      return
    }
    setInvalid(null)
    const valid = properties.filter((property): property is PageProperty => property !== null)
    if (!sameProperties(valid, page.properties)) save.mutate(valid)
  }
  const change = (key: string, patch: Partial<Draft>, now = false) => {
    const next = rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    if (now) commit(next)
    else setRows(next)
  }
  const add = (name = '', type: PropertyType = 'text') => {
    const row: Draft = { key: crypto.randomUUID(), name, type, text: '', checked: false, pages: [] }
    setRows([...rows, row])
    setFresh({ key: row.key, to: name ? 'value' : 'name' })
  }
  const move = (index: number, by: -1 | 1) => {
    const target = index + by
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(target, 0, moved)
    commit(next)
  }
  const present = new Set(rows.map((row) => row.name.trim().toLocaleLowerCase('es')))
  return (
    <section ref={box} aria-label={t('properties.title')} className={styles.properties}>
      {rows.length > 0 && (
        <div className={styles.table}>
          {rows.map((row, index) => (
            <PropertyRow
              key={row.key}
              row={row}
              n={index + 1}
              worldId={page.worldId}
              focus={fresh?.key === row.key ? fresh.to : null}
              onFocused={() => setFresh(null)}
              onChange={(patch, now) => change(row.key, patch, now)}
              onCommit={() => commit(rows)}
              onRevert={() => {
                const saved = page.properties.find((property) => property.name === row.name)
                change(row.key, saved ? { ...toDraft(saved), key: row.key } : { text: '', pending: '' })
              }}
              onMove={(by) => move(index, by)}
              onRemove={() => commit(rows.filter((other) => other.key !== row.key))}
            />
          ))}
        </div>
      )}
      <div className={styles.adders}>
        <button type="button" className={styles.addButton} onClick={() => add()}>
          {t('properties.addOne')}
        </button>
        {RESERVED.filter((reserved) => !present.has(reserved.name)).map((reserved) => (
          <button
            key={reserved.name}
            type="button"
            className={styles.addButton}
            onClick={() => add(reserved.name, reserved.type)}
          >
            {t(`properties.reserved.${reserved.name}`)}
          </button>
        ))}
      </div>
      <FormError message={invalid ?? (save.error ? errorText(save.error) : null)} />
    </section>
  )
}

/** Una fila: su nombre, su tipo (discreto) y su valor, que se cambian ahí mismo; y su ×, al acercarse */
function PropertyRow({
  row,
  n,
  worldId,
  focus,
  onFocused,
  onChange,
  onCommit,
  onRevert,
  onMove,
  onRemove
}: {
  row: Draft
  n: number
  worldId: string
  focus: 'name' | 'value' | null
  onFocused: () => void
  /** now: guardar ya (lo que no se escribe letra a letra: un tipo, una casilla, una etiqueta) */
  onChange: (patch: Partial<Draft>, now?: boolean) => void
  onCommit: () => void
  onRevert: () => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const nameInput = useRef<HTMLInputElement>(null)
  const label = row.name.trim() || t('properties.numbered', { n })
  useEffect(() => {
    if (!focus) return
    const target = focus === 'name' ? nameInput.current : document.getElementById(`${id}-valor`)
    target?.focus()
    onFocused()
  }, [focus, id, onFocused])
  // Intro guarda (y del nombre pasa al valor); Escape deshace; Alt+flechas la mueven
  const keys = (event: KeyboardEvent<HTMLElement>, toValue = false) => {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      onMove(event.key === 'ArrowUp' ? -1 : 1)
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onCommit()
      if (toValue) document.getElementById(`${id}-valor`)?.focus()
      else (event.currentTarget as HTMLElement).blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onRevert()
    }
  }
  return (
    <div className={styles.prop} data-type={row.type}>
      <div className={styles.propName}>
        <input
          ref={nameInput}
          className={styles.nameInput}
          aria-label={t('properties.name', { n })}
          value={row.name}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('properties.namePlaceholder')}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={onCommit}
          onKeyDown={(event) => keys(event, true)}
        />
      </div>
      <div className={styles.propValue}>
        <ValueField row={row} id={id} n={n} worldId={worldId} onChange={onChange} onCommit={onCommit} keys={keys} />
      </div>
      <select
        className={styles.typeSelect}
        aria-label={t('properties.type', { n })}
        title={t('properties.type', { n })}
        value={row.type}
        onChange={(event) => onChange({ type: event.target.value as PropertyType }, true)}
      >
        {TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`properties.types.${type}`)}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={styles.removeProp}
        aria-label={t('properties.remove', { name: label })}
        title={t('properties.remove', { name: label })}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

function ValueField({
  row,
  id,
  n,
  worldId,
  onChange,
  onCommit,
  keys
}: {
  row: Draft
  id: string
  n: number
  worldId: string
  onChange: (patch: Partial<Draft>, now?: boolean) => void
  onCommit: () => void
  keys: (event: KeyboardEvent<HTMLElement>) => void
}) {
  const { t } = useTranslation()
  const titles = usePageTitles(worldId)
  const [choice, setChoice] = useState('')
  const valueId = `${id}-valor`
  const label = t('properties.value', { n })
  switch (row.type) {
    case 'boolean':
      return (
        <label className={styles.check}>
          <input
            id={valueId}
            type="checkbox"
            aria-label={label}
            checked={row.checked}
            onChange={(event) => onChange({ checked: event.target.checked }, true)}
          />
          <span aria-hidden="true">{t(row.checked ? 'properties.yes' : 'properties.no')}</span>
        </label>
      )
    case 'pages': {
      const pick = (title: string) => {
        const found = titles.find((p) => p.title === title)
        if (found && !row.pages.includes(found.id)) onChange({ pages: [...row.pages, found.id] }, true)
        if (found) setChoice('')
      }
      return (
        <div className={styles.chipField}>
          {row.pages.map((pageId) => {
            const title = titles.find((p) => p.id === pageId)?.title ?? t('properties.unknownPage')
            return (
              <span key={pageId} className={styles.pageChip}>
                <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId }}>
                  {title}
                </Link>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={t('properties.removePage', { title })}
                  onClick={() => onChange({ pages: row.pages.filter((p) => p !== pageId) }, true)}
                >
                  ×
                </button>
              </span>
            )
          })}
          <input
            id={valueId}
            className={styles.valueInput}
            aria-label={label}
            list={`${id}-paginas`}
            value={choice}
            autoComplete="off"
            placeholder={t('properties.pagesHint')}
            onChange={(event) => {
              setChoice(event.target.value)
              pick(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                pick(choice)
              } else keys(event)
            }}
          />
          <datalist id={`${id}-paginas`}>
            {titles.map((p) => (
              <option key={p.id} value={p.title} />
            ))}
          </datalist>
        </div>
      )
    }
    case 'list': {
      const items = row.text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      // Las etiquetas, de las de la cuenta (ADR-0006); las demás listas, con sus pastillas
      if (isTagsName(row.name)) {
        return (
          <TagsField
            id={valueId}
            label={label}
            hideLabel
            value={items}
            onChange={(next) => onChange({ text: next.join(', '), pending: '' }, true)}
          />
        )
      }
      return (
        <ChipsField
          id={valueId}
          label={label}
          value={items}
          onChange={(next) => onChange({ text: next.join(', ') }, true)}
        />
      )
    }
    default: {
      const long = row.type === 'text' && row.name.trim().toLocaleLowerCase('es') === 'resumen'
      return long ? (
        <textarea
          id={valueId}
          className={styles.valueInput}
          aria-label={label}
          value={row.text}
          maxLength={5000}
          rows={2}
          onChange={(event) => onChange({ text: event.target.value })}
          onBlur={onCommit}
          onKeyDown={keys}
        />
      ) : (
        <input
          id={valueId}
          className={styles.valueInput}
          aria-label={label}
          value={row.text}
          inputMode={row.type === 'number' ? 'decimal' : undefined}
          autoComplete="off"
          placeholder={t('properties.empty')}
          onChange={(event) => onChange({ text: event.target.value })}
          onBlur={onCommit}
          onKeyDown={keys}
        />
      )
    }
  }
}

/** Una lista: sus pastillas con su ×, y un campo para añadir (Intro o coma; borrar en vacío quita la última) */
function ChipsField({
  id,
  label,
  value,
  onChange
}: {
  id: string
  label: string
  value: readonly string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const add = () => {
    const items = draft
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item && !value.includes(item))
    setDraft('')
    if (items.length > 0) onChange([...value, ...items])
  }
  return (
    <div className={styles.chipField}>
      {value.map((item) => (
        <span key={item} className={styles.listChip}>
          {item}
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={t('properties.remove', { name: item })}
            onClick={() => onChange(value.filter((other) => other !== item))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        className={styles.valueInput}
        aria-label={label}
        value={draft}
        autoComplete="off"
        placeholder={t('properties.addItem')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft.trim() && add()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !draft && value.length > 0) onChange(value.slice(0, -1))
        }}
      />
    </div>
  )
}
