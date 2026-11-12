/**
 * El editor de un sistema, a mano (tanda 8; lienzo aprobado: «Editor de sistemas»): los pasos con preguntas de mesa a
 * la izquierda (se salta a cualquiera), el paso abierto en el centro con «Siguiente: …» y, a la derecha, la ficha de
 * ejemplo que se calcula al momento y la revisión siempre a la vista, cada aviso con «Ir a…». Se guarda solo, con la
 * versión que se tenía, cuando no hay errores (los mismos que valida el servidor); con errores, se sigue escribiendo y
 * la revisión dice qué falta. Quitar algo deja «Deshacer» un momento
 */
import { characterType, type Language, type Problem, type System, textOf, validateSystem } from '@crisol/systems'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client.ts'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { Loading } from '../../components/brand.tsx'
import { failed, LoadError } from '../../components/load-error.tsx'
import { PageTitle } from '../../components/page-title.tsx'
import { CharacterStep } from './character-step.tsx'
import { ExampleSheet } from './example-sheet.tsx'
import { AdvancedStep, CompendiumStep, CreationStep, ObjectsStep, SheetStep } from './more-steps.tsx'
import { RollsStep } from './rolls-step.tsx'
import styles from './rules.module.css'

export const STEPS = ['personaje', 'tiradas', 'objetos', 'ficha', 'creacion', 'compendio', 'avanzado'] as const
export type Step = (typeof STEPS)[number]

/** Un cambio en el borrador: sobre una copia; con `undo`, lo que se quitó (sale «Deshacer») */
export type Change = (fn: (draft: System) => void, undo?: string) => void

/** De qué paso es un aviso, por su ruta */
export function stepOf(path: string, system: System): Step {
  const type = characterType(system)
  if (type && (path === `types.${type}.fields` || path.startsWith(`types.${type}.fields.`))) return 'personaje'
  if (/^(rolls|dice|initiative)(\.|$)/.test(path)) return 'tiradas'
  if (/^(sheet|types\.[^.]+\.sheet)(\.|$)/.test(path)) return 'ficha'
  if (/^creation(\.|$)/.test(path)) return 'creacion'
  if (/^(sources|packs|compendium)(\.|$)/.test(path)) return 'compendio'
  if (/^types\./.test(path)) return 'objetos'
  return 'avanzado'
}

/** El sitio de un aviso en su paso (su fila y, si va dentro de otra, esa), para llevar a él */
export const anchorOf = (path: string): { row: string; parent?: string } | null => {
  const field = /^types\.([^.]+)\.fields\.([^.]+)/.exec(path)
  if (field) return { row: `campo-${field[1]}-${field[2]}`, parent: `tipo-${field[1]}` }
  const roll = /^rolls\.([^.]+)/.exec(path)
  return roll ? { row: `tirada-${roll[1]}` } : null
}

type Saving = 'saved' | 'dirty' | 'saving' | 'invalid' | 'conflict' | 'error'

export function RulesEditor({ systemId }: { systemId: string }) {
  const api = useApi()
  const system = useQuery({ queryKey: ['system', systemId], queryFn: () => api.call('getSystem', { systemId }) })
  if (!system.data)
    return failed(system) ? <LoadError error={system.error} onRetry={() => system.refetch()} /> : <Loading />
  return (
    <Editor
      key={`${system.data.id}-${system.dataUpdatedAt}`}
      systemId={systemId}
      name={system.data.name}
      initial={system.data.document as unknown as System}
      initialVersion={system.data.version}
      onReload={() => void system.refetch()}
    />
  )
}

function Editor({
  systemId,
  name,
  initial,
  initialVersion,
  onReload
}: {
  systemId: string
  name: string
  initial: System
  initialVersion: number
  onReload: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const language: Language = (initial.languages?.[0] as Language | undefined) ?? 'es'
  const [draft, setDraft] = useState<System>(initial)
  const [step, setStep] = useState<Step>('personaje')
  const [saving, setSaving] = useState<Saving>('saved')
  const [fresh, setFresh] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ before: System; text: string } | null>(null)
  // Al acabar un guardado, se mira si quedó algo por guardar
  const [settled, setSettled] = useState(0)
  const version = useRef(initialVersion)
  const saved = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const heading = useRef<HTMLHeadingElement>(null)
  const stepFocus = useRef<'heading' | 'none' | null>(null)
  // Validar, la ficha de ejemplo y la revisión van un paso por detrás de lo que se escribe: no frenan cada tecla
  const deferred = useDeferredValue(draft)
  const problems = useMemo<Problem[]>(() => validateSystem(deferred, { language }).problems, [deferred, language])
  const errors = problems.filter((p) => p.severity === 'error')
  const warnings = problems.length - errors.length
  const byStep = useMemo(() => {
    const out = new Map<Step, Problem[]>()
    for (const problem of problems) {
      const s = stepOf(problem.path, deferred)
      out.set(s, [...(out.get(s) ?? []), problem])
    }
    return out
  }, [problems, deferred])

  const change: Change = (fn, undoText) => {
    setDraft((current) => {
      const next = structuredClone(current)
      fn(next)
      if (undoText) setUndo({ before: current, text: undoText })
      return next
    })
    // Con otro cambio después, «Deshacer» ya no sale: volver a lo de antes perdería ese cambio
    if (!undoText) setUndo(null)
  }

  const save = useMutation({
    mutationFn: (document: System) =>
      api.call('updateSystem', {
        systemId,
        version: version.current,
        document: document as unknown as Record<string, unknown>
      }),
    onMutate: () => setSaving('saving'),
    onSuccess: (out, document) => {
      version.current = out.system.version
      saved.current = document
      setSaving((now) => (now === 'saving' ? 'saved' : now))
      void client.invalidateQueries({ queryKey: ['systems'] })
      void client.invalidateQueries({ queryKey: ['systemBooks', systemId] })
    },
    onError: (error) => setSaving(error instanceof ApiError && error.code === 'SYSTEM_CHANGED' ? 'conflict' : 'error'),
    onSettled: () => setSettled((n) => n + 1)
  })
  const pending = save.isPending

  // Se guarda solo, un momento después del último cambio y sin errores; de uno en uno (con la versión del anterior)
  useEffect(() => {
    if (deferred !== draft || draft === saved.current) return
    // Lo que se está guardando ya es esto: nada que hacer hasta que acabe
    if (pending && save.variables === draft) return
    clearTimeout(timer.current)
    if (errors.length > 0) {
      setSaving('invalid')
      return
    }
    setSaving((now) => (now === 'conflict' ? now : 'dirty'))
    if (pending) return
    timer.current = setTimeout(() => save.mutate(draft), 900)
    return () => clearTimeout(timer.current)
  }, [draft, deferred, errors.length, pending, settled])

  // Al salir (o al cerrar la pestaña) con algo sin guardar y sin errores, se guarda ya
  const latest = useRef({ draft, pending })
  latest.current = { draft, pending }
  useEffect(() => {
    const flush = () => {
      const { draft: last, pending: busy } = latest.current
      if (busy || last === saved.current) return
      if (validateSystem(last, { language }).problems.some((p) => p.severity === 'error')) return
      clearTimeout(timer.current)
      saved.current = last
      void api
        .call('updateSystem', {
          systemId,
          version: version.current,
          document: last as unknown as Record<string, unknown>
        })
        .then((out) => {
          version.current = out.system.version
          void client.invalidateQueries({ queryKey: ['system', systemId] })
        })
        .catch(() => {})
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [api, client, systemId, language])

  // Se anuncia lo que importa: que no se puede guardar y, tras un problema, que ya se guardó
  const troubled = useRef(false)
  useEffect(() => {
    if (saving === 'invalid' && !troubled.current) announce(t('rules.unsaved', { count: errors.length }))
    if (saving === 'invalid' || saving === 'error' || saving === 'conflict') troubled.current = true
    if (saving === 'saved' && troubled.current) {
      troubled.current = false
      announce(t('rules.saved'))
    }
  }, [saving, announce, t, errors.length])

  // «Deshacer» dura un momento
  useEffect(() => {
    if (!undo) return
    announce(undo.text)
    const gone = setTimeout(() => setUndo(null), 8000)
    return () => clearTimeout(gone)
  }, [undo, announce])

  // Al cambiar de paso, arriba y con el foco en su título (salvo si se va a un sitio concreto)
  useEffect(() => {
    if (stepFocus.current === 'heading') {
      heading.current?.focus({ preventScroll: true })
      // Solo si su principio quedó por encima (se venía de abajo, de «Siguiente»)
      const article = heading.current?.closest('article')
      if (article && article.getBoundingClientRect().top < 0) article.scrollIntoView({ block: 'start' })
    }
    stepFocus.current = null
  }, [step])
  const openStep = (s: Step) => {
    stepFocus.current = 'heading'
    setStep(s)
  }

  const goTo = (problem: Problem) => {
    const target = stepOf(problem.path, draft)
    const anchor = anchorOf(problem.path)
    stepFocus.current = anchor ? 'none' : 'heading'
    setStep(target)
    if (!anchor) return
    const reach = (again: boolean) => {
      const element = document.getElementById(anchor.row)
      // Su fila está dentro de otra (un campo de un tipo de objeto): se abre esa antes
      if (!element && anchor.parent && again) {
        const parent = document.getElementById(anchor.parent)?.querySelector<HTMLButtonElement>('button[aria-expanded]')
        if (parent?.getAttribute('aria-expanded') === 'false') parent.click()
        requestAnimationFrame(() => reach(false))
        return
      }
      const head = element?.querySelector<HTMLButtonElement>('button[aria-expanded]')
      // Su fila, abierta y con el foco
      if (head?.getAttribute('aria-expanded') === 'false') head.click()
      element?.scrollIntoView({ block: 'center' })
      head?.focus()
    }
    requestAnimationFrame(() => reach(true))
  }

  const at = STEPS.indexOf(step)
  const next = STEPS[at + 1]
  const previous = STEPS[at - 1]
  const SHOWN = 30

  return (
    <div className={styles.editor}>
      <div className={styles.titleRow}>
        <PageTitle>{t('systemRules.title')}</PageTitle>
        <SaveState saving={saving} errors={errors.length} />
      </div>
      <nav className={styles.steps} aria-label={t('rules.steps')}>
        <span className={styles.stepsTitle}>{name}</span>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={styles.step}
                aria-current={s === step ? 'step' : undefined}
                data-advanced={s === 'avanzado' || undefined}
                onClick={() => openStep(s)}
              >
                <span className={styles.stepNumber} aria-hidden={s === 'avanzado' || undefined}>
                  {s === 'avanzado' ? '⋯' : i + 1}
                </span>
                <span className={styles.stepQuestion}>{t(`rules.step.${s}.question`)}</span>
                {(byStep.get(s) ?? []).some((p) => p.severity === 'error') && (
                  <span className={styles.stepWarn} title={t('rules.stepHasProblems')}>
                    <span className={styles.srOnly}>{t('rules.stepHasProblems')}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <article className={styles.main} aria-labelledby="paso-abierto">
        <h2 id="paso-abierto" ref={heading} tabIndex={-1}>
          {t(`rules.step.${step}.question`)}
        </h2>
        <p className={styles.lead}>{t(`rules.step.${step}.lead`)}</p>
        {step === 'personaje' && (
          <CharacterStep system={draft} language={language} change={change} onAdded={setFresh} problems={problems} />
        )}
        {step === 'tiradas' && <RollsStep system={draft} language={language} change={change} problems={problems} />}
        {step === 'objetos' && <ObjectsStep system={draft} language={language} change={change} problems={problems} />}
        {step === 'ficha' && <SheetStep system={draft} language={language} change={change} />}
        {step === 'creacion' && <CreationStep system={draft} language={language} change={change} />}
        {step === 'compendio' && <CompendiumStep systemId={systemId} />}
        {step === 'avanzado' && <AdvancedStep systemId={systemId} system={draft} language={language} change={change} />}
        <div className={styles.next}>
          {previous ? (
            <button type="button" className={styles.back} onClick={() => openStep(previous)}>
              ← {t(`rules.step.${previous}.short`)}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" className={styles.go} onClick={() => openStep(next)}>
              {t('rules.next', { step: t(`rules.step.${next}.short`) })}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </article>
      <aside className={styles.side} aria-label={t('rules.aside')}>
        {/* La revisión, primero: siempre a la vista; la ficha de ejemplo, debajo y con su propio desplazamiento */}
        <section className={styles.panel} aria-labelledby="revision">
          <div className={styles.panelHead}>
            <h2 id="revision">{t('rules.review.title')}</h2>
            <span data-ok={problems.length === 0 || undefined} data-errors={errors.length > 0 || undefined}>
              {problems.length === 0
                ? t('rules.review.ok')
                : [
                    errors.length > 0 ? t('rules.review.errors', { count: errors.length }) : '',
                    warnings > 0 ? t('rules.review.warnings', { count: warnings }) : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </div>
          {problems.length === 0 ? (
            <p className={styles.muted}>{t('rules.review.allGood')}</p>
          ) : (
            <ul className={styles.notes}>
              {problems.slice(0, SHOWN).map((problem) => (
                <li key={`${problem.path}-${problem.message}`} data-severity={problem.severity}>
                  <span className={styles.dot} aria-hidden="true" />
                  <span>
                    <b>{problem.where}</b> {problem.message}
                    <button type="button" className={styles.goto} onClick={() => goTo(problem)}>
                      {t('rules.review.goTo', { step: t(`rules.step.${stepOf(problem.path, draft)}.short`) })}
                    </button>
                  </span>
                </li>
              ))}
              {problems.length > SHOWN && (
                <li className={styles.muted}>{t('rules.review.more', { count: problems.length - SHOWN })}</li>
              )}
            </ul>
          )}
        </section>
        <section className={`${styles.panel} ${styles.exPanel}`} aria-labelledby="ficha-ejemplo">
          <div className={styles.panelHead}>
            <h2 id="ficha-ejemplo">{t('rules.example.title')}</h2>
          </div>
          <ExampleSheet system={deferred} language={language} fresh={fresh} />
        </section>
      </aside>
      {undo && (
        <div className={styles.undo} role="status">
          <span>{undo.text}</span>
          <button
            type="button"
            onClick={() => {
              setDraft(undo.before)
              setUndo(null)
            }}
          >
            {t('rules.undo')}
          </button>
        </div>
      )}
      {saving === 'conflict' && (
        <div className={styles.problem} role="alert">
          {errorText(new ApiError('SYSTEM_CHANGED', 400))}
          <button type="button" onClick={onReload}>
            {t('rules.reload')}
          </button>
        </div>
      )}
      {saving === 'error' && save.error && (
        <div className={styles.problem} role="alert">
          {errorText(save.error)}
        </div>
      )}
    </div>
  )
}

/** El estado del guardado, a la vista (lo que importa se anuncia aparte, sin repetir cada pausa) */
function SaveState({ saving, errors }: { saving: Saving; errors: number }) {
  const { t } = useTranslation()
  const text =
    saving === 'saved'
      ? t('rules.saved')
      : saving === 'invalid'
        ? t('rules.unsaved', { count: errors })
        : saving === 'saving' || saving === 'dirty'
          ? t('rules.saving')
          : ''
  return (
    <span className={styles.saveState} data-state={saving}>
      {saving === 'saved' && <Check size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

/** Un nombre del sistema en su idioma (para los textos que lo nombran) */
export const nameOf = (system: System, language: Language) => textOf(system.name, language)
