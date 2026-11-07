/**
 * Las pestañas de una página (ADR-0007): «Texto», que es su cuerpo y va siempre primero, y las que se le añaden (un
 * mapa). Sin pestañas añadidas no se pinta nada: el mapa se añade desde «⋯». La elegida va en la dirección (?pestana=)
 */
import type { Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  Clock,
  Dices,
  FileText,
  Grid3x3,
  Map as MapIcon,
  Network,
  PenTool,
  Plus,
  Trash2
} from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import dialogStyles from '../../components/dialog.module.css'
import { useDismiss } from '../../components/dismiss.ts'
import { FormError } from '../../components/field.tsx'
import { focusIsLost, focusOnMount } from '../../components/focus.ts'
import form from '../../components/form.module.css'
import { Modal } from '../../components/modal.tsx'
import { ColorChoices } from '../../routes/world-card.tsx'
import { colorHex } from '../../routes/world-look.ts'
import type { SceneChoice } from '../../tabletop/use-preparation.ts'
import { TargetReveal } from '../reveal.tsx'
import { setPendingChoice } from '../scene/pending.ts'
import { SourcePicker } from '../scene/source-picker.tsx'
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

/**
 * La barra, como en Everlore: «Texto» y las añadidas; la elegida, con su menú (nombre, color y quitar); se recolocan
 * arrastrando (o con Alt y las flechas). Al final,
 * «+» para añadir otra
 */
export function PageTabs({ page, tabs, active }: { page: Page; tabs: PageTabView[]; active: string | null }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = { worldId: page.worldId, pageId: page.id }
  // El botón derecho sobre una pestaña: se elige y se abre su menú
  const [menuFor, setMenuFor] = useState<string | null>(null)
  // Recolocar arrastrando: la que se lleva y sobre cuál va (se pone delante de ella)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const move = useMutation({
    mutationFn: ({ tabId, after }: { tabId: string; after: string | null }) =>
      api.call('updatePageTab', { tabId, after }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
  })
  const dropOn = (target: string) => {
    if (!dragging || dragging === target) return
    const others = tabs.filter((tab) => tab.id !== dragging)
    const at = others.findIndex((tab) => tab.id === target)
    move.mutate({ tabId: dragging, after: at > 0 ? (others[at - 1]?.id ?? null) : null })
  }
  return (
    <nav aria-label={t('pageTabs.label')} className={styles.bar} data-tour="mapa-pestanas" data-side-anchor="">
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
          <li
            key={tab.id}
            className={styles.item}
            draggable={!page.locked}
            data-dragging={dragging === tab.id || undefined}
            data-over={(over === tab.id && dragging !== tab.id) || undefined}
            onDragStart={(event) => {
              setDragging(tab.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', tab.name)
            }}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            onDragOver={(event) => {
              if (!dragging) return
              event.preventDefault()
              setOver(tab.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              dropOn(tab.id)
              setDragging(null)
              setOver(null)
            }}
            onContextMenu={(event) => {
              if (page.locked) return
              event.preventDefault()
              setMenuFor(tab.id)
              if (active !== tab.id)
                void navigate({ to: '/mundos/$worldId/wiki/$pageId', params, search: { pestana: tab.id } })
            }}
          >
            <Link
              draggable={false}
              to="/mundos/$worldId/wiki/$pageId"
              params={params}
              search={{ pestana: tab.id }}
              activeOptions={{ exact: true, includeSearch: true }}
              className={styles.tab}
              aria-current={active === tab.id ? 'page' : undefined}
              style={tab.color ? ({ '--tab-color': colorHex(tab.color) } as CSSProperties) : undefined}
              data-color={tab.color ? '' : undefined}
              aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
              // Con el teclado, Alt y las flechas la recolocan (con el ratón, arrastrando)
              onKeyDown={(event) => {
                if (page.locked || !event.altKey) return
                if (event.key === 'ArrowLeft' && index > 0) {
                  event.preventDefault()
                  move.mutate({ tabId: tab.id, after: tabs[index - 2]?.id ?? null })
                } else if (event.key === 'ArrowRight' && index < tabs.length - 1) {
                  event.preventDefault()
                  move.mutate({ tabId: tab.id, after: tabs[index + 1]?.id ?? null })
                }
              }}
            >
              {tab.kind === 'text' ? (
                <FileText aria-hidden="true" size={14} />
              ) : tab.kind === 'table' ? (
                <Dices aria-hidden="true" size={14} />
              ) : tab.kind === 'scene' ? (
                <Grid3x3 aria-hidden="true" size={14} />
              ) : (
                <MapIcon aria-hidden="true" size={14} />
              )}
              {tab.name}
            </Link>
            {active === tab.id && !page.locked && (
              <TabMenu
                page={page}
                tabs={tabs}
                index={index}
                requested={menuFor === tab.id}
                onRequested={() => setMenuFor(null)}
              />
            )}
          </li>
        ))}
        {!page.locked && (
          <li>
            <NewTab page={page} />
          </li>
        )}
      </ul>
      {/* «Guardado», a la derecha de las pestañas (lo pone el texto de la página) */}
      <span className={styles.saveSlot} data-save-slot="" />
    </nav>
  )
}

/** Los tipos de pestaña: texto, mapa, tabla y escena ya; los demás, en las fases que vienen (ADR-0007) */
const KINDS = [
  { kind: 'text', icon: FileText, ready: true },
  { kind: 'map', icon: MapIcon, ready: true },
  { kind: 'table', icon: Dices, ready: true },
  { kind: 'scene', icon: Grid3x3, ready: true },
  { kind: 'board', icon: PenTool, ready: false },
  { kind: 'timeline', icon: Clock, ready: false },
  { kind: 'tree', icon: Network, ready: false }
] as const

/** «+»: un cuadro con un recuadro por tipo y el nombre (sin él, el del tipo); la nueva va al final y se abre */
function NewTab({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'text' | 'map' | 'table' | 'scene'>('text')
  // Una escena puede nacer ya con su mapa: se prepara al abrirla
  const [choice, setChoice] = useState<SceneChoice | null>(null)
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const add = useMutation({
    mutationFn: () =>
      api.call('createPageTab', { pageId: page.id, kind, ...(name.trim() ? { name: name.trim() } : {}) }),
    onSuccess: async (tab) => {
      if (tab.kind === 'scene' && choice) setPendingChoice(tab.id, choice)
      // Ya en la lista, sin esperar a pedirla otra vez
      queryClient.setQueryData<PageTabView[]>(tabsKey(page.worldId, page.id), (tabs) => [...(tabs ?? []), tab])
      void queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
      dialog.current?.close()
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId: page.worldId, pageId: page.id },
        search: { pestana: tab.id }
      })
    }
  })
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.add}
        aria-label={t('pageTabs.add')}
        title={t('pageTabs.add')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" size={16} />
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={`${dialogStyles.dialog} ${styles.newDialog}${kind === 'scene' ? ` ${styles.wideDialog}` : ''}`}
          onClose={() => {
            setOpen(false)
            setName('')
            setKind('text')
            setChoice(null)
            // Se quita al acabar de irse: si ya se está en otro sitio (escribiendo en la nueva), el foco no se mueve
            const at = document.activeElement
            if (focusIsLost() || at === trigger.current || dialog.current?.contains(at)) trigger.current?.focus()
          }}
        >
          <form
            className={styles.newForm}
            onSubmit={(event) => {
              event.preventDefault()
              add.mutate()
            }}
          >
            <h2 id={titleId}>{t('pageTabs.newTitle')}</h2>
            <fieldset className={styles.kinds}>
              <legend className={styles.hidden}>{t('pageTabs.kind')}</legend>
              {KINDS.map(({ kind: option, icon: Icon, ready }) => (
                <label key={option} className={styles.kindCard} data-ready={ready || undefined}>
                  <input
                    type="radio"
                    name={`${titleId}-kind`}
                    disabled={!ready}
                    checked={kind === option}
                    onChange={() => {
                      if (ready) setKind(option as typeof kind)
                    }}
                  />
                  <Icon aria-hidden="true" size={20} />
                  {t(`pageTabs.kinds.${option}`)}
                  {!ready && <span className={styles.soon}>{t('pageTabs.soon')}</span>}
                </label>
              ))}
            </fieldset>
            <input
              className={styles.nameInput}
              data-autofocus=""
              value={name}
              maxLength={60}
              placeholder={t('pageTabs.namePlaceholder')}
              aria-label={t('pageTabs.name')}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            {kind === 'scene' && <SourcePicker worldId={page.worldId} value={choice} onChange={setChoice} />}
            <FormError message={add.error ? errorText(add.error) : null} />
            <BusyButton type="submit" className={form.button} busy={add.isPending}>
              {t('pageTabs.create')}
            </BusyButton>
          </form>
        </Modal>
      )}
    </>
  )
}

/** El menú de la pestaña elegida */
function TabMenu({
  page,
  tabs,
  index,
  requested,
  onRequested
}: {
  page: Page
  tabs: PageTabView[]
  index: number
  /** Pedido con el botón derecho: se abre solo */
  requested: boolean
  onRequested: () => void
}) {
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
  useEffect(() => {
    if (!requested) return
    setOpen(true)
    onRequested()
  }, [requested, onRequested])
  const panelId = useId()
  const nameId = useId()
  const close = () => {
    // El nombre cambiado se guarda también al cerrar (pulsando fuera o con Escape: el campo no llega a perder el foco)
    rename()
    setOpen(false)
    setConfirming(false)
  }
  useDismiss(open, close, root, trigger)
  const refresh = () => queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
  const update = useMutation({
    mutationFn: (patch: { name?: string; color?: PageTabView['color']; hidden?: boolean }) =>
      api.call('updatePageTab', { tabId: tab.id, ...patch }),
    // Se ve ya, sin esperar al servidor
    onMutate: (patch) =>
      queryClient.setQueryData<PageTabView[]>(tabsKey(page.worldId, page.id), (current) =>
        current?.map((other) => (other.id === tab.id ? { ...other, ...patch } : other))
      ),
    onSettled: refresh
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
            className={styles.nameField}
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
          <ColorChoices value={tab.color} onChange={(color) => update.mutate({ color })} />
          {/* Los jugadores (ADR-0017): oculta, o revelarla en partida */}
          <div className={styles.players}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={tab.hidden}
                onChange={(event) => update.mutate({ hidden: event.currentTarget.checked })}
              />
              {t('pageTabs.hiddenFromPlayers')}
            </label>
            <TargetReveal worldId={page.worldId} pageId={page.id} kind="tab" targetId={tab.id} />
          </div>
          {confirming ? (
            // Confirmar, en el mismo sitio y con la misma letra que el menú
            <div className={styles.confirm}>
              <p>{t('pageTabs.deleteWarning', { name: tab.name })}</p>
              <div className={styles.confirmActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setConfirming(false)}>
                  {t('list.cancel')}
                </button>
                <BusyButton
                  ref={focusOnMount}
                  className={styles.confirmButton}
                  busy={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {t('pageTabs.confirmDelete')}
                </BusyButton>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.deleteButton} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" size={15} />
              {t('pageTabs.delete')}
            </button>
          )}
          <FormError message={update.error || remove.error ? errorText(update.error ?? remove.error) : null} />
        </div>
      )}
    </div>
  )
}
