import type { Page } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookCopy, ChevronDown, CircleOff, FileText, LayoutTemplate } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { loadedGameIcons, useGameIcons } from '../components/game-icons.ts'
import { Icon, useIconLabel } from '../components/icon.tsx'
import { IconBrowser } from '../components/icon-browser.tsx'
import cards from '../routes/world-card.module.css'
import { useTemplates } from '../templates/data.ts'
import { TemplateIcon } from '../templates/icons.tsx'
import styles from './icon.module.css'

/**
 * Lo que se ve al elegir un icono, el mismo en todas partes (una página, una plantilla, una carpeta, un sistema): los
 * iconos de rol de la app, con su buscador y sus grupos, y quitarlo (Enrique, 2026-11-19: «que aparezcan nuestros
 * iconos, no los por defecto»). Un emoji se pone escribiéndolo delante del título
 */
function IconPanel({
  value,
  onPick,
  autoFocus = true
}: {
  value: string | null
  onPick: (icon: string | null) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <IconBrowser value={value} onPick={onPick} autoFocus={autoFocus} />
      {value && (
        <button type="button" className={styles.remove} onClick={() => onPick(null)}>
          <CircleOff aria-hidden="true" size={15} />
          {t('icon.remove')}
        </button>
      )}
    </>
  )
}

/** El dibujo de una página sin icono: el de su plantilla; si no, el de página o el de varias (como en el árbol) */
export function PageKindIcon({
  template,
  hasChildren,
  size = 15
}: {
  template: string | null
  hasChildren: boolean
  size?: number
}) {
  const found = useTemplates().data?.templates.find((each) => each.id === template)
  if (found) return <TemplateIcon icon={found.icon} size={size} />
  return hasChildren ? <BookCopy aria-hidden="true" size={size} /> : <FileText aria-hidden="true" size={size} />
}

/**
 * El icono de la página, delante de su título: pulsarlo abre una caja (patrón de despliegue, como el menú de la
 * cuenta) con los iconos de la app y quitarlo. Escape, pulsar fuera o salir con el tabulador la cierran. Siempre se
 * puede pulsar (Enrique, 2026-11-19: «haz que el icono del título de una hoja sea pulsable»): sin icono, el de su tipo,
 * atenuado (el mismo que en el árbol; en una plantilla, el de plantilla). También se pone desde el propio título (un
 * emoji delante, o «:» y su nombre). Con la página bloqueada solo se ve, y sin icono no sale
 */
export function PageIcon({
  page,
  isTemplate = false,
  style,
  elemento
}: {
  page: Page
  /** La página de una plantilla: sin icono, el dibujo de plantilla */
  isTemplate?: boolean
  /** Su nombre de transición (el icono de una plantilla, desde su tarjeta) */
  style?: CSSProperties | undefined
  elemento?: 'icono'
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const label = useIconLabel(page.icon)
  // La lista de los iconos, ya pedida: «:» en el título los propone en cuanto se escribe
  useGameIcons(!page.locked)
  const save = useMutation({
    mutationFn: (icon: string | null) => api.call('updatePage', { pageId: page.id, icon }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      setOpen(false)
      // Puesto o quitado, el botón sigue ahí (sin icono, con el de su tipo)
      trigger.current?.focus()
    }
  })

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (page.locked) {
    if (!page.icon) return null
    return (
      <span className={styles.wrapper} style={style} data-elemento={elemento}>
        <span className={styles.still}>
          <Icon value={page.icon} />
        </span>
      </span>
    )
  }
  return (
    <div ref={wrapper} className={styles.wrapper} style={style} data-elemento={elemento}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={page.icon && label ? t('icon.change', { icon: label }) : t('icon.choose')}
        title={page.icon ? undefined : t('icon.choose')}
        data-default={page.icon ? undefined : ''}
        onClick={() => setOpen(!open)}
      >
        {page.icon ? (
          <Icon value={page.icon} />
        ) : isTemplate ? (
          <LayoutTemplate aria-hidden="true" size={26} />
        ) : (
          <PageKindIcon template={page.template ?? null} hasChildren={page.hasChildren} size={26} />
        )}
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <IconPanel value={page.icon} onPick={(icon) => save.mutate(icon)} />
          <FormError message={save.error ? errorText(save.error) : null} />
        </div>
      )}
    </div>
  )
}

/** Cuántos iconos se proponen al escribir «:» en un título */
const SUGGESTED = 16

/**
 * Los iconos de la app que casan con lo escrito tras «:» al principio de un título (los más parecidos; sin nada, los
 * primeros destacados). Mientras llega su lista, ninguno
 */
export function titleIcons(query: string) {
  const catalog = loadedGameIcons()
  if (!catalog) return []
  return (query.trim() ? catalog.searchGameIcons(query) : catalog.FEATURED_GAME_ICONS).slice(0, SUGGESTED)
}

/**
 * Lo que se propone al escribir «:» al principio de un título (como «/» y «@» en el texto): los iconos de la app que
 * casan con lo que sigue. El foco se queda en el título (las flechas mueven la elegida, Intro la pone, Escape lo
 * deja); con el ratón, pulsar uno no saca del título
 */
export function TitleIconSuggestions({
  id,
  query,
  active,
  onPick,
  onHover
}: {
  id: string
  query: string
  active: number
  onPick: (icon: string) => void
  onHover: (index: number) => void
}) {
  const { t } = useTranslation()
  // Se vuelve a pintar cuando llega la lista
  useGameIcons()
  const shown = titleIcons(query)
  const list = useRef<HTMLDivElement>(null)
  // La elegida, siempre a la vista
  useEffect(() => {
    list.current?.querySelector(`[data-at="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])
  return (
    <div className={styles.suggest}>
      <p className={styles.suggestHead}>{query ? t('icon.suggestFor', { query }) : t('icon.suggest')}</p>
      {shown.length === 0 ? (
        <p className={styles.suggestNone}>{t('icon.noneFound')}</p>
      ) : (
        <div ref={list} id={id} role="listbox" aria-label={t('icon.suggest')} className={styles.suggestList}>
          {shown.map((icon, index) => (
            <div
              key={icon.id}
              id={`${id}-${index}`}
              data-at={index}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className={styles.suggestOption}
              title={icon.label}
              // Sin quitarle el foco al título
              onPointerDown={(event) => {
                event.preventDefault()
                onPick(`gi:${icon.id}`)
              }}
              onPointerEnter={() => onHover(index)}
            >
              <Icon value={`gi:${icon.id}`} size={22} />
              <span>{icon.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * El icono en un formulario (el de una carpeta, un sistema…): un botón con el de ahora que abre, flotando debajo (sin
 * empujar la ventana), los mismos iconos de la app que en una página, y quitarlo. Escape o pulsar fuera lo cierran y el
 * foco vuelve al botón
 */
export function IconChoices({ value, onChange }: { value: string | null; onChange: (icon: string | null) => void }) {
  const { t } = useTranslation()
  const [browsing, setBrowsing] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const legendId = useId()
  const label = useIconLabel(value)
  useEffect(() => {
    if (!browsing) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrap.current?.contains(event.target)) setBrowsing(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [browsing])
  const pick = (icon: string | null) => {
    onChange(icon)
    setBrowsing(false)
    button.current?.focus()
  }
  return (
    <fieldset className={cards.choices}>
      <legend id={legendId}>{t('icon.short')}</legend>
      <div ref={wrap} className={styles.choiceWrap}>
        <button
          ref={button}
          type="button"
          className={styles.choiceTrigger}
          aria-expanded={browsing}
          aria-describedby={legendId}
          onClick={() => setBrowsing(!browsing)}
        >
          {value ? <Icon value={value} size={20} /> : <CircleOff aria-hidden="true" size={16} />}
          <span>{value ? (label ?? t('icon.short')) : t('icon.none')}</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
        {browsing && (
          // biome-ignore lint/a11y/noStaticElementInteractions: Escape cierra el buscador sin cerrar la ventana de debajo
          <div
            className={styles.floatingBrowser}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              setBrowsing(false)
              button.current?.focus()
            }}
          >
            <IconPanel value={value} onPick={pick} />
          </div>
        )}
      </div>
    </fieldset>
  )
}
