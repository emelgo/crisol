/**
 * La pestaña Páginas de la Mesa: el árbol de páginas del mundo, con un buscador y sus ramas plegables. Elegir una la
 * abre (en una ventana sobre la Mesa: docs/diseno.md)
 */
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import styles from './pages-tab.module.css'

interface TreePage {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  level: number
  hasChildren: boolean
}

export const pageTreeKey = (worldId: string) => ['pages', worldId, 'tree', 'mesa']

const normal = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

/** Las que se ven: con búsqueda, las que coinciden (sin árbol); sin ella, las de ramas abiertas */
export function visiblePages(pages: TreePage[], open: ReadonlySet<string>, query: string): TreePage[] {
  const q = normal(query.trim())
  if (q) return pages.filter((page) => normal(page.title).includes(q))
  const shown: TreePage[] = []
  const visible = new Set<string | null>([null])
  for (const page of pages) {
    if (!visible.has(page.parentId)) continue
    shown.push(page)
    if (open.has(page.id)) visible.add(page.id)
  }
  return shown
}

export function PagesTab({ worldId, onOpen }: { worldId: string; onOpen: (pageId: string, title: string) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const tree = useQuery({
    queryKey: pageTreeKey(worldId),
    queryFn: () => api.call('listPageTree', { worldId, levels: 32 })
  })
  if (!tree.data) return failed(tree) ? <LoadError error={tree.error} onRetry={() => tree.refetch()} /> : null
  const pages = tree.data.pages
  const shown = visiblePages(pages, open, query)
  const searching = Boolean(query.trim())
  const toggle = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }
  return (
    <>
      <input
        className={styles.search}
        type="search"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        value={query}
        placeholder={t('tabletop.pages.search')}
        aria-label={t('tabletop.pages.search')}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {pages.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.pages.empty')}</p>
      ) : shown.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.noMatches')}</p>
      ) : (
        <ul className={styles.tree} aria-label={t('tabletop.sidebar.pages')}>
          {shown.map((page) => (
            <li
              key={page.id}
              className={styles.row}
              style={{ paddingInlineStart: searching ? 0 : `${page.level * 1.125}rem` }}
            >
              {page.hasChildren && !searching ? (
                <button
                  type="button"
                  className={styles.twisty}
                  aria-expanded={open.has(page.id)}
                  aria-label={t(open.has(page.id) ? 'tabletop.pages.collapse' : 'tabletop.pages.expand', {
                    title: page.title
                  })}
                  onClick={() => toggle(page.id)}
                >
                  <ChevronRight aria-hidden="true" size={14} />
                </button>
              ) : (
                <span className={styles.twisty} aria-hidden="true">
                  {!page.hasChildren && <FileText size={13} />}
                </span>
              )}
              <button type="button" className={styles.title} onClick={() => onOpen(page.id, page.title)}>
                {page.icon && <span aria-hidden="true">{page.icon} </span>}
                {page.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
