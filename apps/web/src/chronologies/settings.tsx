/**
 * Los ajustes de una cronología, junto a sus pestañas (decisión 4 de Enrique: cada una con su calendario y su filtro):
 * su calendario, qué páginas con fecha salen (ninguna, todas o las de unas plantillas o etiquetas) y de qué grupos son
 * sus eventos; y los grupos del mundo (su nombre y su color, o quitarlos). Su nombre es el de su pestaña (ADR-0031).
 * Cada cambio se guarda al momento
 */
import { type CalendarView, type ChronologyView, type TimelineGroupView, WORLD_COLORS } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal, Trash2 } from 'lucide-react'
import { type CSSProperties, useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionInput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { Floating } from '../components/floating.tsx'
import { PRESET_COLORS } from '../routes/world-look.ts'
import styles from './chronologies.module.css'

export function ChronologySettings({
  worldId,
  organizationId,
  chronology,
  calendars,
  groups,
  outside
}: {
  worldId: string
  organizationId: string | undefined
  chronology: ChronologyView
  calendars: readonly CalendarView[]
  groups: readonly TimelineGroupView[]
  outside: number
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, box, button)
  const id = useId()
  const templates = useQuery({
    queryKey: ['templates', organizationId],
    queryFn: () => api.call('listTemplates', organizationId ? { organizationId } : {}),
    enabled: open
  })
  const tags = useQuery({
    queryKey: ['tags', organizationId],
    queryFn: () => api.call('listAccountTags', organizationId ? { organizationId } : {}),
    enabled: open
  })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['chronology'] })
    void client.invalidateQueries({ queryKey: ['chronologies', worldId] })
  }
  const update = useMutation({
    mutationFn: (input: Omit<ActionInput<'updateChronology'>, 'chronologyId'>) =>
      api.call('updateChronology', { chronologyId: chronology.id, ...input }),
    onSuccess: refresh,
    onError: (error) => announce(errorText(error))
  })
  const updateGroups = useMutation({
    mutationFn: (next: Array<{ id?: string; name: string; color: TimelineGroupView['color'] }>) =>
      api.call('updateTimelineGroups', { worldId, groups: next }),
    onSuccess: refresh,
    onError: (error) => announce(errorText(error))
  })
  const filter = chronology.filter
  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((each) => each !== value) : [...list, value]
  const primary = calendars.find((c) => c.primary)
  const groupList = (change: (g: TimelineGroupView) => Partial<TimelineGroupView> | null) =>
    groups.flatMap((g) => {
      const patch = change(g)
      return patch === null
        ? []
        : [{ id: g.id, name: patch.name ?? g.name, color: patch.color !== undefined ? patch.color : g.color }]
    })

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.headButton}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        data-tour="cronologia-ajustes"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {t('chronologies.settings.open')}
      </button>
      {open && (
        <Floating
          anchor={button}
          boxRef={box}
          placement="bottom-end"
          className={styles.settings}
          role="dialog"
          aria-label={t('chronologies.settings.title')}
        >
          <div className={styles.settingsSection}>
            <label htmlFor={`${id}-calendar`}>{t('chronologies.calendar')}</label>
            <select
              id={`${id}-calendar`}
              value={chronology.calendarId ?? ''}
              onChange={(event) => update.mutate({ calendarId: event.currentTarget.value || null })}
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
            {outside > 0 && <p className={styles.settingsNote}>{t('chronologies.outside', { count: outside })}</p>}
          </div>
          <fieldset className={styles.settingsSection}>
            <legend>{t('chronologies.settings.pages')}</legend>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={filter.pages}
                onChange={(event) => update.mutate({ filter: { pages: event.currentTarget.checked } })}
              />
              {t('chronologies.settings.datedPages')}
            </label>
            {filter.pages && (templates.data?.templates.length ?? 0) > 0 && (
              <fieldset className={styles.choiceList}>
                <legend className={styles.settingsHint}>{t('chronologies.settings.templates')}</legend>
                {templates.data?.templates.map((template) => (
                  <label key={template.id} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={filter.templates.includes(template.id)}
                      onChange={() => update.mutate({ filter: { templates: toggle(filter.templates, template.id) } })}
                    />
                    {template.name}
                  </label>
                ))}
              </fieldset>
            )}
            {filter.pages && (tags.data?.tags.length ?? 0) > 0 && (
              <fieldset className={styles.choiceList}>
                <legend className={styles.settingsHint}>{t('chronologies.settings.tags')}</legend>
                {tags.data?.tags.map((tag) => (
                  <label
                    key={tag.name}
                    className={styles.check}
                    style={{ paddingInlineStart: `${tag.depth * 0.75}rem` } as CSSProperties}
                  >
                    <input
                      type="checkbox"
                      checked={filter.tags.includes(tag.name)}
                      onChange={() => update.mutate({ filter: { tags: toggle(filter.tags, tag.name) } })}
                    />
                    #{tag.name.split('/').at(-1)}
                  </label>
                ))}
              </fieldset>
            )}
          </fieldset>
          <fieldset className={styles.settingsSection}>
            <legend>{t('chronologies.settings.groups')}</legend>
            {groups.length === 0 && <p className={styles.settingsNote}>{t('chronologies.settings.noGroups')}</p>}
            {groups.length > 0 && (
              <p className={styles.settingsHint}>
                {filter.groups.length === 0
                  ? t('chronologies.settings.allGroups')
                  : t('chronologies.settings.someGroups')}
              </p>
            )}
            <ul className={styles.groupList}>
              {groups.map((group) => (
                <li key={group.id}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={filter.groups.length === 0 || filter.groups.includes(group.id)}
                      onChange={() => {
                        const all = filter.groups.length === 0 ? groups.map((g) => g.id) : filter.groups
                        const next = toggle(all, group.id)
                        update.mutate({ filter: { groups: next.length === groups.length ? [] : next } })
                      }}
                    />
                    {group.name}
                  </label>
                  <select
                    aria-label={t('chronologies.settings.groupColor', { name: group.name })}
                    value={group.color ?? ''}
                    className={styles.colorSelect}
                    style={
                      {
                        '--swatch': group.color
                          ? (PRESET_COLORS[group.color as keyof typeof PRESET_COLORS] ?? group.color)
                          : 'transparent'
                      } as CSSProperties
                    }
                    onChange={(event) =>
                      updateGroups.mutate(
                        groupList((g) =>
                          g.id === group.id
                            ? { color: (event.currentTarget.value || null) as TimelineGroupView['color'] }
                            : {}
                        )
                      )
                    }
                  >
                    <option value="">{t('chronologies.settings.noColor')}</option>
                    {WORLD_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {t(`worlds.colors.${color}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t('chronologies.settings.removeGroup', { name: group.name })}
                    title={t('chronologies.settings.removeGroup', { name: group.name })}
                    onClick={() => updateGroups.mutate(groupList((g) => (g.id === group.id ? null : {})))}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        </Floating>
      )}
    </>
  )
}
