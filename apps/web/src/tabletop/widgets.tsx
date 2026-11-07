/**
 * Los widgets de la campaña (docs/specs/herramientas-mesa.md): contadores, relojes de progreso y temporizadores. En la
 * mesa, unas tarjetas encima del mapa que se tocan en el sitio (más y menos, los segmentos del reloj, poner en marcha o
 * parar), con su ojo para la tele; en la tele, las mismas sin botones. Su panel los crea, los nombra y los ajusta
 */
import type { CampaignTableView, ScreenWidget, WidgetView } from '@crisol/contracts'
import {
  CLOCK_SEGMENTS,
  clockFace,
  clockStep,
  DEFAULT_WIDGET_COLOR,
  formatDuration,
  msToNextSecond,
  parseDuration,
  secondsShown,
  sortWidgets,
  valueOnClick,
  type WidgetKind
} from '@crisol/tabletop'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Minus, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { type MouseEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionInput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import styles from './tools.module.css'
import visionStyles from './vision.module.css'

type Widget = WidgetView | ScreenWidget

/** Los widgets de la mesa, con lo que devuelven las acciones hasta que llega otra */
export function useWidgets(campaignId: string, table: CampaignTableView | null) {
  const api = useApi()
  const fromTable = table?.widgets
  const [local, setLocal] = useState<{ base: WidgetView[] | undefined; widgets: WidgetView[] } | null>(null)
  const widgets = sortWidgets(local && local.base === fromTable ? local.widgets : (fromTable ?? []))
  const keep = (next: WidgetView | { id: string }, removed = false) =>
    setLocal((current) => {
      const base = current && current.base === fromTable ? current.widgets : (fromTable ?? [])
      const rest = base.filter((w) => w.id !== next.id)
      return {
        base: fromTable,
        widgets: removed
          ? rest
          : base.some((w) => w.id === next.id)
            ? base.map((w) => (w.id === next.id ? (next as WidgetView) : w))
            : [...base, next as WidgetView]
      }
    })
  const update = useMutation({
    mutationFn: (input: ActionInput<'updateWidget'>) => api.call('updateWidget', input),
    onSuccess: (widget) => keep(widget)
  })
  const create = useMutation({
    mutationFn: (input: Omit<ActionInput<'createWidget'>, 'campaignId'>) =>
      api.call('createWidget', { campaignId, ...input }),
    onSuccess: (widget) => keep(widget)
  })
  const remove = useMutation({
    mutationFn: (widgetId: string) => api.call('deleteWidget', { widgetId }),
    onSuccess: (result) => keep(result, true)
  })
  return {
    widgets,
    update,
    create,
    remove,
    error: [update, create, remove].find((m) => m.error)?.error ?? null
  }
}

export type Widgets = ReturnType<typeof useWidgets>

/** La hora de ahora, que cambia cuando cambia lo que enseña algún temporizador en marcha */
function useTimerNow(widgets: readonly Widget[]) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const running = widgets.filter((w) => w.kind === 'timer' && w.running)
    if (running.length === 0) return
    const wait = Math.min(
      ...running.map((w) => msToNextSecond({ value: w.value, duration: w.duration ?? 0, running: w.running }, now))
    )
    if (!Number.isFinite(wait)) return
    const timer = setTimeout(() => setNow(Date.now()), wait)
    return () => clearTimeout(timer)
  }, [widgets, now])
  return now
}

/** Las tarjetas de los widgets encima del mapa: en la mesa se tocan; en la tele, solo los de ojo abierto */
export function WidgetCards({
  widgets,
  control,
  className
}: {
  widgets: readonly Widget[]
  /** La mesa: lo que se cambia (sin ello, la tele) */
  control?: Widgets
  className?: string
}) {
  const { t } = useTranslation()
  const now = useTimerNow(widgets)
  if (widgets.length === 0) return null
  return (
    <section className={`${styles.widgets} ${className ?? ''}`} aria-label={t('tools.widgets')}>
      {widgets.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} control={control} now={now} />
      ))}
    </section>
  )
}

function WidgetCard({ widget, control, now }: { widget: Widget; control: Widgets | undefined; now: number }) {
  const { t } = useTranslation()
  const shown = 'shown' in widget ? widget.shown : true
  const update = (input: Omit<ActionInput<'updateWidget'>, 'widgetId'>) =>
    control?.update.mutate({ widgetId: widget.id, ...input })
  const busy = control?.update.isPending ?? false
  return (
    <article className={styles.widget} aria-label={widget.label} data-hidden={!shown || undefined}>
      <header className={styles.widgetHead}>
        <span>{widget.label}</span>
        {control && (
          <button
            type="button"
            className={styles.icon}
            aria-pressed={shown}
            aria-label={t('tools.onScreen')}
            title={t(shown ? 'tools.onScreen' : 'tools.onlyYou')}
            onClick={() => update({ shown: !shown })}
          >
            {shown ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
          </button>
        )}
      </header>
      {widget.kind === 'counter' && (
        <div className={styles.counter}>
          {control && (
            <button
              type="button"
              className={styles.step}
              aria-label={t('tools.less', { name: widget.label })}
              disabled={busy || (widget.min !== null && widget.value <= widget.min)}
              onClick={() => update({ step: -1 })}
            >
              <Minus aria-hidden="true" size={14} />
            </button>
          )}
          <output className={styles.big}>{widget.value}</output>
          {control && (
            <button
              type="button"
              className={styles.step}
              aria-label={t('tools.more', { name: widget.label })}
              disabled={busy || (widget.max !== null && widget.value >= widget.max)}
              onClick={() => update({ step: 1 })}
            >
              <Plus aria-hidden="true" size={14} />
            </button>
          )}
        </div>
      )}
      {widget.kind === 'clock' && <Clock widget={widget} onValue={control ? (value) => update({ value }) : null} />}
      {widget.kind === 'timer' && (
        <div className={styles.timer}>
          <output className={styles.big}>
            {formatDuration(
              secondsShown({ value: widget.value, duration: widget.duration ?? 0, running: widget.running }, now)
            )}
          </output>
          {control && (
            <>
              <button
                type="button"
                className={styles.step}
                aria-label={t(widget.running ? 'tools.pause' : 'tools.start')}
                title={t(widget.running ? 'tools.pause' : 'tools.start')}
                onClick={() => update({ timer: widget.running ? 'pause' : 'start' })}
              >
                {widget.running ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
              </button>
              <button
                type="button"
                className={styles.step}
                aria-label={t('tools.reset')}
                title={t('tools.reset')}
                onClick={() => update({ timer: 'reset' })}
              >
                <RotateCcw aria-hidden="true" size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}

/** Un reloj de progreso: sus cuñas (en la mesa, cada una se pulsa) y la cuenta al lado */
function Clock({ widget, onValue }: { widget: Widget; onValue: ((value: number) => void) | null }) {
  const { t } = useTranslation()
  const segments = widget.segments ?? 4
  const face = clockFace(segments, widget.value, false)
  const filled = Math.max(0, Math.min(segments, Math.round(widget.value)))
  const label = t('tools.clockValue', { name: widget.label, value: filled, max: segments })
  const svg = (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.face}>
      {face.wedges.map((d, i) => (
        <path
          key={d}
          d={d}
          data-segment={i}
          fill={i < filled ? widget.color : '#2c2d33'}
          stroke="#0b0b0c"
          strokeWidth={0.8}
        />
      ))}
    </svg>
  )
  return (
    <div className={styles.clock}>
      {onValue ? (
        <button
          type="button"
          className={styles.faceButton}
          aria-label={label}
          title={t('tools.clockHint')}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            const segment = (event.target as Element).closest('[data-segment]')?.getAttribute('data-segment')
            onValue(
              segment === null || segment === undefined
                ? filled >= segments
                  ? 0
                  : filled + 1
                : valueOnClick(Number(segment), filled)
            )
          }}
          onContextMenu={(event) => {
            event.preventDefault()
            onValue(clockStep(segments, filled, -1))
          }}
        >
          {svg}
        </button>
      ) : (
        <span role="img" aria-label={label}>
          {svg}
        </span>
      )}
      <output className={styles.big}>{`${filled}/${segments}`}</output>
    </div>
  )
}

const NEW: Record<WidgetKind, Omit<ActionInput<'createWidget'>, 'campaignId' | 'label'>> = {
  counter: { kind: 'counter', value: 0, min: 0, color: DEFAULT_WIDGET_COLOR.counter },
  clock: { kind: 'clock', segments: 6, color: DEFAULT_WIDGET_COLOR.clock },
  timer: { kind: 'timer', duration: 300, color: DEFAULT_WIDGET_COLOR.timer }
}

/** El panel de los widgets: la lista (nombre, tipo, ojo y quitar), los ajustes del elegido y crear uno */
export function WidgetsPanel({ control }: { control: Widgets }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      {control.widgets.length === 0 && <span className={visionStyles.stat}>{t('tools.noWidgets')}</span>}
      <ul className={styles.rows} aria-label={t('tools.widgets')}>
        {control.widgets.map((widget) => (
          <li key={widget.id}>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.rowName}
                aria-expanded={open === widget.id}
                onClick={() => setOpen(open === widget.id ? null : widget.id)}
              >
                {widget.label}
              </button>
              <span className={styles.chip}>{t(`tools.kinds.${widget.kind}`)}</span>
            </div>
            {open === widget.id && <WidgetSettings key={widget.version} widget={widget} control={control} />}
          </li>
        ))}
      </ul>
      <div className={styles.adds}>
        {(['counter', 'clock', 'timer'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={visionStyles.ghost}
            disabled={control.create.isPending}
            onClick={() =>
              control.create.mutate(
                { ...NEW[kind], label: t(`tools.kinds.${kind}`) },
                { onSuccess: (widget) => setOpen(widget.id) }
              )
            }
          >
            <Plus aria-hidden="true" size={15} />
            {t(`tools.kinds.${kind}`)}
          </button>
        ))}
      </div>
      <FormError message={control.error ? errorText(control.error) : null} />
    </>
  )
}

/** Lo que se ajusta de un widget: su nombre, sus límites, sus segmentos o su duración, el ojo y quitarlo */
function WidgetSettings({ widget, control }: { widget: WidgetView; control: Widgets }) {
  const { t } = useTranslation()
  const id = useId()
  const [label, setLabel] = useState(widget.label)
  const [duration, setDuration] = useState(formatDuration(widget.duration ?? 300))
  const save = (input: Omit<ActionInput<'updateWidget'>, 'widgetId'>) =>
    control.update.mutate({ widgetId: widget.id, ...input })
  const commitLabel = () => {
    const next = label.trim()
    if (next && next !== widget.label) save({ label: next })
    else setLabel(widget.label)
  }
  const commitDuration = () => {
    const seconds = parseDuration(duration)
    if (seconds && seconds !== widget.duration) save({ duration: seconds })
    else setDuration(formatDuration(widget.duration ?? 300))
  }
  return (
    <section className={visionStyles.selected} aria-label={widget.label}>
      <label className={visionStyles.field}>
        <span>{t('tools.name')}</span>
        <input
          className={visionStyles.input}
          value={label}
          maxLength={40}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => event.key === 'Enter' && commitLabel()}
        />
      </label>
      {widget.kind === 'clock' && (
        <label className={visionStyles.field}>
          <span>{t('tools.segments')}</span>
          <select
            className={visionStyles.select}
            value={widget.segments ?? 4}
            onChange={(event) => save({ segments: Number(event.target.value) })}
          >
            {CLOCK_SEGMENTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {widget.kind === 'timer' && (
        <label className={visionStyles.field}>
          <span>{t('tools.duration')}</span>
          <input
            id={id}
            className={visionStyles.input}
            value={duration}
            inputMode="numeric"
            onChange={(event) => setDuration(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => event.key === 'Enter' && commitDuration()}
          />
        </label>
      )}
      <div className={visionStyles.row}>
        <button type="button" className={visionStyles.ghost} onClick={() => save({ shown: !widget.shown })}>
          {widget.shown ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
          {t(widget.shown ? 'tools.hideFromScreen' : 'tools.showOnScreen')}
        </button>
        <button type="button" className={visionStyles.ghost} onClick={() => control.remove.mutate(widget.id)}>
          <Trash2 aria-hidden="true" size={15} />
          {t('tools.remove')}
        </button>
      </div>
    </section>
  )
}
