/**
 * El panel de lo dibujado que está elegido (módulo 9, lienzo «Mapas con capas»): su nombre, su página, su capa y cómo se
 * ve (en listas cerradas), si está oculto a los jugadores y «Revelar», y quitarlo. Cada cambio se guarda al momento.
 * Quien no lo cambia (un jugador) ve su nombre y su página
 */
import { type MapElementView, type MapLayerView, type MapStyle, type Page, WORLD_COLORS } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { FormError } from '../../components/field.tsx'
import { focusOnMount } from '../../components/focus.ts'
import list from '../../components/list.module.css'
import { PRESET_COLORS } from '../../routes/world-look.ts'
import { PageLink } from '../read-as.tsx'
import { TargetReveal } from '../reveal.tsx'
import { elementName } from './drawing.tsx'
import styles from './map.module.css'
import type { ElementPatch } from './use-elements.ts'

const FILLS = ['solid', 'hatch', 'none'] as const
const STROKES = ['solid', 'dashed', 'dotted'] as const
/** Cómo sale su nombre, en el orden en que se ofrece: siempre (1), al pasar (0), nunca (2) */
const DISPLAYS = [1, 0, 2] as const
const DISPLAY_NAMES = { 0: 'hover', 1: 'always', 2: 'never' } as const

export function ElementPanel({
  page,
  element,
  layers,
  editable,
  naming,
  onChange,
  onDelete,
  onClose
}: {
  page: Page
  element: MapElementView
  layers: readonly MapLayerView[]
  editable: boolean
  /** Recién dibujado: el foco, a su nombre */
  naming: boolean
  onChange: (patch: ElementPatch) => Promise<unknown>
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const id = useId()
  const [error, setError] = useState<unknown>(null)
  const [label, setLabel] = useState(element.label ?? '')
  const [pageName, setPageName] = useState(element.pageTitle ?? '')
  const names = useQuery({
    queryKey: ['pages', page.worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId: page.worldId }),
    enabled: editable
  })
  const title = t(`map.element.title.${element.kind}`)

  const save = async (patch: ElementPatch) => {
    setError(null)
    try {
      await onChange(patch)
    } catch (caught) {
      setError(caught)
    }
  }
  const style = (patch: MapStyle) => save({ style: { ...element.style, ...patch } })

  /** Una página por su título: la que hay, o una subpágina nueva de la del mapa */
  const pageFor = async (name: string) => {
    const key = name.toLocaleLowerCase('es')
    const found = names.data?.pages.find((other) => other.title.toLocaleLowerCase('es') === key)
    if (found) return found.id
    const created = await api.call('createPage', { worldId: page.worldId, title: name, parentId: page.id })
    await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
    return created.id
  }
  const commitLabel = () => {
    const next = label.trim() || null
    if (next !== element.label) void save({ label: next })
  }
  const commitPage = async () => {
    const next = pageName.trim()
    if (next === (element.pageTitle ?? '')) return
    if (!next) return save({ pageId: null })
    try {
      await save({ pageId: await pageFor(next) })
    } catch (caught) {
      setError(caught)
    }
  }
  const onEnter = (commit: () => unknown) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void commit()
  }

  const head = (
    <header className={styles.panelHead}>
      <h2>{editable ? title : elementName(element) || title}</h2>
      <button
        type="button"
        className={styles.close}
        aria-label={t('map.element.close')}
        title={t('map.element.close')}
        onClick={onClose}
      >
        <X aria-hidden="true" size={18} />
      </button>
    </header>
  )

  if (!editable) {
    return (
      <section className={styles.panel} aria-label={title}>
        {head}
        {element.pageId && element.pageTitle && (
          <p className={styles.readPage}>
            {element.pageTitle}{' '}
            <PageLink className={list.secondary} worldId={page.worldId} pageId={element.pageId}>
              {t('map.pin.open')}
            </PageLink>
          </p>
        )}
      </section>
    )
  }

  const color = element.style.color ?? 'wine'
  const kind = element.kind
  const range = (name: RangeName, value: number, options: Omit<RangeProps, 'id' | 'name' | 'value'>) => (
    <RangeField key={name} id={`${id}-${name}`} name={name} value={value} {...options} />
  )

  return (
    <section className={styles.panel} aria-label={title}>
      {head}
      <fieldset className={styles.fields}>
        <label htmlFor={`${id}-label`}>{kind === 'label' ? t('map.element.text') : t('map.pin.name')}</label>
        <input
          id={`${id}-label`}
          ref={naming ? focusOnMount : undefined}
          value={label}
          maxLength={120}
          placeholder={element.pageTitle ?? ''}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={commitLabel}
          onKeyDown={onEnter(commitLabel)}
        />

        <label htmlFor={`${id}-page`}>{t('map.pin.page')}</label>
        <div className={styles.pageRow}>
          <input
            id={`${id}-page`}
            list={`${id}-pages`}
            value={pageName}
            placeholder={t('map.pin.noPage')}
            onChange={(event) => setPageName(event.currentTarget.value)}
            onBlur={() => void commitPage()}
            onKeyDown={onEnter(commitPage)}
          />
          {element.pageId && element.pageTitle && (
            <PageLink className={list.secondary} worldId={page.worldId} pageId={element.pageId}>
              {t('map.pin.open')}
            </PageLink>
          )}
        </div>
        <datalist id={`${id}-pages`}>
          {names.data?.pages.map((other) => (
            <option key={other.id} value={other.title} />
          ))}
        </datalist>

        {layers.length > 1 && (
          <>
            <label htmlFor={`${id}-layer`}>{t('map.element.layer')}</label>
            <select
              id={`${id}-layer`}
              value={element.layerId ?? layers[0]?.id}
              onChange={(event) => void save({ layerId: event.currentTarget.value })}
            >
              {[...layers].reverse().map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className={styles.players}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={element.hidden}
              onChange={(event) => void save({ hidden: event.currentTarget.checked })}
            />
            {t('map.element.hidden')}
          </label>
          <TargetReveal worldId={page.worldId} pageId={page.id} kind="element" targetId={element.id} />
        </div>

        <fieldset className={styles.choices}>
          <legend>{t('map.pin.color')}</legend>
          {WORLD_COLORS.map((option) => (
            <label key={option} className={styles.swatch} title={t(`worlds.colors.${option}`)}>
              <input
                type="radio"
                name={`${id}-color`}
                checked={color === option}
                onChange={() => void style({ color: option })}
              />
              <span aria-hidden="true" style={{ background: PRESET_COLORS[option] }} />
              <span className={styles.hidden}>{t(`worlds.colors.${option}`)}</span>
            </label>
          ))}
        </fieldset>

        <details className={styles.aspect}>
          <summary>{t('map.element.aspect')}</summary>
          <div className={styles.aspectBody}>
            {kind === 'region' && (
              <fieldset className={styles.segmented}>
                <legend>{t('map.element.fill')}</legend>
                {FILLS.map((fill) => (
                  <label key={fill}>
                    <input
                      type="radio"
                      name={`${id}-fill`}
                      checked={(element.style.fill ?? 'solid') === fill}
                      onChange={() => void style({ fill })}
                    />
                    <span>{t(`map.element.fills.${fill}`)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {kind === 'region' &&
              (element.style.fill ?? 'solid') === 'solid' &&
              range('opacity', Math.round((element.style.opacity ?? 0.25) * 100), {
                min: 5,
                max: 100,
                step: 5,
                unit: ' %',
                onCommit: (value) => void style({ opacity: value / 100 })
              })}

            {kind !== 'label' && (
              <fieldset className={styles.segmented}>
                <legend>{t(kind === 'region' ? 'map.element.border' : 'map.element.stroke')}</legend>
                {STROKES.map((stroke) => (
                  <label key={stroke}>
                    <input
                      type="radio"
                      name={`${id}-stroke`}
                      checked={(element.style.stroke ?? 'solid') === stroke}
                      onChange={() => void style({ stroke })}
                    />
                    <span>{t(`map.element.strokes.${stroke}`)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {kind === 'path' &&
              range('width', element.style.width ?? 3, {
                min: 1,
                max: 12,
                step: 1,
                onCommit: (width) => void style({ width })
              })}

            {kind !== 'label' && (
              <fieldset className={styles.segmented}>
                <legend>{t('map.element.display')}</legend>
                {DISPLAYS.map((display) => (
                  <label key={display}>
                    <input
                      type="radio"
                      name={`${id}-display`}
                      checked={(element.style.display ?? 1) === display}
                      onChange={() => void style({ display })}
                    />
                    <span>{t(`map.displays.${DISPLAY_NAMES[display]}`)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {range('size', element.style.size ?? (kind === 'path' ? 14 : kind === 'label' ? 20 : 26), {
              min: 10,
              max: 96,
              step: 1,
              onCommit: (size) => void style({ size })
            })}
            {kind === 'label' &&
              'at' in element.geometry &&
              range('rotate', element.geometry.rotate ?? 0, {
                min: -180,
                max: 180,
                step: 5,
                unit: '°',
                onCommit: (rotate) =>
                  'at' in element.geometry && void save({ geometry: { ...element.geometry, rotate } })
              })}
            {kind === 'label' &&
              'at' in element.geometry &&
              range('arc', Math.round((element.geometry.arc ?? 0) * 100), {
                min: -100,
                max: 100,
                step: 10,
                onCommit: (arc) =>
                  'at' in element.geometry && void save({ geometry: { ...element.geometry, arc: arc / 100 } })
              })}
          </div>
        </details>

        <button type="button" className={list.secondary} onClick={onDelete}>
          {t('map.element.delete')}
        </button>
      </fieldset>
      <FormError message={error ? errorText(error) : null} />
    </section>
  )
}

type RangeName = 'opacity' | 'width' | 'size' | 'rotate' | 'arc'
type RangeProps = {
  id: string
  name: RangeName
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onCommit: (value: number) => void
}

/** Un deslizador con su cifra al lado, que se ve mientras se mueve y se guarda al soltar (o con las flechas) */
function RangeField({ id, name, value, min, max, step, unit = '', onCommit }: RangeProps) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(value)
  // Si cambia por otro lado (deshacer, la IA), se ve lo nuevo; mientras se mueve, lo de la mano
  useEffect(() => setShown(value), [value])
  const commit = (next: number) => {
    if (next !== value) onCommit(next)
  }
  return (
    <>
      <label htmlFor={id}>{t(`map.element.${name}`)}</label>
      <div className={styles.rangeRow}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={(event) => setShown(Number(event.currentTarget.value))}
          onPointerUp={(event) => commit(Number(event.currentTarget.value))}
          onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        />
        <output htmlFor={id}>
          {shown}
          {unit}
        </output>
      </div>
    </>
  )
}
