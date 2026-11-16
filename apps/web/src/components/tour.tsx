import { autoUpdate, computePosition, flip, offset, type Placement, shift } from '@floating-ui/dom'
import { CircleHelp } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
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

/** Lo que señala un paso: lo primero que se vea de su selector (con varios, el de la barra o, en el móvil, otro) */
function find(selector: string): Element | null {
  for (const element of document.querySelectorAll(selector))
    if (typeof element.checkVisibility !== 'function' || element.checkVisibility()) return element
  return null
}

/**
 * Los recorridos montados a la vez (el de la vista y, dentro, el de un mapa o el de los dados): sale uno solo cada vez
 * (el siguiente espera a que acabe el que está en marcha) y un solo «?», el del último montado (el más concreto)
 */
const mounted: string[] = []
let running: string | null = null
let version = 0
const listeners = new Set<() => void>()
const changed = () => {
  version++
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = () => version

/**
 * El recorrido de una pantalla: un globo junto a cada parte dice qué es («1 de 3», Atrás, Siguiente). Sale solo la
 * primera vez, hasta acabarlo; después, con el botón «?» que pinta este componente (va junto al título de la
 * pantalla). Los pasos cuyo elemento no está en la pantalla se saltan
 */
export function Tour({
  id,
  steps,
  helpInPlace = false
}: {
  id: string
  steps: readonly TourStep[]
  /** El «?» junto a su sitio (en una ficha flotante, la de los dados), no en la esquina de la pantalla */
  helpInPlace?: boolean
}) {
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
  const key = useId()
  useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => {
    mounted.push(key)
    changed()
    return () => {
      mounted.splice(mounted.indexOf(key), 1)
      if (running === key) running = null
      changed()
    }
  }, [key])
  const top = mounted[mounted.length - 1] === key
  const busy = running !== null && running !== key

  const start = () => {
    if (busy) return
    // Solo lo que se ve: en el móvil, lo de la barra que va en «Más» no está
    const present = latest.current.filter((step) => {
      return find(step.target) !== null
    })
    if (present.length === 0) return
    started.current = true
    running = key
    changed()
    returnTo.current = document.activeElement
    setVisible(present)
    setIndex(0)
  }
  // Se cierra (acabado o no) y deja salir al siguiente que espera
  const stop = () => {
    setIndex(null)
    if (running === key) {
      running = null
      changed()
    }
  }

  // La primera vez: un momento después de entrar, cuando ya está pintado
  useEffect(() => {
    if (!email || opened || busy || started.current || readSeen(email).includes(id)) return
    const timer = window.setTimeout(start, 400)
    return () => window.clearTimeout(timer)
  }, [email, id, opened, busy])

  const step = index === null ? undefined : visible[index]

  // El globo junto a su elemento y el aro alrededor; siguen al elemento si la pantalla se mueve
  useLayoutEffect(() => {
    const target = step ? find(step.target) : null
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
        const other = find(also.target)
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
      // Lo que ocupa casi toda la pantalla (el mapa de la Mesa) no deja sitio fuera: el globo, en su centro
      const rect = target.getBoundingClientRect()
      if (rect.height > window.innerHeight * 0.6 && rect.width > window.innerWidth * 0.5) {
        const top = Math.max(rect.top, 0) + Math.min(rect.height, window.innerHeight) / 2 - element.offsetHeight / 2
        const left = rect.left + rect.width / 2 - element.offsetWidth / 2
        Object.assign(element.style, { left: `${left}px`, top: `${top}px` })
        return
      }
      // Lo de la página no va encima de la barra de la izquierda (lo de la barra, sí: va a su lado)
      const bar = document.querySelector('[data-tour="barra-llama"]')?.closest('nav')
      const left = bar && !bar.parentElement?.contains(target) ? bar.getBoundingClientRect().right + 12 : 12
      const padding = { top: 12, right: 12, bottom: 12, left }
      void computePosition(target, element, {
        strategy: 'fixed',
        placement: step.placement ?? 'bottom',
        middleware: [offset(14), flip({ padding }), shift({ padding })]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [step])

  // Escape lo cierra (sin acabarlo) esté donde esté el foco: el globo no lo atrapa, y tras un Tab ya no está en él
  useEffect(() => {
    if (index === null) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      stop()
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index])

  // El «?»: vuelve a sacar el recorrido cuando se quiera (solo el del recorrido más concreto de los montados)
  // En el body: dentro de la página (su propia capa) quedaba debajo de lo demás y los botones de la wiki lo hacían
  // cuadrado (Enrique, 2026-11-16: «se ha ido al fondo … y sale cuadrado»)
  const button = (
    <button type="button" className={styles.help} aria-label={t('tour.again')} title={t('tour.again')} onClick={start}>
      <CircleHelp aria-hidden="true" size={18} />
    </button>
  )
  const help = top && (helpInPlace ? button : createPortal(button, document.body))
  if (!step || index === null || !email) return help
  // Con Escape se cierra sin acabarlo: volverá a salir la próxima vez
  const close = (finished: boolean) => {
    if (finished) markSeen(email, id)
    stop()
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
  }
  const last = index === visible.length - 1
  return (
    <>
      {help}
      {/* En el body: dentro del contenido (que es su propia capa en las transiciones) quedaba debajo de la barra de la
          izquierda (Enrique, 2026-11-13: «el tutorial en libros … se ve por debajo de la barra») */}
      {createPortal(
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
          <div ref={bubble} role="dialog" aria-labelledby={titleId} className={styles.bubble}>
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
        </>,
        document.body
      )}
    </>
  )
}
