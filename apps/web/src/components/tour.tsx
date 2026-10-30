import { autoUpdate, computePosition, flip, offset, type Placement, shift } from '@floating-ui/dom'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import styles from './tour.module.css'
import { useWindow } from './window.tsx'

/** Un paso del recorrido: a qué apunta (un selector, normalmente [data-tour="…"]) y qué dice */
export interface TourStep {
  target: string
  text: string
  placement?: Placement
  /** Lo que se resalta también en este paso (lo relacionado, sin un paso propio), con su nota si la lleva */
  also?: readonly { target: string; text?: string; placement?: Placement }[]
}

const STORAGE = 'crisol.recorridos'

/** Lo que se guarda por cuenta: si salen los recorridos y cuáles ya tiene claros */
interface ToursState {
  off: boolean
  clear: string[]
}

const keyFor = (email: string) => `${STORAGE}.${email}`

function readState(email: string): ToursState {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(email)) ?? '{}') as Partial<ToursState>
    return {
      off: value.off === true,
      clear: Array.isArray(value.clear) ? value.clear.filter((item): item is string => typeof item === 'string') : []
    }
  } catch {
    return { off: false, clear: [] }
  }
}

function writeState(email: string, state: ToursState) {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(state))
  } catch {
    // Sin almacenamiento, los recorridos salen como siempre
  }
}

/** Para «Ajustes»: si salen todos. Con uno marcado «Lo tengo claro», la casilla se ve sin marcar */
export function toursEnabled(email: string) {
  const state = readState(email)
  return !state.off && state.clear.length === 0
}

/** Encenderlos los vuelve a sacar todos (también los que se tenían claros); apagarlos, ninguno */
export function setToursEnabled(email: string, enabled: boolean) {
  writeState(email, { off: !enabled, clear: [] })
}

/**
 * Un recorrido por una pantalla: al entrar, un globo junto a cada parte dice qué es («1 de 3», Saltar, Atrás,
 * Siguiente). Los pasos cuyo elemento no está en la pantalla se saltan. Sale cada vez hasta que se marca «Lo tengo
 * claro»; en Ajustes se apagan todos o se vuelven a encender, y al cerrar Ajustes vuelve a salir si se había saltado
 */
export function Tour({ id, steps }: { id: string; steps: readonly TourStep[] }) {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const [index, setIndex] = useState<number | null>(null)
  const [visible, setVisible] = useState<TourStep[]>([])
  const bubble = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const extra = useRef<HTMLDivElement[]>([])
  const notes = useRef<HTMLParagraphElement[]>([])
  const next = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<Element | null>(null)
  const titleId = useId()
  const clearId = useId()
  const [understood, setUnderstood] = useState(false)
  const email = account?.email
  // Los pasos llegan nuevos en cada pintado: se leen al empezar, sin volver a empezar el recorrido
  const latest = useRef(steps)
  latest.current = steps
  // Sale una vez por visita, y otra al cerrar Ajustes si no está en pantalla (la casilla marcada dice que sale)
  const started = useRef(false)
  const opened = useWindow()?.opened ?? null
  const lastWindow = useRef(opened)

  // Al entrar, si no se ha visto: los pasos que tienen dónde apuntar (un momento después, cuando ya está pintado).
  // Con una ventana abierta espera a que se cierre
  useEffect(() => {
    const closed = lastWindow.current
    lastWindow.current = opened
    if (!email || opened) return
    if (closed === 'ajustes' && index === null) started.current = false
    if (started.current) return
    const state = readState(email)
    if (state.off || state.clear.includes(id)) return
    const timer = window.setTimeout(() => {
      const present = latest.current.filter((step) => document.querySelector(step.target))
      if (present.length === 0) return
      started.current = true
      returnTo.current = document.activeElement
      setUnderstood(false)
      setVisible(present)
      setIndex(0)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [email, id, opened])

  const step = index === null ? undefined : visible[index]

  // El globo junto a su elemento y el aro alrededor; siguen al elemento si la pantalla se mueve
  useLayoutEffect(() => {
    const target = step ? document.querySelector(step.target) : null
    const element = bubble.current
    const halo = ring.current
    if (!step || !target || !element || !halo) return
    target.scrollIntoView({ block: 'nearest' })
    next.current?.focus()
    const around = (box: HTMLElement, of: Element) => {
      const rect = of.getBoundingClientRect()
      Object.assign(box.style, {
        left: `${rect.left - 6}px`,
        top: `${rect.top - 6}px`,
        width: `${rect.width + 12}px`,
        height: `${rect.height + 12}px`
      })
    }
    return autoUpdate(target, element, () => {
      around(halo, target)
      ;(step.also ?? []).forEach((also, i) => {
        const other = document.querySelector(also.target)
        const box = extra.current[i]
        if (!other || !box) return
        around(box, other)
        const note = notes.current[i]
        if (!note) return
        void computePosition(other, note, {
          strategy: 'fixed',
          placement: also.placement ?? 'right',
          middleware: [offset(14), flip({ padding: 12 }), shift({ padding: 12 })]
        }).then(({ x, y }) => Object.assign(note.style, { left: `${x}px`, top: `${y}px` }))
      })
      void computePosition(target, element, {
        strategy: 'fixed',
        placement: step.placement ?? 'bottom',
        middleware: [offset(14), flip({ padding: 12 }), shift({ padding: 12 })]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [step])

  if (!step || index === null || !email) return null
  const close = () => {
    // Solo si se marcó «Lo tengo claro», no vuelve a salir
    if (understood) {
      const state = readState(email)
      writeState(email, { ...state, clear: [...new Set([...state.clear, id])] })
    }
    setIndex(null)
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
  }
  const last = index === visible.length - 1
  return (
    <>
      <div ref={ring} aria-hidden="true" className={styles.ring} />
      {(step.also ?? []).map((also, i) => (
        <div key={also.target}>
          <div
            ref={(box) => {
              if (box) extra.current[i] = box
            }}
            aria-hidden="true"
            className={styles.also}
          />
          {also.text && (
            <p
              ref={(note) => {
                if (note) notes.current[i] = note
              }}
              className={styles.note}
            >
              {also.text}
            </p>
          )}
        </div>
      ))}
      <div
        ref={bubble}
        role="dialog"
        aria-labelledby={titleId}
        className={styles.bubble}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      >
        <p id={titleId} className={styles.text}>
          {step.text}
        </p>
        {/* Solo en el último paso: al acabarlo se decide si vuelve a salir */}
        {last && (
          <label className={styles.clear} htmlFor={clearId}>
            <input
              id={clearId}
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.currentTarget.checked)}
            />
            {t('tour.understood')}
          </label>
        )}
        <div className={styles.footer}>
          <span className={styles.count}>{t('tour.count', { current: index + 1, total: visible.length })}</span>
          {!last && (
            <button type="button" className={styles.skip} onClick={close}>
              {t('tour.skip')}
            </button>
          )}
          {index > 0 && (
            <button type="button" className={styles.back} onClick={() => setIndex(index - 1)}>
              {t('tour.back')}
            </button>
          )}
          <button
            ref={next}
            type="button"
            className={styles.next}
            onClick={() => (last ? close() : setIndex(index + 1))}
          >
            {t(last ? 'tour.done' : 'tour.next')}
          </button>
        </div>
      </div>
    </>
  )
}
