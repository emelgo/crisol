/**
 * El cuadro del evento (lienzo del módulo 8, pantalla 7; Everlore, link-page-field.tsx): arriba la tarjeta en vivo; el
 * título (opcional si lleva página: sin él, el de la página), la fecha con el selector de las fechas (inicio, fin,
 * precisión, cada año), el estilo (un color de la paleta del mundo o uno propio, o una imagen de los archivos con su
 * encuadre), el icono y el grupo, la página enlazada (una que existe o una nueva, eligiendo dónde va), la descripción
 * (hasta 1.000) y «Oculto para los jugadores» con el ojo de cada campaña. Se guarda con «Crear evento» o «Guardar».
 * Cada evento es de una cronología (ADR-0032): en su pestaña, de esa; desde la vista grande de un calendario, se elige
 * arriba a cuál va (o una nueva), y con ella sus grupos
 */
import {
  type CalendarView,
  type ChronologyEntryView,
  type DateValueInput,
  type TimelineGroupView,
  WORLD_COLORS
} from '@crisol/contracts'
import { CalendarDateError, formatDateValue } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Palette, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import { FilePicker } from '../components/file-picker.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { PRESET_COLORS } from '../routes/world-look.ts'
import { DateField, type DateValue } from '../wiki/date-field.tsx'
import { IconPicker } from '../wiki/map/icon-picker.tsx'
import { ItemEye } from '../wiki/map/item-eye.tsx'
import { PagePicker } from '../wiki/map/page-picker.tsx'
import styles from './chronologies.module.css'
import { EventCard } from './event-card.tsx'

/** Lo que abre el cuadro: un evento que ya está (su entrada) o uno nuevo (con su fecha, si se pidió en un día) */
export type EventDraft = { entry: ChronologyEntryView } | { date: DateValue | null }

/** Una cronología a la que puede ir el evento (en la vista grande de un calendario), con sus grupos */
export interface ChronologyChoice {
  id: string
  name: string
  groups: readonly TimelineGroupView[]
}

const MAX_DESCRIPTION = 1000

/** La fecha guardada de una entrada: la de su calendario (si se convirtió) o la de la cronología */
export function storedDate(entry: ChronologyEntryView, calendarId: string): DateValue {
  if (entry.converted) return entry.converted.date as DateValue
  return {
    calendarId,
    start: entry.start,
    ...(entry.end ? { end: entry.end } : {}),
    ...(entry.yearly ? { yearly: true as const } : {})
  }
}

export function EventDialog({
  worldId,
  chronologyId,
  choices,
  calendarId,
  calendars,
  groups,
  draft,
  onClose,
  onSaved
}: {
  worldId: string
  /** La cronología del evento (en su pestaña); sin ella, se elige entre choices */
  chronologyId: string | null
  /** Las cronologías a elegir (la vista grande de un calendario; la primera, la propuesta) */
  choices?: readonly ChronologyChoice[] | undefined
  /** El calendario de la cronología (el de las fechas nuevas) */
  calendarId: string
  calendars: readonly CalendarView[]
  groups: readonly TimelineGroupView[]
  draft: EventDraft
  onClose: () => void
  /** Con el id del evento guardado (para ir a él) */
  onSaved: (eventId: string | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const id = useId()
  const editing = 'entry' in draft ? draft.entry : null
  const [title, setTitle] = useState(editing && !editing.untitled ? editing.title : '')
  const [date, setDate] = useState<DateValue | null>(
    'entry' in draft ? storedDate(draft.entry, calendarId) : draft.date
  )
  const [style, setStyle] = useState<'color' | 'image'>(editing?.image ? 'image' : 'color')
  const [color, setColor] = useState<string | null>(editing?.color ?? null)
  const [image, setImage] = useState(editing?.image ?? null)
  const [picking, setPicking] = useState(false)
  const [icon, setIcon] = useState<string | null>(editing?.icon ?? null)
  // A qué cronología va: la suya o, al elegir, la del evento, la propuesta o una nueva («new»)
  const [target, setTarget] = useState<string>(editing?.chronologyId ?? chronologyId ?? choices?.[0]?.id ?? 'new')
  const [newChronology, setNewChronology] = useState(() => t('chronologies.dialog.newChronologyName'))
  // Si las cronologías llegan con el cuadro ya abierto, la propuesta (salvo que ya se eligiera otra cosa)
  const picked = useRef(false)
  const proposed = choices?.[0]?.id
  useEffect(() => {
    if (!picked.current && proposed && target === 'new') setTarget(proposed)
  }, [proposed, target])
  const shownGroups = choices ? (choices.find((choice) => choice.id === target)?.groups ?? []) : groups
  const [groupId, setGroupId] = useState<string>(editing?.groupId ?? '')
  const [newGroup, setNewGroup] = useState('')
  const [page, setPage] = useState<{ id: string; title: string } | null>(editing?.page ?? null)
  const [newPage, setNewPage] = useState<{ title: string; parentId: string | null } | null>(null)
  const [description, setDescription] = useState(editing?.description ?? '')
  const [hidden, setHidden] = useState(editing?.hidden ?? false)
  const [problem, setProblem] = useState<string | null>(null)
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })

  const text = useMemo(() => {
    if (!date) return t('chronologies.dialog.noDate')
    const calendar = calendars.find((c) => c.id === date.calendarId)
    try {
      return calendar ? formatDateValue(calendar.definition, date) : ''
    } catch (error) {
      if (error instanceof CalendarDateError) return ''
      throw error
    }
  }, [date, calendars, t])
  const linkedTitle = newPage?.title ?? page?.title ?? null
  const shownTitle = title.trim() || linkedTitle || t('chronologies.dialog.untitled')
  const group = groupId ? shownGroups.find((g) => g.id === groupId) : undefined

  const save = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error('NO_DATE')
      const common = {
        title: title.trim(),
        date: date as DateValueInput,
        color: style === 'color' ? color : null,
        image: style === 'image' ? image : null,
        icon,
        description,
        hidden,
        ...(groupId === 'new'
          ? newGroup.trim()
            ? { group: newGroup.trim() }
            : { groupId: null }
          : { groupId: groupId || null }),
        ...(newPage ? { newPage } : { pageId: page?.id ?? null })
      }
      if (editing?.eventId)
        return api.call('updateTimelineEvent', {
          eventId: editing.eventId,
          ...common,
          ...(choices && target !== 'new' && target !== editing.chronologyId ? { chronologyId: target } : {})
        })
      // Una cronología nueva (desde un calendario, sin ninguna o porque se pide): una página con su nombre
      const into =
        target === 'new'
          ? (await api.call('createChronology', { worldId, name: newChronology.trim() || 'Cronología' })).id
          : target
      return (await api.call('createTimelineEvents', { chronologyId: into, events: [common] })).events[0]
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['chronology'] })
      void client.invalidateQueries({ queryKey: ['chronologies', worldId] })
      if (newPage || target === 'new') void client.invalidateQueries({ queryKey: ['pages', worldId] })
      announce(
        editing
          ? t('chronologies.dialog.saved', { title: shownTitle })
          : t('chronologies.dialog.created', { title: shownTitle })
      )
      onSaved(saved?.id ?? null)
      dialog.current?.close()
    }
  })
  const submit = () => {
    if (!date) return setProblem(t('chronologies.dialog.needDate'))
    if (!title.trim() && !page && !newPage) return setProblem(t('chronologies.dialog.needTitle'))
    setProblem(null)
    save.mutate()
  }
  const pages = names.data?.pages ?? []
  const fieldRow = (label: string, control: ReactNode, htmlFor?: string) => (
    <div className={form.field}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className={styles.fieldLabel}>{label}</span>}
      {control}
    </div>
  )
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.eventDialog}`}
      onClose={onClose}
    >
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <h2 id={titleId}>{editing ? t('chronologies.dialog.edit') : t('chronologies.dialog.new')}</h2>
        <div className={styles.preview} aria-hidden="true">
          <EventCard
            worldId={worldId}
            entry={{
              kind: 'event',
              title: shownTitle,
              text,
              ...(date?.yearly ? { yearly: true as const } : {}),
              ...(style === 'color' && color ? { color } : {}),
              ...(style === 'image' && image ? { image } : {}),
              ...(icon ? { icon } : {}),
              ...(description ? { description } : {}),
              ...(page && !newPage ? { page: { ...page, icon: null } } : {}),
              ...(hidden ? { hidden: true as const } : {})
            }}
            group={group}
          />
        </div>
        <div className={styles.dialogGrid}>
          {choices && (
            <div className={`${form.field} ${styles.wide}`}>
              <label htmlFor={`${id}-chronology`}>{t('chronologies.dialog.chronology')}</label>
              <div className={styles.chronologyChoice}>
                <select
                  id={`${id}-chronology`}
                  value={target}
                  onChange={(event) => {
                    picked.current = true
                    setTarget(event.currentTarget.value)
                    // Sus grupos son de otra
                    setGroupId('')
                  }}
                >
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                  {!editing && <option value="new">{t('chronologies.dialog.newChronology')}</option>}
                </select>
                {target === 'new' && (
                  <input
                    aria-label={t('chronologies.dialog.newChronologyLabel')}
                    value={newChronology}
                    maxLength={60}
                    onChange={(event) => setNewChronology(event.currentTarget.value)}
                  />
                )}
              </div>
            </div>
          )}
          {fieldRow(
            t('chronologies.dialog.title'),
            <input
              id={`${id}-title`}
              value={title}
              maxLength={200}
              placeholder={linkedTitle ?? ''}
              onChange={(event) => setTitle(event.currentTarget.value)}
              data-autofocus
            />,
            `${id}-title`
          )}
          {fieldRow(
            t('chronologies.dialog.date'),
            <div className={styles.dateBox}>
              <DateField
                id={`${id}-date`}
                label={t('chronologies.dialog.date')}
                name={t('chronologies.dialog.date')}
                value={date}
                worldId={worldId}
                allowEnd
                onChange={(value) => setDate(value)}
              />
            </div>,
            `${id}-date`
          )}
          <fieldset className={styles.styleField}>
            <legend className={styles.fieldLabel}>{t('chronologies.dialog.style')}</legend>
            <div className={styles.styleToggle}>
              <label>
                <input
                  type="radio"
                  name={`${id}-style`}
                  checked={style === 'color'}
                  onChange={() => setStyle('color')}
                />
                <Palette size={14} aria-hidden="true" />
                {t('chronologies.dialog.color')}
              </label>
              <label>
                <input
                  type="radio"
                  name={`${id}-style`}
                  checked={style === 'image'}
                  onChange={() => setStyle('image')}
                />
                <ImageIcon size={14} aria-hidden="true" />
                {t('chronologies.dialog.image')}
              </label>
            </div>
            {style === 'color' ? (
              <div className={styles.swatches}>
                <label className={styles.swatch} title={t('chronologies.dialog.groupColor')}>
                  <input type="radio" name={`${id}-color`} checked={color === null} onChange={() => setColor(null)} />
                  <span aria-hidden="true" className={styles.swatchNone} />
                  <span className={styles.srOnly}>{t('chronologies.dialog.groupColor')}</span>
                </label>
                {WORLD_COLORS.map((each) => (
                  <label key={each} className={styles.swatch} title={t(`worlds.colors.${each}`)}>
                    <input type="radio" name={`${id}-color`} checked={color === each} onChange={() => setColor(each)} />
                    <span aria-hidden="true" style={{ background: PRESET_COLORS[each] }} />
                    <span className={styles.srOnly}>{t(`worlds.colors.${each}`)}</span>
                  </label>
                ))}
                <label className={styles.swatch} title={t('chronologies.dialog.customColor')}>
                  <input
                    type="color"
                    value={color?.startsWith('#') ? color : '#8a6cd1'}
                    onChange={(event) => setColor(event.currentTarget.value)}
                  />
                  {color?.startsWith('#') ? (
                    <span aria-hidden="true" style={{ background: color }} />
                  ) : (
                    <Plus aria-hidden="true" size={14} />
                  )}
                  <span className={styles.srOnly}>{t('chronologies.dialog.customColor')}</span>
                </label>
              </div>
            ) : (
              <div className={styles.imageRow}>
                <button type="button" className={styles.imageChoice} onClick={() => setPicking(true)}>
                  {image ? (
                    <img
                      src={`/api/files/${image.fileId}`}
                      alt=""
                      style={{ objectPosition: `${image.x}% ${image.y}%` }}
                    />
                  ) : (
                    <ImageIcon size={16} aria-hidden="true" />
                  )}
                  <span className={styles.srOnly}>{t('chronologies.dialog.chooseImage')}</span>
                </button>
                {image && (
                  <label className={styles.focal}>
                    <span className={styles.srOnly}>{t('chronologies.dialog.focal')}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={image.y}
                      onChange={(event) => setImage({ ...image, y: Number(event.currentTarget.value) })}
                    />
                  </label>
                )}
              </div>
            )}
          </fieldset>
          <div className={form.field}>
            <span className={styles.fieldLabel} id={`${id}-look`}>
              {t('chronologies.dialog.iconAndGroup')}
            </span>
            <div className={styles.iconGroup}>
              <IconPicker id={`${id}-icon`} value={icon} onPick={setIcon} />
              <select
                aria-label={t('chronologies.dialog.group')}
                value={groupId}
                onChange={(event) => setGroupId(event.currentTarget.value)}
              >
                <option value="">{t('chronologies.lanes.none')}</option>
                {shownGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="new">{t('chronologies.dialog.newGroup')}</option>
              </select>
            </div>
            {groupId === 'new' && (
              <input
                aria-label={t('chronologies.lanes.newName')}
                placeholder={t('chronologies.lanes.newName')}
                value={newGroup}
                maxLength={60}
                onChange={(event) => setNewGroup(event.currentTarget.value)}
              />
            )}
          </div>
          <div className={form.field}>
            <label htmlFor={`${id}-page`}>{t('chronologies.dialog.page')}</label>
            <PagePicker
              id={`${id}-page`}
              value={newPage?.title ?? page?.title ?? ''}
              pages={pages}
              placeholder={t('chronologies.dialog.pagePlaceholder')}
              onCommit={(written) => {
                const wanted = written.trim()
                if (!wanted) {
                  setPage(null)
                  setNewPage(null)
                  return
                }
                const found = pages.find((p) => p.title.toLocaleLowerCase('es') === wanted.toLocaleLowerCase('es'))
                if (found) {
                  setPage({ id: found.id, title: found.title })
                  setNewPage(null)
                } else setNewPage({ title: wanted, parentId: null })
              }}
            />
            {newPage && (
              <div className={styles.newPage}>
                <span>{t('chronologies.dialog.newPage', { title: newPage.title })}</span>
                <label>
                  <span>{t('chronologies.dialog.where')}</span>
                  <select
                    value={newPage.parentId ?? ''}
                    onChange={(event) => setNewPage({ ...newPage, parentId: event.currentTarget.value || null })}
                  >
                    <option value="">{t('chronologies.dialog.top')}</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {[...p.path.slice(0, -1), p.title].join(' › ')}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
          <div className={`${form.field} ${styles.wide}`}>
            <label htmlFor={`${id}-description`}>{t('chronologies.dialog.description')}</label>
            <textarea
              id={`${id}-description`}
              value={description}
              maxLength={MAX_DESCRIPTION}
              rows={3}
              onChange={(event) => setDescription(event.currentTarget.value)}
              aria-describedby={`${id}-count`}
            />
            <span
              id={`${id}-count`}
              className={form.counter}
              data-full={description.length >= MAX_DESCRIPTION || undefined}
            >
              {t('chronologies.dialog.count', { count: description.length, max: '1.000' })}
            </span>
          </div>
          <label className={styles.hiddenSwitch}>
            <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.currentTarget.checked)} />
            <span>{t('chronologies.dialog.hidden')}</span>
          </label>
          {editing?.eventId && (
            <div className={styles.eye}>
              <ItemEye
                page={{ id: '', worldId }}
                target={{ kind: 'event', targetId: editing.eventId }}
                feminine={false}
                hidden={hidden}
              />
            </div>
          )}
        </div>
        <FormError message={problem ?? (save.error ? errorText(save.error) : null)} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {editing ? t('chronologies.dialog.save') : t('chronologies.dialog.create')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('chronologies.cancel')}
          </button>
        </div>
      </form>
      {picking && (
        <FilePicker
          worldId={worldId}
          kind="image"
          title={t('chronologies.dialog.chooseImage')}
          chosenId={image?.fileId ?? null}
          onPick={(file) => setImage({ fileId: file.id, x: 50, y: 50 })}
          onClose={() => setPicking(false)}
        />
      )}
    </Modal>
  )
}
