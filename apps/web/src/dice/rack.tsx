/**
 * Los dados abiertos (lienzo «Tirar dados», a lo D&D Beyond): una columna sobre el d20 con el historial, escribir la
 * tirada y los siete dados (pulsar suma uno; con el botón derecho o manteniendo, quita uno). Lo juntado sale en una
 * bandeja junto al d20, con el modificador, la ventaja, quién la ve y «Tirar». Al tirar se vacía y se cierra
 */
import { type Campaign, type RollVisibility, visibilitiesFor } from '@crisol/contracts'
import { withAdvantage } from '@crisol/dice'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronUp, Eraser, Eye, EyeOff, History, Keyboard, Minus, Plus, X } from 'lucide-react'
import {
  type Dispatch,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { useDice } from './context.tsx'
import styles from './dice.module.css'
import { useCloseFloating } from './floating.ts'
import { echoes, explain } from './formula.ts'
import { chipOf, dieName, isEmpty, type Pool, type PoolAction, poolFormula, SIDES, type Sides, signed } from './pool.ts'
import { appendRoll } from './rolls.ts'
import { useTray } from './tray.tsx'
import { visibilityIn } from './visibility.ts'

/** La silueta de cada dado */
export const DIE_PATH: Record<Sides, string> = {
  4: 'M12 3l9 16H3z',
  6: 'M5 5h14v14H5z',
  8: 'M12 2l8 10-8 10-8-10z',
  10: 'M12 2l9 8-9 12-9-12z',
  12: 'M12 2l9.5 7-3.6 11H6.1L2.5 9z',
  20: 'M12 2l8.6 5v10L12 22l-8.6-5V7zM12 7l-5 8.5h10z',
  100: 'M8 3l6 6-6 9-6-9zM16 6l6 6-6 9-6-9z'
}

/** Quién la ve, de más a menos gente */
const ORDER: readonly RollVisibility[] = ['all', 'master', 'self', 'hidden']

/** El foco, a un dado de la columna (tras quitar el control que lo tenía) */
const focusDie = (sides: Sides) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-die="${sides}"]`)?.focus())

/** Cuánto hay que mantener el dedo para quitar un dado */
const HOLD_MS = 450

function DieIcon({ sides }: { sides: Sides }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.dieIcon}>
      <path d={DIE_PATH[sides]} />
    </svg>
  )
}

export function DiceRack({
  campaign,
  pool,
  change,
  sheet,
  chooser
}: {
  campaign: Campaign
  pool: Pool
  change: Dispatch<PoolAction>
  /** En el móvil: una hoja desde abajo */
  sheet: boolean
  /** En qué campaña se tira, si hay que elegir */
  chooser: ReactNode
}) {
  const { t } = useTranslation()
  const dice = useDice()
  const writing = dice.mode === 'write'
  const showPool = writing || !isEmpty(pool)
  const count = (sides: Sides) => pool.dice.find((d) => d.sides === sides)?.count ?? 0
  const close = useCloseFloating()
  const hint = useId()
  return (
    <>
      <div className={styles.column} data-tour="dados-columna">
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('dice.history')}
            title={t('dice.history')}
            data-tour="dados-historial"
            onClick={dice.openHistory}
          >
            <History size={17} aria-hidden="true" />
            {sheet && <span>{t('dice.history')}</span>}
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('dice.write')}
            title={t('dice.write')}
            aria-pressed={writing}
            onClick={() => dice.setMode(writing ? 'dice' : 'write')}
          >
            <Keyboard size={17} aria-hidden="true" />
          </button>
          {/* En el móvil, una hoja que se porta como una ventana: con su botón de cerrar */}
          {sheet && (
            <button
              type="button"
              className={styles.tool}
              aria-label={t('dice.close')}
              title={t('dice.close')}
              onClick={close}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        <ul className={styles.rackDice} aria-label={t('dice.addDie')}>
          {SIDES.map((sides) => (
            <li key={sides}>
              <DieButton sides={sides} count={count(sides)} change={change} disabled={writing} hint={hint} />
            </li>
          ))}
        </ul>
        <p id={hint} className={styles.hidden}>
          {t('dice.removeHint')}
        </p>
      </div>
      {showPool && <PoolTray campaign={campaign} pool={pool} change={change} writing={writing} chooser={chooser} />}
    </>
  )
}

/** Un dado de la columna: pulsar suma uno; el botón derecho o mantener el dedo, quita uno */
function DieButton({
  sides,
  count,
  change,
  disabled,
  hint
}: {
  sides: Sides
  count: number
  change: Dispatch<PoolAction>
  disabled: boolean
  /** Cómo se quita uno (el botón derecho, mantener el dedo o Retroceso) */
  hint: string
}) {
  const { t } = useTranslation()
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const touch = useRef(false)
  const cancel = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }
  const down = (event: PointerEvent) => {
    held.current = false
    touch.current = event.pointerType === 'touch'
    if (!touch.current) return
    hold.current = setTimeout(() => {
      held.current = true
      change({ type: 'remove', sides })
    }, HOLD_MS)
  }
  useEffect(() => cancel, [])
  const name = dieName(sides)
  return (
    <button
      type="button"
      className={styles.rackDie}
      aria-label={count ? t('dice.addCount', { die: name, count }) : t('dice.add', { die: name })}
      aria-describedby={hint}
      aria-keyshortcuts="Backspace Delete"
      data-count={count || undefined}
      data-die={sides}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => {
        // Tras mantener el dedo, el clic que llega no suma
        if (held.current) {
          held.current = false
          return
        }
        change({ type: 'add', sides })
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete' && event.key !== '-') return
        event.preventDefault()
        change({ type: 'remove', sides })
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        // Con el dedo ya lo quita mantener (Android manda además este menú: no se quita otro)
        if (touch.current) return
        change({ type: 'remove', sides })
      }}
    >
      <DieIcon sides={sides} />
      <span className={styles.rackName}>{name}</span>
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  )
}

/** La bandeja: lo juntado (o lo escrito), el modificador, la ventaja, quién la ve y «Tirar» */
function PoolTray({
  campaign,
  pool,
  change,
  writing,
  chooser
}: {
  campaign: Campaign
  pool: Pool
  change: Dispatch<PoolAction>
  writing: boolean
  chooser: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const tray = useTray()
  const dice = useDice()
  const close = useCloseFloating()
  const id = useId()
  // Escrita: empieza por la tirada por defecto del sistema de la campaña (sin sistema, 1d20)
  const fallback = campaign.system?.defaultRoll ?? '1d20'
  const [written, setWritten] = useState(fallback)
  const last = useRef(fallback)
  useEffect(() => {
    setWritten((current) => (current === last.current ? fallback : current))
    last.current = fallback
  }, [fallback])
  const formula = writing ? written : poolFormula(pool)
  const explained = explain(formula)
  const advantage = writing
    ? /(^|[^\d])2d20kh1/i.test(written)
      ? 'advantage'
      : /(^|[^\d])2d20kl1/i.test(written)
        ? 'disadvantage'
        : 'none'
    : pool.advantage
  // De más a menos gente: todos, el máster, solo yo
  const options = [...visibilitiesFor(campaign.role)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  // Si lo recordado no vale en esta campaña, lo más privado que tenga (nunca todos)
  const visibility = visibilityIn(dice.visibility, campaign.role)
  const roll = useMutation({
    mutationFn: () => api.call('rollDice', { campaignId: campaign.id, formula, visibility }),
    onSuccess: ({ roll: done }) => {
      appendRoll(queryClient, done)
      tray.play(done)
      announce(t('dice.rolled', { label: done.label ?? done.formula, total: done.total }))
      // Se vacía y se cierra; la próxima vez se abre igual (escribiendo o con los dados)
      if (!writing) change({ type: 'clear' })
      close()
    }
  })
  const toggle = (mode: 'advantage' | 'disadvantage') => {
    if (!writing) {
      change({ type: 'advantage', mode })
      return
    }
    const next = withAdvantage(written, advantage === mode ? 'none' : mode)
    setWritten(next ?? `${written.trim() ? `${written.trim()}+` : ''}${mode === 'advantage' ? '2d20kh1' : '2d20kl1'}`)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (explained.ok && !roll.isPending) roll.mutate()
  }
  return (
    <form className={styles.pool} onSubmit={submit} aria-label={t('dice.formula')}>
      {writing ? (
        <div className={styles.writeRow}>
          <label className={styles.hidden} htmlFor={`${id}-formula`}>
            {t('dice.formula')}
          </label>
          <input
            id={`${id}-formula`}
            className={styles.formula}
            value={written}
            maxLength={300}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            aria-invalid={!explained.ok}
            aria-describedby={`${id}-explained`}
            // biome-ignore lint/a11y/noAutofocus: se acaba de pedir escribir la tirada
            autoFocus
            onChange={(event) => setWritten(event.currentTarget.value)}
          />
          <p id={`${id}-explained`} className={explained.ok ? styles.explained : styles.wrong}>
            {explained.ok && echoes(written, explained.text) ? '' : explained.text}
          </p>
        </div>
      ) : (
        <div className={styles.poolRow}>
          <ul className={styles.chips} aria-label={t('dice.inRoll')}>
            {pool.dice.map((d) => (
              <li key={d.sides} className={styles.chip}>
                <DieIcon sides={d.sides} />
                <span translate="no">{chipOf(d)}</span>
                <button
                  type="button"
                  aria-label={t('dice.drop', { dice: chipOf(d) })}
                  onClick={() => {
                    change({ type: 'drop', sides: d.sides })
                    // El chip se va: el foco, a su dado de la columna
                    focusDie(d.sides)
                  }}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <fieldset className={styles.stepper}>
            <legend className={styles.hidden}>{t('dice.modifier')}</legend>
            <button type="button" aria-label={t('dice.less')} onClick={() => change({ type: 'modifier', by: -1 })}>
              <Minus size={13} aria-hidden="true" />
            </button>
            <span className={styles.value} aria-live="polite">
              {signed(pool.modifier)}
            </span>
            <button type="button" aria-label={t('dice.more')} onClick={() => change({ type: 'modifier', by: 1 })}>
              <Plus size={13} aria-hidden="true" />
            </button>
          </fieldset>
          <button
            type="button"
            className={styles.clear}
            aria-label={t('dice.clear')}
            title={t('dice.clear')}
            onClick={() => {
              change({ type: 'clear' })
              focusDie(SIDES[0])
            }}
          >
            <Eraser size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {roll.error && <p className={styles.wrong}>{errorText(roll.error)}</p>}
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.pill}
          aria-pressed={advantage === 'advantage'}
          onClick={() => toggle('advantage')}
        >
          {t('dice.advantage')}
        </button>
        <button
          type="button"
          className={styles.pill}
          aria-pressed={advantage === 'disadvantage'}
          onClick={() => toggle('disadvantage')}
        >
          {t('dice.disadvantage')}
        </button>
        {chooser}
        <WhoSees options={options} value={visibility} onChange={dice.setVisibility} />
        <button type="submit" className={styles.roll} disabled={!explained.ok || roll.isPending}>
          {t('dice.roll')}
        </button>
      </div>
    </form>
  )
}

/** Quién ve la tirada: un menú que sube (se recuerda) */
function WhoSees({
  options,
  value,
  onChange
}: {
  options: readonly RollVisibility[]
  value: RollVisibility
  onChange: (value: RollVisibility) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, menu, button)
  // Al abrirlo, el foco en lo elegido; Escape lo cierra y vuelve al botón (sin cerrar los dados)
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [open])
  const Icon = value === 'all' ? Eye : EyeOff
  const pick = (option: RollVisibility) => {
    onChange(option)
    setOpen(false)
    button.current?.focus()
  }
  return (
    <span className={styles.whoWrap}>
      <button
        ref={button}
        type="button"
        className={styles.who}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('dice.who')}: ${t(`dice.visibility.${value}`)}`}
        onClick={() => setOpen(!open)}
      >
        <Icon size={14} aria-hidden="true" />
        {t(`dice.visibility.${value}`)}
        <ChevronUp size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={t('dice.who')}
          className={styles.whoMenu}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              button.current?.focus()
              return
            }
            const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
            const at = items.indexOf(document.activeElement as HTMLElement)
            const to =
              event.key === 'ArrowDown'
                ? (at + 1) % items.length
                : event.key === 'ArrowUp'
                  ? (at - 1 + items.length) % items.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : -1
            if (to < 0) return
            event.preventDefault()
            items[to]?.focus()
          }}
          // Con Tab (o pulsando fuera) se va el foco: se cierra
          onBlur={(event) => {
            if (!menu.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
          }}
        >
          {options.map((option) => {
            const ItemIcon = option === 'all' ? Eye : EyeOff
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={option === value}
                tabIndex={option === value ? 0 : -1}
                onClick={() => pick(option)}
              >
                <ItemIcon size={14} aria-hidden="true" />
                {t(`dice.visibility.${option}`)}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
