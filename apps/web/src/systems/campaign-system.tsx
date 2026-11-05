/**
 * El sistema de una campaña, en su ventana (y al crearla): cuál (de serie, de la cuenta o ninguno) y, si lo trae, sus
 * fuentes, el idioma del contenido y sus ajustes. Lo que se elige va al borrador de la ventana: se guarda con su
 * «Guardar» (docs/specs/sistemas.md § campana)
 */
import { type Choices, normalizeChoices, type SettingValue, type System, textOf } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { CircleAlert } from 'lucide-react'
import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { NumberText } from '../components/number-text.tsx'
import styles from './campaign-system.module.css'
import { useSystems } from './screen.tsx'

export interface SystemDraft {
  system: string | null
  choices: Partial<Choices>
}

/** Lo que queda elegido de verdad: lo que falta, con su valor inicial */
export const completeChoices = (document: System | undefined, choices: Partial<Choices>) =>
  document ? normalizeChoices(document, choices).choices : null

type Source = NonNullable<System['sources']>[number]

/** Las ediciones de un sistema (si cada fuente dice la suya): de la más nueva a la más vieja, con sus fuentes */
export function editionsOf(system: System | undefined): { edition: string; sources: Source[] }[] | null {
  const sources = system?.sources ?? []
  if (sources.length === 0 || sources.some((s) => !s.edition)) return null
  const byEdition = new Map<string, Source[]>()
  for (const s of sources) byEdition.set(s.edition as string, [...(byEdition.get(s.edition as string) ?? []), s])
  const newest = (list: Source[]) =>
    list
      .map((s) => s.released ?? '')
      .sort()
      .at(-1) ?? ''
  return [...byEdition]
    .map(([edition, list]) => ({ edition, sources: list }))
    .sort((a, b) => newest(b.sources).localeCompare(newest(a.sources)))
}

export function CampaignSystemFields({
  value,
  onChange,
  onProblem
}: {
  value: SystemDraft
  onChange: (value: SystemDraft) => void
  /** Lo que impide guardarlo (sin ninguna edición activa), o null */
  onProblem?: (problem: string | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const systems = useSystems()
  const all = systems.data?.systems ?? []
  const document = useQuery({
    queryKey: ['systems', value.system],
    queryFn: () => api.call('getSystem', { systemId: value.system ?? '' }),
    enabled: Boolean(value.system)
  })
  const system = document.data?.document as unknown as System | undefined
  const chosen = completeChoices(system, value.choices)
  const set = (patch: Partial<Choices>) => onChange({ ...value, choices: { ...value.choices, ...patch } })
  const setting = (key: string, next: SettingValue) => set({ settings: { ...(chosen?.settings ?? {}), [key]: next } })
  const editions = editionsOf(system)
  const active = editions?.filter((e) => e.sources.some((s) => chosen?.sources.includes(s.key))) ?? []
  const noSource = Boolean(system && chosen && (system.sources?.length ?? 0) > 0 && chosen.sources.length === 0)
  const problem = noSource ? t(editions ? 'campaignSystem.atLeastOneEdition' : 'campaignSystem.atLeastOneSource') : null
  useEffect(() => onProblem?.(problem), [problem, onProblem])

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
        {all.some((s) => !s.builtIn) && (
          <optgroup label={t('systems.mine')}>
            {all
              .filter((s) => !s.builtIn)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </optgroup>
        )}
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

      {system && chosen && editions && (
        <fieldset className={styles.group}>
          <legend>{t('campaignSystem.editions')}</legend>
          {editions.map((e) => (
            <label key={e.edition} className={styles.check}>
              <input
                type="checkbox"
                checked={e.sources.every((s) => chosen.sources.includes(s.key))}
                onChange={(event) => {
                  const keys = e.sources.map((s) => s.key)
                  set({
                    sources: event.currentTarget.checked
                      ? [...new Set([...chosen.sources, ...keys])]
                      : chosen.sources.filter((s) => !keys.includes(s))
                  })
                }}
              />
              <span>
                {e.edition}
                <span className={styles.detail}>
                  {e.sources.map((s) => `${textOf(s.name)} · ${s.license}`).join(', ')}
                </span>
              </span>
            </label>
          ))}
          {problem && (
            <p className={styles.error} role="alert">
              <CircleAlert size={14} aria-hidden="true" />
              {problem}
            </p>
          )}
        </fieldset>
      )}

      {system && chosen && active.length > 1 && (
        <fieldset className={styles.group}>
          <legend>{t('campaignSystem.duplicates')}</legend>
          {(['newest', 'both'] as const).map((d) => (
            <label key={d} className={styles.check}>
              <input
                type="radio"
                name={`${id}-repetido`}
                checked={chosen.duplicates === d}
                onChange={() => set({ duplicates: d })}
              />
              <span>
                {t(`campaignSystem.${d}`, { edition: active[0]?.edition })}
                <span className={styles.detail}>
                  {t(`campaignSystem.${d}Hint`, {
                    older: active
                      .slice(1)
                      .map((e) => e.edition)
                      .join(', ')
                  })}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {system && chosen && !editions && (system.sources?.length ?? 0) > 0 && (
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
          {problem && (
            <p className={styles.error} role="alert">
              <CircleAlert size={14} aria-hidden="true" />
              {problem}
            </p>
          )}
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
                  <NumberText
                    id={`${id}-${key}`}
                    value={typeof current === 'number' ? current : 0}
                    onValue={(n) => setting(key, n)}
                  />
                </div>
              )
            const help = s.help ? <p className={styles.hint}>{textOf(s.help)}</p> : null
            if (s.kind === 'choice' && (s.options?.length ?? 0) <= 3)
              return (
                <fieldset key={key} className={styles.many}>
                  <legend className={styles.manyLabel}>{label}</legend>
                  <div className={styles.languages}>
                    {s.options?.map((o) => (
                      <label key={o.value} className={styles.language}>
                        <input
                          type="radio"
                          name={`${id}-${key}`}
                          checked={current === o.value}
                          onChange={() => setting(key, o.value)}
                        />
                        {textOf(o.label)}
                      </label>
                    ))}
                  </div>
                  {help}
                </fieldset>
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
              <fieldset key={key} className={styles.many}>
                <legend className={styles.manyLabel}>{label}</legend>
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
              </fieldset>
            )
          })}
        </fieldset>
      )}

      {system && chosen && editions && value.system && (
        <ContentSample systemId={value.system} system={system} choices={chosen} active={active.map((e) => e.edition)} />
      )}
      {system && editions && <p className={styles.hint}>{attributionOf(system, t)}</p>}
    </div>
  )
}

/** «Contiene material de SRD 5.1 y SRD 5.2.1 de Wizards of the Coast, con licencia CC BY 4.0» */
function attributionOf(system: System, t: TFunction) {
  const sources = system.sources ?? []
  const names = sources.map((s) => textOf(s.name))
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '')
  const publishers = [...new Set(sources.map((s) => s.publisher).filter(Boolean))]
  const licenses = [...new Set(sources.map((s) => s.license))]
  return t(publishers.length === 1 ? 'campaignSystem.attribution' : 'campaignSystem.attributionPlain', {
    sources: list,
    publisher: publishers[0],
    license: licenses.join(', ')
  })
}

/**
 * Así se ve al elegir: unas cosas que están en más de una edición, como saldrían con lo elegido (la más nueva o las dos,
 * la vieja como «Legado»)
 */
function ContentSample({
  systemId,
  system,
  choices,
  active
}: {
  systemId: string
  system: System
  choices: Choices
  active: string[]
}) {
  const { t } = useTranslation()
  const api = useApi()
  const headingId = useId()
  const found = useQuery({
    queryKey: ['systemContent', systemId, 'muestra', choices.language],
    queryFn: () =>
      api.call('searchSystemContent', { systemId, duplicates: 'both', language: choices.language, limit: 100 })
  })
  const hits = found.data?.items ?? []
  // Lo que está en más de una edición: unas pocas cosas, de tipos distintos si se puede
  const byConcept = new Map<string, typeof hits>()
  for (const h of hits)
    if (h.concept) byConcept.set(`${h.type}:${h.concept}`, [...(byConcept.get(`${h.type}:${h.concept}`) ?? []), h])
  const shared = [...byConcept.values()].filter((list) => new Set(list.map((h) => h.edition)).size > 1)
  const picked: typeof shared = []
  for (const list of shared)
    if (picked.length < 4 && !picked.some((p) => p[0]?.type === list[0]?.type)) picked.push(list)
  for (const list of shared) if (picked.length < 4 && !picked.includes(list)) picked.push(list)
  const rows = picked.flatMap((list) => {
    const visible = list.filter((h) => h.edition && active.includes(h.edition))
    const sorted = [...visible].sort((a, b) => active.indexOf(a.edition ?? '') - active.indexOf(b.edition ?? ''))
    const shown = choices.duplicates === 'newest' ? sorted.slice(0, 1) : sorted
    return shown.map((h, i) => ({
      key: h.key,
      name: `${h.name} · ${textOf(system.types[h.type]?.label ?? h.type, choices.language)}`,
      tag: i > 0 ? `${h.edition} · ${t('campaignSystem.legacy')}` : (h.edition ?? ''),
      legacy: i > 0
    }))
  })
  if (found.isPending || picked.length === 0) return null
  return (
    <section className={styles.look} aria-labelledby={headingId} aria-live="polite">
      <h4 id={headingId}>{t('campaignSystem.look')}</h4>
      {active.length === 0 ? (
        <p className={styles.hint}>{t('campaignSystem.lookNone')}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.key}>
              {r.name}
              <span className={r.legacy ? `${styles.tag} ${styles.legacy}` : styles.tag}>{r.tag}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
