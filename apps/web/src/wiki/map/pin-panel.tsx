/**
 * El panel del pin elegido: su nombre, la página a la que lleva (una que no existe se crea como subpágina de la del
 * mapa), y cómo se ve. Cada cambio se guarda al momento. Recién puesto con «Pin con página nueva», el nombre que se le
 * dé es el de su página nueva
 */
import { type MapPinView, type Page, WORLD_COLORS } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { FormError } from '../../components/field.tsx'
import { focusOnMount } from '../../components/focus.ts'
import list from '../../components/list.module.css'
import { PRESET_COLORS } from '../../routes/world-look.ts'
import styles from './map.module.css'
import { PinShape, pinHex, SHAPE_NAMES } from './pin-shape.tsx'

type Patch = Partial<Omit<MapPinView, 'id' | 'pageTitle'>>

const VARIANTS = ['large', 'small', 'icon'] as const
const DISPLAYS = ['hover', 'always', 'never'] as const

export function PinPanel({
  page,
  pin,
  editable,
  naming,
  onNamed,
  onChange,
  onDelete,
  onClose
}: {
  page: Page
  pin: MapPinView
  editable: boolean
  /** Recién puesto con «Pin con página nueva»: el nombre crea su página */
  naming: boolean
  onNamed: () => void
  onChange: (patch: Patch) => Promise<unknown>
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const id = useId()
  const [error, setError] = useState<unknown>(null)
  const [label, setLabel] = useState(pin.label ?? '')
  const [pageName, setPageName] = useState(pin.pageTitle ?? '')
  const names = useQuery({
    queryKey: ['pages', page.worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId: page.worldId })
  })

  const save = async (patch: Patch) => {
    setError(null)
    try {
      await onChange(patch)
    } catch (caught) {
      setError(caught)
    }
  }

  /** Una página por su título: la que hay, o una subpágina nueva de la del mapa */
  const pageFor = async (title: string) => {
    const key = title.toLocaleLowerCase('es')
    const found = names.data?.pages.find((other) => other.title.toLocaleLowerCase('es') === key)
    if (found) return found.id
    const created = await api.call('createPage', { worldId: page.worldId, title, parentId: page.id })
    await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
    return created.id
  }

  const commitLabel = async () => {
    const next = label.trim()
    if (naming) {
      if (!next) return
      onNamed()
      try {
        const pageId = await pageFor(next)
        setPageName(next)
        setLabel('')
        await save({ pageId, label: null })
      } catch (caught) {
        setError(caught)
      }
      return
    }
    if ((next || null) !== pin.label) await save({ label: next || null })
  }

  const commitPage = async () => {
    const next = pageName.trim()
    if (next === (pin.pageTitle ?? '')) return
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

  const custom = pin.color.startsWith('#') ? pin.color : null

  return (
    <section className={styles.panel} aria-label={t('map.pin.title')}>
      <header className={styles.panelHead}>
        <h2>{t('map.pin.title')}</h2>
        <button
          type="button"
          className={styles.close}
          aria-label={t('map.pin.close')}
          title={t('map.pin.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <fieldset disabled={!editable} className={styles.fields}>
        <label htmlFor={`${id}-label`}>{naming ? t('map.pin.page') : t('map.pin.name')}</label>
        <input
          id={`${id}-label`}
          ref={naming ? focusOnMount : undefined}
          value={label}
          maxLength={120}
          placeholder={naming ? '' : (pin.pageTitle ?? t('map.untitledPin'))}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={() => void commitLabel()}
          onKeyDown={onEnter(commitLabel)}
        />

        {!naming && (
          <>
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
              {pin.pageId && pin.pageTitle && (
                <Link
                  className={list.secondary}
                  to="/mundos/$worldId/wiki/$pageId"
                  params={{ worldId: page.worldId, pageId: pin.pageId }}
                >
                  {t('map.pin.open')}
                </Link>
              )}
            </div>
            <datalist id={`${id}-pages`}>
              {names.data?.pages.map((other) => (
                <option key={other.id} value={other.title} />
              ))}
            </datalist>
          </>
        )}

        <fieldset className={styles.choices}>
          <legend>{t('map.pin.color')}</legend>
          {WORLD_COLORS.map((color) => (
            <label key={color} className={styles.swatch} title={t(`worlds.colors.${color}`)}>
              <input
                type="radio"
                name={`${id}-color`}
                checked={pin.color === color}
                onChange={() => void save({ color })}
              />
              <span aria-hidden="true" style={{ background: PRESET_COLORS[color] }} />
              <span className={styles.hidden}>{t(`worlds.colors.${color}`)}</span>
            </label>
          ))}
          <label className={`${styles.swatch} ${styles.customSwatch}`} title={t('map.pin.customColor')}>
            <input
              type="color"
              value={custom ?? pinHex(pin.color)}
              onChange={(event) => void save({ color: event.currentTarget.value })}
            />
            {custom ? (
              <span aria-hidden="true" style={{ background: custom }} />
            ) : (
              <Plus aria-hidden="true" size={16} />
            )}
            <span className={styles.hidden}>{t('map.pin.customColor')}</span>
          </label>
        </fieldset>

        <fieldset className={styles.choices}>
          <legend>{t('map.pin.shape')}</legend>
          {SHAPE_NAMES.map((shape, index) => (
            <label key={shape} className={styles.shapeChoice} title={t(`map.shapes.${shape}`)}>
              <input
                type="radio"
                name={`${id}-shape`}
                checked={pin.shape === index}
                onChange={() => void save({ shape: index })}
              />
              <PinShape shape={index} color={pin.color} size={26} />
              <span className={styles.hidden}>{t(`map.shapes.${shape}`)}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.segmented}>
          <legend>{t('map.pin.size')}</legend>
          {VARIANTS.map((variant, index) => (
            <label key={variant}>
              <input
                type="radio"
                name={`${id}-variant`}
                checked={pin.variant === index}
                onChange={() => void save({ variant: index })}
              />
              <span>{t(`map.variants.${variant}`)}</span>
            </label>
          ))}
        </fieldset>

        <label htmlFor={`${id}-icon`}>{t('map.pin.icon')}</label>
        <input
          id={`${id}-icon`}
          className={styles.iconInput}
          defaultValue={pin.icon ?? ''}
          maxLength={16}
          placeholder={t('map.pin.iconHint')}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim() || null
            if (next !== pin.icon) void save({ icon: next })
          }}
          onKeyDown={onEnter(() => (document.activeElement as HTMLElement | null)?.blur())}
        />

        <label htmlFor={`${id}-display`}>{t('map.pin.display')}</label>
        <select
          id={`${id}-display`}
          value={pin.display}
          onChange={(event) => void save({ display: Number(event.currentTarget.value) })}
        >
          {DISPLAYS.map((display, index) => (
            <option key={display} value={index}>
              {t(`map.displays.${display}`)}
            </option>
          ))}
        </select>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={pin.locked}
            onChange={(event) => void save({ locked: event.currentTarget.checked })}
          />
          {t('map.pin.locked')}
        </label>

        <button type="button" className={list.secondary} onClick={onDelete}>
          {t('map.pin.delete')}
        </button>
      </fieldset>
      <FormError message={error ? errorText(error) : null} />
    </section>
  )
}
