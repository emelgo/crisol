/**
 * El creador de un personaje, como el de D&D Beyond con el aspecto de Crisol (docs/specs/personajes.md § creador):
 * la barra de pasos con lo que falta (!), cada paso con lo suyo y, a la derecha, su nivel, lo pendiente y terminarlo
 * (o confirmar su nivel). Lo que hay que decidir se elige en ese panel
 */
import { type Build, type BuildPick, type Text, textOf } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { ContentText } from '../campaign/content-text.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import fieldStyles from '../components/form.module.css'
import { failed } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { Pending } from './characters.tsx'
import styles from './creator.module.css'
import { type Change, pickId } from './save.ts'
import { ScoresStep } from './scores.tsx'

type Loaded = ActionOutput<'getCharacter'>
type Character = Loaded['character']
type State = Loaded['state']
type Step = State['steps'][number]
type Decision = State['decisions'][number]
type ContentStep = Extract<Step, { kind: 'content' }>

const MAX_LEVEL = 20

export function Creator({
  character,
  state,
  save,
  busy,
  campaignId
}: {
  character: Character
  state: State
  save: (change: Change) => Promise<void>
  busy: boolean
  campaignId: string
}) {
  const { t } = useTranslation()
  const build = character.build as Build
  const firstPending = state.steps.find((s) => s.pending > 0)?.key
  const [stepKey, setStepKey] = useState(firstPending ?? state.steps[0]?.key ?? '')
  const [deciding, setDeciding] = useState<string | null>(null)
  const step = state.steps.find((s) => s.key === stepKey) ?? state.steps[0]
  const decision = state.decisions.find((d) => d.id === deciding) ?? null
  const choose = (d: Decision, values: string[]) =>
    save({ build: (b) => ({ ...b, decisions: { ...(b.decisions ?? {}), [d.id]: values } }) })
  const root = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLElement>(null)
  const side = useRef<HTMLElement>(null)
  const open = useRef(deciding)
  open.current = deciding
  // Si desaparece lo que tenía el foco (una opción elegida, la X de una clase, «Cambiar»), el foco no se pierde:
  // va al panel de la decisión abierta o al paso
  useEffect(() => {
    const element = root.current
    const rescue = (event: FocusEvent) => {
      const lost = event.target as Element | null
      if (event.relatedTarget || !lost) return
      requestAnimationFrame(() => {
        if (lost.isConnected || (document.activeElement && document.activeElement !== document.body)) return
        ;(open.current ? side.current : main.current)?.focus()
      })
    }
    element?.addEventListener('focusout', rescue)
    return () => element?.removeEventListener('focusout', rescue)
  }, [])
  return (
    <div className={styles.creator} ref={root}>
      <nav className={styles.steps} aria-label={t('creator.steps')}>
        {state.steps.map((s) => (
          <button
            key={s.key}
            type="button"
            className={styles.step}
            aria-current={s.key === step?.key ? 'step' : undefined}
            onClick={() => {
              setStepKey(s.key)
              setDeciding(null)
            }}
          >
            {s.label}
            {s.pending > 0 && <Pending count={s.pending} label={t('creator.pendingCount', { count: s.pending })} />}
          </button>
        ))}
      </nav>
      <div className={styles.body}>
        <section className={styles.main} aria-label={step?.label} ref={main} tabIndex={-1}>
          {step?.kind === 'content' && step.levels && (
            <LevelsStep
              step={step}
              state={state}
              build={build}
              save={save}
              onDecide={setDeciding}
              campaignId={campaignId}
            />
          )}
          {step?.kind === 'content' && !step.levels && (
            <PickStep step={step} state={state} save={save} onDecide={setDeciding} campaignId={campaignId} />
          )}
          {step?.kind === 'scores' && (
            <ScoresStep step={step} state={state} build={build} save={save} campaignId={campaignId} />
          )}
          {step?.kind === 'fields' && <FieldsStep step={step} build={build} save={save} />}
          {step?.kind === 'summary' && (
            <SummaryStep
              state={state}
              onGo={(key) => setStepKey(key)}
              onDecide={(id, key) => {
                setStepKey(key)
                setDeciding(id)
              }}
            />
          )}
        </section>
        <aside
          className={styles.side}
          aria-label={decision ? decision.label : t('creator.overview')}
          ref={side}
          tabIndex={-1}
        >
          {decision ? (
            <DecisionPanel
              decision={{ ...decision, chosen: build.decisions?.[decision.id] ?? decision.chosen }}
              onChoose={(values) => choose(decision, values)}
              onClose={() => setDeciding(null)}
              next={state.decisions.find((d) => d.pending && d.id !== decision.id) ?? null}
              onNext={(d) => {
                setStepKey(d.step)
                setDeciding(d.id)
              }}
            />
          ) : (
            <Overview
              character={character}
              state={state}
              busy={busy}
              onConfirm={(kind) => save({ confirm: kind })}
              onGo={(key) => setStepKey(key)}
              onDecide={(id, key) => {
                setStepKey(key)
                setDeciding(id)
              }}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

/** Lo que concede algo, por nivel, con sus decisiones: cada fila abre la suya en el panel */
function Granted({
  owner,
  state,
  onDecide,
  campaignId
}: {
  owner: string
  state: State
  onDecide: (id: string) => void
  campaignId: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const rows = [
    ...state.decisions
      .filter((d) => d.from.id === owner)
      .map((d) => ({ kind: 'decision' as const, id: d.id, level: d.level ?? 0, decision: d })),
    ...state.items
      .filter((item) => item.from === owner && item.id !== owner)
      .map((item) => ({ kind: 'item' as const, id: item.id, level: item.level ?? 0, item }))
  ].sort((a, b) => a.level - b.level)
  if (rows.length === 0) return null
  return (
    <ul className={styles.granted}>
      {rows.map((row) => {
        const decisions = row.kind === 'item' ? state.decisions.filter((d) => d.from.id === row.id) : [row.decision]
        return (
          <li key={row.id} className={styles.grantedRow}>
            <div className={styles.grantedHead}>
              <span className={styles.grantedName}>{row.kind === 'item' ? row.item.name : row.decision.label}</span>
              <span className={styles.grantedLevel}>
                {row.level ? t('creator.level', { level: row.level }) : t('creator.start')}
              </span>
              {decisions.map((d) => (
                <button key={d.id} type="button" className={styles.decide} onClick={() => onDecide(d.id)}>
                  {d.chosen.length > 0 ? chosenText(d) : t('creator.choices', { count: d.count })}
                  {d.pending && <Pending label={t('creator.toChoose')} />}
                </button>
              ))}
              {row.kind === 'item' && (
                <button
                  type="button"
                  className={styles.expand}
                  aria-expanded={open === row.id}
                  aria-label={t('creator.more', { name: row.item.name })}
                  onClick={() => setOpen(open === row.id ? null : row.id)}
                >
                  {open === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              )}
            </div>
            {open === row.id && row.kind === 'item' && (
              <GrantedText contentKey={row.item.key} campaignId={campaignId} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Lo elegido de una decisión, por sus nombres */
const chosenText = (d: Decision) => d.chosen.map((v) => d.options.find((o) => o.value === v)?.label ?? v).join(', ')

/** El texto de lo concedido, al desplegarlo: el de su documento del compendio */
function GrantedText({ contentKey, campaignId }: { contentKey: string | null; campaignId: string }) {
  const api = useApi()
  const read = useQuery({
    queryKey: ['compendium', campaignId, 'entry', contentKey],
    queryFn: () => api.call('getCampaignContent', { campaignId, keys: [contentKey ?? ''] }),
    enabled: Boolean(contentKey)
  })
  const { t } = useTranslation()
  const item = read.data?.items[0]
  const text = item ? textOf(item.data.descripcion as Text, 'es') : ''
  // Desplegado, siempre dice algo: cargando, que falló o que no tiene texto
  if (!text)
    return (
      <p className={styles.grantedNote}>
        {read.isPending && contentKey
          ? t('creator.loadingText')
          : failed(read)
            ? t('creator.textFailed')
            : t('creator.noText')}
      </p>
    )
  return (
    <div className={styles.grantedText}>
      <ContentText text={text} />
    </div>
  )
}

/** Un paso de niveles (las clases): cada una con su nivel y lo que concede; añadir otra */
function LevelsStep({
  step,
  state,
  build,
  save,
  onDecide,
  campaignId
}: {
  step: ContentStep
  state: State
  build: Build
  save: (change: Change) => Promise<void>
  onDecide: (id: string) => void
  campaignId: string
}) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(step.picks.length === 0)
  const setLevel = (pick: BuildPick, level: number) =>
    save({
      build: (b) => ({
        ...b,
        picks: (b.picks ?? []).map((p) => (p.id === pick.id ? { ...p, level } : p))
      })
    })
  const remove = (id: string) =>
    save({
      build: (b) => ({
        ...b,
        picks: (b.picks ?? []).filter((p) => p.id !== id),
        decisions: Object.fromEntries(Object.entries(b.decisions ?? {}).filter(([k]) => !k.startsWith(`${id}>`)))
      })
    })
  const total = step.picks.reduce((n, p) => n + (p.level ?? 1), 0)
  return (
    <>
      {step.picks.map((pick, i) => {
        const raw = (build.picks ?? []).find((p) => p.id === pick.id)
        const levelId = `level-${pick.id}`
        return (
          <article key={pick.id} className={styles.pick} aria-labelledby={`name-${pick.id}`}>
            <header className={styles.pickHead}>
              <h2 id={`name-${pick.id}`} className={styles.pickName}>
                {pick.name}
              </h2>
              <span className={styles.tag}>{i === 0 ? t('creator.first') : t('creator.multiclass')}</span>
              <span className={styles.levelField}>
                <label htmlFor={levelId}>{t('creator.levelLabel')}</label>
                <select
                  id={levelId}
                  value={pick.level ?? 1}
                  onChange={(event) => raw && setLevel(raw, Number(event.currentTarget.value))}
                >
                  {Array.from({ length: MAX_LEVEL - (total - (pick.level ?? 1)) }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </span>
              {i > 0 && <RemoveButton name={pick.name} onConfirm={() => void remove(pick.id)} />}
            </header>
            {pick.missing && <p className={styles.missing}>{t('creator.missing')}</p>}
            <Granted owner={pick.id} state={state} onDecide={onDecide} campaignId={campaignId} />
          </article>
        )
      })}
      {adding || step.picks.length === 0 ? (
        <Options
          step={step}
          title={step.picks.length === 0 ? t('creator.chooseOne', { what: step.label }) : t('creator.addAnother')}
          onPick={(key) => {
            setAdding(false)
            void save({
              build: (b) => ({ ...b, picks: [...(b.picks ?? []), { id: pickId(), step: step.key, key, level: 1 }] })
            })
          }}
          onCancel={step.picks.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        total < MAX_LEVEL && (
          <button type="button" className={styles.add} onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            {t('creator.addAnother')}
          </button>
        )
      )}
    </>
  )
}

/** Un paso de contenido sin niveles (la especie, el trasfondo): lo elegido con lo que concede, o elegirlo */
function PickStep({
  step,
  state,
  save,
  onDecide,
  campaignId
}: {
  step: ContentStep
  state: State
  save: (change: Change) => Promise<void>
  onDecide: (id: string) => void
  campaignId: string
}) {
  const { t } = useTranslation()
  const [changing, setChanging] = useState(false)
  const replace = (key: string) =>
    save({
      build: (b) => {
        const old = (b.picks ?? []).filter((p) => p.step === step.key).map((p) => p.id)
        return {
          ...b,
          picks: [...(b.picks ?? []).filter((p) => p.step !== step.key), { id: pickId(), step: step.key, key }],
          decisions: Object.fromEntries(
            Object.entries(b.decisions ?? {}).filter(([k]) => !old.some((id) => k.startsWith(`${id}>`)))
          )
        }
      }
    })
  // Un paso de varios (dos movimientos): se añaden hasta su máximo y se quitan uno a uno
  if (step.max > 1)
    return (
      <>
        {step.picks.map((pick) => (
          <article key={pick.id} className={styles.pick} aria-labelledby={`name-${pick.id}`}>
            <header className={styles.pickHead}>
              <h2 id={`name-${pick.id}`} className={styles.pickName}>
                {pick.name}
              </h2>
              <RemoveButton
                name={pick.name}
                onConfirm={() =>
                  void save({
                    build: (b) => ({
                      ...b,
                      picks: (b.picks ?? []).filter((p) => p.id !== pick.id),
                      decisions: Object.fromEntries(
                        Object.entries(b.decisions ?? {}).filter(([k]) => !k.startsWith(`${pick.id}>`))
                      )
                    })
                  })
                }
              />
            </header>
            <Granted owner={pick.id} state={state} onDecide={onDecide} campaignId={campaignId} />
          </article>
        ))}
        {step.picks.length < step.max && (
          <Options
            step={step}
            title={t('creator.chooseUpTo', { what: step.label, left: step.max - step.picks.length })}
            onPick={(key) =>
              void save({
                build: (b) => ({ ...b, picks: [...(b.picks ?? []), { id: pickId(), step: step.key, key }] })
              })
            }
            onCancel={undefined}
          />
        )}
      </>
    )
  if (step.picks.length === 0 || changing)
    return (
      <Options
        step={step}
        title={t('creator.chooseOne', { what: step.label })}
        onPick={(key) => {
          setChanging(false)
          void replace(key)
        }}
        onCancel={changing ? () => setChanging(false) : undefined}
      />
    )
  return (
    <>
      {step.picks.map((pick) => (
        <article key={pick.id} className={styles.pick} aria-labelledby={`name-${pick.id}`}>
          <header className={styles.pickHead}>
            <h2 id={`name-${pick.id}`} className={styles.pickName}>
              {pick.name}
            </h2>
            <button type="button" className={styles.change} onClick={() => setChanging(true)}>
              {t('creator.change')}
            </button>
          </header>
          {pick.missing && <p className={styles.missing}>{t('creator.missing')}</p>}
          <Granted owner={pick.id} state={state} onDecide={onDecide} campaignId={campaignId} />
        </article>
      ))}
    </>
  )
}

/** Lo que se puede elegir en un paso: lo que no vale, con su motivo */
function Options({
  step,
  title,
  onPick,
  onCancel
}: {
  step: ContentStep
  title: string
  onPick: (key: string) => void
  onCancel: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const titleId = useId()
  // Elegida una, las demás esperan a que llegue lo guardado: un doble clic no añade dos
  // (con cada estado que llega del servidor, también si falló, se puede volver a elegir)
  const [picked, setPicked] = useState<string | null>(null)
  const [source, setSource] = useState(step)
  if (source !== step) {
    setSource(step)
    setPicked(null)
  }
  // Los libros de lo que se puede elegir: para filtrar (con más de uno)
  const books = [...new Set(step.options.flatMap((o) => (o.book ? [o.book] : [])))]
  const [book, setBook] = useState<string | null>(null)
  return (
    <section className={styles.options} aria-labelledby={titleId} aria-busy={picked !== null}>
      <div className={styles.optionsHead}>
        <h2 id={titleId}>{title}</h2>
        {onCancel && (
          <button type="button" className={styles.change} onClick={onCancel}>
            {t('creator.cancel')}
          </button>
        )}
      </div>
      {/* Por libro (ADR-0021): solo los de la campaña, y cada opción dice el suyo */}
      {books.length > 1 && (
        <fieldset className={styles.bookFilter}>
          <legend className={styles.hidden}>{t('creator.byBook')}</legend>
          <button type="button" aria-pressed={book === null} onClick={() => setBook(null)}>
            {t('creator.allBooks')}
          </button>
          {books.map((b) => (
            <button key={b} type="button" aria-pressed={book === b} onClick={() => setBook(b)}>
              {b}
            </button>
          ))}
        </fieldset>
      )}
      <ul className={styles.optionList}>
        {step.options
          .filter((o) => book === null || o.book === book)
          .map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={styles.option}
                disabled={!o.available}
                // Su nombre, el de la opción; su motivo y su libro, como descripción
                aria-label={o.label}
                aria-describedby={
                  [o.reason ? `${titleId}-${o.value}-r` : '', o.book ? `${titleId}-${o.value}-b` : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                aria-disabled={picked !== null && picked !== o.value ? true : undefined}
                aria-pressed={picked === o.value ? true : undefined}
                onClick={() => {
                  if (picked !== null) return
                  setPicked(o.value)
                  onPick(o.value)
                }}
              >
                <span className={styles.optionName}>{o.label}</span>
                {o.reason && (
                  <span id={`${titleId}-${o.value}-r`} className={styles.reason}>
                    {o.reason}
                  </span>
                )}
                {o.book && (
                  <span id={`${titleId}-${o.value}-b`} className={styles.optionBook}>
                    {o.book}
                  </span>
                )}
              </button>
            </li>
          ))}
      </ul>
    </section>
  )
}

/** Un paso de campos: lo escrito (su alineamiento, sus idiomas, sus notas) */
function FieldsStep({
  step,
  build,
  save
}: {
  step: Extract<Step, { kind: 'fields' }>
  build: Build
  save: (change: Change) => Promise<void>
}) {
  const values = build.values ?? {}
  const set = (key: string, value: unknown) =>
    save({ build: (b) => ({ ...b, values: { ...(b.values ?? {}), [key]: value } }) })
  return (
    <div className={styles.fields}>
      {step.fields.map((field) => (
        <FieldInput key={field.key} field={field} value={values[field.key]} onCommit={(v) => set(field.key, v)} />
      ))}
    </div>
  )
}

function FieldInput({
  field,
  value,
  onCommit
}: {
  field: Extract<Step, { kind: 'fields' }>['fields'][number]
  value: unknown
  onCommit: (value: unknown) => void
}) {
  const id = useId()
  const shown = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : ''
  const [text, setText] = useState(shown)
  const [wrong, setWrong] = useState(false)
  const { t } = useTranslation()
  if (field.kind === 'choice' && field.options)
    return (
      <div className={styles.field}>
        <label htmlFor={id}>{field.label}</label>
        <select id={id} value={shown} onChange={(event) => onCommit(event.currentTarget.value)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  const commit = () => {
    if (text === shown) return
    if (field.kind === 'number') {
      const n = Number(text)
      const fits = text.trim() !== '' && Number.isFinite(n)
      setWrong(!fits)
      if (fits) onCommit(n)
      return
    }
    onCommit(
      field.kind === 'list'
        ? text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : text
    )
  }
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{field.label}</label>
      {field.kind === 'text' ? (
        <textarea id={id} rows={4} value={text} onChange={(e) => setText(e.currentTarget.value)} onBlur={commit} />
      ) : (
        <input
          id={id}
          type={field.kind === 'number' ? 'number' : 'text'}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          placeholder={field.kind === 'list' ? t('creator.listHint') : undefined}
          aria-invalid={wrong || undefined}
          aria-describedby={wrong ? `${id}-error` : undefined}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onBlur={commit}
        />
      )}
      {wrong && (
        <small id={`${id}-error`} className={fieldStyles.fieldError}>
          {t('creator.notANumber')}
        </small>
      )}
    </div>
  )
}

/** El resumen: lo que falta, con su paso; desde aquí se va a cada cosa */
function SummaryStep({
  state,
  onGo,
  onDecide
}: {
  state: State
  onGo: (key: string) => void
  onDecide: (id: string, step: string) => void
}) {
  const { t } = useTranslation()
  const pending = state.decisions.filter((d) => d.pending)
  const steps = state.steps.filter((s) => s.pending > 0 && (s.kind === 'content' || s.kind === 'scores'))
  return (
    <div className={styles.summary}>
      <h2>{state.summary.line || t('characters.noClass')}</h2>
      {pending.length === 0 && steps.length === 0 ? (
        <p>{t('creator.nothingLeft')}</p>
      ) : (
        <PendingList state={state} onGo={onGo} onDecide={onDecide} />
      )}
    </div>
  )
}

/** Lo que falta, por pasos: los pasos sin elegir y las decisiones pendientes */
function PendingList({
  state,
  onGo,
  onDecide
}: {
  state: State
  onGo: (key: string) => void
  onDecide: (id: string, step: string) => void
}) {
  const { t } = useTranslation()
  const groups = state.steps
    .map((step) => ({
      step,
      empty:
        (step.kind === 'content' && step.picks.length < step.min) ||
        (step.kind === 'scores' &&
          step.pending > state.decisions.filter((d) => d.step === step.key && d.pending).length),
      decisions: state.decisions.filter((d) => d.step === step.key && d.pending)
    }))
    .filter((g) => g.empty || g.decisions.length > 0)
  if (groups.length === 0) return <p className={styles.none}>{t('creator.nothingLeft')}</p>
  return (
    <div className={styles.pendingList}>
      {groups.map(({ step, empty, decisions }) => (
        <div key={step.key}>
          <p className={styles.pendingStep}>{step.label}</p>
          <ul>
            {empty && (
              <li>
                <button type="button" className={styles.pendingItem} onClick={() => onGo(step.key)}>
                  <Pending label={t('creator.toChoose')} />
                  <span>{t('creator.chooseOne', { what: step.label })}</span>
                </button>
              </li>
            )}
            {decisions.map((d) => (
              <li key={d.id}>
                <button type="button" className={styles.pendingItem} onClick={() => onDecide(d.id, d.step)}>
                  <Pending label={t('creator.toChoose')} />
                  <span>
                    {d.label}
                    <span className={styles.pendingFrom}>
                      {d.from.name}
                      {d.level ? ` · ${t('creator.level', { level: d.level })}` : ''} ·{' '}
                      {t('creator.chosenOf', { chosen: d.chosen.length, count: d.count })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** A la derecha: su nivel y sus valores, lo pendiente y terminarlo (o confirmar su nivel) */
function Overview({
  character,
  state,
  busy,
  onConfirm,
  onGo,
  onDecide
}: {
  character: Character
  state: State
  busy: boolean
  onConfirm: (kind: 'created' | 'level') => void
  onGo: (key: string) => void
  onDecide: (id: string, step: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const versions = useQuery({
    queryKey: ['characterVersions', character.id],
    queryFn: () => api.call('listCharacterVersions', { characterId: character.id }),
    enabled: character.status === 'ready'
  })
  const last = versions.data?.versions[0]
  const creating = character.status === 'creating'
  const confirmLevel = !creating && last !== undefined && state.level > last.level
  return (
    <div className={styles.overview}>
      <dl className={styles.stats}>
        {state.summary.stats.map((s) => (
          <div key={s.key}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <h2 className={styles.sideTitle}>{t('creator.pending')}</h2>
      <PendingList state={state} onGo={onGo} onDecide={onDecide} />
      <div className={styles.confirm}>
        {creating && (
          <BusyButton
            className={styles.primary}
            busy={busy}
            disabled={!state.complete}
            onClick={() => onConfirm('created')}
          >
            {busy ? t('characters.saving') : t('creator.finish')}
          </BusyButton>
        )}
        {confirmLevel && (
          <BusyButton className={styles.primary} busy={busy} onClick={() => onConfirm('level')}>
            {busy ? t('characters.saving') : t('creator.confirmLevel', { level: state.level })}
          </BusyButton>
        )}
        {creating && !state.complete && <p className={styles.hint}>{t('creator.finishHint')}</p>}
      </div>
    </div>
  )
}

/** Elegir lo de una decisión: tantos como pide, de sus opciones; las que no valen, con su motivo */
function DecisionPanel({
  decision,
  onChoose,
  onClose,
  next,
  onNext
}: {
  decision: Decision
  onChoose: (values: string[]) => void
  onClose: () => void
  next: Decision | null
  onNext: (d: Decision) => void
}) {
  const { t } = useTranslation()
  const name = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  // Al abrirla (o pasar a la siguiente), el foco va a su título: en lo estrecho, el panel queda debajo del paso
  useEffect(() => {
    if (decision.id) heading.current?.focus()
  }, [decision.id])
  const single = decision.count === 1
  const toggle = (value: string) => {
    if (single) return onChoose([value])
    const chosen = decision.chosen.includes(value)
      ? decision.chosen.filter((v) => v !== value)
      : [...decision.chosen, value].slice(-decision.count)
    onChoose(chosen)
  }
  return (
    <div className={styles.decision}>
      <div className={styles.decisionHead}>
        <h2 className={styles.sideTitle} ref={heading} tabIndex={-1}>
          {decision.label}
        </h2>
        <button type="button" className={styles.remove} aria-label={t('creator.close')} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.pendingFrom}>
        {decision.from.name}
        {decision.level ? ` · ${t('creator.level', { level: decision.level })}` : ''}
      </p>
      {decision.repeat ? (
        <RepeatChoices decision={decision} onChoose={onChoose} />
      ) : (
        <fieldset className={styles.choices}>
          <legend>
            {t('creator.pickN', { count: decision.count })}{' '}
            <strong>{t('creator.chosenOf', { chosen: decision.chosen.length, count: decision.count })}</strong>
          </legend>
          {decision.options.map((o) => (
            <label key={o.value} className={styles.choice} data-disabled={o.available ? undefined : ''}>
              <input
                type={single ? 'radio' : 'checkbox'}
                name={name}
                checked={decision.chosen.includes(o.value)}
                disabled={!o.available && !decision.chosen.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span>
                {o.label}
                {o.reason && <span className={styles.reason}>{o.reason}</span>}
                {o.book && <span className={styles.optionBook}>{o.book}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {next && (
        <button type="button" className={styles.change} onClick={() => onNext(next)}>
          {t('creator.goTo', { what: next.label })}
        </button>
      )}
    </div>
  )
}

/** Elegir lo mismo varias veces (+1 y +1 a la misma): cuántas veces cada una, como mucho las que dice */
function RepeatChoices({ decision, onChoose }: { decision: Decision; onChoose: (values: string[]) => void }) {
  const { t } = useTranslation()
  const times = (value: string) => decision.chosen.filter((v) => v === value).length
  const left = decision.count - decision.chosen.length
  const add = (value: string) => onChoose([...decision.chosen, value])
  const take = (value: string) => {
    const at = decision.chosen.lastIndexOf(value)
    onChoose(decision.chosen.filter((_, i) => i !== at))
  }
  return (
    <div className={styles.choices}>
      <p className={styles.repeatHead}>
        {t('creator.pickN', { count: decision.count })}{' '}
        <strong>{t('creator.chosenOf', { chosen: decision.chosen.length, count: decision.count })}</strong>
      </p>
      <ul className={styles.repeat}>
        {decision.options.map((o) => (
          <li key={o.value} className={styles.repeatRow}>
            <span>{o.label}</span>
            <span className={styles.stepper}>
              <button
                type="button"
                aria-label={t('creator.less', { name: o.label })}
                disabled={times(o.value) === 0}
                onClick={() => take(o.value)}
              >
                −
              </button>
              <output aria-live="polite">{times(o.value) > 0 ? `+${times(o.value)}` : '0'}</output>
              <button
                type="button"
                aria-label={t('creator.plus', { name: o.label })}
                disabled={left === 0 || times(o.value) >= decision.most || !o.available}
                onClick={() => add(o.value)}
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Quitar algo elegido (una clase, una opción) se lleva sus elecciones: se pregunta antes, como en otros creadores */
function RemoveButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <>
      <button
        type="button"
        className={styles.remove}
        aria-label={t('creator.removeClass', { name })}
        onClick={() => setAsking(true)}
      >
        <X size={16} aria-hidden="true" />
      </button>
      {asking && (
        <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={() => setAsking(false)}>
          <div className={dialogStyles.body}>
            <h2 id={titleId}>{t('creator.removeTitle', { name })}</h2>
            <p className={dialogStyles.description}>{t('creator.removeText')}</p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={fieldStyles.button}
                data-autofocus=""
                onClick={() => {
                  onConfirm()
                  dialog.current?.close()
                }}
              >
                {t('creator.removeConfirm')}
              </button>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('creator.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
