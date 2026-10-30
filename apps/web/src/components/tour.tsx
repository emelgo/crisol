import { autoUpdate, computePosition, flip, offset, type Placement, shift } from '@floating-ui/dom'
import { CircleHelp } from 'lucide-react'
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

const keyFor = (email: string) => `${STORAGE}.${email}`

/** Los recorridos que la cuenta ya ha hecho hasta el final (en este navegador) */
function readSeen(email: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(email)) ?? '{}') as { seen?: unknown }
    return Array.isArray(value.seen) ? value.seen.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function markSeen(email: string, id: string) {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify({ seen: [...new Set([...readSeen(email), id])] }))
  } catch {
    // Sin almacenamiento, el recorrido vuelve a salir la próxima vez
  }
}

/**
 * El recorrido de una pantalla: un globo junto a cada parte dice qué es («1 de 3», Atrás, Siguiente). Sale solo la
 * primera vez, hasta acabarlo; después, con el botón «?» que pinta este componente (va junto al título de la
 * pantalla). Los pasos cuyo elemento no está en la pantalla se saltan
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
  const email = account?.email
  // Los pasos llegan nuevos en cada pintado: se leen al empezar, sin volver a empezar el recorrido
  const latest = useRef(steps)
  latest.current = steps
  // Sale solo una vez por visita, y no con una ventana abierta encima (espera a que se cierre)
  const started = useRef(false)
  const opened = useWindow()?.opened ?? null

  const start = () => {
    const present = latest.current.filter((step) => document.querySelector(step.target))
    if (present.length === 0) return
    started.current = true
    returnTo.current = document.activeElement
    setVisible(present)
    setIndex(0)
  }

  // La primera vez: un momento después de entrar, cuando ya está pintado
  useEffect(() => {
    if (!email || opened || started.current || readSeen(email).includes(id)) return
    const timer = window.setTimeout(start, 400)
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

  // El «?»: vuelve a sacar el recorrido cuando se quiera
  const help = (
    <button type="button" className={styles.help} aria-label={t('tour.again')} title={t('tour.again')} onClick={start}>
      <CircleHelp aria-hidden="true" size={18} />
    </button>
  )
  if (!step || index === null || !email) return help
  // Con Escape se cierra sin acabarlo: volverá a salir la próxima vez
  const close = (finished: boolean) => {
    if (finished) markSeen(email, id)
    setIndex(null)
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
  }
  const last = index === visible.length - 1
  return (
    <>
      {help}
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
          if (event.key === 'Escape') close(false)
        }}
      >
        <p id={titleId} className={styles.text}>
          {step.text}
        </p>
        <div className={styles.footer}>
          <span className={styles.count}>{t('tour.count', { current: index + 1, total: visible.length })}</span>
          {index > 0 && (
            <button type="button" className={styles.back} onClick={() => setIndex(index - 1)}>
              {t('tour.back')}
            </button>
          )}
          <button
            ref={next}
            type="button"
            className={styles.next}
            onClick={() => (last ? close(true) : setIndex(index + 1))}
          >
            {t(last ? 'tour.done' : 'tour.next')}
          </button>
        </div>
      </div>
    </>
  )
}
