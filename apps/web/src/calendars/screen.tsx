/**
 * «Calendarios», la pantalla del tiempo del mundo (módulo 8; lienzo aprobado, pantalla 1): una ficha por calendario con
 * el año dibujado, el principal marcado, su engranaje con lo que se puede hacer con él, reordenar arrastrando (o con
 * Alt y las flechas) y «Calendario nuevo» al final. Solo para quien lleva el mundo: la jugadora los lee con las fechas
 */
import type { CalendarView } from '@crisol/contracts'
import { yearLength } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { type DragEvent, type KeyboardEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { ChronologySection } from '../chronologies/section.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { EmptyState } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { Menu, MenuItem } from '../components/menu.tsx'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './calendars.module.css'
import { NewCalendarDialog } from './new-calendar.tsx'
import { YearStrip } from './year-strip.tsx'

const route = getRouteApi('/mundos/$worldId/calendarios')

/** El bodegón de la pantalla vacía: el astrolabio y el almanaque (public/vacios/calendarios.webp) */
export const CALENDARS_ART = 'calendarios' as const

/** Los calendarios de un mundo, solo para quien lo dirige (como sus archivos) */
export function CalendarsScreen() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (!world)
    return (
      <Screen title={t('wiki.notFound')}>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </Screen>
    )
  return <Calendars worldId={worldId} />
}

export const calendarsQuery = (worldId: string) => ['calendars', worldId]

function Calendars({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const calendars = useQuery({
    queryKey: calendarsQuery(worldId),
    queryFn: () => api.call('listCalendars', { worldId })
  })
  const [creating, setCreating] = useState(false)
  const opener = useRef<HTMLButtonElement | null>(null)
  if (!calendars.data)
    return failed(calendars) ? <LoadError error={calendars.error} onRetry={() => calendars.refetch()} /> : <Loading />
  const list = calendars.data.calendars
  const open = (event: { currentTarget: HTMLButtonElement }) => {
    opener.current = event.currentTarget
    setCreating(true)
  }
  return (
    <Screen
      title={t('calendars.title')}
      {...(list.length > 0 ? { emblem: CALENDARS_ART } : {})}
      className={styles.screen}
    >
      {failed(calendars) && <SectionError error={calendars.error} onRetry={() => calendars.refetch()} />}
      {list.length === 0 ? (
        <EmptyState
          kind={CALENDARS_ART}
          action={
            <button type="button" className={form.button} onClick={open} data-tour="calendarios-nuevo">
              {t('calendars.new')}
            </button>
          }
        >
          <p>{t('calendars.empty')}</p>
        </EmptyState>
      ) : (
        <CalendarList worldId={worldId} calendars={list} onNew={open} />
      )}
      {/* Las cronologías del mundo, bajo los calendarios (decisión 4 de Enrique): con algún calendario */}
      {list.length > 0 && <ChronologySection worldId={worldId} calendars={list} />}
      {creating && (
        <NewCalendarDialog
          worldId={worldId}
          calendars={list}
          onClose={() => {
            setCreating(false)
            opener.current?.focus()
          }}
        />
      )}
      <Tour
        id="calendarios"
        steps={[
          { target: '[data-tour="calendarios-lista"]', text: t('tour.calendars.list') },
          { target: '[data-tour="calendarios-nuevo"]', text: t('tour.calendars.create') },
          { target: '[data-tour="cronologias"]', text: t('tour.calendars.chronologies') }
        ]}
      />
    </Screen>
  )
}

/** Las fichas, en su orden: se reordenan arrastrando o con Alt y las flechas */
function CalendarList({
  worldId,
  calendars,
  onNew
}: {
  worldId: string
  calendars: readonly CalendarView[]
  onNew: (event: { currentTarget: HTMLButtonElement }) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; side: 'before' | 'after' } | null>(null)
  const [deleting, setDeleting] = useState<CalendarView | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const refresh = () => client.invalidateQueries({ queryKey: calendarsQuery(worldId) })
  const update = useMutation({
    mutationFn: (input: { calendarId: string; after?: string | null; primary?: true }) =>
      api.call('updateCalendar', input),
    onSettled: refresh,
    onError: (error) => announce(errorText(error))
  })
  const duplicate = useMutation({
    mutationFn: (calendar: CalendarView) =>
      api.call('createCalendar', {
        worldId,
        name: t('calendars.copyName', { name: calendar.name }).slice(0, 60),
        from: { copyOf: calendar.id }
      }),
    onSettled: refresh,
    onError: (error) => announce(errorText(error))
  })

  /** Pone uno delante o detrás de otro (after: tras cuál; null, el primero) */
  const moveTo = (id: string, index: number) => {
    const others = calendars.filter((c) => c.id !== id)
    const after = index <= 0 ? null : (others[index - 1]?.id ?? null)
    update.mutate({ calendarId: id, after })
    const name = calendars.find((c) => c.id === id)?.name ?? ''
    announce(t('calendars.moved', { name, position: Math.max(1, Math.min(index + 1, calendars.length)) }))
  }
  const drop = (event: DragEvent, target: CalendarView) => {
    event.preventDefault()
    const id = dragged
    setDragged(null)
    setOver(null)
    if (!id || id === target.id) return
    const others = calendars.filter((c) => c.id !== id)
    const at = others.findIndex((c) => c.id === target.id)
    moveTo(id, over?.side === 'after' ? at + 1 : at)
  }
  const keys = (event: KeyboardEvent, calendar: CalendarView, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const to = event.key === 'ArrowUp' ? index - 1 : index + 1
    if (to < 0 || to >= calendars.length) return
    moveTo(calendar.id, to)
    // El foco sigue en la ficha movida
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-calendar="${calendar.id}"] a`)?.focus()
    )
  }

  return (
    <>
      <ul className={styles.list} aria-label={t('calendars.list')} ref={listRef} data-tour="calendarios-lista">
        {calendars.map((calendar, index) => (
          <li
            key={calendar.id}
            className={styles.card}
            data-calendar={calendar.id}
            data-primary={calendar.primary || undefined}
            data-dragging={dragged === calendar.id || undefined}
            data-drop={over?.id === calendar.id ? over.side : undefined}
            draggable
            onDragStart={(event) => {
              setDragged(calendar.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', calendar.id)
            }}
            onDragEnd={() => {
              setDragged(null)
              setOver(null)
            }}
            onDragOver={(event) => {
              if (!dragged || dragged === calendar.id) return
              event.preventDefault()
              const box = event.currentTarget.getBoundingClientRect()
              setOver({ id: calendar.id, side: event.clientY < box.top + box.height / 2 ? 'before' : 'after' })
            }}
            onDrop={(event) => drop(event, calendar)}
          >
            <CalendarCard
              worldId={worldId}
              calendar={calendar}
              canDelete={!calendar.primary || calendars.length === 1}
              onKeyDown={(event) => keys(event, calendar, index)}
              onPrimary={() => update.mutate({ calendarId: calendar.id, primary: true })}
              onDuplicate={() => duplicate.mutate(calendar)}
              onDelete={() => setDeleting(calendar)}
            />
          </li>
        ))}
      </ul>
      <NewCard
        label={t('calendars.new')}
        shape="row"
        className={styles.new}
        onClick={onNew}
        data-tour="calendarios-nuevo"
      />
      {deleting && <DeleteCalendar worldId={worldId} calendar={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}

function CalendarCard({
  worldId,
  calendar,
  canDelete,
  onKeyDown,
  onPrimary,
  onDuplicate,
  onDelete
}: {
  worldId: string
  calendar: CalendarView
  canDelete: boolean
  onKeyDown: (event: KeyboardEvent) => void
  onPrimary: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { definition } = calendar
  const months = definition.months.filter((m) => !m.festival).length
  const festivals = definition.months.length - months
  const monthsText = t('calendars.months', { count: months })
  const shape =
    festivals > 0
      ? t('calendars.monthsAndFestivals', {
          months: monthsText,
          festivals: t('calendars.festivals', { count: festivals })
        })
      : monthsText
  const moons = definition.moons
  const moonNames =
    moons.length <= 1
      ? (moons[0]?.name ?? '')
      : t('calendars.and', {
          first: moons
            .slice(0, -1)
            .map((m) => m.name)
            .join(', '),
          last: moons.at(-1)?.name ?? ''
        })
  const params = { worldId, calendarId: calendar.id }
  return (
    <>
      <div className={styles.cardHead}>
        <Link
          to="/mundos/$worldId/calendarios/$calendarId"
          params={params}
          className={styles.name}
          onKeyDown={onKeyDown}
          aria-describedby={`${calendar.id}-shape`}
        >
          {calendar.name}
        </Link>
        {calendar.primary && <span className={styles.badge}>{t('calendars.primary')}</span>}
      </div>
      <p className={styles.facts} id={`${calendar.id}-shape`}>
        <span>{shape}</span>
        <span>{t('calendars.days', { count: yearLength(definition) })}</span>
        <span>{t('calendars.week', { count: definition.weekdays.length })}</span>
      </p>
      <YearStrip definition={definition} label={t('calendars.year', { name: calendar.name })} />
      <div className={styles.cardFoot}>
        <p className={styles.facts}>
          {moons.length > 0 && (
            <span className={styles.moons}>
              <span className={styles.moonDots} aria-hidden="true">
                {moons.map((moon) => (
                  <span key={moon.id} className={styles.moonDot} style={{ ['--moon-color' as string]: moon.color }} />
                ))}
              </span>
              {moonNames}
            </span>
          )}
          <span>
            {definition.eras.length > 0
              ? t('calendars.eras', { count: definition.eras.length })
              : t('calendars.noEras')}
          </span>
        </p>
        <Menu
          label={t('calendars.actions', { name: calendar.name })}
          icon={<Settings size={18} aria-hidden="true" />}
          className={styles.gear}
        >
          {(close) => (
            <>
              <Link to="/mundos/$worldId/calendarios/$calendarId" params={params} className={styles.menuLink}>
                {t('calendars.open')}
              </Link>
              {!calendar.primary && (
                <MenuItem
                  onClick={() => {
                    close()
                    onPrimary()
                  }}
                >
                  {t('calendars.makePrimary')}
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  close()
                  onDuplicate()
                }}
              >
                {t('calendars.duplicate')}
              </MenuItem>
              <MenuItem
                className={styles.danger}
                disabled={!canDelete}
                title={canDelete ? undefined : t('calendars.deletePrimary')}
                onClick={() => {
                  close()
                  onDelete()
                }}
              >
                {t('calendars.delete')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </>
  )
}

/** Borrar uno: se confirma (se deshace desde el historial) */
function DeleteCalendar({
  worldId,
  calendar,
  onClose
}: {
  worldId: string
  calendar: CalendarView
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const warningId = useId()
  const remove = useMutation({
    mutationFn: () => api.call('deleteCalendar', { calendarId: calendar.id }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: calendarsQuery(worldId) })
      dialog.current?.close()
    }
  })
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={warningId}
      className={dialogStyles.dialog}
      onClose={onClose}
    >
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          remove.mutate()
        }}
      >
        <h2 id={titleId}>{t('calendars.deleteTitle', { name: calendar.name })}</h2>
        <p id={warningId} className={dialogStyles.description}>
          {t('calendars.deleteWarning')}
        </p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={remove.isPending}>
            {t('calendars.delete')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()} data-autofocus>
            {t('calendars.editor.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
