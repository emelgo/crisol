/**
 * El paso de puntuaciones (las características): el método (matriz, compra por puntos, dados o a mano) y, de cada
 * una, su base, sus aumentos (lo que le suma lo elegido), su total y su modificador. Los dados se tiran en el servidor
 * y quedan en el registro de la campaña
 */
import type { Build } from '@crisol/systems'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { Pending } from './characters.tsx'
import styles from './creator.module.css'
import type { Change } from './save.ts'

type State = ActionOutput<'getCharacter'>['state']
type Step = Extract<State['steps'][number], { kind: 'scores' }>
type Method = Step['methods'][number]

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)

export function ScoresStep({
  step,
  state,
  build,
  save,
  campaignId
}: {
  step: Step
  state: State
  build: Build
  save: (change: Change) => Promise<void>
  campaignId: string
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const methodName = useId()
  const method = step.methods.find((m) => m.key === build.scores?.method) ?? step.methods[0]
  const base = build.scores?.base ?? {}
  const sheet = (state.sheet[step.set] ?? {}) as Record<string, Record<string, unknown>>
  const setScores = (scores: Build['scores']) => save({ build: (b) => ({ ...b, scores }) })
  const setBase = (element: string, value: number | null) => {
    const next = { ...base }
    if (value === null) delete next[element]
    else next[element] = value
    return setScores({ ...build.scores, method: method?.key, base: next })
  }
  const roll = useMutation({
    mutationFn: async (m: Method) => {
      const rolls: number[] = []
      for (const _ of step.elements) {
        const { roll: rolled } = await api.call('rollDice', {
          campaignId,
          formula: m.formula ?? '4d6kh3',
          visibility: 'all'
        })
        rolls.push(rolled.total)
      }
      await setScores({ method: m.key, base: {}, rolls })
      return rolls
    },
    onSuccess: (rolls) => announce(`${t('creator.rolled')} ${rolls.join(', ')}`)
  })
  // Los valores que se reparten: los de la matriz o los tirados; cada uno, una vez
  const pool =
    method?.kind === 'array' ? (method.values ?? []) : method?.kind === 'roll' ? (build.scores?.rolls ?? []) : []
  const used = (except: string) => {
    const left = [...pool]
    for (const [element, value] of Object.entries(base)) {
      if (element === except) continue
      const at = left.indexOf(value)
      if (at >= 0) left.splice(at, 1)
    }
    return left
  }
  const spent =
    method?.kind === 'pointbuy' ? Object.values(base).reduce((n, v) => n + (method.costs?.[String(v)] ?? 0), 0) : 0
  return (
    <div className={styles.scores}>
      <fieldset className={styles.methods}>
        <legend>{t('creator.method')}</legend>
        {step.methods.map((m) => (
          <label key={m.key} className={styles.methodChoice}>
            <input
              type="radio"
              name={methodName}
              checked={m.key === method?.key}
              // Lo repartido no vale para otro método; lo tirado (ya en el registro) se queda
              onChange={() =>
                setScores({
                  method: m.key,
                  base: {},
                  ...(build.scores?.rolls ? { rolls: build.scores.rolls } : {})
                })
              }
            />
            {m.label}
          </label>
        ))}
      </fieldset>
      {method?.kind === 'pointbuy' && (
        <p className={styles.budget}>
          {t('creator.points', { left: (method.budget ?? 0) - spent, budget: method.budget ?? 0 })}
        </p>
      )}
      {method?.kind === 'roll' && (
        <div className={styles.rolls}>
          {(build.scores?.rolls ?? []).length > 0 ? (
            <p>
              {t('creator.rolled')} <strong>{(build.scores?.rolls ?? []).join(', ')}</strong>{' '}
              <span className={styles.pendingFrom}>{t('creator.inLog')}</span>
            </p>
          ) : (
            <BusyButton className={styles.primary} busy={roll.isPending} onClick={() => roll.mutate(method)}>
              {roll.isPending ? t('creator.rolling') : t('creator.roll', { formula: method.formula ?? '' })}
            </BusyButton>
          )}
          <FormError message={roll.error ? errorText(roll.error) : null} />
        </div>
      )}
      <table className={styles.scoreTable}>
        <thead>
          <tr>
            <th scope="col">{step.label}</th>
            <th scope="col">{t('creator.base')}</th>
            <th scope="col">{t('creator.total')}</th>
            <th scope="col">{t('creator.modifier')}</th>
          </tr>
        </thead>
        <tbody>
          {step.elements.map((element) => {
            const value = base[element.key]
            const total = sheet[element.key]?.[step.field]
            const mod = sheet[element.key]?.mod
            const inputId = `score-${element.key}`
            return (
              <tr key={element.key}>
                <th scope="row">
                  <label htmlFor={inputId}>{element.label}</label>
                  {typeof value !== 'number' && <Pending label={t('creator.toChoose')} />}
                </th>
                <td>
                  {method?.kind === 'array' || method?.kind === 'roll' ? (
                    <select
                      id={inputId}
                      value={typeof value === 'number' ? String(value) : ''}
                      onChange={(event) =>
                        setBase(
                          element.key,
                          event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
                        )
                      }
                    >
                      <option value="">—</option>
                      {[...new Set([...(typeof value === 'number' ? [value] : []), ...used(element.key)])]
                        .sort((a, b) => b - a)
                        .map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                    </select>
                  ) : method?.kind === 'pointbuy' ? (
                    <select
                      id={inputId}
                      value={typeof value === 'number' ? String(value) : ''}
                      onChange={(event) =>
                        setBase(
                          element.key,
                          event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
                        )
                      }
                    >
                      <option value="">—</option>
                      {Object.keys(method.costs ?? {})
                        .map(Number)
                        .sort((a, b) => a - b)
                        .filter(
                          (v) =>
                            (method.costs?.[String(v)] ?? 0) -
                              (typeof value === 'number' ? (method.costs?.[String(value)] ?? 0) : 0) <=
                            (method.budget ?? 0) - spent
                        )
                        .map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <ManualScore
                      id={inputId}
                      value={typeof value === 'number' ? value : null}
                      min={method?.min}
                      max={method?.max}
                      onCommit={(n) => void setBase(element.key, n)}
                    />
                  )}
                </td>
                <td className={styles.number}>{typeof total === 'number' ? total : '—'}</td>
                <td className={styles.number}>{typeof mod === 'number' ? signed(mod) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Una puntuación escrita a mano: se guarda al salir del campo (o con Intro); vacía, se quita; fuera de sus límites, vuelve */
function ManualScore({
  id,
  value,
  min,
  max,
  onCommit
}: {
  id: string
  value: number | null
  min: number | undefined
  max: number | undefined
  onCommit: (value: number | null) => void
}) {
  const written = value === null ? '' : String(value)
  const [draft, setDraft] = useState(written)
  const [source, setSource] = useState(written)
  if (source !== written) {
    setSource(written)
    setDraft(written)
  }
  const commit = () => {
    if (draft === written) return
    if (draft.trim() === '') return onCommit(null)
    const n = Number(draft)
    const fits = Number.isInteger(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
    if (fits) onCommit(n)
    else setDraft(written)
  }
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}
