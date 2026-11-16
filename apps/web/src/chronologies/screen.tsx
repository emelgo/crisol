/**
 * Una cronología a pantalla entera, como el mapa (decisión 4 de Enrique, docs/specs/modulo-8.md; lienzo del módulo 8,
 * pantallas 4 a 8): arriba «‹ Calendarios», su nombre, «Ir a…», el ojo de cada campaña y sus ajustes; en el marco, la
 * vista elegida (Lista · Meses · Calendario, que se recuerda en el aparato); abajo en el centro, la píldora de cristal
 * con «+» y las tres vistas; en Meses, el zoom abajo a la derecha. Vacía, una sola pieza discontinua «Añadir evento».
 * La jugadora la lee igual, sin «+», sin «⋯» y sin arrastrar; en el móvil, Lista y Calendario (Meses, desde 640 px)
 */
import type { CalendarView, ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import { type DateValue, dateValueForm, type FullDate, shiftDate, type TimeZoom } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { CalendarDays, ChevronLeft, GanttChart, List, MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { useDismiss } from '../components/dismiss.ts'
import { EmptyState } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import { Floating } from '../components/floating.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Menu, MenuGroup, MenuItem } from '../components/menu.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { DateField } from '../wiki/date-field.tsx'
import { ItemEye } from '../wiki/map/item-eye.tsx'
import { readAsInput, readAsKey, useOpenPage, useReadAs } from '../wiki/read-as.tsx'
import { CalendarView as MonthCalendar } from './calendar-view.tsx'
import styles from './chronologies.module.css'
import { EventDialog, type EventDraft, storedDate } from './event-dialog.tsx'
import { ListView } from './list-view.tsx'
import { MonthsView } from './months-view.tsx'
import { ChronologySettings } from './settings.tsx'

const route = getRouteApi('/mundos/$worldId/calendarios/cronologias/$chronologyId')

type View = 'list' | 'months' | 'calendar'
const VIEWS: Array<{ id: View; icon: typeof List }> = [
  { id: 'list', icon: List },
  { id: 'months', icon: GanttChart },
  { id: 'calendar', icon: CalendarDays }
]
const ZOOMS: TimeZoom[] = ['years', 'months', 'days']

/** La vista elegida de cada cronología, en este aparato (si no se puede guardar, la lista) */
function rememberedView(id: string): View {
  try {
    const value = localStorage.getItem(`crisol.cronologia.${id}`)
    return value === 'months' || value === 'calendar' ? value : 'list'
  } catch {
    return 'list'
  }
}
function rememberView(id: string, view: View) {
  try {
    localStorage.setItem(`crisol.cronologia.${id}`, view)
  } catch {
    // Sin almacenamiento (ventana privada): no se recuerda
  }
}

/** Si la pantalla es estrecha (el móvil): la lista en una columna y el calendario compacto */
function useNarrowScreen(width: number) {
  const query = `(max-width: ${width - 1}px)`
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const list = matchMedia(query)
    const change = () => setNarrow(list.matches)
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [query])
  return narrow
}

export const chronologyQuery = (chronologyId: string, readAs: ReturnType<typeof useReadAs>) => [
  'chronology',
  chronologyId,
  ...readAsKey(readAs)
]

/** La pantalla del máster: «Calendarios» › una cronología */
export function ChronologyScreen() {
  const { worldId, chronologyId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  const world = worlds.data.worlds.find((w) => w.id === worldId)
  return (
    <Chronology
      worldId={worldId}
      chronologyId={chronologyId}
      organizationId={world?.organizationId}
      editable={world?.role === 'master'}
      back={
        <Link to="/mundos/$worldId/calendarios" params={{ worldId }} className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          <ChronologyBackText />
        </Link>
      }
    />
  )
}

function ChronologyBackText() {
  const { t } = useTranslation()
  return <>{t('calendars.title')}</>
}

/** Una cronología, para el máster (editable) o para quien juega (desde su campaña, con ReadAsProvider) */
export function Chronology({
  worldId,
  chronologyId,
  organizationId,
  editable,
  back
}: {
  worldId: string
  chronologyId: string
  organizationId: string | undefined
  editable: boolean
  back: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const readAs = useReadAs()
  const openPage = useOpenPage()
  const narrow = useNarrowScreen(640)
  const data = useQuery({
    queryKey: chronologyQuery(chronologyId, readAs),
    queryFn: () => api.call('getChronology', { chronologyId, ...readAsInput(readAs) })
  })
  const calendars = useQuery({
    queryKey: ['calendars', worldId, ...readAsKey(readAs)],
    queryFn: () => api.call('listCalendars', { worldId, ...readAsInput(readAs) })
  })
  const [view, setView] = useState<View>(() => rememberedView(chronologyId))
  const [zoom, setZoom] = useState<TimeZoom>('months')
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [converting, setConverting] = useState<ChronologyEntryView | null>(null)
  const [redating, setRedating] = useState<ChronologyEntryView | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  // En el móvil no hay Meses: se ve la lista
  const shown: View = narrow && view === 'months' ? 'list' : view
  const choose = (next: View) => {
    setView(next)
    rememberView(chronologyId, next)
  }

  // Lo que falla se ve (y se anuncia), no solo para el lector de pantalla
  const [failure, setFailure] = useState<string | null>(null)
  const fail = (error: unknown) => {
    const text = errorText(error)
    setFailure(text)
    announce(text)
  }
  const [deleting, setDeleting] = useState<ChronologyEntryView | null>(null)
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['chronology'] })
    void client.invalidateQueries({ queryKey: ['chronologies', worldId] })
  }, [client, worldId])
  const update = useMutation({
    mutationFn: (input: { eventId: string } & Record<string, unknown>) =>
      api.call('updateTimelineEvent', input as Parameters<typeof api.call<'updateTimelineEvent'>>[1]),
    onSuccess: refresh,
    onError: fail
  })
  const remove = useMutation({
    mutationFn: (entry: ChronologyEntryView) => api.call('deleteTimelineEvent', { eventId: entry.eventId ?? '' }),
    onSuccess: (_, entry) => {
      refresh()
      announce(t('chronologies.removed', { title: entry.title }))
    },
    onError: fail
  })
  const duplicate = useMutation({
    mutationFn: (entry: ChronologyEntryView) =>
      api.call('createTimelineEvents', {
        worldId,
        events: [
          {
            title: entry.untitled ? '' : entry.title,
            date: storedDate(entry, data.data?.calendar.id ?? ''),
            color: entry.color ?? null,
            image: entry.image ?? null,
            icon: entry.icon ?? null,
            description: entry.description ?? '',
            groupId: entry.groupId ?? null,
            pageId: entry.page?.id ?? null,
            hidden: entry.hidden ?? false
          }
        ]
      }),
    onSuccess: refresh,
    onError: fail
  })
  const updateGroups = useMutation({
    mutationFn: (groups: Array<{ id?: string; name: string; color: TimelineGroupView['color'] }>) =>
      api.call('updateTimelineGroups', { worldId, groups }),
    onSuccess: refresh,
    onError: fail
  })

  if (!data.data || !calendars.data)
    return failed(data) ? <LoadError error={data.error} onRetry={() => data.refetch()} /> : <Loading />
  const { chronology, calendar, groups, entries, outside } = data.data
  const definition = calendar.definition

  /** Mover una entrada en el tiempo (arrastrarla): un evento, su fecha; una página, su campo de fecha */
  const move = (entry: ChronologyEntryView, unit: 'days' | 'months' | 'years', steps: number) => {
    const moved = shiftDate(
      definition,
      {
        start: entry.start,
        ...(entry.end ? { end: entry.end } : {}),
        ...(entry.yearly ? { yearly: true as const } : {})
      },
      unit,
      steps
    )
    if (!moved || !entry.eventId) return
    update.mutate({ eventId: entry.eventId, date: { calendarId: calendar.id, ...moved } })
    announce(
      t('chronologies.moved', {
        title: entry.title,
        steps,
        unit: t(`chronologies.units.${unit}`, { count: Math.abs(steps) })
      })
    )
  }
  const edit = (entry: ChronologyEntryView) => {
    opener.current = document.activeElement as HTMLElement | null
    setDraft({ entry })
  }
  const create = (date: FullDate | null = null) => {
    opener.current = document.activeElement as HTMLElement | null
    setDraft({ date: date ? ({ calendarId: calendar.id, start: date } as DateValue) : null })
  }

  const menuFor = editable
    ? (entry: ChronologyEntryView) => (
        <Menu
          label={t('chronologies.entryActions', { title: entry.title })}
          icon={<MoreHorizontal size={16} aria-hidden="true" />}
          className={styles.cardMenu}
        >
          {(close) =>
            entry.kind === 'event' ? (
              <>
                <MenuItem
                  onClick={() => {
                    close()
                    edit(entry)
                  }}
                >
                  {t('chronologies.menu.edit')}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close()
                    duplicate.mutate(entry)
                  }}
                >
                  {t('chronologies.menu.duplicate')}
                </MenuItem>
                <MenuGroup label={t('chronologies.menu.color')}>
                  {[null, 'wine', 'moss', 'slate', 'ochre', 'sea', 'plum'].map((color) => (
                    <MenuItem
                      key={color ?? 'none'}
                      onClick={() => {
                        close()
                        update.mutate({ eventId: entry.eventId ?? '', color })
                      }}
                    >
                      {color ? t(`worlds.colors.${color as 'wine'}`) : t('chronologies.dialog.groupColor')}
                    </MenuItem>
                  ))}
                </MenuGroup>
                {groups.length > 0 && (
                  <MenuGroup label={t('chronologies.menu.group')}>
                    {[{ id: null as string | null, name: t('chronologies.lanes.none') }, ...groups].map((group) => (
                      <MenuItem
                        key={group.id ?? 'none'}
                        aria-current={(entry.groupId ?? null) === group.id || undefined}
                        onClick={() => {
                          close()
                          update.mutate({ eventId: entry.eventId ?? '', groupId: group.id })
                        }}
                      >
                        {group.name}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                )}
                {!entry.page && (
                  <MenuItem
                    onClick={() => {
                      close()
                      setConverting(entry)
                    }}
                  >
                    {t('chronologies.menu.convert')}
                  </MenuItem>
                )}
                <MenuItem
                  className={styles.danger}
                  onClick={() => {
                    close()
                    setDeleting(entry)
                  }}
                >
                  {t('chronologies.menu.delete')}
                </MenuItem>
              </>
            ) : (
              <>
                {entry.property && !entry.converted && (
                  <MenuItem
                    onClick={() => {
                      close()
                      setRedating(entry)
                    }}
                  >
                    {t('chronologies.menu.redate')}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    close()
                    if (entry.pageId) openPage(worldId, entry.pageId)
                  }}
                >
                  {t('chronologies.menu.openPage')}
                </MenuItem>
              </>
            )
          }
        </Menu>
      )
    : undefined

  const empty = entries.length === 0
  return (
    <div className={styles.screen} data-narrow={narrow || undefined}>
      <header className={styles.head}>
        {back}
        <PageTitle>{chronology.name}</PageTitle>
        <p className={styles.headFacts}>
          {calendar.name}
          {outside > 0 && <span> · {t('chronologies.outside', { count: outside })}</span>}
        </p>
        <div className={styles.headTools}>
          {!empty && <GoTo entries={entries} onPick={(key) => setFocusKey(key)} />}
          {editable && (
            <>
              <ItemEye
                page={{ id: '', worldId }}
                target={{ kind: 'chronology', targetId: chronology.id }}
                feminine
                hidden={false}
              />
              <ChronologySettings
                worldId={worldId}
                organizationId={organizationId}
                chronology={chronology}
                calendars={calendars.data.calendars}
                groups={groups}
                outside={outside}
              />
            </>
          )}
        </div>
      </header>
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('chronologies.closeFailure')}
            onClick={() => setFailure(null)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      )}
      {narrow && (
        <div
          className={styles.segmented}
          role="toolbar"
          aria-label={t('chronologies.views.label')}
          data-tour="cronologia-vistas"
        >
          {VIEWS.filter((v) => v.id !== 'months').map(({ id }) => (
            <button key={id} type="button" aria-pressed={shown === id} onClick={() => choose(id)}>
              {t(`chronologies.views.${id}`)}
            </button>
          ))}
        </div>
      )}
      <div className={styles.frame} data-view={shown}>
        {empty ? (
          editable ? (
            <EmptyState
              kind="calendarios"
              action={
                <button type="button" className={styles.empty} onClick={() => create()} data-tour="cronologia-vacia">
                  <Plus size={20} aria-hidden="true" />
                  {t('chronologies.addEvent')}
                </button>
              }
            >
              <p>{chronology.filter.pages ? t('chronologies.emptyHint') : t('chronologies.emptyNoPages')}</p>
            </EmptyState>
          ) : (
            <p className={styles.emptyPlayer}>{t('chronologies.emptyPlayer')}</p>
          )
        ) : shown === 'list' ? (
          <div className={styles.listScroll}>
            <FocusList entries={entries} focusKey={focusKey}>
              <ListView
                worldId={worldId}
                definition={definition}
                entries={entries}
                groups={groups}
                compact={narrow}
                menuFor={menuFor}
                onEdit={editable ? edit : undefined}
              />
            </FocusList>
          </div>
        ) : shown === 'months' ? (
          <MonthsView
            definition={definition}
            entries={entries}
            groups={groups}
            zoom={zoom}
            focusKey={focusKey}
            onEdit={editable ? edit : undefined}
            onShift={editable ? move : undefined}
            onGroups={editable ? (next) => updateGroups.mutate(next) : undefined}
          />
        ) : (
          <MonthCalendar
            key={focusKey ?? 'calendario'}
            worldId={worldId}
            definition={definition}
            entries={focusKey ? withFocusLast(entries, focusKey) : entries}
            groups={groups}
            compact={narrow}
            onCreateAt={editable ? (date) => create(date) : undefined}
            onMove={editable ? (entry, days) => move(entry, 'days', days) : undefined}
            onEdit={editable ? edit : undefined}
            menuFor={menuFor}
          />
        )}
        <div className={styles.dock} hidden={narrow && !editable}>
          <div
            className={styles.pill}
            role="toolbar"
            aria-label={t('chronologies.views.label')}
            data-tour="cronologia-pildora"
          >
            {/* Vacía, «Añadir evento» ya es la pieza del centro */}
            {editable && !empty && (
              <>
                <button
                  type="button"
                  className={styles.add}
                  aria-label={t('chronologies.addEvent')}
                  title={t('chronologies.addEvent')}
                  onClick={() => create()}
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
                <span className={styles.pillSep} aria-hidden="true" />
              </>
            )}
            {VIEWS.filter((v) => !(narrow && v.id === 'months')).map(({ id, icon: Icon }) => (
              <button key={id} type="button" aria-pressed={shown === id} onClick={() => choose(id)}>
                <Icon size={16} aria-hidden="true" />
                {t(`chronologies.views.${id}`)}
              </button>
            ))}
          </div>
          {shown === 'months' && !empty && (
            <div className={styles.zoom} role="toolbar" aria-label={t('chronologies.zoom.label')}>
              {ZOOMS.map((each) => (
                <button key={each} type="button" aria-pressed={zoom === each} onClick={() => setZoom(each)}>
                  {t(`chronologies.zoom.${each}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {draft && (
        <EventDialog
          worldId={worldId}
          calendarId={calendar.id}
          calendars={calendars.data.calendars}
          groups={groups}
          draft={draft}
          onSaved={(eventId) => {
            refresh()
            if (eventId) setFocusKey(`e:${eventId}`)
          }}
          onClose={() => {
            setDraft(null)
            opener.current?.focus()
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          entry={deleting}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting, { onSettled: () => setDeleting(null) })}
          onClose={() => setDeleting(null)}
        />
      )}
      {converting && (
        <ConvertDialog worldId={worldId} entry={converting} onDone={refresh} onClose={() => setConverting(null)} />
      )}
      {redating && (
        <RedateDialog
          worldId={worldId}
          calendars={calendars.data.calendars}
          calendarId={calendar.id}
          entry={redating}
          onDone={refresh}
          onClose={() => setRedating(null)}
        />
      )}
      <Tour
        id={editable ? 'cronologia' : 'cronologia-jugadora'}
        steps={
          editable
            ? [
                { target: '[data-tour="cronologia-pildora"]', text: t('tour.chronology.pill') },
                { target: '[data-tour="cronologia-ajustes"]', text: t('tour.chronology.settings') }
              ]
            : [
                {
                  target: narrow ? '[data-tour="cronologia-vistas"]' : '[data-tour="cronologia-pildora"]',
                  text: t('tour.chronology.views')
                },
                { target: '[data-tour="cronologia-ir"]', text: t('tour.chronology.goTo') }
              ]
        }
      />
    </div>
  )
}

/** La entrada elegida con «Ir a…», la última: el calendario abre en su mes */
function withFocusLast(entries: readonly ChronologyEntryView[], key: string) {
  const found = entries.find((e) => e.key === key)
  return found ? [...entries.filter((e) => e.key !== key), found] : entries
}

/** En la lista, «Ir a…» baja hasta la entrada (y la enfoca) */
function FocusList({
  entries,
  focusKey,
  children
}: {
  entries: readonly ChronologyEntryView[]
  focusKey: string | null
  children: ReactNode
}) {
  const holder = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusKey) return
    const index = entries.findIndex((e) => e.key === focusKey)
    const row = holder.current?.querySelectorAll('li')[index]
    row?.scrollIntoView({ block: 'center' })
    row?.querySelector<HTMLElement>('h3 a, h3 button')?.focus({ preventScroll: true })
  }, [focusKey, entries])
  return <div ref={holder}>{children}</div>
}

/** «Ir a…»: buscar una entrada por su título y saltar a ella (para lo separado por milenios) */
function GoTo({ entries, onPick }: { entries: readonly ChronologyEntryView[]; onPick: (key: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, box, button)
  const wanted = query.trim().toLocaleLowerCase('es')
  const found = useMemo(
    () => (wanted ? entries.filter((e) => e.title.toLocaleLowerCase('es').includes(wanted)) : entries).slice(0, 30),
    [entries, wanted]
  )
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.headButton}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        data-tour="cronologia-ir"
      >
        <Search size={16} aria-hidden="true" />
        {t('chronologies.goTo')}
      </button>
      {open && (
        <Floating
          anchor={button}
          boxRef={box}
          placement="bottom-end"
          className={styles.goTo}
          role="dialog"
          aria-label={t('chronologies.goTo')}
        >
          <input
            aria-label={t('chronologies.goToSearch')}
            placeholder={t('chronologies.goToSearch')}
            value={query}
            // biome-ignore lint/a11y/noAutofocus: se abre para escribir
            autoFocus
            onChange={(event) => setQuery(event.currentTarget.value)}
            aria-controls={`${id}-list`}
          />
          <ul id={`${id}-list`} className={styles.goToList}>
            {found.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(entry.key)
                    close()
                  }}
                >
                  <span>{entry.field ? `${entry.title} · ${entry.field}` : entry.title}</span>
                  <small>{entry.text}</small>
                </button>
              </li>
            ))}
          </ul>
        </Floating>
      )}
    </>
  )
}

/** Convertir un evento en página, eligiendo dónde va */
function ConvertDialog({
  worldId,
  entry,
  onDone,
  onClose
}: {
  worldId: string
  entry: ChronologyEntryView
  onDone: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const id = useId()
  const [title, setTitle] = useState(entry.title)
  const [parentId, setParentId] = useState('')
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const convert = useMutation({
    mutationFn: () =>
      api.call('convertEventToPage', { eventId: entry.eventId ?? '', parentId: parentId || null, title: title.trim() }),
    onSuccess: () => {
      onDone()
      void client.invalidateQueries({ queryKey: ['pages', worldId] })
      announce(t('chronologies.converted', { title: title.trim() }))
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim()) convert.mutate()
        }}
      >
        <h2 id={titleId}>{t('chronologies.convert.title')}</h2>
        <p className={dialogStyles.description}>{t('chronologies.convert.description')}</p>
        <div className={form.field}>
          <label htmlFor={`${id}-title`}>{t('chronologies.convert.name')}</label>
          <input
            id={`${id}-title`}
            value={title}
            maxLength={200}
            required
            onChange={(event) => setTitle(event.currentTarget.value)}
            data-autofocus
          />
        </div>
        <div className={form.field}>
          <label htmlFor={`${id}-parent`}>{t('chronologies.dialog.where')}</label>
          <select id={`${id}-parent`} value={parentId} onChange={(event) => setParentId(event.currentTarget.value)}>
            <option value="">{t('chronologies.dialog.top')}</option>
            {(names.data?.pages ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {[...p.path.slice(0, -1), p.title].join(' › ')}
              </option>
            ))}
          </select>
        </div>
        <FormError message={convert.error ? errorText(convert.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={convert.isPending} disabled={!title.trim()}>
            {t('chronologies.convert.submit')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('chronologies.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Cambiar la fecha de una página desde la cronología: su campo, con el selector de las fechas */
function RedateDialog({
  worldId,
  calendars,
  calendarId,
  entry,
  onDone,
  onClose
}: {
  worldId: string
  calendars: readonly CalendarView[]
  calendarId: string
  entry: ChronologyEntryView
  onDone: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const id = useId()
  const [value, setValue] = useState<DateValue | null>(storedDate(entry, calendarId))
  const save = useMutation({
    mutationFn: () => {
      const calendar = calendars.find((c) => c.id === value?.calendarId)
      return api.call('editPage', {
        pageId: entry.pageId ?? '',
        properties: [
          {
            name: entry.property ?? '',
            type: 'date',
            value: value && calendar ? dateValueForm(calendar.definition, value) : null,
            ...(calendar ? { calendar: calendar.id } : {})
          }
        ]
      })
    },
    onSuccess: () => {
      onDone()
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <h2 id={titleId}>{t('chronologies.redate.title', { title: entry.title })}</h2>
        <div className={form.field}>
          <label htmlFor={`${id}-date`}>{entry.property}</label>
          <DateField
            id={`${id}-date`}
            label={entry.property ?? ''}
            name={entry.property ?? ''}
            value={value}
            worldId={worldId}
            allowEnd
            onChange={setValue}
          />
        </div>
        <FormError message={save.error ? errorText(save.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('chronologies.dialog.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('chronologies.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Borrar un evento: se confirma (se deshace desde el historial) */
function ConfirmDelete({
  entry,
  busy,
  onConfirm,
  onClose
}: {
  entry: ChronologyEntryView
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('chronologies.deleteEvent', { title: entry.title })}</h2>
        <p className={dialogStyles.description}>{t('chronologies.deleteEventWarning')}</p>
        <div className={dialogStyles.actions}>
          <BusyButton className={form.button} busy={busy} onClick={onConfirm}>
            {t('chronologies.delete')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()} data-autofocus>
            {t('chronologies.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
