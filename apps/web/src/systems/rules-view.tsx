/**
 * Las reglas de un sistema, para leerlas (ajustes tras los módulos; Enrique, 2026-11-19: «Reglas debe ser como
 * calendario, debe mostrar una vista general y el editor de reglas en un botón»): una hoja de referencia con el
 * esqueleto de las pantallas. El título sobre la columna y, a su derecha, «Editar reglas» para quien puede cambiarlo; en
 * el centro, lo que define el sistema por partes (el personaje, las tiradas, lo que se lleva, cómo se crea un personaje
 * y los ajustes de campaña), con las fórmulas en palabras; a la izquierda, el índice de esas partes, que sigue la lectura
 */
import type { System } from '@crisol/systems'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { Backpack, Dices, type LucideIcon, Pencil, Settings2, Skull, UserRound, Wand } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { RulesEditor } from './editor/rules-editor.tsx'
import { isEmptyOutline, type RulesOutline, rulesOutline } from './rules-outline.ts'
import styles from './rules-view.module.css'

const route = getRouteApi('/sistemas/$systemId/reglas')
const editRoute = getRouteApi('/sistemas/$systemId/reglas/editar')

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Si quien lo ve puede cambiarlo (un sistema de la cuenta, y con permiso): lo dicen sus libros */
function useEditable(systemId: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
}

export function SystemRules() {
  const { t } = useTranslation()
  const api = useApi()
  const { systemId } = route.useParams()
  const system = useQuery({ queryKey: ['system', systemId], queryFn: () => api.call('getSystem', { systemId }) })
  const books = useEditable(systemId)
  const document = system.data?.document as unknown as System | undefined
  const language = document?.languages?.[0] ?? 'es'
  const outline = useMemo(
    () =>
      document
        ? rulesOutline(document, language, {
            thisOne: t('rulesView.thisOne'),
            yes: t('rulesView.yes'),
            no: t('rulesView.no')
          })
        : null,
    [document, language, t]
  )
  if (!system.data || !outline)
    return failed(system) ? <LoadError error={system.error} onRetry={() => system.refetch()} /> : <Loading />
  const editable = Boolean(books.data?.editable) && !system.data.builtIn
  return <RulesSheet systemId={systemId} outline={outline} editable={editable} />
}

/** El editor por pasos, en su ruta; quien no puede cambiarlo vuelve a la vista */
export function SystemRulesEditor() {
  const { systemId } = editRoute.useParams()
  const books = useEditable(systemId)
  if (books.data && !books.data.editable)
    return <Navigate to="/sistemas/$systemId/reglas" params={{ systemId }} replace />
  // Si sus libros no llegan, el editor se abre igual (lo dice su paso del compendio; guardar lo valida el servidor)
  if (books.isPending) return <Loading />
  return <RulesEditor systemId={systemId} />
}

type Part = 'personaje' | 'tiradas' | 'objetos' | 'fichas' | 'creacion' | 'ajustes'
const ICONS: Record<Part, LucideIcon> = {
  personaje: UserRound,
  tiradas: Dices,
  objetos: Backpack,
  fichas: Skull,
  creacion: Wand,
  ajustes: Settings2
}
const anchor = (part: Part) => `reglas-${part}`

function RulesSheet({ systemId, outline, editable }: { systemId: string; outline: RulesOutline; editable: boolean }) {
  const { t } = useTranslation()
  const parts = useMemo(() => {
    const out: { part: Part; title: string; count: number }[] = []
    if (outline.character) out.push({ part: 'personaje', title: outline.character.label, count: 0 })
    if (outline.rolls.length > 0)
      out.push({ part: 'tiradas', title: t('rulesView.rolls'), count: outline.rolls.length })
    if (outline.items.length > 0)
      out.push({ part: 'objetos', title: t('rulesView.items'), count: outline.items.length })
    if (outline.actors.length > 0)
      out.push({ part: 'fichas', title: t('rulesView.actors'), count: outline.actors.length })
    if (outline.creation.length > 0)
      out.push({ part: 'creacion', title: t('rulesView.creation'), count: outline.creation.length })
    if (outline.settings.length > 0)
      out.push({ part: 'ajustes', title: t('rulesView.settings'), count: outline.settings.length })
    return out
  }, [outline, t])
  const empty = isEmptyOutline(outline)
  const active = useReading(parts.map((p) => anchor(p.part)))
  const [chosen, setChosen] = useState<string | null>(null)
  const pinned = useRef(0)
  // La que se pulsa manda mientras se va hacia ella; luego, la que se lee
  const current = chosen && Date.now() < pinned.current ? chosen : active

  const go = (part: Part) => {
    const target = document.getElementById(anchor(part))
    if (!target) return
    setChosen(anchor(part))
    pinned.current = Date.now() + 900
    // Solo se desplaza su columna (scrollIntoView movía también el armazón de la app, cerca del final)
    const box = scrollerOf(target)
    const gap = 24
    const top = target.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) - gap
    const behavior = reducedMotion() ? 'auto' : 'smooth'
    if (box) box.scrollBy({ top, behavior })
    else window.scrollBy({ top, behavior })
    target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }

  return (
    <Screen
      title={t('systemRules.title')}
      actions={
        editable ? (
          <Link
            to="/sistemas/$systemId/reglas/editar"
            params={{ systemId }}
            className={styles.edit}
            data-tour="reglas-editar"
          >
            <Pencil size={16} aria-hidden="true" />
            {t('rulesView.edit')}
          </Link>
        ) : undefined
      }
      left={
        parts.length > 1 ? (
          <nav className={styles.index} aria-label={t('rulesView.index')} data-tour="reglas-indice">
            <ol>
              {parts.map(({ part, title, count }) => {
                const Icon = ICONS[part]
                return (
                  <li key={part}>
                    <button
                      type="button"
                      className={styles.indexItem}
                      aria-current={current === anchor(part) ? 'location' : undefined}
                      onClick={() => go(part)}
                    >
                      <Icon size={16} aria-hidden="true" className={styles.indexIcon} />
                      <span className={styles.indexTitle}>{title}</span>
                      {count > 0 && <span className={styles.indexCount}>{count}</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null
      }
      leftLabel={t('rulesView.index')}
    >
      {outline.summary && <p className={styles.lead}>{outline.summary}</p>}
      {empty && <p className={styles.empty}>{editable ? t('rulesView.emptyEdit') : t('rulesView.empty')}</p>}
      {outline.character && <CharacterPart character={outline.character} />}
      {outline.rolls.length > 0 && <RollsPart outline={outline} />}
      {outline.items.length > 0 && (
        <Part part="objetos" title={t('rulesView.items')}>
          <TypeCards types={outline.items} />
        </Part>
      )}
      {outline.actors.length > 0 && (
        <Part part="fichas" title={t('rulesView.actors')}>
          <TypeCards types={outline.actors} />
        </Part>
      )}
      {outline.creation.length > 0 && (
        <Part part="creacion" title={t('rulesView.creation')}>
          <ol className={styles.steps}>
            {outline.creation.map((step) => (
              <li key={step.key}>
                <span className={styles.stepName}>{step.label}</span>
                <span className={styles.muted}>
                  {step.kind !== 'summary' && t(`rules.creation.kind.${step.kind}`)}
                  {step.detail && step.detail !== step.label ? `: ${step.detail}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </Part>
      )}
      {outline.settings.length > 0 && (
        <Part part="ajustes" title={t('rulesView.settings')}>
          <dl className={styles.rows}>
            {outline.settings.map((setting) => (
              <div key={setting.key} className={styles.row}>
                <dt>
                  {setting.label}
                  {setting.help && <span className={styles.help}>{setting.help}</span>}
                </dt>
                <dd>
                  <ul className={styles.chips}>
                    {setting.options.map((option) => (
                      <li key={option.label} data-chosen={option.chosen || undefined}>
                        {option.label}
                        {option.chosen && <span className={styles.chosen}> · {t('rulesView.chosen')}</span>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </Part>
      )}
      {outline.license && <p className={styles.license}>{outline.license}</p>}
      <Tour
        id="reglas"
        steps={[
          { target: '[data-tour="reglas-indice"]', text: t('tour.rulesView.index'), placement: 'right' },
          ...(editable
            ? [{ target: '[data-tour="reglas-editar"]', text: t('tour.rulesView.edit'), placement: 'bottom' as const }]
            : [])
        ]}
      />
    </Screen>
  )
}

/** Lo que se desplaza alrededor de algo: el primero que tiene desplazamiento propio */
function scrollerOf(element: Element): Element | null {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at)
    if ((overflowY === 'auto' || overflowY === 'scroll') && at.scrollHeight > at.clientHeight) return at
  }
  return null
}

/** La parte que se está leyendo: la última cuyo principio pasó del primer cuarto de la ventana (o la última, al final) */
function useReading(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const key = ids.join(' ')
  useEffect(() => {
    const list = key ? key.split(' ') : []
    let frame = 0
    const update = (event?: Event) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = event?.target instanceof Element ? event.target : document.scrollingElement
        const atEnd = Boolean(box && box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 4)
        const line = window.innerHeight * 0.25
        let current = list[0] ?? null
        for (const id of list) {
          const top = document.getElementById(id)?.getBoundingClientRect().top
          if (top !== undefined && (top <= line || (atEnd && top < window.innerHeight))) current = id
        }
        setActive(current)
      })
    }
    update()
    document.addEventListener('scroll', update, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', update, { capture: true })
    }
  }, [key])
  return active
}

function Part({ part, title, children }: { part: Part; title: string; children: ReactNode }) {
  return (
    <section id={anchor(part)} className={styles.part} aria-labelledby={`${anchor(part)}-titulo`}>
      <h2 id={`${anchor(part)}-titulo`} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Unas filas de nombre y lo que es (una fórmula en palabras, un máximo, unos tipos) */
function Rows({ rows }: { rows: { key: string; label: string; value: ReactNode }[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CharacterPart({ character }: { character: NonNullable<RulesOutline['character']> }) {
  const { t } = useTranslation()
  return (
    <Part part="personaje" title={character.label}>
      {character.sets.map((set) => (
        <div key={set.key} className={styles.block}>
          <h3>{set.label}</h3>
          {/* Pocos (las seis características), en una sola fila; muchos, en las columnas que quepan */}
          <ul
            className={styles.elements}
            style={set.elements.length <= 6 ? ({ '--columnas': set.elements.length } as CSSProperties) : undefined}
          >
            {set.elements.map((element) => (
              <li key={element.key}>
                <span>{element.label}</span>
                {(element.abbr || element.note) && (
                  <span className={styles.muted}>{[element.abbr, element.note].filter(Boolean).join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
          {set.noted.length > 0 && (
            <p className={styles.note}>{t('rulesView.eachNotes', { list: set.noted.join(', ') })}</p>
          )}
          {set.derived.length > 0 && (
            <Rows rows={set.derived.map((d) => ({ key: d.key, label: d.label, value: d.formula }))} />
          )}
        </div>
      ))}
      {character.derived.length > 0 && (
        <div className={styles.block}>
          <h3>{t('rulesView.derived')}</h3>
          <Rows rows={character.derived.map((d) => ({ key: d.key, label: d.label, value: d.formula }))} />
        </div>
      )}
      {character.resources.length > 0 && (
        <div className={styles.block}>
          <h3>{t('rulesView.resources')}</h3>
          <Rows
            rows={character.resources.map((r) => ({
              key: r.key,
              label: r.label,
              value: [
                r.max ? t('rulesView.max', { value: r.max }) : '',
                r.recovery ? t(`rulesView.recovery.${r.recovery}`) : ''
              ]
                .filter(Boolean)
                .join(' · ')
            }))}
          />
        </div>
      )}
      {character.items.length > 0 && (
        <div className={styles.block}>
          <h3>{t('rulesView.carried')}</h3>
          <Rows rows={character.items.map((i) => ({ key: i.key, label: i.label, value: i.types }))} />
        </div>
      )}
      {character.others.length > 0 && (
        <div className={styles.block}>
          <h3>{t('rulesView.more')}</h3>
          <ul className={styles.others}>
            {character.others.map((field) => (
              <li key={field.key}>
                <span>{field.label}</span>
                {field.detail && <span className={styles.muted}>{field.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Part>
  )
}

function RollsPart({ outline }: { outline: RulesOutline }) {
  const { t } = useTranslation()
  const { dice } = outline
  return (
    <Part part="tiradas" title={t('rulesView.rolls')}>
      {(dice.default || dice.critical || dice.initiative) && (
        <dl className={styles.dice}>
          {dice.default && (
            <div>
              <dt>{t('rulesView.dice')}</dt>
              <dd>{dice.default}</dd>
            </div>
          )}
          {dice.critical && (
            <div>
              <dt>{t('rulesView.critical')}</dt>
              <dd>{t(`rules.rolls.criticalRule.${dice.critical}`)}</dd>
            </div>
          )}
          {dice.initiative && (
            <div>
              <dt>{t('rulesView.initiative')}</dt>
              <dd>{dice.initiative}</dd>
            </div>
          )}
        </dl>
      )}
      <ul className={styles.rolls}>
        {outline.rolls.map((roll) => (
          <li key={roll.key} className={styles.roll}>
            <h3>{roll.label}</h3>
            <p className={styles.formula}>{roll.formula}</p>
            {(roll.each || roll.target !== 'none') && (
              <p className={styles.muted}>
                {[
                  roll.each ? t('rulesView.each', { list: roll.each }) : '',
                  roll.target !== 'none' ? t(`rulesView.target.${roll.target}`) : ''
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {roll.variants.length > 0 && (
              <ul className={styles.plain}>
                {roll.variants.map((variant) => (
                  <li key={`${variant.when}-${variant.formula}`}>
                    {t('rulesView.variant', { when: variant.when, formula: variant.formula })}
                  </li>
                ))}
              </ul>
            )}
            {roll.bands.length > 0 && (
              <ul className={styles.bands} aria-label={t('rulesView.results')}>
                {roll.bands.map((band) => (
                  <li key={`${band.label}-${band.when}`} data-tone={band.tone}>
                    <span className={styles.band}>{band.label}</span>
                    <span className={styles.muted}>{band.when || t('rulesView.otherwise')}</span>
                  </li>
                ))}
              </ul>
            )}
            {roll.modes.length > 0 && (
              <ul className={styles.chips} aria-label={t('rulesView.modes')}>
                {roll.modes.map((mode) => (
                  <li key={mode.key}>
                    {mode.label}
                    {mode.change && <span className={styles.muted}> {mode.change}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Part>
  )
}

/** Los tipos de objeto o las otras fichas, en tarjetas: su nombre, cuántos campos tiene, los primeros y lo que da */
function TypeCards({
  types
}: {
  types: readonly { key: string; label: string; fields: number; sample: string[]; bonuses?: string[] }[]
}) {
  const { t } = useTranslation()
  const SHOWN = 6
  return (
    <ul className={styles.types}>
      {types.map((type) => (
        <li key={type.key} className={styles.type}>
          <span className={styles.typeName}>{type.label}</span>
          <span className={styles.muted}>{t('rulesView.fields', { count: type.fields })}</span>
          {type.sample.length > 0 && (
            <span className={styles.sample}>
              {type.sample.slice(0, SHOWN).join(', ')}
              {type.sample.length > SHOWN ? '…' : ''}
            </span>
          )}
          {type.bonuses && type.bonuses.length > 0 && (
            <span className={styles.sample}>{t('rulesView.bonuses', { list: type.bonuses.join(', ') })}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
