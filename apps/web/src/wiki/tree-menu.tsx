/**
 * El menú de una página en el árbol, con el botón derecho (o la tecla de menú, o Mayús+F10), como en Everlore: crear
 * una subpágina, renombrar, duplicar, exportar, mover, ordenar sus subpáginas y borrar. Flota junto al ratón
 */
import type { PageSummary } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDownAZ,
  ArrowUpZA,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FolderInput,
  Pencil,
  Trash2
} from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useLinkedBy } from './backlinks.tsx'
import { useExport } from './export.tsx'
import { useNewPage } from './new-page.tsx'
import styles from './tree-menu.module.css'

type View = 'menu' | 'rename' | 'delete'
type Sub = 'move' | 'sort'

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export function TreeMenu({
  worldId,
  page,
  at,
  isHome,
  openPath,
  onClose
}: {
  worldId: string
  page: PageSummary
  at: { x: number; y: number }
  isHome: boolean
  /** La página abierta y las de encima: si se borra una de ellas, se va a la madre de la borrada */
  openPath: readonly string[]
  onClose: (returnFocus?: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const newPage = useNewPage()
  const run = useExport()
  const menu = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('menu')
  // El desplegable de al lado (mover u ordenar): se abre al pasar por encima, sin pulsar
  const [sub, setSub] = useState<Sub | null>(null)
  const flyout = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(page.title)
  const [filter, setFilter] = useState('')
  const [place, setPlace] = useState(at)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
  const close = useRef(onClose)
  close.current = onClose

  // Que no se salga de la pantalla
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect()
    if (!box) return
    setPlace({
      x: Math.max(8, Math.min(at.x, window.innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - box.height - 8))
    })
  }, [at, view])
  // Al abrirse (y al cambiar de vista), el foco dentro; un clic fuera lo cierra
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('input, [role="menuitem"]')?.focus()
  }, [view])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

  const rename = useMutation({
    mutationFn: (next: string) => api.call('updatePage', { pageId: page.id, title: next }),
    onSuccess: async () => {
      await refresh()
      onClose(true)
    }
  })
  const duplicate = useMutation({
    mutationFn: async () => {
      const [{ markdown }, full] = await Promise.all([
        api.call('readPage', { pageId: page.id }),
        api.call('getPage', { pageId: page.id })
      ])
      const { pages } = await api.call('createPages', {
        worldId,
        parentId: page.parentId,
        pages: [
          {
            key: 'copia',
            title: t('treeMenu.copyOf', { title: page.title }),
            ...(page.icon ? { icon: page.icon } : {}),
            markdown
          }
        ]
      })
      const copy = pages[0]
      if (!copy) return null
      await api.call('movePage', { pageId: copy.id, parentId: page.parentId, after: page.id })
      if (full.panel.length > 0) await api.call('setPagePanel', { pageId: copy.id, blocks: full.panel })
      return copy
    },
    onSuccess: async (copy) => {
      await refresh()
      onClose()
      if (!copy) return
      announce(t('treeMenu.duplicated', { title: page.title }))
      await navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: copy.id } })
    }
  })
  const move = useMutation({
    mutationFn: (parentId: string | null) => api.call('movePage', { pageId: page.id, parentId }),
    onSuccess: async () => {
      await refresh()
      announce(t('treeMenu.moved', { title: page.title }))
      onClose(true)
    }
  })
  const sort = useMutation({
    mutationFn: (order: 'asc' | 'desc') => api.call('sortPageChildren', { worldId, parentId: page.id, order }),
    onSuccess: async () => {
      await refresh()
      onClose(true)
    }
  })
  const remove = useMutation({
    mutationFn: () => api.call('deletePage', { pageId: page.id }),
    onSuccess: async () => {
      await refresh()
      announce(t('wiki.deleted', { title: page.title }))
      onClose()
      if (openPath.includes(page.id)) {
        await navigate(
          page.parentId
            ? { to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: page.parentId } }
            : { to: '/mundos/$worldId', params: { worldId } }
        )
      }
    }
  })
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId }),
    enabled: sub === 'move'
  })
  // Sus subpáginas: no se puede mover dentro de ellas (se metería en sí misma)
  const below = useQuery({
    queryKey: ['pages', worldId, 'branch', page.id],
    queryFn: () => api.call('listPageTree', { worldId, parentId: page.id, levels: 6 }),
    enabled: sub === 'move' && page.hasChildren
  })
  const inside = new Set((below.data?.pages ?? []).map((p) => p.id))
  const linkedBy = useLinkedBy(page, view === 'delete')
  const error = rename.error ?? duplicate.error ?? move.error ?? sort.error ?? remove.error

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (sub) setSub(null)
      else if (view === 'menu') onClose(true)
      else setView('menu')
      return
    }
    const inFlyout = (document.activeElement as HTMLElement | null)?.closest('[data-flyout]') ?? null
    if (event.key === 'ArrowLeft' && inFlyout) {
      event.preventDefault()
      const opener = inFlyout.parentElement?.querySelector<HTMLElement>('[aria-haspopup]')
      setSub(null)
      opener?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    // Las de su nivel: las del desplegable si se está en él; si no, las del menú
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
      (element) => element.closest('[data-flyout]') === inFlyout
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    event.preventDefault()
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  // Abrir el desplegable con el teclado (o al pulsar): el foco, dentro
  const openSub = (which: Sub) => {
    setSub(which)
    requestAnimationFrame(() => flyout.current?.querySelector<HTMLElement>('input, [role="menuitem"]')?.focus())
  }
  const item = (
    icon: ReactNode,
    label: string,
    onClick: () => void,
    extra?: { danger?: boolean; more?: boolean; sub?: Sub }
  ) => (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={styles.item}
      data-danger={extra?.danger || undefined}
      aria-haspopup={extra?.more ? 'menu' : undefined}
      aria-expanded={extra?.sub ? sub === extra.sub : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (extra?.sub && event.key === 'ArrowRight') {
          event.preventDefault()
          openSub(extra.sub)
        }
      }}
    >
      {icon}
      <span>{label}</span>
      {extra?.more && <ChevronRight aria-hidden="true" size={14} className={styles.more} />}
    </button>
  )

  const wanted = plain(filter.trim())
  const targets = (names.data?.pages ?? [])
    .filter((p) => p.id !== page.id && p.id !== page.parentId && !inside.has(p.id))
    .filter((p) => !wanted || plain(p.title).includes(wanted))
    .slice(0, 30)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={t('treeMenu.label', { title: page.title })}
      className={styles.menu}
      style={{ left: place.x, top: place.y }}
      onKeyDown={onKeyDown}
    >
      {view === 'menu' && (
        <>
          {item(<FilePlus aria-hidden="true" size={15} />, t('treeMenu.subpage'), () => {
            onClose()
            newPage({ id: page.id, title: page.title })
          })}
          {item(<Pencil aria-hidden="true" size={15} />, t('treeMenu.rename'), () => setView('rename'))}
          {item(<Copy aria-hidden="true" size={15} />, t('treeMenu.duplicate'), () => duplicate.mutate())}
          {item(<Download aria-hidden="true" size={15} />, t('treeMenu.export'), () => {
            run.mutate({ worldId, pageId: page.id, children: page.hasChildren })
            onClose(true)
          })}
          <div className={styles.separator} />
          {!isHome && (
            // biome-ignore lint/a11y/noStaticElementInteractions: con el teclado se abre con la flecha derecha
            <div className={styles.subWrap} onMouseEnter={() => setSub('move')} onMouseLeave={() => setSub(null)}>
              {item(<FolderInput aria-hidden="true" size={15} />, t('treeMenu.move'), () => openSub('move'), {
                more: true,
                sub: 'move'
              })}
              {sub === 'move' && (
                <div ref={flyout} className={styles.flyout} data-flyout="" role="menu" aria-label={t('treeMenu.move')}>
                  <input
                    className={styles.search}
                    value={filter}
                    placeholder={t('treeMenu.moveSearch')}
                    aria-label={t('treeMenu.moveSearch')}
                    onChange={(event) => setFilter(event.currentTarget.value)}
                  />
                  <div className={styles.list}>
                    {page.parentId &&
                      item(<FolderInput aria-hidden="true" size={15} />, t('treeMenu.moveRoot'), () =>
                        move.mutate(null)
                      )}
                    {targets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        className={styles.item}
                        onClick={() => move.mutate(target.id)}
                      >
                        <span>{target.title}</span>
                        {target.path.length > 1 && (
                          <span className={styles.path}>{target.path.slice(0, -1).join(' / ')}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {page.hasChildren && (
            // biome-ignore lint/a11y/noStaticElementInteractions: con el teclado se abre con la flecha derecha
            <div className={styles.subWrap} onMouseEnter={() => setSub('sort')} onMouseLeave={() => setSub(null)}>
              {item(<ArrowDownAZ aria-hidden="true" size={15} />, t('treeMenu.sort'), () => openSub('sort'), {
                more: true,
                sub: 'sort'
              })}
              {sub === 'sort' && (
                <div ref={flyout} className={styles.flyout} data-flyout="" role="menu" aria-label={t('treeMenu.sort')}>
                  {item(<ArrowDownAZ aria-hidden="true" size={15} />, t('treeMenu.sortAsc'), () => sort.mutate('asc'))}
                  {item(<ArrowUpZA aria-hidden="true" size={15} />, t('treeMenu.sortDesc'), () => sort.mutate('desc'))}
                </div>
              )}
            </div>
          )}
          {!isHome && (
            <>
              <div className={styles.separator} />
              {item(<Trash2 aria-hidden="true" size={15} />, t('treeMenu.delete'), () => setView('delete'), {
                danger: true
              })}
            </>
          )}
        </>
      )}
      {view === 'rename' && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            const next = title.trim()
            if (next && next !== page.title) rename.mutate(next)
            else onClose(true)
          }}
        >
          <input
            value={title}
            maxLength={200}
            aria-label={t('treeMenu.newTitle')}
            onChange={(event) => setTitle(event.currentTarget.value)}
            onFocus={(event) => event.currentTarget.select()}
          />
        </form>
      )}
      {view === 'delete' && (
        <div className={styles.confirm}>
          <p>
            {t(page.hasChildren ? 'wiki.deleteWarningWithSubpages' : 'wiki.deleteWarning', { title: page.title })}
            {linkedBy ? ` ${t('wiki.linkedBy', { count: linkedBy })}` : ''}
          </p>
          {item(<Trash2 aria-hidden="true" size={15} />, t('wiki.delete'), () => remove.mutate(), { danger: true })}
        </div>
      )}
      {error && <p className={styles.error}>{errorText(error)}</p>}
    </div>,
    document.body
  )
}
