/**
 * Las piezas que flotan sobre el grafo de relaciones (módulo 10): el zoom (abajo a la derecha), la leyenda de los trazos
 * (abajo a la izquierda) y la ficha de la página elegida (arriba a la derecha), con «Abrir» y «Centrar aquí» (en el del
 * mundo) o «Sus relaciones» (en el de una página: las añade al grafo)
 */
import type { RelationNode } from '@crisol/contracts'
import { Crosshair, ExternalLink, Minus, Plus, X } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NodeGlyphBox } from './glyph.tsx'
import type { WordsRow } from './model.ts'
import styles from './relations.module.css'

/** − 100 % +; pulsar el tanto por ciento lo encuadra todo */
export function ZoomControls({
  scale,
  onZoom,
  onFit
}: {
  scale: number
  onZoom: (factor: number) => void
  onFit: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.zoom} role="toolbar" aria-label={t('relations.zoom.label')}>
      <button
        type="button"
        aria-label={t('relations.zoom.out')}
        title={t('relations.zoom.out')}
        onClick={() => onZoom(1 / 1.25)}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.zoomValue} title={t('relations.zoom.fit')} onClick={onFit}>
        <span className={styles.hidden}>{t('relations.zoom.fit')}: </span>
        {Math.round(scale * 100)} %
      </button>
      <button
        type="button"
        aria-label={t('relations.zoom.in')}
        title={t('relations.zoom.in')}
        onClick={() => onZoom(1.25)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/** La leyenda de los trazos: campo, menciona y, al máster, lo que sale de un secreto */
export function Legend({ secrets }: { secrets: boolean }) {
  const { t } = useTranslation()
  const rows = [
    ['field', t('relations.legend.field')],
    ['mention', t('relations.legend.mention')],
    ...(secrets ? [['secret', t('relations.legend.secret')]] : [])
  ] as const
  return (
    <ul className={styles.legend} aria-label={t('relations.legend.label')}>
      {rows.map(([kind, name]) => (
        <li key={kind}>
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              className={styles.edge}
              data-kind={kind === 'secret' ? 'field' : kind}
              data-secret={kind === 'secret' || undefined}
            />
          </svg>
          {name}
        </li>
      ))}
    </ul>
  )
}

/**
 * La página elegida en el grafo: pulsar o Intro la eligen; elegida con el teclado, el foco va a su ficha; al cerrarla
 * (su X o Escape, con el foco donde sea salvo escribiendo), el foco vuelve a su nodo
 */
export function useSelection() {
  const [selected, setSelected] = useState<string | null>(null)
  const [focusCard, setFocusCard] = useState(false)
  const select = useCallback((id: string | null, viaKeyboard = false) => {
    setSelected(id)
    setFocusCard(viaKeyboard && id !== null)
  }, [])
  const close = useCallback(() => {
    setSelected((id) => {
      if (id)
        requestAnimationFrame(() =>
          document.querySelector<SVGElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
        )
      return null
    })
  }, [])
  useEffect(() => {
    if (!selected) return
    const onEscape = (event: KeyboardEvent) => {
      const target = event.target as Element | null
      if (event.key !== 'Escape' || target?.closest('input, textarea, select, [role="dialog"] [role="dialog"]')) return
      close()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [selected, close])
  return { selected, select, close, focusCard }
}

/**
 * La ficha de la página elegida: su icono, su nombre, su plantilla y su primer campo, sus relaciones en palabras,
 * «Abrir» y «Centrar aquí» o «Sus relaciones» (Escape la cierra: useSelection)
 */
export function NodeCard({
  node,
  color,
  meta,
  rows,
  primary,
  onOpen,
  onCenter = null,
  onExpand = null,
  onClose,
  autoFocus = false
}: {
  node: RelationNode
  color: string
  meta: string
  rows: readonly WordsRow[]
  /** El botón principal: «Abrir», «Centrar aquí» o «Sus relaciones» */
  primary: 'center' | 'open' | 'expand'
  onOpen: () => void
  /** Llevar la vista a ella (el grafo del mundo) */
  onCenter?: (() => void) | null
  /** Añadir sus relaciones al grafo (el de una página; null si ya están) */
  onExpand?: (() => void) | null
  onClose: () => void
  /** Elegida con el teclado: el foco, a la ficha */
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    if (autoFocus && node.id) box.current?.focus({ preventScroll: true })
  }, [autoFocus, node.id])
  return (
    <section
      ref={box}
      tabIndex={-1}
      className={styles.card}
      aria-label={node.title}
      data-node-card=""
      style={{ '--node-color': color } as CSSProperties}
    >
      <header className={styles.cardHead}>
        <NodeGlyphBox node={node} />
        <div>
          <h3>{node.title}</h3>
          {meta && <p>{meta}</p>}
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={t('relations.close')}
          title={t('relations.close')}
          onClick={onClose}
          data-card-close=""
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {rows.length > 0 && (
        <dl className={styles.words}>
          {rows.slice(0, 6).map((row) => (
            <div key={`${row.label}-${row.secret}`} data-secret={row.secret || undefined}>
              <dt>{row.label}</dt>
              <dd>{row.pages.map((page) => page.title).join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className={styles.cardActions}>
        <button type="button" className={primary === 'open' ? styles.primary : styles.secondary} onClick={onOpen}>
          <ExternalLink size={16} aria-hidden="true" />
          {t('relations.open')}
        </button>
        {onCenter && (
          <button type="button" className={primary === 'center' ? styles.primary : styles.secondary} onClick={onCenter}>
            <Crosshair size={16} aria-hidden="true" />
            {t('relations.centerHere')}
          </button>
        )}
        {onExpand && (
          <button type="button" className={primary === 'expand' ? styles.primary : styles.secondary} onClick={onExpand}>
            <Plus size={16} aria-hidden="true" />
            {t('relations.expandHere')}
          </button>
        )}
      </div>
    </section>
  )
}

/** Un interruptor con su nombre (como «Solo campos») */
export function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span aria-hidden="true" className={styles.track} />
      {label}
    </label>
  )
}

export type { RelationNode }
