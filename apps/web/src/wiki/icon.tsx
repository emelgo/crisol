import type { Page } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, CircleOff } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { Icon, iconLabel } from '../components/icon.tsx'
import { IconBrowser, iconsMatching } from '../components/icon-browser.tsx'
import cards from '../routes/world-card.module.css'
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

/**
 * El icono de la página, delante de su título: pulsarlo abre una caja (patrón de despliegue, como el menú de la
 * cuenta) con los iconos de la app y quitarlo. Escape, pulsar fuera o salir con el tabulador la cierran. Sin icono no
 * se ve: se pone desde el propio título (un emoji delante, o «:» y su nombre)
 */
export function PageIcon({
  page,
  style,
  elemento
}: {
  page: Page & { icon: string }
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
  const save = useMutation({
    mutationFn: (icon: string | null) => api.call('updatePage', { pageId: page.id, icon }),
    onSuccess: async (_, icon) => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      setOpen(false)
      // Quitado, el botón ya no está: el foco, al título
      if (icon) trigger.current?.focus()
      else wrapper.current?.parentElement?.querySelector<HTMLElement>('[role="textbox"]')?.focus()
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
        aria-label={t('icon.change', { icon: iconLabel(page.icon) })}
        onClick={() => setOpen(!open)}
      >
        <Icon value={page.icon} />
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

/** Los iconos de la app que casan con lo escrito tras «:» al principio de un título (los primeros) */
export function titleIcons(query: string) {
  return iconsMatching(query).slice(0, SUGGESTED)
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
          <span>{value ? iconLabel(value) : t('icon.none')}</span>
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
