import type { Page, PageProperty } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { EyeOff } from 'lucide-react'
import { type KeyboardEvent, type MutableRefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useTemplates } from '../templates/picker.tsx'
import fieldStyles from './field-controls.module.css'
import { ChoiceSelect, ClockField } from './field-controls.tsx'
import styles from './properties.module.css'
import { PageLink, readAsInput, readAsKey, useReadAs } from './read-as.tsx'
import tagStyles from './tags.module.css'
import { TagsField, tagDot, useTagColor } from './tags.tsx'

/** La propiedad de las etiquetas */
const isTagsName = (name: string) => name.trim().toLocaleLowerCase('es') === 'etiquetas'

type PropertyType = PageProperty['type']
const TYPES: PropertyType[] = ['text', 'number', 'boolean', 'list', 'pages', 'choice', 'clock']
/** Los segmentos de un reloj nuevo */
const CLOCK_SEGMENTS = 4
/** Las reservadas, con su tipo: se ofrecen para añadirlas de un clic */
const RESERVED = [{ name: 'etiquetas', type: 'list' }] as const

/** Los títulos de las páginas de la wiki por su id (para las propiedades que enlazan páginas) */
function usePageTitles(worldId: string) {
  const api = useApi()
  // Leyendo como jugador, los de lo que ve (ADR-0017)
  const readAs = useReadAs()
  const tree = useQuery({
    queryKey: ['pages', worldId, 'tree', 32, ...readAsKey(readAs)],
    queryFn: () => api.call('listPageTree', { worldId, levels: 32, ...readAsInput(readAs) })
  })
  return tree.data?.pages ?? []
}

/** Las páginas del mundo en la papelera, por su id: un enlace a una de ellas sale tachado (sin llevar a ningún sitio) */
function useTrashedTitles(worldId: string, wanted: boolean) {
  const api = useApi()
  const trash = useQuery({
    queryKey: ['trash', worldId],
    queryFn: () => api.call('listTrash', { worldId }),
    enabled: wanted
  })
  return new Map((trash.data?.items ?? []).filter((item) => item.kind === 'page').map((item) => [item.id, item.name]))
}

/** Un enlace a una página del campo: a ella, o tachado si está en la papelera */
function LinkedPage({
  worldId,
  pageId,
  title,
  trashed
}: {
  worldId: string
  pageId: string
  title: string | undefined
  trashed: string | undefined
}) {
  const { t } = useTranslation()
  if (title === undefined && trashed !== undefined) {
    return <s className={fieldStyles.trashed}>{t('fields.trashed', { title: trashed })}</s>
  }
  return (
    <PageLink worldId={worldId} pageId={pageId}>
      {title ?? t('properties.unknownPage')}
    </PageLink>
  )
}

/** Una propiedad mientras se edita: los textos tal como se escriben, y su valor se saca al guardar */
interface Draft {
  key: string
  name: string
  type: PropertyType
  text: string
  checked: boolean
  pages: string[]
  /** De unas opciones: la lista */
  options: string[]
  /** De un reloj: los segmentos llenos y cuántos tiene */
  count: number
  segments: number
  /** Las etiquetas escritas aún sin poner: van con las demás al guardar */
  pending?: string
  /** Como estaba guardada: su campo de plantilla y su forma no se pierden al cambiar otra cosa */
  original?: PageProperty
  /** «Oculto»: no les llega a los jugadores aunque vean la página (ADR-0017) */
  hidden?: boolean
}

const toDraft = (property: PageProperty): Draft => ({
  key: crypto.randomUUID(),
  name: property.name,
  type: property.type,
  text:
    property.type === 'list'
      ? property.value.join(', ')
      : property.type === 'text' || property.type === 'number' || property.type === 'choice'
        ? String(property.value ?? '')
        : '',
  checked: property.type === 'boolean' ? property.value : false,
  pages: property.type === 'pages' ? property.value : [],
  options: property.type === 'choice' ? property.options : [],
  count: property.type === 'clock' ? property.value : 0,
  segments: property.type === 'clock' ? property.segments : CLOCK_SEGMENTS,
  original: property,
  hidden: property.hidden === true
})

/** Al cambiar de tipo a mano: lo que ya había escrito pasa al tipo nuevo como se pueda */
const retyped = (row: Draft, type: PropertyType): Partial<Draft> => {
  if (type === 'choice') {
    const options = row.options.length > 0 ? row.options : row.text.trim() ? [row.text.trim()] : []
    return { type, options }
  }
  if (type === 'clock') return { type, count: Math.min(row.count, row.segments), segments: row.segments }
  return { type }
}

/** La propiedad que sale de un borrador, o null si su valor no se puede leer (un número que no lo es) */
function fromDraft(draft: Draft): PageProperty | null {
  const value = propertyOfDraft(draft)
  return value && draft.hidden ? { ...value, hidden: true } : value
}

function propertyOfDraft(draft: Draft): PageProperty | null {
  const name = draft.name.trim()
  const original = draft.original?.type === draft.type ? draft.original : undefined
  // Lo de la plantilla (su campo, a qué apunta un enlace) se queda al cambiar el valor
  const field = original?.field === undefined ? {} : { field: original.field }
  switch (draft.type) {
    case 'text':
      return { name, ...field, type: 'text', value: draft.text }
    case 'number': {
      // Vacío, sin valor (como un campo de plantilla aún sin rellenar)
      if (draft.text.trim() === '') return { name, ...field, type: 'number', value: null }
      const value = Number(draft.text.replace(',', '.'))
      return Number.isFinite(value) ? { name, ...field, type: 'number', value } : null
    }
    case 'boolean':
      return { name, ...field, type: 'boolean', value: draft.checked }
    case 'list':
      return {
        name,
        ...field,
        type: 'list',
        value: [
          ...draft.text.split(','),
          ...(draft.pending ?? '').split(',').map((item) => item.replace(/\s/g, '').replace(/^#/, ''))
        ]
          .map((item) => item.trim())
          .filter((item, i, all) => item && all.indexOf(item) === i)
      }
    case 'pages':
      return original?.type === 'pages'
        ? { ...original, name, value: original.single ? draft.pages.slice(-1) : draft.pages }
        : { name, type: 'pages', value: draft.pages }
    case 'choice':
      return { name, ...field, type: 'choice', value: draft.text.trim(), options: draft.options }
    case 'clock':
      return { name, ...field, type: 'clock', value: Math.min(draft.count, draft.segments), segments: draft.segments }
  }
}

/** El valor de una propiedad, para leer */
function PropertyValue({ property, worldId }: { property: PageProperty; worldId: string }) {
  const { t } = useTranslation()
  const titles = usePageTitles(worldId)
  const lost = property.type === 'pages' && property.value.some((id) => !titles.some((p) => p.id === id))
  const trashed = useTrashedTitles(worldId, lost)
  const colorOf = useTagColor()
  switch (property.type) {
    case 'number':
      return <>{property.value?.toLocaleString('es') ?? ''}</>
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
              <LinkedPage
                worldId={worldId}
                pageId={id}
                title={titles.find((p) => p.id === id)?.title}
                trashed={trashed.get(id)}
              />
            </li>
          ))}
        </ul>
      )
    case 'clock':
      return <>{`${property.value}/${property.segments}`}</>
    default:
      return <>{property.value}</>
  }
}

/**
 * Las propiedades de la página abierta, siempre editables en el sitio (como en el Crisol antiguo): tocar un nombre o
 * un valor lo cambia; Intro o salir del campo lo guarda, Escape lo deshace. Sin «Guardar» ni «Cancelar». Con la página
 * bloqueada, solo se leen
 */
/** Añadir desde fuera (desde «Añadir bloque» del panel): las etiquetas o una propiedad nueva */
export type PropertyAdder = (kind: 'tags' | 'property') => void

/** «Oculto»: un campo o un bloque que no ven los jugadores (en lo del mundo no se dice «máster») */
export function HiddenBadge() {
  const { t } = useTranslation()
  return (
    <span className={styles.hiddenBadge}>
      <EyeOff aria-hidden="true" size={11} />
      {t('properties.hidden')}
    </span>
  )
}

export function PageProperties({
  page,
  adders = true,
  adderRef
}: {
  page: Page
  /** Sus botones de añadir; en el panel no: se añade desde «Añadir bloque» */
  adders?: boolean
  adderRef?: MutableRefObject<PropertyAdder | null>
}) {
  const { t } = useTranslation()
  if (page.locked) {
    if (page.properties.length === 0) return null
    return (
      <section aria-label={t('properties.title')} className={styles.properties} data-properties="">
        <dl className={styles.list}>
          {page.properties.map((property) => (
            <div key={property.name} className={styles.row}>
              <dt>
                {property.name}
                {property.hidden && <HiddenBadge />}
              </dt>
              <dd>
                <PropertyValue property={property} worldId={page.worldId} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }
  return <InlineProperties page={page} adders={adders} adderRef={adderRef} />
}

const sameProperties = (a: readonly PageProperty[], b: readonly PageProperty[]) =>
  JSON.stringify(a) === JSON.stringify(b)

function InlineProperties({
  page,
  adders,
  adderRef
}: {
  page: Page
  adders: boolean
  adderRef: MutableRefObject<PropertyAdder | null> | undefined
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const box = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<Draft[]>(() => page.properties.map(toDraft))
  const [invalid, setInvalid] = useState<string | null>(null)
  // La fila recién añadida, para llevarle el foco (al nombre, o al valor si ya lo trae)
  const [fresh, setFresh] = useState<{ key: string; to: 'name' | 'value' } | null>(null)
  // Los guardados van en fila: dos seguidos (el tipo y luego el valor) no llegan cambiados de orden; y mientras
  // quede alguno, lo que llega de fuera (que puede ser de antes de él) no pisa lo de aquí
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = useRef(0)
  const save = useMutation({
    mutationFn: (properties: PageProperty[]) => {
      inFlight.current++
      const run = queue.current
        .catch(() => undefined)
        .then(() => api.call('setPageProperties', { pageId: page.id, properties }))
        .finally(() => {
          inFlight.current--
        })
      queue.current = run
      return run
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  // Lo que llega de fuera (otra pestaña, la IA) entra si no se está escribiendo aquí
  useEffect(() => {
    if (inFlight.current > 0 || box.current?.contains(document.activeElement)) return
    setRows(page.properties.map(toDraft))
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
    const row: Draft = {
      key: crypto.randomUUID(),
      name,
      type,
      text: '',
      checked: false,
      pages: [],
      options: [],
      count: 0,
      segments: CLOCK_SEGMENTS
    }
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
  // Desde «Añadir bloque»: las etiquetas (si ya están, a su campo) o una propiedad nueva
  if (adderRef) {
    adderRef.current = (kind) => {
      if (kind === 'property') return add()
      const tags = rows.find((row) => isTagsName(row.name))
      if (tags) setFresh({ key: tags.key, to: 'value' })
      else add('etiquetas', 'list')
    }
  }
  if (!adders && rows.length === 0) return null
  return (
    <section ref={box} aria-label={t('properties.title')} className={styles.properties} data-properties="">
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
      {adders && (
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
      )}
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
        {row.hidden && <HiddenBadge />}
      </div>
      <div className={styles.propValue}>
        <ValueField row={row} id={id} n={n} worldId={worldId} onChange={onChange} onCommit={onCommit} keys={keys} />
      </div>
      {row.original?.field === undefined && (row.type === 'choice' || row.type === 'clock') && (
        // La forma de una hecha a mano (las de plantilla traen la suya)
        <div className={styles.propShape}>
          {row.type === 'choice' ? (
            <ChipsField
              id={`${id}-opciones`}
              label={t('fields.options', { name: label })}
              value={row.options}
              onChange={(options) => onChange({ options }, true)}
            />
          ) : (
            <label className={fieldStyles.shape}>
              {t('fields.segments', { name: label })}
              <input
                type="number"
                min={2}
                max={12}
                className={fieldStyles.segmentsInput}
                value={row.segments}
                onChange={(event) => {
                  const segments = Math.min(12, Math.max(2, Math.trunc(Number(event.target.value)) || 2))
                  onChange({ segments, count: Math.min(row.count, segments) }, true)
                }}
              />
            </label>
          )}
        </div>
      )}

      <div className={styles.propEnd}>
        <button
          type="button"
          className={styles.hideProp}
          aria-pressed={row.hidden === true}
          aria-label={t('properties.hide', { name: label })}
          title={t('properties.hide', { name: label })}
          onClick={() => onChange({ hidden: !row.hidden }, true)}
        >
          <EyeOff aria-hidden="true" size={14} />
        </button>
        <button
          type="button"
          className={styles.removeProp}
          aria-label={t('properties.remove', { name: label })}
          title={t('properties.remove', { name: label })}
          onClick={onRemove}
        >
          ×
        </button>
        <select
          className={styles.typeSelect}
          aria-label={t('properties.type', { n })}
          title={t('properties.type', { n })}
          value={row.type}
          onChange={(event) => onChange(retyped(row, event.target.value as PropertyType), true)}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`properties.types.${type}`)}
            </option>
          ))}
        </select>
      </div>
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
  const lost = row.type === 'pages' && row.pages.some((id) => !titles.some((p) => p.id === id))
  const trashed = useTrashedTitles(worldId, lost)
  const templates = useTemplates().data?.templates ?? []
  const [everyPage, setEveryPage] = useState(false)
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
      const single = row.original?.type === 'pages' && row.original.single === true
      // Las de su tipo primero (sus targets, y las copias de esas plantillas); «Todas las páginas», el resto
      const targets = row.original?.type === 'pages' ? (row.original.targets ?? []) : []
      const lineOf = (template: string | null) =>
        template ? (templates.find((each) => each.id === template)?.line ?? [template]) : []
      const preferred =
        targets.length > 0 ? titles.filter((p) => lineOf(p.template).some((id) => targets.includes(id))) : null
      const offered = preferred && !everyPage ? preferred : titles
      const pick = (title: string) => {
        const found = titles.find((p) => p.title === title)
        // Un enlace a una sola página la cambia; uno a varias la añade
        if (found && !row.pages.includes(found.id))
          onChange({ pages: single ? [found.id] : [...row.pages, found.id] }, true)
        if (found) setChoice('')
      }
      return (
        <div className={styles.chipField}>
          {row.pages.map((pageId) => {
            const found = titles.find((p) => p.id === pageId)?.title
            const title = found ?? trashed.get(pageId) ?? t('properties.unknownPage')
            return (
              <span key={pageId} className={styles.pageChip}>
                <LinkedPage worldId={worldId} pageId={pageId} title={found} trashed={trashed.get(pageId)} />
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
            {offered.map((p) => (
              <option key={p.id} value={p.title} />
            ))}
          </datalist>
          {preferred && (
            <button type="button" className={fieldStyles.allPages} onClick={() => setEveryPage(!everyPage)}>
              {t(everyPage ? 'fields.onlyTargets' : 'fields.allPages')}
            </button>
          )}
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
    case 'choice':
      return (
        <ChoiceSelect
          id={valueId}
          label={label}
          value={row.text}
          options={row.options}
          onPick={(value) => onChange({ text: value }, true)}
        />
      )
    case 'clock':
      return (
        <ClockField
          label={label}
          value={row.count}
          segments={row.segments}
          onPick={(count) => onChange({ count }, true)}
        />
      )
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
