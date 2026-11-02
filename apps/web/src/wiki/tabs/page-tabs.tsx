/**
 * Las pestañas de una página (ADR-0007): «Texto», que es su cuerpo y va siempre primero, y las que se le añaden (un
 * mapa). Sin pestañas añadidas no se pinta nada: el mapa se añade desde «⋯». La elegida va en la dirección (?pestana=)
 */
import type { Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Map as MapIcon } from 'lucide-react'
import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import { FormError } from '../../components/field.tsx'
import { focusOnMount } from '../../components/focus.ts'
import form from '../../components/form.module.css'
import list from '../../components/list.module.css'
import styles from './page-tabs.module.css'

export const tabsKey = (worldId: string, pageId: string) => ['pages', worldId, 'tabs', pageId]

/** Las pestañas añadidas de una página, en orden */
export function usePageTabs(page: Page) {
  const api = useApi()
  return useQuery({
    queryKey: tabsKey(page.worldId, page.id),
    queryFn: async () => (await api.call('listPageTabs', { pageId: page.id })).tabs
  })
}

/** Abierto: pulsar fuera lo cierra; Escape también, y el foco vuelve a su botón */
function useDismiss(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, close, root, trigger])
}

/** La barra: «Texto» y las añadidas; la elegida, con su menú (renombrar, mover y quitar) */
export function PageTabs({ page, tabs, active }: { page: Page; tabs: PageTabView[]; active: string | null }) {
  const { t } = useTranslation()
  if (tabs.length === 0) return null
  const params = { worldId: page.worldId, pageId: page.id }
  return (
    <nav aria-label={t('pageTabs.label')} className={styles.bar} data-tour="mapa-pestanas">
      <ul>
        <li>
          <Link
            to="/mundos/$worldId/wiki/$pageId"
            params={params}
            search={{}}
            activeOptions={{ exact: true, includeSearch: true }}
            className={styles.tab}
            aria-current={active === null ? 'page' : undefined}
          >
            {t('pageTabs.text')}
          </Link>
        </li>
        {tabs.map((tab, index) => (
          <li key={tab.id} className={styles.item}>
            <Link
              to="/mundos/$worldId/wiki/$pageId"
              params={params}
              search={{ pestana: tab.id }}
              activeOptions={{ exact: true, includeSearch: true }}
              className={styles.tab}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              <MapIcon aria-hidden="true" size={14} />
              {tab.name}
            </Link>
            {active === tab.id && !page.locked && <TabMenu page={page} tabs={tabs} index={index} />}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** El menú de la pestaña elegida */
function TabMenu({ page, tabs, index }: { page: Page; tabs: PageTabView[]; index: number }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const tab = tabs[index] as PageTabView
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [name, setName] = useState(tab.name)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const nameId = useId()
  const close = () => {
    setOpen(false)
    setConfirming(false)
  }
  useDismiss(open, close, root, trigger)
  const refresh = () => queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
  const update = useMutation({
    mutationFn: (patch: { name?: string; after?: string | null }) =>
      api.call('updatePageTab', { tabId: tab.id, ...patch }),
    onSuccess: refresh
  })
  const remove = useMutation({
    mutationFn: () => api.call('deletePageTab', { tabId: tab.id }),
    onSuccess: async () => {
      await refresh()
      announce(t('pageTabs.deleted', { name: tab.name }))
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId: page.worldId, pageId: page.id },
        search: {}
      })
    }
  })
  const rename = () => {
    const next = name.trim()
    if (next && next !== tab.name) update.mutate({ name: next })
    else setName(tab.name)
  }
  return (
    <div ref={root} className={styles.menu}>
      <button
        ref={trigger}
        type="button"
        className={styles.menuButton}
        aria-label={t('pageTabs.options', { name: tab.name })}
        title={t('pageTabs.options', { name: tab.name })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <label htmlFor={nameId}>{t('pageTabs.name')}</label>
          <input
            id={nameId}
            ref={focusOnMount}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={rename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                rename()
              }
            }}
          />
          <div className={styles.row}>
            {/* A la izquierda: tras la de antes de la de antes (o la primera tras el texto); a la derecha: tras la siguiente */}
            <button
              type="button"
              className={list.secondary}
              disabled={index === 0}
              onClick={() => update.mutate({ after: tabs[index - 2]?.id ?? null })}
            >
              {t('pageTabs.moveLeft')}
            </button>
            <button
              type="button"
              className={list.secondary}
              disabled={index === tabs.length - 1}
              onClick={() => update.mutate({ after: tabs[index + 1]?.id ?? null })}
            >
              {t('pageTabs.moveRight')}
            </button>
          </div>
          {confirming ? (
            <div className={list.confirm}>
              <p>{t('pageTabs.deleteWarning', { name: tab.name })}</p>
              <div className={list.actions}>
                <BusyButton
                  ref={focusOnMount}
                  className={form.button}
                  busy={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {t('pageTabs.delete')}
                </BusyButton>
                <button type="button" className={list.secondary} onClick={() => setConfirming(false)}>
                  {t('list.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={list.secondary} onClick={() => setConfirming(true)}>
              {t('pageTabs.delete')}
            </button>
          )}
          <FormError message={update.error || remove.error ? errorText(update.error ?? remove.error) : null} />
        </div>
      )}
    </div>
  )
}

/** «Añadir mapa», en «⋯»: la pestaña nueva, al final, y se abre */
export function AddMapTab({ page, onDone }: { page: Page; onDone: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const add = useMutation({
    mutationFn: () => api.call('createPageTab', { pageId: page.id, kind: 'map' }),
    onSuccess: async (tab) => {
      // Ya en la lista, sin esperar a pedirla otra vez
      queryClient.setQueryData<PageTabView[]>(tabsKey(page.worldId, page.id), (tabs) => [...(tabs ?? []), tab])
      void queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
      onDone()
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId: page.worldId, pageId: page.id },
        search: { pestana: tab.id }
      })
    }
  })
  if (page.locked) return null
  return (
    <>
      <BusyButton className={list.secondary} busy={add.isPending} onClick={() => add.mutate()}>
        {t('pageTabs.addMap')}
      </BusyButton>
      <FormError message={add.error ? errorText(add.error) : null} />
    </>
  )
}
