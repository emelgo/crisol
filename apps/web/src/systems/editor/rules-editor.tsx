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
import { useEffect, useMemo, useRef, useState } from 'react'
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

/** El sitio de un aviso en su paso (su fila), para llevar a él */
const anchorOf = (path: string) => {
  const field = /^types\.[^.]+\.fields\.([^.]+)/.exec(path)
  if (field) return `campo-${field[1]}`
  const roll = /^rolls\.([^.]+)/.exec(path)
  return roll ? `tirada-${roll[1]}` : null
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
  const version = useRef(initialVersion)
  const saved = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const problems = useMemo<Problem[]>(() => validateSystem(draft, { language }).problems, [draft, language])
  const errors = problems.filter((p) => p.severity === 'error')

  const change: Change = (fn, undoText) => {
    setDraft((current) => {
      const next = structuredClone(current)
      fn(next)
      if (undoText) setUndo({ before: current, text: undoText })
      return next
    })
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
    onError: (error) => setSaving(error instanceof ApiError && error.code === 'SYSTEM_CHANGED' ? 'conflict' : 'error')
  })

  // Se guarda solo, un momento después del último cambio y sin errores
  useEffect(() => {
    if (draft === saved.current) return
    clearTimeout(timer.current)
    if (errors.length > 0) {
      setSaving('invalid')
      return
    }
    setSaving('dirty')
    timer.current = setTimeout(() => save.mutate(draft), 900)
    return () => clearTimeout(timer.current)
  }, [draft, errors.length])

  // «Deshacer» dura un momento
  useEffect(() => {
    if (!undo) return
    announce(undo.text)
    const gone = setTimeout(() => setUndo(null), 8000)
    return () => clearTimeout(gone)
  }, [undo, announce])

  const goTo = (problem: Problem) => {
    const target = stepOf(problem.path, draft)
    setStep(target)
    const anchor = anchorOf(problem.path)
    if (!anchor) return
    requestAnimationFrame(() => {
      const element = document.getElementById(anchor)
      element?.scrollIntoView({ block: 'center' })
      element?.querySelector<HTMLElement>('button')?.focus()
    })
  }

  const at = STEPS.indexOf(step)
  const next = STEPS[at + 1]
  const previous = STEPS[at - 1]
  const byStep = (s: Step) => problems.filter((p) => stepOf(p.path, draft) === s)

  return (
    <div className={styles.editor}>
      <div className={styles.titleRow}>
        <PageTitle>{t('systemRules.title')}</PageTitle>
        <SaveState saving={saving} errors={errors.length} />
      </div>
      <nav className={styles.steps} aria-label={t('rules.steps')}>
        <span className={styles.stepsTitle}>{name}</span>
        <ol>
          {STEPS.map((s, i) => {
            const own = byStep(s)
            return (
              <li key={s}>
                <button
                  type="button"
                  className={styles.step}
                  aria-current={s === step ? 'step' : undefined}
                  data-advanced={s === 'avanzado' || undefined}
                  onClick={() => setStep(s)}
                >
                  <span className={styles.stepNumber}>{s === 'avanzado' ? '⋯' : i + 1}</span>
                  <span className={styles.stepQuestion}>{t(`rules.step.${s}.question`)}</span>
                  {own.some((p) => p.severity === 'error') && (
                    <span className={styles.stepWarn} title={t('rules.stepHasProblems')} />
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <article className={styles.main} aria-labelledby="paso-abierto">
        <h2 id="paso-abierto">{t(`rules.step.${step}.question`)}</h2>
        <p className={styles.lead}>{t(`rules.step.${step}.lead`)}</p>
        {step === 'personaje' && (
          <CharacterStep system={draft} language={language} change={change} onAdded={setFresh} />
        )}
        {step === 'tiradas' && <RollsStep system={draft} language={language} change={change} />}
        {step === 'objetos' && <ObjectsStep system={draft} language={language} change={change} />}
        {step === 'ficha' && <SheetStep system={draft} language={language} change={change} />}
        {step === 'creacion' && <CreationStep system={draft} language={language} change={change} />}
        {step === 'compendio' && <CompendiumStep systemId={systemId} />}
        {step === 'avanzado' && <AdvancedStep systemId={systemId} system={draft} language={language} change={change} />}
        <div className={styles.next}>
          {previous ? (
            <button type="button" className={styles.back} onClick={() => setStep(previous)}>
              ← {t(`rules.step.${previous}.short`)}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" className={styles.go} onClick={() => setStep(next)}>
              {t('rules.next', { step: t(`rules.step.${next}.short`) })}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </article>
      <aside className={styles.side} aria-label={t('rules.aside')}>
        <section className={styles.panel} aria-labelledby="ficha-ejemplo">
          <div className={styles.panelHead}>
            <h2 id="ficha-ejemplo">{t('rules.example.title')}</h2>
            <span className={styles.panelHint}>{t('rules.example.hint')}</span>
          </div>
          <ExampleSheet system={draft} language={language} fresh={fresh} />
        </section>
        <section className={styles.panel} aria-labelledby="revision">
          <div className={styles.panelHead}>
            <h2 id="revision">{t('rules.review.title')}</h2>
            <span data-ok={problems.length === 0 || undefined}>
              {problems.length === 0 ? t('rules.review.ok') : t('rules.review.count', { count: problems.length })}
            </span>
          </div>
          {problems.length === 0 ? (
            <p className={styles.muted}>{t('rules.review.allGood')}</p>
          ) : (
            <ul className={styles.notes}>
              {problems.slice(0, 30).map((problem) => (
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
            </ul>
          )}
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
    <span className={styles.saveState} data-state={saving} aria-live="polite">
      {saving === 'saved' && <Check size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

/** Un nombre del sistema en su idioma (para los textos que lo nombran) */
export const nameOf = (system: System, language: Language) => textOf(system.name, language)
