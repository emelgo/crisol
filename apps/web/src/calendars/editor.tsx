/**
 * El editor de un calendario, por fases (ajustes tras los módulos, bloque C; como Reglas de un sistema): con el
 * esqueleto de las pantallas, el título sobre la columna y «Ver calendario» a su derecha; a la izquierda, las fases con
 * sus avisos (General, Semana, Meses, Días señalados, Días de más, Estaciones, Lunas, Eras y la correspondencia con el
 * principal); en el centro, la fase elegida (va en la URL, ?fase=), con la anterior y la siguiente al pie y, cuando hay
 * cambios, «Guardar» y «Cancelar» abajo; a la derecha, el año en cifras y los problemas, cada uno con «Ir a…». Se guarda
 * entero (con la versión que se leyó); con problemas, «Guardar» lleva al primero. Salir con cambios pregunta
 */
import type { CalendarView } from '@crisol/contracts'
import { type CalendarDefinition, type CalendarProblem, type CalendarSection, validateCalendar } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useBlocker, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  Hourglass,
  Leaf,
  type LucideIcon,
  Moon,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert
} from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import dialogStyles from '../components/dialog.module.css'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './editor.module.css'
import { CalendarFacts } from './facts.tsx'
import { useProblemText } from './problems.ts'
import {
  type Change,
  CorrespondenceSection,
  ErasSection,
  GeneralSection,
  LeapSection,
  MonthsSection,
  MoonsSection,
  NamedDaysSection,
  SeasonsSection,
  Section,
  WeekSection
} from './sections.tsx'
import { YearStrip } from './year-strip.tsx'

const route = getRouteApi('/mundos/$worldId/calendarios/$calendarId/editar')

/** Las fases, en su orden: su id en la URL, su sección de los problemas (los días señalados no tienen) y su título */
export const PHASES = [
  { id: 'general', section: 'general', title: 'general', icon: SlidersHorizontal },
  { id: 'semana', section: 'week', title: 'week', icon: CalendarDays },
  { id: 'meses', section: 'months', title: 'months', icon: CalendarRange },
  { id: 'dias-senalados', section: null, title: 'namedDays', icon: Sparkles },
  { id: 'dias-de-mas', section: 'leap', title: 'leap', icon: Repeat },
  { id: 'estaciones', section: 'seasons', title: 'seasons', icon: Leaf },
  { id: 'lunas', section: 'moons', title: 'moons', icon: Moon },
  { id: 'eras', section: 'eras', title: 'eras', icon: Hourglass },
  { id: 'correspondencia', section: 'correspondence', title: 'correspondence', icon: ArrowLeftRight }
] as const satisfies ReadonlyArray<{
  id: string
  section: CalendarSection | null
  title: string
  icon: LucideIcon
}>

type Phase = (typeof PHASES)[number]

export function CalendarEditorScreen() {
  const { t } = useTranslation()
  const { worldId, calendarId } = route.useParams()
  const { fase } = route.useSearch()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const calendars = useQuery({
    queryKey: ['calendars', worldId],
    queryFn: () => api.call('listCalendars', { worldId }),
    enabled: Boolean(account)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!calendars.data)
    return failed(calendars) ? <LoadError error={calendars.error} onRetry={() => calendars.refetch()} /> : <Loading />
  const calendar = calendars.data.calendars.find((c) => c.id === calendarId)
  if (!calendar)
    return (
      <Screen title={t('calendars.notFound')}>
        <Link to="/mundos/$worldId/calendarios" params={{ worldId }}>
          {t('calendars.title')}
        </Link>
      </Screen>
    )
  const primary = calendars.data.calendars.find((c) => c.primary && c.id !== calendar.id) ?? null
  // Al guardar, el editor sigue donde estaba; lo de otra pestaña entra si no hay cambios
  return <Editor key={calendar.id} worldId={worldId} calendar={calendar} primary={primary} asked={fase ?? null} />
}

function Editor({
  worldId,
  calendar: current,
  primary,
  asked
}: {
  worldId: string
  calendar: CalendarView
  primary: CalendarView | null
  /** La fase de la URL (sin ella, o si no la tiene este calendario, General) */
  asked: string | null
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const problemText = useProblemText()
  // Lo guardado con lo que se compara (y su versión, la que se manda al guardar)
  const [calendar, setCalendar] = useState(current)
  const [draft, setDraft] = useState<CalendarDefinition>(current.definition)
  const [name, setName] = useState(current.name)
  const heading = useRef<HTMLHeadingElement>(null)
  // Al cambiar de fase: el foco, a su título o al primer campo con problema
  const focusOnPhase = useRef<'heading' | 'problem' | null>(null)
  const change: Change = (fn) =>
    setDraft((current) => {
      const next = structuredClone(current)
      fn(next)
      return next
    })
  // Validar y el resumen van un paso por detrás de lo que se escribe: no frenan cada tecla
  const deferred = useDeferredValue(draft)
  const problems = useMemo<CalendarProblem[]>(() => {
    const anchor = deferred.correspondence ? { anchor: primary?.definition ?? null } : {}
    const found = validateCalendar(deferred, anchor)
    if (!name.trim())
      found.unshift({
        section: 'general',
        code: 'nameMissing',
        params: {},
        message: t('calendars.problem.nameMissing')
      })
    return found
  }, [deferred, primary, name, t])
  // Los meses, los días de más y la semana tienen que estar bien para calcular días
  const computable = !problems.some((p) => p.section === 'months' || p.section === 'leap' || p.section === 'week')
  const saved = useMemo(() => JSON.stringify(calendar.definition), [calendar.definition])
  const dirty = name !== calendar.name || JSON.stringify(draft) !== saved
  // Si cambia en otra pestaña (o por la IA) y aquí no hay cambios, se ve lo nuevo
  if (current.version > calendar.version && !dirty) {
    setCalendar(current)
    setDraft(current.definition)
    setName(current.name)
  }

  // Al acortar un mes, cuántas fechas se leen ahora en su último día (lo dice el servidor al guardar)
  const [clipped, setClipped] = useState(0)
  const save = useMutation({
    mutationFn: () =>
      api.call('updateCalendar', {
        calendarId: calendar.id,
        version: calendar.version,
        name: name.trim(),
        definition: draft
      }),
    onSuccess: ({ clipped: shortened, ...stored }) => {
      setClipped(shortened ?? 0)
      setCalendar(stored)
      setDraft(stored.definition)
      setName(stored.name)
      client.setQueryData(['calendars', worldId], (old: { calendars: CalendarView[] } | undefined) =>
        old ? { calendars: old.calendars.map((c) => (c.id === stored.id ? stored : c)) } : old
      )
      void client.invalidateQueries({ queryKey: ['calendars', worldId] })
      announce(shortened ? t('calendars.editor.clipped', { count: shortened }) : t('calendars.editor.saved'))
    },
    onError: (error) => announce(errorText(error))
  })

  const phases: Phase[] = PHASES.filter((p) => p.id !== 'correspondencia' || (primary !== null && !calendar.primary))
  const phase = phases.find((p) => p.id === asked) ?? phases[0] ?? PHASES[0]
  const at = phases.indexOf(phase)
  const previous = phases[at - 1]
  const next = phases[at + 1]
  const titleOf = (p: Phase) => t(`calendars.editor.${p.title}`)
  const phaseOf = (section: CalendarSection) => phases.find((p) => p.section === section) ?? phases[0] ?? PHASES[0]
  const countOf = (p: Phase) => (p.section ? problems.filter((problem) => problem.section === p.section).length : 0)
  const own = phase.section ? problems.filter((p) => p.section === phase.section) : []
  const first = problems[0]

  /** Abre una fase (en la URL): el foco, a su título o, si se va a un problema, al primer campo que lo tiene */
  const openPhase = (target: Phase, focus: 'heading' | 'problem' = 'heading') => {
    focusOnPhase.current = focus
    if (target.id === phase.id) return focusPhase()
    void navigate({
      to: '/mundos/$worldId/calendarios/$calendarId/editar',
      params: { worldId, calendarId: calendar.id },
      search: target.id === 'general' ? {} : { fase: target.id }
    })
  }
  const focusPhase = () => {
    const wanted = focusOnPhase.current
    focusOnPhase.current = null
    if (!wanted) return
    const box = heading.current?.closest('section')
    const invalid = wanted === 'problem' ? box?.querySelector<HTMLElement>('[aria-invalid="true"]') : null
    ;(invalid ?? heading.current)?.focus({ preventScroll: true })
    // Si su principio quedó por encima (se venía de abajo, de «Siguiente»), arriba
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start' })
  }
  useEffect(focusPhase, [phase.id])

  const submit = () => {
    if (first) {
      announce(t('calendars.editor.cantSave', { count: problems.length }))
      openPhase(phaseOf(first.section), 'problem')
      return
    }
    save.mutate()
  }
  // Salir con cambios (a otra pantalla: cambiar de fase no es salir) pregunta; al cerrar la pestaña, el aviso del navegador
  const blocker = useBlocker({
    shouldBlockFn: ({ current: from, next: to }) => dirty && from.pathname !== to.pathname,
    withResolver: true,
    enableBeforeUnload: () => dirty
  })
  const cancel = () => {
    setDraft(calendar.definition)
    setName(calendar.name)
    save.reset()
  }

  const props = { draft, change, problems }
  const PhaseIcon = phase.icon
  const yearId = useId()
  const problemsId = useId()

  return (
    <Screen
      title={name.trim() || calendar.name}
      actions={
        <Link
          to="/mundos/$worldId/calendarios/$calendarId"
          params={{ worldId, calendarId: calendar.id }}
          className={styles.view}
        >
          <Eye size={16} aria-hidden="true" />
          {t('calendars.editor.view')}
        </Link>
      }
      left={
        <nav className={styles.nav} aria-label={t('calendars.editor.phases')} data-tour="calendario-fases">
          <ol>
            {phases.map((p, i) => {
              const count = countOf(p)
              const Icon = p.icon
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.navItem}
                    aria-current={p.id === phase.id ? 'step' : undefined}
                    onClick={() => openPhase(p)}
                  >
                    <span className={styles.navNumber} aria-hidden="true">
                      {i + 1}
                    </span>
                    <Icon size={16} aria-hidden="true" className={styles.navIcon} />
                    <span className={styles.navTitle}>{titleOf(p)}</span>
                    {count > 0 && (
                      <span className={styles.navCount}>
                        <span aria-hidden="true">{count}</span>
                        <span className={styles.srOnly}>{t('calendars.editor.problems', { count })}</span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      }
      leftLabel={t('calendars.editor.phases')}
      right={
        <div className={styles.side} data-tour="calendario-resumen">
          <section aria-labelledby={yearId}>
            <h2 id={yearId}>{t('calendars.editor.yearSummary')}</h2>
            <YearStrip definition={deferred} label={t('calendars.year', { name: name.trim() || calendar.name })} />
            <div className={styles.facts}>
              <CalendarFacts calendar={{ ...calendar, definition: deferred }} />
            </div>
          </section>
          <section aria-labelledby={problemsId}>
            <h2 id={problemsId}>{t('calendars.editor.problemsTitle')}</h2>
            {problems.length === 0 ? (
              <p className={styles.muted}>{t('calendars.editor.noProblems')}</p>
            ) : (
              <ul className={styles.notes}>
                {problems.map((problem) => (
                  <li key={`${problem.section}-${problem.code}-${problem.index ?? ''}-${problem.message}`}>
                    <TriangleAlert size={14} aria-hidden="true" />
                    <span>
                      {problemText(problem)}{' '}
                      <button
                        type="button"
                        className={styles.goto}
                        onClick={() => openPhase(phaseOf(problem.section), 'problem')}
                      >
                        {t('calendars.editor.goTo', { phase: titleOf(phaseOf(problem.section)) })}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      }
      rightLabel={t('calendars.editor.summary')}
    >
      <div className={styles.column}>
        <Section
          id={phase.id}
          icon={<PhaseIcon size={18} />}
          title={phase.id === 'correspondencia' ? t('calendars.editor.correspondenceTitle') : titleOf(phase)}
          problems={own}
          headingRef={heading}
          footer={
            <div className={styles.next}>
              {previous ? (
                <button type="button" className={styles.back} onClick={() => openPhase(previous)}>
                  <ChevronLeft size={16} aria-hidden="true" />
                  {titleOf(previous)}
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" className={styles.go} onClick={() => openPhase(next)}>
                  {t('calendars.editor.next', { phase: titleOf(next) })}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          }
        >
          {phase.id === 'general' && <GeneralSection draft={draft} change={change} name={name} onName={setName} />}
          {phase.id === 'semana' && <WeekSection {...props} valid={computable} />}
          {phase.id === 'meses' && <MonthsSection {...props} />}
          {phase.id === 'dias-senalados' && <NamedDaysSection draft={draft} change={change} />}
          {phase.id === 'dias-de-mas' && <LeapSection {...props} />}
          {phase.id === 'estaciones' && <SeasonsSection {...props} valid={computable} reference={deferred} />}
          {phase.id === 'lunas' && <MoonsSection {...props} />}
          {phase.id === 'eras' && <ErasSection {...props} />}
          {phase.id === 'correspondencia' && primary && <CorrespondenceSection {...props} primary={primary} />}
        </Section>
        <footer className={styles.foot} data-tour="calendario-guardar">
          <ChangesBar shown={dirty}>
            <BusyButton className={form.button} busy={save.isPending} onClick={submit}>
              {t('calendars.editor.save')}
            </BusyButton>
            <button type="button" className={styles.cancel} onClick={cancel}>
              {t('calendars.editor.cancel')}
            </button>
            {first && (
              <button
                type="button"
                className={styles.problemLink}
                onClick={() => openPhase(phaseOf(first.section), 'problem')}
              >
                <TriangleAlert size={16} aria-hidden="true" />
                {t('calendars.editor.problemsIn', {
                  count: problems.length,
                  section: titleOf(phaseOf(first.section))
                })}
              </button>
            )}
          </ChangesBar>
          {save.error && <span className={styles.error}>{errorText(save.error)}</span>}
          {clipped > 0 && !dirty && (
            <span className={styles.notice}>{t('calendars.editor.clipped', { count: clipped })}</span>
          )}
        </footer>
      </div>

      {blocker.status === 'blocked' && (
        <LeaveDialog onStay={() => blocker.reset?.()} onLeave={() => blocker.proceed?.()} />
      )}
      <Tour
        id="calendario"
        steps={[
          { target: '[data-tour="calendario-fases"]', text: t('tour.calendar.phases'), placement: 'right' },
          { target: '[data-tour="calendario-resumen"]', text: t('tour.calendar.summary'), placement: 'left' }
        ]}
      />
    </Screen>
  )
}

/** ¿Salir sin guardar? Seguir editando (lo primero, con el foco) o salir perdiendo los cambios */
function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const left = useRef(false)
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={dialogStyles.dialog}
      onClose={() => {
        if (!left.current) onStay()
      }}
    >
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('calendars.editor.leaveTitle')}</h2>
        <div className={dialogStyles.actions}>
          <button type="button" className={form.button} onClick={() => dialog.current?.close()} data-autofocus>
            {t('calendars.editor.stay')}
          </button>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              left.current = true
              onLeave()
            }}
          >
            {t('calendars.editor.leave')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
