/**
 * La pestaña «Páginas» de la barra del mundo: el buscador (por nombre o #etiqueta; con Intro, en el texto de todas), el
 * árbol (o lo que coincide) y, debajo, los marcadores
 */
import type { Page } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { FileText, ListFilter } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { Bookmarks } from '../navigation.tsx'
import panelStyles from '../panel-blocks.module.css'
import { PageTree } from '../tree.tsx'
import styles from '../wiki.module.css'

/** Normalizado para comparar: sin mayúsculas ni tildes */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export function PagesPanel({ worldId, current }: { worldId: string; current: Page | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  return (
    <>
      <PageFilter
        label={t('wiki.filter')}
        value={filter}
        onChange={setFilter}
        // Intro busca dentro del texto de todas
        onSearch={(q) => void navigate({ to: '/mundos/$worldId/buscar', params: { worldId }, search: { q } })}
      />
      {filter.trim() ? (
        <FilteredPages worldId={worldId} query={filter} currentId={current?.id} />
      ) : (
        <PageTree worldId={worldId} currentId={current?.id} path={current?.path} onNavigate={() => undefined} />
      )}
      {/* Los marcadores, debajo del árbol */}
      <div className={styles.asideBookmarks}>
        <Bookmarks worldId={worldId} />
      </div>
    </>
  )
}

/** El campo para filtrar el árbol, como en LegendKeeper: por nombre o, con «#», por etiqueta */
function PageFilter({
  label,
  value,
  onChange,
  onSearch
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
}) {
  const { t } = useTranslation()
  const hintId = useId()
  return (
    <div className={styles.filter} data-tour="buscador">
      {/* La pista, también para el lector de pantalla y lo táctil (no solo en el title) */}
      <span id={hintId} className={panelStyles.visuallyHidden}>
        {t('wiki.filterHint')}
      </span>
      <input
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        type="search"
        value={value}
        aria-label={label}
        aria-describedby={hintId}
        placeholder={label}
        title={t('wiki.filterHint')}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation()
            onChange('')
          }
          if (event.key === 'Enter' && value.trim() && !value.trim().startsWith('#')) {
            event.preventDefault()
            onSearch(value.trim())
          }
        }}
      />
      <ListFilter aria-hidden="true" size={16} />
    </div>
  )
}

/** Las páginas que coinciden con el filtro, en una lista, con su camino debajo */
function FilteredPages({
  worldId,
  query,
  currentId
}: {
  worldId: string
  query: string
  currentId: string | undefined
}) {
  const { t } = useTranslation()
  const api = useApi()
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const wanted = plain(query.trim())
  const byTag = wanted.startsWith('#')
  const tag = wanted.slice(1)
  const found = (names.data?.pages ?? []).filter((page) =>
    byTag
      ? page.tags.some((each) => plain(each).startsWith(tag))
      : [page.title, ...page.aliases].some((name) => plain(name).includes(wanted))
  )
  if (!names.data) return null
  if (found.length === 0) return <p className={styles.filterEmpty}>{t('wiki.filterEmpty')}</p>
  return (
    <ul className={styles.filtered} aria-label={t('wiki.filterResults')}>
      {found.map((page) => (
        <li key={page.id}>
          <Link
            to="/mundos/$worldId/wiki/$pageId"
            params={{ worldId, pageId: page.id }}
            aria-current={page.id === currentId ? 'page' : undefined}
          >
            <FileText aria-hidden="true" size={15} />
            <span>
              {page.title}
              {page.path.length > 1 && <small>{page.path.slice(0, -1).join(' › ')}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
