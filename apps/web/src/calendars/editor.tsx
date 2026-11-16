/**
 * El editor de un calendario, a pantalla entera (lienzo aprobado, pantalla 2; decisión 3 de Enrique): a la izquierda
 * las secciones con sus problemas y el año en cifras; en el centro, la columna que se desplaza dentro de su marco con
 * todas las secciones y, al pie, «Guardar» y «Cancelar» cuando hay cambios; a la derecha, la vista previa del mes, que
 * cambia al momento. Se guarda entero (con la versión que se leyó); con problemas, «Guardar» lleva al primero
 */
import type { CalendarView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  type CalendarProblem,
  type CalendarSection,
  validateCalendar,
  yearLength
} from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  Hourglass,
  Leaf,
  Moon,
  Repeat,
  SlidersHorizontal,
  TriangleAlert
} from 'lucide-react'
import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './editor.module.css'
import { MonthPreview } from './preview.tsx'
import {
  type Change,
  CorrespondenceSection,
  ErasSection,
  GeneralSection,
  LeapSection,
  MonthsSection,
  MoonsSection,
  SeasonsSection,
  Section,
  WeekSection
} from './sections.tsx'

const route = getRouteApi('/mundos/$worldId/calendarios/$calendarId')

export function CalendarEditorScreen() {
  const { t } = useTranslation()
  const { worldId, calendarId } = route.useParams()
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
      <div className={styles.missing}>
        <PageTitle>{t('calendars.notFound')}</PageTitle>
        <Link to="/mundos/$worldId/calendarios" params={{ worldId }}>
          {t('calendars.title')}
        </Link>
      </div>
    )
  const primary = calendars.data.calendars.find((c) => c.primary && c.id !== calendar.id) ?? null
  // Al guardar (o si cambia en otra pestaña), el editor empieza de nuevo desde lo guardado
  return <Editor key={`${calendar.id}-${calendar.version}`} worldId={worldId} calendar={calendar} primary={primary} />
}

type SectionEntry = { id: CalendarSection; icon: ReactNode; title: string }

function Editor({
  worldId,
  calendar,
  primary
}: {
  worldId: string
  calendar: CalendarView
  primary: CalendarView | null
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const [draft, setDraft] = useState<CalendarDefinition>(calendar.definition)
  const [name, setName] = useState(calendar.name)
  const [active, setActive] = useState<CalendarSection>('general')
  const column = useRef<HTMLDivElement>(null)
  const change: Change = (fn) =>
    setDraft((current) => {
      const next = structuredClone(current)
      fn(next)
      return next
    })
  // Validar y la vista previa van un paso por detrás de lo que se escribe: no frenan cada tecla
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
  // Los meses, los bisiestos y la semana tienen que estar bien para calcular días
  const computable = !problems.some((p) => p.section === 'months' || p.section === 'leap' || p.section === 'week')
  const dirty = name !== calendar.name || JSON.stringify(draft) !== JSON.stringify(calendar.definition)

  const save = useMutation({
    mutationFn: () =>
      api.call('updateCalendar', {
        calendarId: calendar.id,
        version: calendar.version,
        name: name.trim(),
        definition: draft
      }),
    onSuccess: (saved) => {
      client.setQueryData(['calendars', worldId], (old: { calendars: CalendarView[] } | undefined) =>
        old ? { calendars: old.calendars.map((c) => (c.id === saved.id ? saved : c)) } : old
      )
      void client.invalidateQueries({ queryKey: ['calendars', worldId] })
      announce(t('calendars.editor.saved'))
    },
    onError: (error) => announce(errorText(error))
  })

  const sections: SectionEntry[] = [
    { id: 'general', icon: <SlidersHorizontal size={16} />, title: t('calendars.editor.general') },
    { id: 'week', icon: <CalendarDays size={16} />, title: t('calendars.editor.week') },
    { id: 'months', icon: <CalendarRange size={16} />, title: t('calendars.editor.months') },
    { id: 'leap', icon: <Repeat size={16} />, title: t('calendars.editor.leap') },
    { id: 'seasons', icon: <Leaf size={16} />, title: t('calendars.editor.seasons') },
    { id: 'moons', icon: <Moon size={16} />, title: t('calendars.editor.moons') },
    { id: 'eras', icon: <Hourglass size={16} />, title: t('calendars.editor.eras') },
    ...(primary && !calendar.primary
      ? [
          {
            id: 'correspondence' as const,
            icon: <ArrowLeftRight size={16} />,
            title: t('calendars.editor.correspondence')
          }
        ]
      : [])
  ]
  const countOf = (id: CalendarSection) => problems.filter((p) => p.section === id).length
  const first = problems[0]
  const firstTitle = first ? (sections.find((s) => s.id === first.section)?.title ?? '') : ''

  /** Lleva a una sección: arriba en la columna y con el foco en su título */
  const goTo = (id: CalendarSection, focusProblem = false) => {
    const section = column.current?.querySelector<HTMLElement>(`[data-section="${id}"]`)
    if (!section) return
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
    const target = focusProblem ? section.querySelector<HTMLElement>('[aria-invalid="true"]') : null
    ;(target ?? section.querySelector<HTMLElement>('h2'))?.focus({ preventScroll: true })
    setActive(id)
  }

  // La sección que se ve, marcada en la lista de la izquierda
  useEffect(() => {
    const root = column.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0]?.target.getAttribute('data-section')
        if (id) setActive(id as CalendarSection)
      },
      { root, rootMargin: '0px 0px -60% 0px' }
    )
    for (const section of root.querySelectorAll('[data-section]')) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const submit = () => {
    if (first) {
      announce(t('calendars.editor.cantSave', { count: problems.length }))
      goTo(first.section, true)
      return
    }
    save.mutate()
  }
  const cancel = () => {
    setDraft(calendar.definition)
    setName(calendar.name)
    save.reset()
  }

  const length = computable ? yearLength(deferred) : 0
  const leapLength =
    computable && deferred.leapRules.length > 0 ? length + deferred.leapRules.reduce((s, r) => s + r.days, 0) : 0
  const regular = deferred.months.filter((m) => !m.festival).length
  const festivals = deferred.months.length - regular
  const props = { draft, change, problems }

  return (
    <div className={styles.editor}>
      <header className={styles.head}>
        <Link to="/mundos/$worldId/calendarios" params={{ worldId }} className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('calendars.editor.back')}
        </Link>
        <PageTitle>{name.trim() || calendar.name}</PageTitle>
        {calendar.primary && <span className={styles.badge}>{t('calendars.primary')}</span>}
      </header>

      <nav className={styles.nav} aria-label={t('calendars.editor.sections')} data-tour="calendario-secciones">
        <ul>
          {sections.map((section) => {
            const count = countOf(section.id)
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={styles.navItem}
                  aria-current={active === section.id ? 'true' : undefined}
                  onClick={() => goTo(section.id)}
                >
                  <span aria-hidden="true">{section.icon}</span>
                  <span className={styles.navTitle}>{section.title}</span>
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
        </ul>
        <p className={styles.summary}>
          {computable && (
            <>
              <b>{t('calendars.editor.yearDays', { days: length })}</b>
              {leapLength > 0 && <> · {t('calendars.editor.leapDays', { days: leapLength })}</>}
              <br />
            </>
          )}
          {festivals > 0
            ? t('calendars.monthsAndFestivals', {
                months: t('calendars.months', { count: regular }),
                festivals: t('calendars.festivals', { count: festivals })
              })
            : t('calendars.months', { count: regular })}
        </p>
      </nav>

      <div className={styles.main}>
        <div className={styles.column} ref={column}>
          <Section id="general" icon={sections[0]?.icon} title={t('calendars.editor.general')} problems={problems}>
            <GeneralSection draft={draft} change={change} name={name} onName={setName} />
          </Section>
          <Section id="week" icon={sections[1]?.icon} title={t('calendars.editor.week')} problems={problems}>
            <WeekSection {...props} />
          </Section>
          <Section id="months" icon={sections[2]?.icon} title={t('calendars.editor.months')} problems={problems}>
            <MonthsSection {...props} />
          </Section>
          <Section id="leap" icon={sections[3]?.icon} title={t('calendars.editor.leap')} problems={problems}>
            <LeapSection {...props} />
          </Section>
          <Section id="seasons" icon={sections[4]?.icon} title={t('calendars.editor.seasons')} problems={problems}>
            <SeasonsSection {...props} valid={computable} />
          </Section>
          <Section id="moons" icon={sections[5]?.icon} title={t('calendars.editor.moons')} problems={problems}>
            <MoonsSection {...props} />
          </Section>
          <Section id="eras" icon={sections[6]?.icon} title={t('calendars.editor.eras')} problems={problems}>
            <ErasSection {...props} />
          </Section>
          {primary && !calendar.primary && (
            <Section
              id="correspondence"
              icon={<ArrowLeftRight size={16} />}
              title={t('calendars.editor.correspondenceTitle')}
              problems={problems}
            >
              <CorrespondenceSection {...props} primary={primary} />
            </Section>
          )}
        </div>
        <footer className={styles.foot} data-tour="calendario-guardar">
          <ChangesBar shown={dirty}>
            <BusyButton className={form.button} busy={save.isPending} onClick={submit}>
              {t('calendars.editor.save')}
            </BusyButton>
            <button type="button" className={styles.cancel} onClick={cancel}>
              {t('calendars.editor.cancel')}
            </button>
          </ChangesBar>
          {save.error && <span className={styles.error}>{errorText(save.error)}</span>}
          {first && (
            <button type="button" className={styles.problemLink} onClick={() => goTo(first.section, true)}>
              <TriangleAlert size={16} aria-hidden="true" />
              {t('calendars.editor.problemsIn', { count: problems.length, section: firstTitle })}
            </button>
          )}
        </footer>
      </div>

      <aside className={styles.preview} aria-label={t('calendars.editor.preview')} data-tour="calendario-vista-previa">
        <h2 className={styles.previewLabel}>{t('calendars.editor.preview')}</h2>
        <MonthPreview definition={deferred} valid={computable} />
      </aside>

      <Tour
        id="calendario"
        steps={[
          { target: '[data-tour="calendario-secciones"]', text: t('tour.calendar.sections'), placement: 'right' },
          { target: '[data-tour="calendario-vista-previa"]', text: t('tour.calendar.preview'), placement: 'left' },
          { target: '[data-tour="calendario-guardar"]', text: t('tour.calendar.save'), placement: 'top' }
        ]}
      />
    </div>
  )
}
