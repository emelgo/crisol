/**
 * Las partes «de juego» del editor de un sistema (docs/specs/sistemas.md § editor): sus tiradas (fórmula, por cada qué,
 * objetivo, variantes, franjas y modos), sus dados (la tirada por defecto y los críticos), sus fuentes y sus ajustes de
 * campaña. Avanzado, el documento entero en JSON, está en advanced.tsx
 */
import { describeFormula } from '@crisol/dice'
import { CRITICAL_RULES, type Problem, type Roll, rollContexts, type System, TONES, textOf } from '@crisol/systems'
import { Plus, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProblemList } from '../screen.tsx'
import styles from './editor.module.css'
import { KeyField, keyFrom, renameKey } from './field.tsx'
import { FormulaInput } from './formula-input.tsx'

type Change = (fn: (draft: System) => void) => void
type Tone = (typeof TONES)[number]
type Setting = NonNullable<System['settings']>[string]

interface PartProps {
  draft: System
  original: System
  change: Change
  problems: Problem[]
  disabled: boolean
}

/**
 * Los ids de las filas de una lista que va por su orden (franjas, variantes, fuentes): no cambian al escribir en una
 * ni al quitar otra, y así la fila no se vuelve a montar ni pierde el foco
 */
function useRowIds() {
  const ids = useRef<string[]>([])
  return {
    at: (i: number) => {
      ids.current[i] ??= crypto.randomUUID()
      return ids.current[i]
    },
    remove: (i: number) => {
      ids.current.splice(i, 1)
    }
  }
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.removeRow} aria-label={label} title={label} onClick={onClick}>
      <X size={14} aria-hidden="true" />
    </button>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      <Plus size={14} aria-hidden="true" />
      {label}
    </button>
  )
}

/** El nombre de un campo de una fila: corto a la vista («Si») y entero para los lectores de pantalla («Si (franja 1)») */
function RowName({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span aria-hidden="true">{short}</span>
      <span className={styles.hidden}>{full}</span>
    </>
  )
}

/** La cabecera de unas filas (sus campos llevan cada uno su nombre, para quien no ve la cabecera) */
function RowsHead({ className, names }: { className: string | undefined; names: string[] }) {
  return (
    <div className={`${className} ${styles.rowsHead}`} aria-hidden="true">
      {names.map((name) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  )
}

const inRoll = (p: Problem, key: string) => p.path === `rolls.${key}` || p.path.startsWith(`rolls.${key}.`)

export function RollsPart({ draft, original, change, problems, disabled }: PartProps) {
  const { t } = useTranslation()
  const id = useId()
  const variantIds = useRowIds()
  const bandIds = useRowIds()
  const rolls = Object.entries(draft.rolls ?? {})
  const [picked, setPicked] = useState<string | null>(null)
  // La elegida (aunque su clave esté a medio escribir, vacía) o, si ya no está, la primera
  const open = picked !== null && draft.rolls?.[picked] ? picked : (rolls[0]?.[0] ?? null)
  const roll = open !== null ? draft.rolls?.[open] : undefined
  const contexts = useMemo(() => (roll ? rollContexts(draft, roll) : null), [draft, roll])
  const setRoll = (fn: (roll: Roll) => void) =>
    change((d) => {
      const target = open !== null ? d.rolls?.[open] : undefined
      if (target) fn(target)
    })
  // Por lo que se puede tirar: los números y los calculados de los personajes, y sus conjuntos
  const actorFields = Object.values(draft.types)
    .filter((type) => type.document === 'actor')
    .flatMap((type) => Object.entries(type.fields))
  const seen = new Set<string>()
  const byField = actorFields.filter(([key, f]) => {
    if (seen.has(key) || (f.kind !== 'number' && f.kind !== 'derived')) return false
    seen.add(key)
    return true
  })
  const bySet = actorFields.filter(([, f]) => f.kind === 'set')
  const mine = open !== null ? problems.filter((p) => inRoll(p, open)) : []
  const others = problems.filter((p) => !mine.includes(p))

  // Las fichas de las tiradas van fuera de lo que se desactiva: en uno de serie también se pasa de una a otra
  return (
    <div className={styles.part}>
      <h2 className={styles.partTitle}>{t('systemEditor.rolls')}</h2>
      <fieldset className={styles.chips}>
        <legend className={styles.hidden}>{t('systemEditor.rollList')}</legend>
        {rolls.map(([key, r]) => (
          <button
            key={key}
            type="button"
            className={open === key ? styles.chipOn : styles.chip}
            aria-pressed={open === key}
            onClick={() => setPicked(key)}
          >
            {textOf(r.label) || key}
            {problems.some((p) => p.severity === 'error' && inRoll(p, key)) && (
              <span className={styles.dot} role="img" aria-label={t('systemEditor.withProblems')} />
            )}
          </button>
        ))}
        {!disabled && (
          <button
            type="button"
            className={styles.chipNew}
            onClick={() => {
              const key = keyFrom(t('systemEditor.newRollName'), Object.keys(draft.rolls ?? {}))
              change((d) => {
                d.rolls = {
                  ...(d.rolls ?? {}),
                  [key]: { label: t('systemEditor.newRollName'), formula: d.dice?.default ?? '1d20' }
                }
              })
              setPicked(key)
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {t('systemEditor.newRoll')}
          </button>
        )}
      </fieldset>
      {rolls.length === 0 && <p className={styles.note}>{t('systemEditor.noRolls')}</p>}

      {open !== null && roll && contexts && (
        <fieldset className={styles.rollBody} disabled={disabled}>
          <legend className={styles.hidden}>{textOf(roll.label) || open}</legend>
          <div className={styles.grid2}>
            <div>
              <label className={styles.label} htmlFor={`${id}-name`}>
                {t('systemEditor.name')}
              </label>
              <input
                id={`${id}-name`}
                className={styles.input}
                value={textOf(roll.label)}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setRoll((r) => {
                    r.label = value
                  })
                }}
              />
            </div>
            <KeyField
              id={`${id}-key`}
              value={open}
              fixed={Boolean(original.rolls?.[open])}
              taken={(key) => Boolean(draft.rolls?.[key])}
              onChange={(to) => {
                change((d) => {
                  d.rolls = renameKey(d.rolls ?? {}, open, to)
                })
                setPicked(to)
              }}
            />
            <div className={styles.full}>
              <FormulaInput
                id={`${id}-formula`}
                label={t('systemEditor.formula')}
                value={roll.formula}
                context={contexts.context}
                disabled={disabled}
                onChange={(formula) =>
                  setRoll((r) => {
                    r.formula = formula
                  })
                }
              />
            </div>
            <div>
              <label className={styles.label} htmlFor={`${id}-target`}>
                {t('systemEditor.target')}
              </label>
              <select
                id={`${id}-target`}
                className={styles.input}
                value={roll.target ?? 'none'}
                onChange={(event) => {
                  const value = event.currentTarget.value as NonNullable<Roll['target']>
                  setRoll((r) => {
                    if (value === 'none') delete r.target
                    else r.target = value
                  })
                }}
              >
                {(['none', 'optional', 'required'] as const).map((target) => (
                  <option key={target} value={target}>
                    {t(`systemEditor.targets.${target}`)}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className={`${styles.full} ${styles.checks}`}>
              <legend className={styles.label}>{t('systemEditor.forEach')}</legend>
              {byField.map(([key, f]) => (
                <label key={key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={Boolean(roll.for && 'fields' in roll.for && roll.for.fields.includes(key))}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setRoll((r) => {
                        const fields = r.for && 'fields' in r.for ? r.for.fields : []
                        const next = checked ? [...fields, key] : fields.filter((k) => k !== key)
                        if (next.length) r.for = { fields: next }
                        else delete r.for
                      })
                    }}
                  />
                  {textOf(f.label) || key}
                  <code className={styles.key}>@{key}</code>
                </label>
              ))}
              {bySet.map(([key, f]) => (
                <label key={key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={Boolean(roll.for && 'set' in roll.for && roll.for.set === key)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setRoll((r) => {
                        if (checked) r.for = { set: key }
                        else delete r.for
                      })
                    }}
                  />
                  {t('systemEditor.eachOf', { name: textOf(f.label) || key })}
                </label>
              ))}
            </fieldset>
          </div>

          <h3 className={styles.sub}>{t('systemEditor.variants')}</h3>
          <ul className={styles.rows}>
            {(roll.variants ?? []).map((variant, i) => (
              <li key={variantIds.at(i)} className={styles.rowVariant}>
                <FormulaInput
                  id={`${id}-variant-${i}-if`}
                  label={<RowName short={t('systemEditor.head.if')} full={t('systemEditor.variantIf', { n: i + 1 })} />}
                  compact
                  value={variant.if}
                  context={{ ...contexts.context, dice: false }}
                  disabled={disabled}
                  onChange={(value) =>
                    setRoll((r) => {
                      const target = r.variants?.[i]
                      if (target) target.if = value
                    })
                  }
                />
                <FormulaInput
                  id={`${id}-variant-${i}-formula`}
                  label={
                    <RowName
                      short={t('systemEditor.head.rolls')}
                      full={t('systemEditor.variantFormula', { n: i + 1 })}
                    />
                  }
                  compact
                  value={variant.formula}
                  context={contexts.context}
                  disabled={disabled}
                  onChange={(value) =>
                    setRoll((r) => {
                      const target = r.variants?.[i]
                      if (target) target.formula = value
                    })
                  }
                />
                {!disabled && (
                  <RemoveButton
                    label={t('systemEditor.removeVariant', { n: i + 1 })}
                    onClick={() => {
                      variantIds.remove(i)
                      setRoll((r) => {
                        r.variants = (r.variants ?? []).filter((_, j) => j !== i)
                        if (!r.variants.length) delete r.variants
                      })
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
          {!disabled && (
            <AddButton
              label={t('systemEditor.addVariant')}
              onClick={() =>
                setRoll((r) => {
                  r.variants = [...(r.variants ?? []), { if: 'true', formula: r.formula }]
                })
              }
            />
          )}

          <h3 className={styles.sub}>{t('systemEditor.bands')}</h3>
          <ul className={styles.rows}>
            {(roll.bands ?? []).map((band, i) => (
              <li key={bandIds.at(i)} className={styles.rowBand}>
                <div className={styles.bandIf}>
                  <FormulaInput
                    id={`${id}-band-${i}-if`}
                    label={<RowName short={t('systemEditor.head.if')} full={t('systemEditor.bandIf', { n: i + 1 })} />}
                    compact
                    value={band.if}
                    context={contexts.result}
                    disabled={disabled}
                    onChange={(value) =>
                      setRoll((r) => {
                        const target = r.bands?.[i]
                        if (target) target.if = value
                      })
                    }
                  />
                </div>
                <div className={styles.bandLabel}>
                  <label className={styles.label} htmlFor={`${id}-band-${i}-label`}>
                    <RowName short={t('systemEditor.head.called')} full={t('systemEditor.bandLabel', { n: i + 1 })} />
                  </label>
                  <input
                    id={`${id}-band-${i}-label`}
                    className={styles.input}
                    value={textOf(band.label)}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setRoll((r) => {
                        const target = r.bands?.[i]
                        if (target) target.label = value
                      })
                    }}
                  />
                </div>
                <div className={styles.bandTone}>
                  <label className={styles.label} htmlFor={`${id}-band-${i}-tone`}>
                    <RowName short={t('systemEditor.head.is')} full={t('systemEditor.tone', { n: i + 1 })} />
                  </label>
                  <div className={styles.toneBox}>
                    <span className={styles.tone} data-tone={band.tone} aria-hidden="true" />
                    <select
                      id={`${id}-band-${i}-tone`}
                      className={styles.input}
                      value={band.tone}
                      onChange={(event) => {
                        const value = event.currentTarget.value as Tone
                        setRoll((r) => {
                          const target = r.bands?.[i]
                          if (target) target.tone = value
                        })
                      }}
                    >
                      {TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {t(`systemEditor.tones.${tone}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {!disabled && (
                  <RemoveButton
                    label={t('systemEditor.removeBand', { n: i + 1 })}
                    onClick={() => {
                      bandIds.remove(i)
                      setRoll((r) => {
                        r.bands = (r.bands ?? []).filter((_, j) => j !== i)
                        if (!r.bands.length) delete r.bands
                      })
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
          {!disabled && (
            <AddButton
              label={t('systemEditor.addBand')}
              onClick={() =>
                setRoll((r) => {
                  r.bands = [...(r.bands ?? []), { if: 'true', label: t('systemEditor.newBand'), tone: 'neutral' }]
                })
              }
            />
          )}

          <h3 className={styles.sub}>{t('systemEditor.modes')}</h3>
          {(roll.modes ?? []).length > 0 && (
            <RowsHead
              className={styles.rowMode}
              names={[t('systemEditor.head.name'), t('systemEditor.head.from'), t('systemEditor.head.to')]}
            />
          )}
          <ul className={styles.rows}>
            {(roll.modes ?? []).map((mode, i) => (
              <li key={mode.key} className={styles.rowMode}>
                <div>
                  <label className={styles.rowLabel} htmlFor={`${id}-mode-${i}-label`}>
                    {t('systemEditor.modeLabel', { n: i + 1 })}
                  </label>
                  <input
                    id={`${id}-mode-${i}-label`}
                    className={styles.input}
                    value={textOf(mode.label)}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setRoll((r) => {
                        const target = r.modes?.[i]
                        if (target) target.label = value
                      })
                    }}
                  />
                </div>
                {(['from', 'to'] as const).map((side) => (
                  <div key={side}>
                    <label className={styles.rowLabel} htmlFor={`${id}-mode-${i}-${side}`}>
                      {t(`systemEditor.modeSides.${side}`, { n: i + 1 })}
                    </label>
                    <input
                      id={`${id}-mode-${i}-${side}`}
                      className={`${styles.input} ${styles.mono}`}
                      value={mode[side]}
                      spellCheck={false}
                      aria-describedby={side === 'to' ? `${id}-mode-${i}-said` : undefined}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setRoll((r) => {
                          const target = r.modes?.[i]
                          if (target) target[side] = value
                        })
                      }}
                    />
                  </div>
                ))}
                {!disabled && (
                  <RemoveButton
                    label={t('systemEditor.removeMode', { name: textOf(mode.label) || mode.key })}
                    onClick={() =>
                      setRoll((r) => {
                        r.modes = (r.modes ?? []).filter((_, j) => j !== i)
                        if (!r.modes.length) delete r.modes
                      })
                    }
                  />
                )}
                <p id={`${id}-mode-${i}-said`} className={`${styles.note} ${styles.full}`}>
                  {mode.from.trim()} → {describeFormula(mode.to)}
                </p>
              </li>
            ))}
          </ul>
          {!disabled && (
            <AddButton
              label={t('systemEditor.addMode')}
              onClick={() =>
                setRoll((r) => {
                  const from = /\d*d\d+/.exec(r.formula)?.[0] ?? '1d20'
                  const taken = (r.modes ?? []).map((m) => m.key)
                  const key = keyFrom(t('systemEditor.newMode'), taken)
                  r.modes = [...(r.modes ?? []), { key, label: t('systemEditor.newMode'), from, to: from }]
                })
              }
            />
          )}

          {mine.length > 0 && <ProblemList problems={mine} />}
          {!disabled && (
            <div className={styles.typeFoot}>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  change((d) => {
                    if (d.rolls) delete d.rolls[open]
                    if (d.rolls && !Object.keys(d.rolls).length) delete d.rolls
                  })
                  setPicked(null)
                }}
              >
                {t('systemEditor.removeRoll')}
              </button>
            </div>
          )}
        </fieldset>
      )}
      {others.length > 0 && <ProblemList problems={others} />}
    </div>
  )
}

export function DicePart({ draft, change, problems, disabled }: Omit<PartProps, 'original'>) {
  const { t } = useTranslation()
  const id = useId()
  const critical = draft.dice?.critical ?? 'none'
  const fallback = draft.dice?.default ?? ''
  return (
    <fieldset className={styles.part} disabled={disabled}>
      <legend className={styles.partTitle}>{t('systemEditor.dice')}</legend>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label} htmlFor={`${id}-default`}>
            {t('systemEditor.defaultRoll')}
          </label>
          <input
            id={`${id}-default`}
            className={`${styles.input} ${styles.mono}`}
            value={fallback}
            placeholder="1d20"
            spellCheck={false}
            aria-describedby={`${id}-default-hint`}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                const dice: NonNullable<System['dice']> = { critical: d.dice?.critical ?? 'none' }
                if (value) dice.default = value
                d.dice = dice
              })
            }}
          />
          <p id={`${id}-default-hint`} className={styles.note}>
            {fallback && describeFormula(fallback) !== fallback.trim() ? `${describeFormula(fallback)} · ` : ''}
            {t('systemEditor.defaultRollHint')}
          </p>
        </div>
      </div>
      <fieldset className={styles.radios}>
        <legend className={styles.sub}>{t('systemEditor.critical')}</legend>
        {CRITICAL_RULES.map((rule) => (
          <label key={rule} className={styles.radio}>
            <input
              type="radio"
              name={`${id}-critical`}
              value={rule}
              checked={critical === rule}
              onChange={() =>
                change((d) => {
                  d.dice = { ...(d.dice ?? {}), critical: rule }
                })
              }
            />
            <span>{t(`systemEditor.criticals.${rule}`)}</span>
            <span className={styles.radioNote}>{t(`systemEditor.criticalNotes.${rule}`)}</span>
          </label>
        ))}
      </fieldset>
      {problems.length > 0 && <ProblemList problems={problems} />}
    </fieldset>
  )
}

export function SourcesPart({ draft, original, change, problems, disabled }: PartProps) {
  const { t } = useTranslation()
  const id = useId()
  const rowIds = useRowIds()
  const sources = draft.sources ?? []
  const saved = new Set((original.sources ?? []).map((s) => s.key))
  const set = (i: number, fn: (source: NonNullable<System['sources']>[number]) => void) =>
    change((d) => {
      const target = d.sources?.[i]
      if (target) fn(target)
    })
  return (
    <fieldset className={styles.part} disabled={disabled}>
      <legend className={styles.partTitle}>{t('systemEditor.sources')}</legend>
      <ul className={styles.rows}>
        {sources.map((source, i) => (
          <li key={rowIds.at(i)} className={styles.card}>
            <div className={styles.grid2}>
              <div>
                <label className={styles.label} htmlFor={`${id}-${i}-name`}>
                  {t('systemEditor.name')}
                </label>
                <input
                  id={`${id}-${i}-name`}
                  className={styles.input}
                  value={textOf(source.name)}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(i, (s) => {
                      s.name = value
                    })
                  }}
                />
              </div>
              <KeyField
                id={`${id}-${i}-key`}
                value={source.key}
                fixed={saved.has(source.key)}
                taken={(key) => sources.some((other, j) => j !== i && other.key === key)}
                onChange={(value) =>
                  set(i, (s) => {
                    s.key = value
                  })
                }
              />
              <div>
                <label className={styles.label} htmlFor={`${id}-${i}-license`}>
                  {t('systemEditor.licenseKind')}
                </label>
                <input
                  id={`${id}-${i}-license`}
                  className={styles.input}
                  value={source.license}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(i, (s) => {
                      s.license = value
                    })
                  }}
                />
              </div>
              <div>
                <label className={styles.label} htmlFor={`${id}-${i}-url`}>
                  {t('systemEditor.url')}
                </label>
                <input
                  id={`${id}-${i}-url`}
                  className={styles.input}
                  type="url"
                  value={source.url ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(i, (s) => {
                      if (value) s.url = value
                      else delete s.url
                    })
                  }}
                />
              </div>
              <div className={styles.full}>
                <label className={styles.label} htmlFor={`${id}-${i}-attribution`}>
                  {t('systemEditor.attribution')}
                </label>
                <textarea
                  id={`${id}-${i}-attribution`}
                  className={styles.input}
                  rows={2}
                  value={textOf(source.attribution)}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(i, (s) => {
                      s.attribution = value
                    })
                  }}
                />
              </div>
            </div>
            {!disabled && (
              <div className={styles.typeFoot}>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    rowIds.remove(i)
                    change((d) => {
                      d.sources = (d.sources ?? []).filter((_, j) => j !== i)
                      if (!d.sources.length) delete d.sources
                    })
                  }}
                >
                  {t('systemEditor.removeSource', { name: textOf(source.name) || source.key })}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <AddButton
          label={t('systemEditor.addSource')}
          onClick={() =>
            change((d) => {
              const taken = (d.sources ?? []).map((s) => s.key)
              const key = keyFrom(t('systemEditor.newSource'), taken)
              d.sources = [
                ...(d.sources ?? []),
                { key, name: t('systemEditor.newSource'), license: 'CC BY 4.0', attribution: '' }
              ]
            })
          }
        />
      )}
      {problems.length > 0 && <ProblemList problems={problems} />}
    </fieldset>
  )
}

/** Lo que pide cada clase de ajuste al cambiarla */
function withKind(setting: Setting, kind: Setting['kind']): Setting {
  const next: Setting = { label: setting.label, kind, ...(setting.help ? { help: setting.help } : {}) }
  if (kind === 'choice' || kind === 'choices')
    next.options = setting.options?.length ? setting.options : [{ value: 'una', label: 'Una' }]
  return next
}

export function SettingsPart({ draft, original, change, problems, disabled }: PartProps) {
  const { t } = useTranslation()
  const id = useId()
  const settings = Object.entries(draft.settings ?? {})
  // Cada fila, con un id que no cambia al cambiar su clave
  const rows = useRef(new Map<string, string>())
  const rowId = (key: string) => {
    let found = rows.current.get(key)
    if (!found) {
      found = crypto.randomUUID()
      rows.current.set(key, found)
    }
    return found
  }
  const set = (key: string, fn: (setting: Setting) => void) =>
    change((d) => {
      const target = d.settings?.[key]
      if (target) fn(target)
    })
  return (
    <fieldset className={styles.part} disabled={disabled}>
      <legend className={styles.partTitle}>{t('systemEditor.settings')}</legend>
      <ul className={styles.rows}>
        {settings.map(([key, setting]) => (
          <li key={rowId(key)} className={styles.card}>
            <div className={styles.grid2}>
              <div>
                <label className={styles.label} htmlFor={`${id}-${rowId(key)}-label`}>
                  {t('systemEditor.name')}
                </label>
                <input
                  id={`${id}-${rowId(key)}-label`}
                  className={styles.input}
                  value={textOf(setting.label)}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(key, (s) => {
                      s.label = value
                    })
                  }}
                />
              </div>
              <KeyField
                id={`${id}-${rowId(key)}-key`}
                value={key}
                fixed={Boolean(original.settings?.[key])}
                taken={(other) => Boolean(draft.settings?.[other])}
                onChange={(to) => {
                  rows.current.set(to, rowId(key))
                  rows.current.delete(key)
                  change((d) => {
                    d.settings = renameKey(d.settings ?? {}, key, to)
                  })
                }}
              />
              <div>
                <label className={styles.label} htmlFor={`${id}-${rowId(key)}-kind`}>
                  {t('systemEditor.fieldKind')}
                </label>
                <select
                  id={`${id}-${rowId(key)}-kind`}
                  className={styles.input}
                  value={setting.kind}
                  onChange={(event) => {
                    const kind = event.currentTarget.value as Setting['kind']
                    change((d) => {
                      const target = d.settings?.[key]
                      if (d.settings && target) d.settings[key] = withKind(target, kind)
                    })
                  }}
                >
                  {(['boolean', 'number', 'choice', 'choices'] as const).map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`systemEditor.settingKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </div>
              <SettingDefault id={`${id}-${rowId(key)}-default`} setting={setting} onChange={(fn) => set(key, fn)} />
              {(setting.kind === 'choice' || setting.kind === 'choices') && (
                <div className={styles.full}>
                  <label className={styles.label} htmlFor={`${id}-${rowId(key)}-options`}>
                    {t('systemEditor.options')}
                  </label>
                  <textarea
                    id={`${id}-${rowId(key)}-options`}
                    className={styles.input}
                    rows={3}
                    aria-describedby={`${id}-${rowId(key)}-options-hint`}
                    value={(setting.options ?? []).map((o) => textOf(o.label)).join('\n')}
                    onChange={(event) => {
                      const labels = event.currentTarget.value.split('\n')
                      // El valor de una opción guardada no cambia (lo usan las campañas); el de una nueva sale de su nombre
                      const fixed = new Set((original.settings?.[key]?.options ?? []).map((o) => o.value))
                      set(key, (s) => {
                        const taken: string[] = []
                        s.options = labels.map((label, j) => {
                          const before = s.options?.[j]?.value
                          const value = before && fixed.has(before) ? before : keyFrom(label || 'opcion', taken)
                          taken.push(value)
                          return { value, label }
                        })
                      })
                    }}
                  />
                  <p id={`${id}-${rowId(key)}-options-hint`} className={styles.note}>
                    {t('systemEditor.optionsHint')}
                  </p>
                </div>
              )}
              <div className={styles.full}>
                <label className={styles.label} htmlFor={`${id}-${rowId(key)}-help`}>
                  {t('systemEditor.help')}
                </label>
                <input
                  id={`${id}-${rowId(key)}-help`}
                  className={styles.input}
                  value={textOf(setting.help)}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    set(key, (s) => {
                      if (value) s.help = value
                      else delete s.help
                    })
                  }}
                />
              </div>
            </div>
            {!disabled && (
              <div className={styles.typeFoot}>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() =>
                    change((d) => {
                      if (d.settings) delete d.settings[key]
                      if (d.settings && !Object.keys(d.settings).length) delete d.settings
                    })
                  }
                >
                  {t('systemEditor.removeSetting', { name: textOf(setting.label) || key })}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <AddButton
          label={t('systemEditor.addSetting')}
          onClick={() =>
            change((d) => {
              const key = keyFrom(t('systemEditor.newSetting'), Object.keys(d.settings ?? {}))
              d.settings = { ...(d.settings ?? {}), [key]: { label: t('systemEditor.newSetting'), kind: 'boolean' } }
            })
          }
        />
      )}
      {problems.length > 0 && <ProblemList problems={problems} />}
    </fieldset>
  )
}

/** El valor que tiene un ajuste en una campaña nueva */
function SettingDefault({
  id,
  setting,
  onChange
}: {
  id: string
  setting: Setting
  onChange: (fn: (setting: Setting) => void) => void
}) {
  const { t } = useTranslation()
  if (setting.kind === 'choices') return null
  if (setting.kind === 'boolean')
    return (
      <label className={`${styles.check} ${styles.alignEnd}`}>
        <input
          type="checkbox"
          checked={setting.default === true}
          onChange={(event) => {
            const checked = event.currentTarget.checked
            onChange((s) => {
              if (checked) s.default = true
              else delete s.default
            })
          }}
        />
        {t('systemEditor.settingOn')}
      </label>
    )
  return (
    <div>
      <label className={styles.label} htmlFor={id}>
        {t('systemEditor.default')}
      </label>
      {setting.kind === 'number' ? (
        <input
          id={id}
          className={styles.input}
          type="number"
          value={typeof setting.default === 'number' ? setting.default : ''}
          onChange={(event) => {
            const value = event.currentTarget.value
            onChange((s) => {
              if (value === '') delete s.default
              else s.default = Number(value)
            })
          }}
        />
      ) : (
        <select
          id={id}
          className={styles.input}
          value={typeof setting.default === 'string' ? setting.default : ''}
          onChange={(event) => {
            const value = event.currentTarget.value
            onChange((s) => {
              if (value) s.default = value
              else delete s.default
            })
          }}
        >
          <option value="">{t('systemEditor.noDefault')}</option>
          {(setting.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {textOf(o.label) || o.value}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
