/**
 * «Tabla de páginas» en el panel (ADR-0009): las páginas de una plantilla cuyo campo de enlace apunta a esta, con sus
 * columnas. La calcula el servidor (getPageTables); aquí se pinta y se configura con desplegables
 */
import type { CalendarView, Page, PageProperty, PanelBlock } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Icon } from '../components/icon.tsx'
import { useTemplates } from '../templates/picker.tsx'
import { dateText, useWorldCalendars } from './date-field.tsx'
import { PageLink, readAsInput, readAsKey, useReadAs } from './read-as.tsx'
import styles from './related-block.module.css'

type RelatedBlock = Extract<PanelBlock, { type: 'related' }>

/** Las tablas de una página: se ponen al día con los avisos de páginas (su clave cuelga de ['pages', mundo]) */
export function usePageTables(page: Page) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: ['pages', page.worldId, 'tables', page.id, JSON.stringify(page.panel), ...readAsKey(readAs)],
    queryFn: () => api.call('getPageTables', { pageId: page.id, ...readAsInput(readAs) })
  })
}

/** Una celda, como texto (las páginas, por su título; las fechas, con su calendario) */
function cellText(
  cell: PageProperty | null,
  title: (id: string) => string,
  yes: string,
  no: string,
  calendars: readonly CalendarView[] | undefined
) {
  if (!cell) return ''
  switch (cell.type) {
    case 'date':
      return dateText(calendars, cell.value, cell.text)
    case 'pages':
      return cell.value.map(title).join(', ')
    case 'list':
      return cell.value.join(', ')
    case 'boolean':
      return cell.value ? yes : no
    case 'clock':
      return `${cell.value}/${cell.segments}`
    case 'number':
      return cell.value?.toLocaleString('es') ?? ''
    default:
      return cell.value
  }
}

export function RelatedBody({ page, block, onFix }: { page: Page; block: RelatedBlock; onFix: () => void }) {
  const { t } = useTranslation()
  const tables = usePageTables(page)
  const calendars = useWorldCalendars(page.worldId).data?.calendars
  const table = tables.data?.tables.find((each) => each.blockId === block.id)
  const titles = new Map((tables.data?.linked ?? []).map((each) => [each.id, each.title]))
  const title = (id: string) => titles.get(id) ?? t('properties.unknownPage')
  if (!table) return null
  if (table.problem === 'unset') {
    return (
      <p className={styles.muted}>
        {t('related.unset')}{' '}
        <button type="button" className={styles.fix} onClick={onFix}>
          {t('related.choose')}
        </button>
      </p>
    )
  }
  if (table.problem) {
    return (
      <p className={styles.warning}>
        {t('related.noField')}{' '}
        <button type="button" className={styles.fix} onClick={onFix}>
          {t('related.fix')}
        </button>
      </p>
    )
  }
  if (table.rows.length === 0) return <p className={styles.muted}>{t('related.empty')}</p>
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('related.page')}</th>
            {table.columns.map((column) => (
              <th key={column.field} scope="col">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <PageLink worldId={page.worldId} pageId={row.id}>
                  {row.icon && (
                    <>
                      <Icon value={row.icon} />{' '}
                    </>
                  )}
                  {row.title}
                </PageLink>
              </td>
              {row.cells.map((cell, i) => (
                <td key={table.columns[i]?.field ?? i}>
                  {cellText(cell, title, t('properties.yes'), t('properties.no'), calendars)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.more && <p className={styles.muted}>{t('related.more')}</p>}
    </div>
  )
}

/** Sus opciones: «Páginas de [plantilla] cuyo [campo] es esta página», sus columnas y su orden */
export function RelatedOptions({
  block,
  onChange
}: {
  block: RelatedBlock
  onChange: (patch: Partial<RelatedBlock>) => void
}) {
  const { t } = useTranslation()
  const templateId = useId()
  const fieldId = useId()
  const addId = useId()
  const sortId = useId()
  const all = useTemplates()
  // Solo las que tienen un campo de enlace a páginas (con ellas se hace la tabla), y la de ahora aunque ya no lo tenga
  const templates = (all.data?.templates ?? []).filter(
    (each) => each.id === block.template || each.fields.some((field) => field.type === 'pages' && field.field)
  )
  const template = templates.find((each) => each.id === block.template)
  const fields = template?.fields ?? []
  const links = fields.filter((field) => field.type === 'pages')
  const others = fields.filter((field) => field.field && !block.columns.includes(field.field))
  const nameOf = (field: string) => fields.find((f) => f.field === field)?.name ?? field
  // Otra plantilla: su primer campo de enlace y dos columnas que no sean enlaces, por título
  const pickTemplate = (id: string) => {
    const next = templates.find((each) => each.id === id)
    const nextFields = next?.fields ?? []
    onChange({
      template: id,
      field: nextFields.find((f) => f.type === 'pages')?.field ?? '',
      columns: nextFields
        .filter((f) => f.type !== 'pages' && f.field)
        .slice(0, 2)
        .map((f) => f.field as string),
      sort: 'title'
    })
  }
  // Sin ninguna con la que hacerla, una línea que lo diga
  if (all.data && templates.length === 0) return <p className={styles.muted}>{t('related.noTemplates')}</p>
  return (
    <div className={styles.options}>
      <p className={styles.sentence}>
        <label htmlFor={templateId}>{t('related.pagesOf')}</label>
        <select id={templateId} value={block.template} onChange={(event) => pickTemplate(event.currentTarget.value)}>
          {!block.template && (
            <option value="" disabled>
              {t('related.chooseTemplate')}
            </option>
          )}
          {templates.map((each) => (
            <option key={each.id} value={each.id}>
              {each.name}
            </option>
          ))}
        </select>
        <label htmlFor={fieldId}>{t('related.whose')}</label>
        <select
          id={fieldId}
          value={block.field}
          disabled={!template}
          onChange={(event) => onChange({ field: event.currentTarget.value })}
        >
          {!block.field && (
            <option value="" disabled>
              {t('related.chooseField')}
            </option>
          )}
          {links.map((field) => (
            <option key={field.field} value={field.field}>
              {field.name}
            </option>
          ))}
        </select>
        <span>{t('related.isThis')}</span>
      </p>
      <div className={styles.columns}>
        <span className={styles.label}>{t('related.columns')}</span>
        {block.columns.map((column) => (
          <span key={column} className={styles.column}>
            {nameOf(column)}
            <button
              type="button"
              aria-label={t('related.removeColumn', { name: nameOf(column) })}
              onClick={() =>
                onChange({
                  columns: block.columns.filter((each) => each !== column),
                  ...(block.sort === column ? { sort: 'title' } : {})
                })
              }
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        {block.columns.length < 3 && others.length > 0 && (
          <>
            <label htmlFor={addId} className={styles.hidden}>
              {t('related.addColumn')}
            </label>
            <select
              id={addId}
              value=""
              onChange={(event) => {
                const column = event.currentTarget.value
                if (column) onChange({ columns: [...block.columns, column] })
              }}
            >
              <option value="">{t('related.addColumn')}</option>
              {others.map((field) => (
                <option key={field.field} value={field.field}>
                  {field.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <p className={styles.sentence}>
        <label htmlFor={sortId}>{t('related.sort')}</label>
        <select id={sortId} value={block.sort} onChange={(event) => onChange({ sort: event.currentTarget.value })}>
          <option value="title">{t('related.byTitle')}</option>
          {block.columns.map((column) => (
            <option key={column} value={column}>
              {nameOf(column)}
            </option>
          ))}
        </select>
      </p>
    </div>
  )
}
