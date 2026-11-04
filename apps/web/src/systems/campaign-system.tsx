/**
 * El sistema de una campaña, en su ventana (y al crearla): cuál (de serie, de la cuenta o ninguno) y, si lo trae, sus
 * fuentes, el idioma del contenido y sus ajustes. Lo que se elige va al borrador de la ventana: se guarda con su
 * «Guardar» (docs/specs/sistemas.md § campana)
 */
import { type Choices, normalizeChoices, type SettingValue, type System, textOf } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import styles from './campaign-system.module.css'
import { useSystems } from './screen.tsx'

export interface SystemDraft {
  system: string | null
  choices: Partial<Choices>
}

/** Lo que queda elegido de verdad: lo que falta, con su valor inicial */
export const completeChoices = (document: System | undefined, choices: Partial<Choices>) =>
  document ? normalizeChoices(document, choices).choices : null

export function CampaignSystemFields({
  value,
  onChange
}: {
  value: SystemDraft
  onChange: (value: SystemDraft) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const systems = useSystems()
  const all = systems.data?.systems ?? []
  const selected = all.find((s) => s.id === value.system)
  const document = useQuery({
    queryKey: ['systems', value.system],
    queryFn: () => api.call('getSystem', { systemId: value.system ?? '' }),
    enabled: Boolean(value.system)
  })
  const system = document.data?.document as unknown as System | undefined
  const chosen = completeChoices(system, value.choices)
  const set = (patch: Partial<Choices>) => onChange({ ...value, choices: { ...value.choices, ...patch } })
  const setting = (key: string, next: SettingValue) => set({ settings: { ...(chosen?.settings ?? {}), [key]: next } })

  return (
    <div className={styles.section}>
      <label htmlFor={`${id}-system`} className={styles.label}>
        {t('campaignSystem.system')}
      </label>
      <select
        id={`${id}-system`}
        className={styles.select}
        value={value.system ?? ''}
        onChange={(event) => onChange({ system: event.currentTarget.value || null, choices: {} })}
      >
        <option value="">{t('campaignSystem.none')}</option>
        <optgroup label={t('systems.mine')}>
          {all
            .filter((s) => !s.builtIn)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </optgroup>
        <optgroup label={t('systems.builtIn')}>
          {all
            .filter((s) => s.builtIn)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </optgroup>
      </select>
      {!value.system && <p className={styles.hint}>{t('campaignSystem.noneHint')}</p>}
      {selected && (
        <Link to="/sistemas/$systemId" params={{ systemId: selected.id }} className={styles.open}>
          {t('campaignSystem.open', { name: selected.name })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}

      {system && chosen && (system.sources?.length ?? 0) > 0 && (
        <fieldset className={styles.group}>
          <legend>{t('campaignSystem.sources')}</legend>
          {system.sources?.map((source) => (
            <label key={source.key} className={styles.check}>
              <input
                type="checkbox"
                checked={chosen.sources.includes(source.key)}
                onChange={(event) =>
                  set({
                    sources: event.currentTarget.checked
                      ? [...chosen.sources, source.key]
                      : chosen.sources.filter((s) => s !== source.key)
                  })
                }
              />
              <span>
                {textOf(source.name)}
                <span className={styles.detail}>{source.license}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {system && chosen && system.languages.length > 1 && (
        <fieldset className={styles.group}>
          <legend>{t('campaignSystem.language')}</legend>
          <div className={styles.languages}>
            {system.languages.map((language) => (
              <label key={language} className={styles.language}>
                <input
                  type="radio"
                  name={`${id}-idioma`}
                  checked={chosen.language === language}
                  onChange={() => set({ language })}
                />
                {t(`campaignSystem.languages.${language}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {system && chosen && Object.keys(system.settings ?? {}).length > 0 && (
        <fieldset className={styles.group}>
          <legend>{t('campaignSystem.settings', { name: textOf(system.name) })}</legend>
          {Object.entries(system.settings ?? {}).map(([key, s]) => {
            const current = chosen.settings[key]
            const label = textOf(s.label)
            if (s.kind === 'boolean')
              return (
                <label key={key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={current === true}
                    onChange={(event) => setting(key, event.currentTarget.checked)}
                  />
                  {label}
                </label>
              )
            if (s.kind === 'number')
              return (
                <div key={key} className={styles.number}>
                  <label htmlFor={`${id}-${key}`}>{label}</label>
                  <input
                    id={`${id}-${key}`}
                    type="number"
                    value={typeof current === 'number' ? current : 0}
                    onChange={(event) => setting(key, event.currentTarget.valueAsNumber || 0)}
                  />
                </div>
              )
            if (s.kind === 'choice')
              return (
                <div key={key} className={styles.number}>
                  <label htmlFor={`${id}-${key}`}>{label}</label>
                  <select
                    id={`${id}-${key}`}
                    value={String(current ?? '')}
                    onChange={(event) => setting(key, event.currentTarget.value)}
                  >
                    {s.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {textOf(o.label)}
                      </option>
                    ))}
                  </select>
                </div>
              )
            const list = Array.isArray(current) ? current : []
            return (
              <div key={key} className={styles.many}>
                <span className={styles.manyLabel}>{label}</span>
                {s.options?.map((o) => (
                  <label key={o.value} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={list.includes(o.value)}
                      onChange={(event) =>
                        setting(
                          key,
                          event.currentTarget.checked ? [...list, o.value] : list.filter((v) => v !== o.value)
                        )
                      }
                    />
                    {textOf(o.label)}
                  </label>
                ))}
              </div>
            )
          })}
        </fieldset>
      )}
    </div>
  )
}
