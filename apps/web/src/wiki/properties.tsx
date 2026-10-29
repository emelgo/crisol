import type { Page, PageProperty } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import styles from './properties.module.css'

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
        value: draft.text
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    case 'pages':
      return { name, type: 'pages', value: draft.pages }
  }
}

/** El valor de una propiedad, para leer */
function PropertyValue({ property, worldId }: { property: PageProperty; worldId: string }) {
  const { t } = useTranslation()
  const titles = usePageTitles(worldId)
  switch (property.type) {
    case 'number':
      return <>{property.value.toLocaleString('es')}</>
    case 'boolean':
      return <>{t(property.value ? 'properties.yes' : 'properties.no')}</>
    case 'list':
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

/** Las propiedades de la página abierta: su lista, y editarlas en el sitio */
export function PageProperties({ page }: { page: Page }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const editButton = useReturnFocus()
  const stop = () => {
    editButton.back()
    setEditing(false)
  }
  if (editing) return <PropertiesEditor page={page} onDone={stop} />
  return (
    <section aria-label={t('properties.title')} className={styles.properties}>
      {page.properties.length > 0 && (
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
      )}
      <button type="button" ref={editButton.ref} className={list.secondary} onClick={() => setEditing(true)}>
        {t(page.properties.length > 0 ? 'properties.edit' : 'properties.add')}
      </button>
    </section>
  )
}

function PropertiesEditor({ page, onDone }: { page: Page; onDone: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [drafts, setDrafts] = useState<Draft[]>(() => page.properties.map(toDraft))
  const [invalid, setInvalid] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // Al abrir el editor, el foco va a su primer campo (o a «Añadir propiedad» si no hay ninguna)
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
  }, [])
  const save = useMutation({
    mutationFn: (properties: PageProperty[]) => api.call('setPageProperties', { pageId: page.id, properties }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      onDone()
    }
  })
  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const move = (index: number, by: -1 | 1) =>
    setDrafts((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(index + by, 0, moved)
      return next
    })
  const add = (name = '', type: PropertyType = 'text') =>
    setDrafts((current) => [...current, { key: crypto.randomUUID(), name, type, text: '', checked: false, pages: [] }])
  const present = new Set(drafts.map((d) => d.name.trim().toLocaleLowerCase('es')))

  return (
    <form
      ref={formRef}
      className={styles.editor}
      aria-label={t('properties.title')}
      onSubmit={(event) => {
        event.preventDefault()
        const properties = drafts.filter((d) => d.name.trim()).map(fromDraft)
        const broken = properties.indexOf(null)
        if (broken >= 0) {
          setInvalid(t('properties.badNumber', { name: drafts[broken]?.name ?? '' }))
          return
        }
        setInvalid(null)
        save.mutate(properties.filter((p): p is PageProperty => p !== null))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone()
      }}
    >
      {drafts.length === 0 && <p>{t('properties.none')}</p>}
      <ol className={styles.drafts}>
        {drafts.map((draft, index) => (
          <DraftRow
            key={draft.key}
            draft={draft}
            index={index}
            last={index === drafts.length - 1}
            worldId={page.worldId}
            onChange={(patch) => update(draft.key, patch)}
            onMove={(by) => move(index, by)}
            onRemove={() => setDrafts((current) => current.filter((d) => d.key !== draft.key))}
          />
        ))}
      </ol>
      <div className={list.actions}>
        <button type="button" className={list.secondary} onClick={() => add()}>
          {t('properties.addOne')}
        </button>
        {RESERVED.filter((r) => !present.has(r.name)).map((reserved) => (
          <button
            key={reserved.name}
            type="button"
            className={list.secondary}
            onClick={() => add(reserved.name, reserved.type)}
          >
            {t(`properties.reserved.${reserved.name}`)}
          </button>
        ))}
      </div>
      <FormError message={invalid ?? (save.error ? errorText(save.error) : null)} />
      <div className={list.actions}>
        <BusyButton type="submit" className={form.button} busy={save.isPending}>
          {t('list.save')}
        </BusyButton>
        <button type="button" className={list.secondary} onClick={onDone}>
          {t('list.cancel')}
        </button>
      </div>
    </form>
  )
}

function DraftRow({
  draft,
  index,
  last,
  worldId,
  onChange,
  onMove,
  onRemove
}: {
  draft: Draft
  index: number
  last: boolean
  worldId: string
  onChange: (patch: Partial<Draft>) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const n = index + 1
  const label = draft.name.trim() || t('properties.numbered', { n })
  return (
    <li className={styles.draft}>
      <div className={styles.fields}>
        <div className={form.field}>
          <label htmlFor={`${id}-nombre`}>{t('properties.name', { n })}</label>
          <input
            id={`${id}-nombre`}
            value={draft.name}
            maxLength={60}
            autoComplete="off"
            ref={draft.name ? undefined : focusOnMount}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </div>
        <div className={form.field}>
          <label htmlFor={`${id}-tipo`}>{t('properties.type', { n })}</label>
          <select
            id={`${id}-tipo`}
            value={draft.type}
            onChange={(event) => onChange({ type: event.target.value as PropertyType })}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`properties.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <ValueField draft={draft} id={id} n={n} worldId={worldId} onChange={onChange} />
      </div>
      <div className={styles.rowActions}>
        {index > 0 && (
          <button
            type="button"
            className={list.secondary}
            aria-label={t('properties.moveUp', { name: label })}
            onClick={() => onMove(-1)}
          >
            {t('properties.up')}
          </button>
        )}
        {!last && (
          <button
            type="button"
            className={list.secondary}
            aria-label={t('properties.moveDown', { name: label })}
            onClick={() => onMove(1)}
          >
            {t('properties.down')}
          </button>
        )}
        <button
          type="button"
          className={list.secondary}
          aria-label={t('properties.remove', { name: label })}
          onClick={onRemove}
        >
          {t('properties.removeShort')}
        </button>
      </div>
    </li>
  )
}

function ValueField({
  draft,
  id,
  n,
  worldId,
  onChange
}: {
  draft: Draft
  id: string
  n: number
  worldId: string
  onChange: (patch: Partial<Draft>) => void
}) {
  const { t } = useTranslation()
  const titles = usePageTitles(worldId)
  const [choice, setChoice] = useState('')
  const valueId = `${id}-valor`
  const label = t('properties.value', { n })
  switch (draft.type) {
    case 'boolean':
      return (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.checked}
            onChange={(event) => onChange({ checked: event.target.checked })}
          />
          {label}
        </label>
      )
    case 'pages': {
      const pick = (title: string) => {
        const found = titles.find((p) => p.title === title)
        if (found && !draft.pages.includes(found.id)) onChange({ pages: [...draft.pages, found.id] })
        if (found) setChoice('')
      }
      return (
        <div className={form.field}>
          <label htmlFor={valueId}>{label}</label>
          <ul className={styles.chips}>
            {draft.pages.map((pageId) => {
              const title = titles.find((p) => p.id === pageId)?.title ?? t('properties.unknownPage')
              return (
                <li key={pageId}>
                  {title}{' '}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={t('properties.removePage', { title })}
                    onClick={() => onChange({ pages: draft.pages.filter((p) => p !== pageId) })}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
          <input
            id={valueId}
            list={`${id}-paginas`}
            value={choice}
            autoComplete="off"
            aria-describedby={`${id}-pista`}
            onChange={(event) => {
              setChoice(event.target.value)
              pick(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                pick(choice)
              }
            }}
          />
          <datalist id={`${id}-paginas`}>
            {titles.map((p) => (
              <option key={p.id} value={p.title} />
            ))}
          </datalist>
          <small id={`${id}-pista`} className={form.hint}>
            {t('properties.pagesHint')}
          </small>
        </div>
      )
    }
    default: {
      const long = draft.type === 'text' && draft.name.trim().toLocaleLowerCase('es') === 'resumen'
      return (
        <div className={form.field}>
          <label htmlFor={valueId}>{label}</label>
          {long ? (
            <textarea
              id={valueId}
              value={draft.text}
              maxLength={5000}
              rows={3}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          ) : (
            <input
              id={valueId}
              value={draft.text}
              inputMode={draft.type === 'number' ? 'decimal' : undefined}
              autoComplete="off"
              aria-describedby={draft.type === 'list' ? `${id}-pista` : undefined}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          )}
          {draft.type === 'list' && (
            <small id={`${id}-pista`} className={form.hint}>
              {t('properties.listHint')}
            </small>
          )}
        </div>
      )
    }
  }
}
