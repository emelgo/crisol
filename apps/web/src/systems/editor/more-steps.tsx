/**
 * Los demás pasos del editor (lienzo de la tanda 8): lo que se lleva (los tipos de objeto, cada uno con sus campos),
 * cómo se ve la ficha (sus bloques, que nacen uno por campo y se ordenan), cómo se crea un personaje (sus pasos), qué
 * trae el compendio (sus libros, que se llevan en su Inicio) y lo avanzado (la iniciativa, los idiomas, la versión y
 * el archivo)
 */
import { characterType, type Language, type Problem, type System, sheetOf, textOf } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Download, Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { Loading } from '../../components/brand.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import { FormError } from '../../components/field.tsx'
import { focusAfterRemoving } from '../../components/focus.ts'
import { failed, LoadError } from '../../components/load-error.tsx'
import { useDownload } from '../screen.tsx'
import type { Change } from './change.ts'
import { FieldsList, focusMoved } from './character-step.tsx'
import { keyFor, withText } from './kinds.ts'
import styles from './rules.module.css'

/** Mueve un elemento de una lista (subir o bajar) */
function moved<T>(list: readonly T[], at: number, delta: -1 | 1): T[] {
  const next = [...list]
  const to = at + delta
  if (to < 0 || to >= next.length) return next
  const [item] = next.splice(at, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * Subir, bajar y quitar, en una fila, con su nombre: al mover, el foco sigue en su botón (la fila, en su sitio nuevo)
 * y se dice dónde quedó; al quitar, pasa a la de al lado
 */
function RowTools({
  name,
  index,
  count,
  onMove,
  onRemove
}: {
  name: string
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const self = useRef<HTMLSpanElement>(null)
  const move = (delta: -1 | 1) => {
    const list = self.current?.closest('ul, ol') ?? null
    onMove(delta)
    requestAnimationFrame(() => {
      const row = list?.children[index + delta] ?? null
      if (row) focusMoved(row, '', delta)
    })
    announce(t('rules.movedTo', { name, at: index + delta + 1, of: count }))
  }
  return (
    <span className={styles.inlineTools} ref={self}>
      <button
        type="button"
        data-move="up"
        aria-label={t('rules.upNamed', { name })}
        disabled={index === 0}
        onClick={() => move(-1)}
      >
        <ArrowUp size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-move="down"
        aria-label={t('rules.downNamed', { name })}
        disabled={index === count - 1}
        onClick={() => move(1)}
      >
        <ArrowDown size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('rules.removeNamed', { name })}
        onClick={(event) => {
          const back = focusAfterRemoving(event.currentTarget.closest('li'))
          onRemove()
          requestAnimationFrame(back)
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </span>
  )
}

/** 3 · Lo que se lleva: los tipos de objeto (armas, conjuros…), cada uno con su nombre y sus campos */
export function ObjectsStep({
  system,
  language,
  change,
  problems
}: {
  system: System
  language: Language
  change: Change
  problems: Problem[]
}) {
  const { t } = useTranslation()
  const items = Object.entries(system.types).filter(([, type]) => type.document === 'item')
  const [open, setOpen] = useState<string | null>(items[0]?.[0] ?? null)
  const add = () => {
    const label = t('rules.objects.new')
    const key = keyFor(label, Object.keys(system.types))
    change((draft) => {
      draft.types[key] = { label, document: 'item', fields: { nombre: { kind: 'text', label: t('rules.field.name') } } }
    })
    setOpen(key)
  }
  return (
    <>
      {items.length === 0 && <p className={styles.muted}>{t('rules.objects.none')}</p>}
      <ul className={styles.rows}>
        {items.map(([key, type]) => (
          <li key={key} className={styles.row} data-open={open === key || undefined} id={`tipo-${key}`}>
            <div className={styles.typeHead}>
              <button
                type="button"
                className={styles.typeName}
                aria-expanded={open === key}
                onClick={() => setOpen((now) => (now === key ? null : key))}
              >
                {textOf(type.label, language) || key}
                <small>{t('rules.summary.inside', { count: Object.keys(type.fields).length })}</small>
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t('rules.objects.remove', { name: textOf(type.label, language) })}
                onClick={(event) => {
                  const back = focusAfterRemoving(event.currentTarget.closest('li'))
                  change(
                    (draft) => {
                      delete draft.types[key]
                    },
                    t('rules.removed', { name: textOf(type.label, language) })
                  )
                  requestAnimationFrame(back)
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
            {open === key && (
              <div className={styles.rowBody}>
                <TypeName
                  value={textOf(type.label, language)}
                  onChange={(value) =>
                    change((draft) => {
                      const target = draft.types[key]
                      if (target) target.label = withText(target.label, value, language)
                    })
                  }
                />
                <FieldsList system={system} typeKey={key} language={language} change={change} problems={problems} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <span className={styles.addLabel}>{t('rules.add')}</span>
        <button type="button" className={styles.addButton} onClick={add}>
          <Plus size={14} aria-hidden="true" />
          {t('rules.objects.add')}
        </button>
      </div>
    </>
  )
}

function TypeName({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t('rules.objects.name')}</label>
      <input
        id={id}
        value={value}
        maxLength={80}
        autoComplete="off"
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  )
}

/** 4 · Cómo se ve la ficha: sus bloques, en su orden; sin ninguno, la que sale de sus campos, para empezar de ella */
export function SheetStep({ system, language, change }: { system: System; language: Language; change: Change }) {
  const { t } = useTranslation()
  const type = characterType(system)
  const own = system.sheet?.blocks
  const blocks = own ?? (type ? sheetOf(system, type) : [])
  const fields = type ? (system.types[type]?.fields ?? {}) : {}
  const nameOf = (key: string) => textOf(fields[key]?.label, language) || key
  const describe = (block: (typeof blocks)[number]): string => {
    if (block.kind === 'header') return t('rules.sheet.header')
    // Las columnas, por lo que llevan (dos «3 columnas» no se distinguirían)
    if (block.kind === 'columns')
      return block.blocks
        .map((inner) => ('label' in inner && inner.label ? textOf(inner.label, language) : describe(inner)))
        .join(' · ')
    if (block.kind === 'tabs') return block.tabs.map((tab) => textOf(tab.label, language)).join(' · ')
    if ('fields' in block) return block.fields.map(nameOf).join(', ')
    if ('field' in block) return nameOf(block.field)
    return ''
  }
  const write = (next: typeof blocks) =>
    change((draft) => {
      draft.sheet = { blocks: next }
    })
  return (
    <>
      {!own && <p className={styles.enough}>{t('rules.sheet.generated')}</p>}
      <ul className={styles.rows}>
        {blocks.map((block, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: los bloques no tienen clave; su sitio es lo que los distingue
          <li key={index} className={styles.blockRow}>
            <span className={styles.blockKind}>{t(`rules.sheet.kind.${block.kind}`)}</span>
            <span className={styles.rowName}>
              {'label' in block && block.label ? textOf(block.label, language) : ''}
              <small>{describe(block)}</small>
            </span>
            <RowTools
              name={t(`rules.sheet.kind.${block.kind}`)}
              index={index}
              count={blocks.length}
              onMove={(delta) => write(moved(blocks, index, delta))}
              onRemove={() => write(blocks.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      {own && type && (
        <div className={styles.add}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => write(sheetOf({ ...system, sheet: undefined }, type))}
          >
            {t('rules.sheet.regenerate')}
          </button>
        </div>
      )}
    </>
  )
}

/** 5 · Cómo se crea un personaje: sus pasos, en su orden (elegir del compendio, repartir puntuaciones, escribir) */
export function CreationStep({ system, language, change }: { system: System; language: Language; change: Change }) {
  const { t } = useTranslation()
  const steps = system.creation ?? []
  const type = characterType(system)
  const fields = type ? Object.entries(system.types[type]?.fields ?? {}) : []
  const firstSet = fields.find(([, f]) => f.kind === 'set')
  const write = (next: typeof steps) =>
    change((draft) => {
      draft.creation = next
    })
  const keys = steps.map((s) => s.key)
  const nameOf = (key: string) => textOf(system.types[type ?? '']?.fields[key]?.label, language) || key
  const itemType = Object.entries(system.types).find(([, ty]) => ty.document === 'item')?.[0]
  const score =
    firstSet?.[1].kind === 'set'
      ? Object.entries(firstSet[1].fields).find(([, f]) => f.kind === 'number')?.[0]
      : undefined
  // Lo que hace falta para cada clase de paso: sin ello, su botón se desactiva y dice por qué
  const missing = {
    content: !itemType,
    scores: !score,
    fields: !fields[0],
    summary: false
  }
  const addStep = (kind: 'content' | 'scores' | 'fields' | 'summary') => {
    const label = t(`rules.creation.kind.${kind}`)
    const key = keyFor(label, keys)
    if (kind === 'content' && itemType) write([...steps, { key, label, kind, type: itemType }])
    if (kind === 'scores' && firstSet) {
      const [setKey] = firstSet
      if (score)
        write([
          ...steps,
          {
            key,
            label,
            kind,
            set: setKey,
            field: score,
            methods: [
              { key: 'fijos', label: t('rules.creation.fixed'), kind: 'array', values: [15, 14, 13, 12, 10, 8] }
            ]
          }
        ])
    }
    if (kind === 'fields' && fields[0]) write([...steps, { key, label, kind, fields: [fields[0][0]] }])
    if (kind === 'summary') write([...steps, { key, label, kind }])
  }
  return (
    <>
      {steps.length === 0 && <p className={styles.muted}>{t('rules.creation.none')}</p>}
      <ol className={styles.rows}>
        {steps.map((step, index) => {
          const label = textOf(step.label, language)
          const detail =
            step.kind === 'content'
              ? textOf(system.types[step.type]?.label, language)
              : step.kind === 'scores'
                ? step.methods.map((m) => textOf(m.label, language)).join(', ')
                : step.kind === 'fields'
                  ? step.fields.map(nameOf).join(', ')
                  : ''
          return (
            <li key={step.key} className={styles.blockRow}>
              <span className={styles.blockKind}>{t(`rules.creation.kind.${step.kind}`)}</span>
              <span className={styles.rowName}>
                {label}
                {/* Sin repetir: «Clase» bajo «Clase» no dice nada */}
                {detail && detail !== label && <small>{detail}</small>}
              </span>
              <RowTools
                name={label}
                index={index}
                count={steps.length}
                onMove={(delta) => write(moved(steps, index, delta))}
                onRemove={() => write(steps.filter((_, i) => i !== index))}
              />
            </li>
          )
        })}
      </ol>
      <div className={styles.add}>
        <span className={styles.addLabel}>{t('rules.add')}</span>
        {(['content', 'scores', 'fields', 'summary'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.addButton}
            disabled={missing[kind]}
            aria-describedby={missing[kind] ? `falta-${kind}` : undefined}
            onClick={() => addStep(kind)}
          >
            <Plus size={14} aria-hidden="true" />
            {t(`rules.creation.kind.${kind}`)}
          </button>
        ))}
      </div>
      {(['content', 'scores', 'fields'] as const)
        .filter((kind) => missing[kind])
        .map((kind) => (
          <p key={kind} id={`falta-${kind}`} className={styles.muted}>
            {t(`rules.creation.needs.${kind}`)}
          </p>
        ))}
    </>
  )
}

/** 6 · Qué trae el compendio: sus libros (se llevan en el Inicio del sistema) y lo que trae cada uno */
export function CompendiumStep({ systemId }: { systemId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const books = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  if (!books.data)
    return failed(books) ? <LoadError error={books.error} onRetry={() => books.refetch()} /> : <Loading />
  return (
    <>
      <ul className={styles.rows}>
        {(books.data?.books ?? []).map((book) => (
          <li key={book.key} className={styles.blockRow}>
            <span className={styles.rowName}>
              {book.name}
              <small>
                {book.chapters > 0
                  ? t('rules.compendium.counts', { entries: book.count, chapters: book.chapters })
                  : t('rules.compendium.entries', { entries: book.count })}
              </small>
            </span>
            <Link
              to="/sistemas/$systemId/libros/$bookKey"
              params={{ systemId, bookKey: book.key }}
              className={styles.goto}
            >
              {t('rules.compendium.open')}
            </Link>
          </li>
        ))}
      </ul>
      {books.data && books.data.books.length === 0 && <p className={styles.muted}>{t('rules.compendium.none')}</p>}
      <p className={styles.muted}>
        <Link to="/sistemas/$systemId" params={{ systemId }} className={styles.goto}>
          {t('rules.compendium.manage')}
        </Link>
      </p>
    </>
  )
}

/** Lo avanzado: la iniciativa, los idiomas, la versión y el archivo del sistema */
export function AdvancedStep({
  systemId,
  system,
  language,
  change
}: {
  systemId: string
  system: System
  language: Language
  change: Change
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const ids = { initiative: useId(), version: useId() }
  const download = useDownload(systemId)
  return (
    <div className={styles.form}>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor={ids.initiative}>{t('rules.advanced.initiative')}</label>
          <select
            id={ids.initiative}
            value={system.initiative ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((draft) => {
                if (value) draft.initiative = value
                else delete draft.initiative
              })
            }}
          >
            <option value="">{t('rules.advanced.byHand')}</option>
            {Object.entries(system.rolls ?? {}).map(([key, roll]) => (
              <option key={key} value={key}>
                {textOf(roll.label, language)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.version}>{t('rules.advanced.version')}</label>
          <input
            id={ids.version}
            value={system.version}
            maxLength={40}
            autoComplete="off"
            onChange={(event) => {
              const value = event.currentTarget.value
              change((draft) => {
                draft.version = value
              })
            }}
          />
        </div>
      </div>
      <p className={styles.muted}>{t('rules.advanced.file')}</p>
      <p>
        <BusyButton
          type="button"
          className={styles.addButton}
          busy={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download size={14} aria-hidden="true" />
          {t('systems.download')}
        </BusyButton>
      </p>
      <FormError message={download.error ? errorText(download.error) : null} />
    </div>
  )
}
