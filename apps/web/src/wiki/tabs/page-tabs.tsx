/**
 * Las pestañas de una página (ADR-0007): «Texto», que es su cuerpo y va siempre primero, y las que se le añaden (un
 * mapa). Sin pestañas añadidas no se pinta nada: el mapa se añade desde «⋯». La elegida va en la dirección (?pestana=)
 */
import type { Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, type ToOptions, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Dices, FileText, Grid3x3, Map as MapIcon, Plus, Trash2 } from 'lucide-react'
import { type CSSProperties, createContext, useContext, useEffect, useId, useRef, useState } from 'react'
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
import { TemplatePicker, useTemplates } from '../../templates/picker.tsx'
import { TargetReveal } from '../reveal.tsx'
import { setPendingChoice } from '../scene/pending.ts'
import { SourcePicker } from '../scene/source-picker.tsx'
import { KindChoices, StepBack, TAB_KINDS, tabIcon } from './kinds.tsx'
import styles from './page-tabs.module.css'

export const tabsKey = (worldId: string, pageId: string) => ['pages', worldId, 'tabs', pageId]

/**
 * Adónde lleva cada pestaña (null, su texto): a la página en la wiki de su mundo o, en el editor de una plantilla, a la
 * plantilla (ADR-0024), que lo dice con TabTargetContext
 */
export type TabTarget = (pestana: string | null) => ToOptions
export const TabTargetContext = createContext<TabTarget | null>(null)
export function useTabTarget(page: Page): TabTarget {
  const target = useContext(TabTargetContext)
  return (
    target ??
    ((pestana) => ({
      to: '/mundos/$worldId/wiki/$pageId',
      params: { worldId: page.worldId, pageId: page.id },
      search: pestana ? { pestana } : {}
    }))
  )
}

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
  const target = useTabTarget(page)
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
            {...target(null)}
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
              if (active !== tab.id) void navigate(target(tab.id))
            }}
          >
            <Link
              draggable={false}
              {...target(tab.id)}
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
/**
 * «+»: un cuadro con un recuadro por tipo y el nombre (sin él, el del tipo); la nueva va al final y se abre. «Desde
 * plantilla», la última tras una raya con «o», añade las pestañas de una plantilla (las que se dejen marcadas)
 */
function NewTab({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const target = useTabTarget(page)
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'text' | 'map' | 'table' | 'scene'>('text')
  // Desde una plantilla: cuál y qué pestañas suyas (de entrada, todas)
  const [fromTemplate, setFromTemplate] = useState(false)
  const [back, setBack] = useState(false)
  const [template, setTemplate] = useState<string | null>(null)
  const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set())
  const templates = useTemplates().data?.templates ?? []
  const chosen = templates.find((each) => each.id === template)
  const adding = (chosen?.tabs ?? []).filter((tab) => !left.has(tab.id))
  // Una escena puede nacer ya con su mapa: se prepara al abrirla
  const [choice, setChoice] = useState<SceneChoice | null>(null)
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const done = async (tabs: PageTabView[]) => {
    // Ya en la lista, sin esperar a pedirla otra vez
    queryClient.setQueryData<PageTabView[]>(tabsKey(page.worldId, page.id), (current) => [...(current ?? []), ...tabs])
    void queryClient.invalidateQueries({ queryKey: tabsKey(page.worldId, page.id) })
    dialog.current?.close()
    if (tabs[0]) await navigate(target(tabs[0].id))
  }
  const add = useMutation({
    mutationFn: async () => {
      if (fromTemplate && chosen) {
        return (
          await api.call('addTemplateTabs', {
            pageId: page.id,
            templateId: chosen.id,
            tabIds: adding.map((tab) => tab.id)
          })
        ).tabs
      }
      const tab = await api.call('createPageTab', {
        pageId: page.id,
        kind,
        ...(name.trim() ? { name: name.trim() } : {})
      })
      if (tab.kind === 'scene' && choice) setPendingChoice(tab.id, choice)
      return [tab]
    },
    onSuccess: done
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
          className={`${dialogStyles.dialog} ${styles.newDialog}${!fromTemplate && kind === 'scene' ? ` ${styles.wideDialog}` : ''}`}
          onClose={() => {
            setOpen(false)
            setName('')
            setKind('text')
            setChoice(null)
            setFromTemplate(false)
            setBack(false)
            setTemplate(null)
            setLeft(new Set())
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
            {fromTemplate ? (
              <>
                <StepBack
                  onClick={() => {
                    setFromTemplate(false)
                    setBack(true)
                  }}
                />
                {/* Solo las que traen pestañas, y debajo de cada una, cuáles */}
                <TemplatePicker
                  value={template}
                  only={(each) => each.tabs.length > 0}
                  hint={(each) => each.tabs.map((tab) => tab.name).join(', ')}
                  autoFocus
                  onChange={(id) => {
                    setTemplate(id)
                    setLeft(new Set())
                  }}
                />
                {chosen && (
                  <fieldset className={styles.chosenTabs}>
                    <legend>{t('pageTabs.added')}</legend>
                    {chosen.tabs.map((tab) => {
                      const Icon = tabIcon(tab.kind)
                      return (
                        <label key={tab.id}>
                          <input
                            type="checkbox"
                            checked={!left.has(tab.id)}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked
                              setLeft((current) => {
                                const next = new Set(current)
                                if (checked) next.delete(tab.id)
                                else next.add(tab.id)
                                return next
                              })
                            }}
                          />
                          <Icon aria-hidden="true" size={16} />
                          {t('pageTabs.namedKind', { kind: t(`pageTabs.kinds.${tab.kind}`), name: tab.name })}
                        </label>
                      )
                    })}
                    {chosen.tabs.length === 0 && <p className={styles.noTabs}>{t('pageTabs.templateHasNone')}</p>}
                  </fieldset>
                )}
              </>
            ) : (
              <>
                <KindChoices
                  name={`${titleId}-kind`}
                  legend={t('pageTabs.kind')}
                  kinds={TAB_KINDS}
                  value={kind}
                  labelOf={(each) => t(`pageTabs.kinds.${each}`)}
                  onChange={(each) => setKind(each as typeof kind)}
                  onTemplate={() => setFromTemplate(true)}
                  focusTemplate={back}
                />
                <input
                  className={styles.nameInput}
                  data-autofocus={back ? undefined : ''}
                  value={name}
                  maxLength={60}
                  placeholder={t('pageTabs.namePlaceholder')}
                  aria-label={t('pageTabs.name')}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
                {kind === 'scene' && <SourcePicker worldId={page.worldId} value={choice} onChange={setChoice} />}
              </>
            )}
            <FormError message={add.error ? errorText(add.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton
                type="submit"
                className={form.button}
                busy={add.isPending}
                disabled={fromTemplate && adding.length === 0}
              >
                {t('pageTabs.create')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('pageTabs.cancel')}
              </button>
            </div>
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
  const target = useTabTarget(page)
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
      await navigate(target(null))
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
