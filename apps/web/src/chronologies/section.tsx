/**
 * Las cronologías del mundo, bajo los calendarios en «Calendarios» (decisión 4 de Enrique, docs/specs/modulo-8.md): una
 * ficha por cronología con su calendario, cuántas entradas tiene y de cuándo a cuándo va, su engranaje y «Cronología
 * nueva» al final. Cada una se abre a pantalla entera, como el mapa
 */
import type { CalendarView, ChronologyView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import calendarStyles from '../calendars/calendars.module.css'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, SectionError } from '../components/load-error.tsx'
import { Menu, MenuItem } from '../components/menu.tsx'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import styles from './chronologies.module.css'

export const chronologiesQuery = (worldId: string) => ['chronologies', worldId]

type Listed = ChronologyView & {
  calendarName: string | null
  entries: number
  span: { from: string; to: string } | null
}

export function ChronologySection({ worldId, calendars }: { worldId: string; calendars: readonly CalendarView[] }) {
  const { t } = useTranslation()
  const api = useApi()
  const listed = useQuery({
    queryKey: chronologiesQuery(worldId),
    queryFn: () => api.call('listChronologies', { worldId })
  })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Listed | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const headingId = useId()
  const list = listed.data?.chronologies ?? []
  return (
    <div className={styles.section} data-tour="cronologias">
      <h2 id={headingId} className={styles.sectionTitle}>
        {t('chronologies.title')}
      </h2>
      {failed(listed) && <SectionError error={listed.error} onRetry={() => listed.refetch()} />}
      {list.length > 0 && (
        <ul className={styles.cards} aria-label={t('chronologies.list')}>
          {list.map((chronology) => (
            <li key={chronology.id} className={calendarStyles.card}>
              <ChronologyCard worldId={worldId} chronology={chronology} onDelete={() => setDeleting(chronology)} />
            </li>
          ))}
        </ul>
      )}
      {listed.data && (
        <NewCard
          label={t('chronologies.new')}
          shape="row"
          className={calendarStyles.new}
          data-tour="cronologias-nueva"
          onClick={(event) => {
            opener.current = event.currentTarget
            setCreating(true)
          }}
        />
      )}
      {creating && (
        <NewChronologyDialog
          worldId={worldId}
          calendars={calendars}
          onClose={() => {
            setCreating(false)
            opener.current?.focus()
          }}
        />
      )}
      {deleting && <DeleteChronology worldId={worldId} chronology={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

function ChronologyCard({
  worldId,
  chronology,
  onDelete
}: {
  worldId: string
  chronology: Listed
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const params = { worldId, chronologyId: chronology.id }
  return (
    <>
      <div className={calendarStyles.cardHead}>
        <Link
          to="/mundos/$worldId/calendarios/cronologias/$chronologyId"
          params={params}
          className={calendarStyles.name}
          aria-describedby={`${chronology.id}-facts`}
        >
          {chronology.name}
        </Link>
      </div>
      <div className={calendarStyles.cardFoot}>
        <p className={calendarStyles.facts} id={`${chronology.id}-facts`}>
          <span>
            {chronology.calendarId === null
              ? t('chronologies.primaryCalendar', { name: chronology.calendarName ?? '' })
              : (chronology.calendarName ?? '')}
          </span>
          <span>{t('chronologies.entries', { count: chronology.entries })}</span>
          {chronology.span && (
            <span>
              {chronology.span.from === chronology.span.to
                ? chronology.span.from
                : t('chronologies.span', { from: chronology.span.from, to: chronology.span.to })}
            </span>
          )}
        </p>
        <Menu
          label={t('chronologies.actions', { name: chronology.name })}
          icon={<Settings size={18} aria-hidden="true" />}
          className={calendarStyles.gear}
        >
          {(close) => (
            <>
              <Link
                to="/mundos/$worldId/calendarios/cronologias/$chronologyId"
                params={params}
                className={calendarStyles.menuLink}
              >
                {t('chronologies.open')}
              </Link>
              <MenuItem
                className={calendarStyles.danger}
                onClick={() => {
                  close()
                  onDelete()
                }}
              >
                {t('chronologies.delete')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </>
  )
}

/** «Cronología nueva»: su nombre y su calendario (el principal, de entrada); al crearla, se abre */
function NewChronologyDialog({
  worldId,
  calendars,
  onClose
}: {
  worldId: string
  calendars: readonly CalendarView[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const id = useId()
  const [name, setName] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.call('createChronology', { worldId, name: name.trim(), ...(calendarId ? { calendarId } : {}) }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: chronologiesQuery(worldId) })
      dialog.current?.close()
      void navigate({
        to: '/mundos/$worldId/calendarios/cronologias/$chronologyId',
        params: { worldId, chronologyId: created.id }
      })
    }
  })
  const primary = calendars.find((c) => c.primary)
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <h2 id={titleId}>{t('chronologies.new')}</h2>
        <div className={form.field}>
          <label htmlFor={`${id}-name`}>{t('chronologies.name')}</label>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={60}
            required
            placeholder={t('chronologies.namePlaceholder')}
            onChange={(event) => setName(event.currentTarget.value)}
            data-autofocus
          />
        </div>
        {calendars.length > 1 && (
          <div className={form.field}>
            <label htmlFor={`${id}-calendar`}>{t('chronologies.calendar')}</label>
            <select
              id={`${id}-calendar`}
              value={calendarId}
              onChange={(event) => setCalendarId(event.currentTarget.value)}
            >
              <option value="">{t('chronologies.primaryCalendar', { name: primary?.name ?? '' })}</option>
              {calendars
                .filter((c) => !c.primary)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <FormError message={create.error ? errorText(create.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={create.isPending} disabled={!name.trim()}>
            {t('chronologies.create')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('chronologies.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteChronology({
  worldId,
  chronology,
  onClose
}: {
  worldId: string
  chronology: Listed
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const warningId = useId()
  const remove = useMutation({
    mutationFn: () => api.call('deleteChronology', { chronologyId: chronology.id }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: chronologiesQuery(worldId) })
      announce(t('chronologies.deleted', { name: chronology.name }))
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
        <h2 id={titleId}>{t('chronologies.deleteTitle', { name: chronology.name })}</h2>
        <p id={warningId} className={dialogStyles.description}>
          {t('chronologies.deleteWarning')}
        </p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={remove.isPending}>
            {t('chronologies.delete')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()} data-autofocus>
            {t('chronologies.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
