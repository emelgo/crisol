/**
 * El menú de una página en el árbol, con el botón derecho (o la tecla de menú, o Mayús+F10), como en Everlore: crear
 * una subpágina, renombrar (pone en edición su título, sin cuadro), duplicar, exportar, mover, ordenar sus subpáginas y
 * borrar. Flota junto al ratón
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
  Eye,
  EyeOff,
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
import { useCurrentCampaign } from '../campaign/current-campaign.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useLinkedBy } from './backlinks.tsx'
import { useExport } from './export.tsx'
import { useNewPage } from './new-page.tsx'
import { requestTitleEdit } from './title-edit.ts'
import styles from './tree-menu.module.css'
import { knowledgeKey, useMark } from './who-knows.tsx'

type View = 'menu' | 'delete'
type Sub = 'move' | 'sort' | 'reveal'

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export function TreeMenu({
  worldId,
  page,
  at,
  isHome,
  openPath,
  startReveal = false,
  onClose
}: {
  worldId: string
  page: PageSummary
  at: { x: number; y: number }
  isHome: boolean
  /** La página abierta y las de encima: si se borra una de ellas, se va a la madre de la borrada */
  openPath: readonly string[]
  /** Abierto desde el ojo de la fila: con «Revelar a…» ya desplegado */
  startReveal?: boolean
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
  const [sub, setSub] = useState<Sub | null>(startReveal ? 'reveal' : null)
  const flyout = useRef<HTMLDivElement>(null)
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

  // Renombrar no abre un cuadro: pone en edición el título de la propia página (abriéndola si no lo está)
  const rename = () => {
    onClose()
    requestTitleEdit(page.id)
    if (openPath.at(-1) !== page.id)
      void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: page.id } })
  }
  // Una copia entera (portada, hoja, panel, texto y pestañas), justo detrás: la hace el servidor, de una vez
  const duplicate = useMutation({
    mutationFn: () => api.call('copyPage', { pageId: page.id, title: t('treeMenu.copyOf', { title: page.title }) }),
    onSuccess: async (copy) => {
      await refresh()
      onClose()
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
  // Revelar: lo que sabe cada campaña de la página (como en Everlore, desde el árbol; Enrique, 2026-11-16). Solo dentro
  // de una campaña: en las páginas del mundo no se revela (Enrique, 2026-11-19)
  const campaign = useCurrentCampaign()
  const knowledge = useQuery({
    queryKey: knowledgeKey(worldId, page.id),
    queryFn: () => api.call('getPageKnowledge', { pageId: page.id }),
    enabled: sub === 'reveal'
  })
  const mark = useMark({ id: page.id, worldId })
  const error = duplicate.error ?? move.error ?? sort.error ?? remove.error

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (sub) {
        // Al cerrar el desplegable, el foco vuelve a la opción que lo abrió (si no, se quedaría en lo que se quita)
        const open = event.currentTarget.querySelector<HTMLElement>('[aria-haspopup][aria-expanded="true"]')
        setSub(null)
        open?.focus()
      } else if (view === 'menu') onClose(true)
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
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter(
      (element) => element.closest('[data-flyout]') === inFlyout
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    event.preventDefault()
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  // Abrir el desplegable con el teclado (o al pulsar): el foco, dentro
  const openSub = (which: Sub) => {
    setSub(which)
    requestAnimationFrame(() => flyout.current?.querySelector<HTMLElement>('input, [role^="menuitem"]')?.focus())
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
          {item(<Pencil aria-hidden="true" size={15} />, t('treeMenu.rename'), rename)}
          {item(<Copy aria-hidden="true" size={15} />, t('treeMenu.duplicate'), () => duplicate.mutate())}
          {item(<Download aria-hidden="true" size={15} />, t('treeMenu.export'), () => {
            run.mutate({ worldId, pageId: page.id, children: page.hasChildren })
            onClose(true)
          })}
          <div className={styles.separator} />
          {campaign && (
            // biome-ignore lint/a11y/noStaticElementInteractions: con el teclado se abre con la flecha derecha
            <div className={styles.subWrap} onMouseEnter={() => setSub('reveal')} onMouseLeave={() => setSub(null)}>
              {item(<Eye aria-hidden="true" size={15} />, t('treeMenu.reveal'), () => openSub('reveal'), {
                more: true,
                sub: 'reveal'
              })}
              {sub === 'reveal' && (
                <div
                  ref={flyout}
                  className={styles.flyout}
                  data-flyout=""
                  role="menu"
                  aria-label={t('treeMenu.reveal')}
                >
                  {knowledge.data?.campaigns.length === 0 && <p className={styles.note}>{t('treeMenu.noCampaigns')}</p>}
                  {knowledge.data?.campaigns.map((row) => {
                    const knows = row.audience !== 'none'
                    return (
                      <button
                        key={row.campaignId}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={knows}
                        tabIndex={-1}
                        className={styles.item}
                        disabled={mark.isPending}
                        onClick={() => mark.mutate({ campaignId: row.campaignId, known: !knows })}
                      >
                        {knows ? <Eye aria-hidden="true" size={15} /> : <EyeOff aria-hidden="true" size={15} />}
                        <span>{row.name}</span>
                        <span className={styles.path}>{t(knows ? 'treeMenu.knows' : 'treeMenu.unknown')}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
