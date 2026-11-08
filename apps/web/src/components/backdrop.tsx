import { type CSSProperties, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Backdrop as Art, BACKDROPS } from '../account/backdrops.ts'
import styles from './backdrop.module.css'

/** Cuánto se ve cada imagen antes de pasar a la siguiente (el fundido, en el CSS) */
const SHOWN_MS = 8000

const urlOf = (art: Art) => `/fondos/${art.file}.webp`

/** Un orden al azar en cada visita (Fisher-Yates) */
function shuffled(count: number) {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j] as number, order[i] as number]
  }
  return order
}

/**
 * El fondo de las pantallas de cuenta, como en LegendKeeper (Enrique, 2026-11-08): las imágenes van pasando con un
 * fundido, cada una acercándose despacio, con un degradado teñido de su color y su autor abajo. De adorno: el lector de
 * pantalla solo lee el crédito
 */
export function Backdrop() {
  const { t } = useTranslation()
  const [order] = useState(() => shuffled(BACKDROPS.length))
  const [step, setStep] = useState(0)
  const at = (n: number) => BACKDROPS[order[n % order.length] as number] as Art
  useEffect(() => {
    // La siguiente, ya pedida: cuando le toca, entra sin esperar
    const next = new Image()
    next.src = urlOf(at(step + 1))
    const timer = window.setTimeout(() => setStep((current) => current + 1), SHOWN_MS)
    return () => window.clearTimeout(timer)
  }, [step])
  const current = at(step)
  // La de antes se queda debajo mientras la nueva aparece encima
  const layers = step > 0 ? [step - 1, step] : [step]
  return (
    <div className={styles.backdrop}>
      {layers.map((n) => {
        const art = at(n)
        return (
          <div
            key={n}
            className={styles.layer}
            data-dir={n % 2 === 0 ? 'a' : 'b'}
            style={{ '--tint': art.tint } as CSSProperties}
            aria-hidden="true"
          >
            <img src={urlOf(art)} alt="" className={styles.image} decoding="async" />
          </div>
        )
      })}
      <p key={step} className={styles.credit}>
        <a href={current.source} target="_blank" rel="noopener noreferrer">
          {t('backdrop.credit', {
            title: current.title,
            author: current.year ? `${current.author}, ${current.year}` : current.author
          })}
        </a>
      </p>
    </div>
  )
}
