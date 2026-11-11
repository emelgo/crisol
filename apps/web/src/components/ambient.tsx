/**
 * El fondo de ambiente (tanda 5, «Crisol, con cristal»): el cristal solo luce con algo detrás, y fuera de la Mesa no
 * hay mapa. Detrás de todo, fija, una imagen muy difuminada y tenue: en un mundo, su portada; en Inicio, la del mundo
 * en el que uno se para; si no, la de ambiente. Lo que enmarca va encima de cristal (sin backdrop-filter: el fondo ya
 * viene difuminado, así que no cuesta nada al bajar). Con «Sin desenfoque» (Ajustes) no sale: todo opaco, como antes.
 * De cada imagen se usa una miniatura ya difuminada (pesa poco y apenas hay que pintar) y su luz pone el tope: con una
 * portada clara (nieve, un desierto a mediodía) va más tenue, para que el texto de encima se siga leyendo
 */
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './ambient.module.css'
import { usePlain } from './plain.ts'

/** La de siempre, si nadie pide otra */
export const DEFAULT_AMBIENT = '/ambiente/inicio.webp'

/** Lo más que se ve la imagen, y lo menos (con una muy clara) */
const MOST = 0.32
const LEAST = 0.08
/** La luz que puede tener el fondo en su parte más clara: el texto apagado encima, a 5:1; los títulos rojos, a 3:1 */
const BRIGHTEST = 0.03
/** El color de debajo (--color-bg), en sRGB */
const BASE = [0x17, 0x18, 0x1b] as const

// Quien pide un fondo (una pantalla, un mundo), en el orden en que se montan: manda el último
const wanted: { key: symbol; url: string | null }[] = []
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const current = () => wanted.at(-1)?.url ?? DEFAULT_AMBIENT

/** Pide el fondo mientras se ve: url de una imagen (la portada de un mundo) o null para la de siempre */
export function useAmbient(url: string | null | undefined) {
  const key = useRef(Symbol('ambiente')).current
  useLayoutEffect(() => {
    wanted.push({ key, url: null })
    return () => {
      const at = wanted.findIndex((entry) => entry.key === key)
      if (at >= 0) wanted.splice(at, 1)
      emit()
    }
  }, [key])
  useLayoutEffect(() => {
    const entry = wanted.find((item) => item.key === key)
    if (!entry) return
    entry.url = url ?? null
    emit()
  }, [key, url])
}

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** Cuánto se puede ver una imagen cuyo punto claro es (r, g, b) para que, sobre el fondo, no pase de BRIGHTEST */
export function ambientAlpha(r: number, g: number, b: number) {
  for (let alpha = MOST; alpha > LEAST; alpha -= 0.01) {
    const mix = (from: number, to: number) => from * (1 - alpha) + to * alpha
    if (luminance(mix(BASE[0], r), mix(BASE[1], g), mix(BASE[2], b)) <= BRIGHTEST) return Math.round(alpha * 100) / 100
  }
  return LEAST
}

type Prepared = { src: string; alpha: number }
const prepared = new Map<string, Promise<Prepared>>()

/** La miniatura difuminada de una imagen y su tope (si no se puede, la imagen tal cual y el tope de una oscura) */
function prepare(url: string): Promise<Prepared> {
  const known = prepared.get(url)
  if (known) return known
  const work = (async () => {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    // Pequeña y ya difuminada: estirada se ve suave sin filtro en directo (el compositor no desenfoca nada al bajar)
    const width = 64
    const height = Math.max(1, Math.round((image.naturalHeight * width) / image.naturalWidth))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('sin lienzo')
    context.filter = 'blur(2px)'
    context.drawImage(image, -3, -3, width + 6, height + 6)
    // El punto claro: el del 97 % (un brillo suelto no cuenta)
    const { data } = context.getImageData(0, 0, width, height)
    const points: [number, number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
      points.push([luminance(r, g, b), r, g, b])
    }
    points.sort((a, b) => a[0] - b[0])
    const [, r, g, b] = points[Math.floor(points.length * 0.97)] ?? [0, 0, 0, 0]
    return { src: canvas.toDataURL('image/webp', 0.85), alpha: ambientAlpha(r, g, b) }
  })().catch(() => ({ src: url, alpha: ambientAlpha(140, 110, 90) }))
  prepared.set(url, work)
  return work
}

export function Ambient() {
  const url = useSyncExternalStore(subscribe, current, current)
  const plain = usePlain()
  // La nueva aparece encima de la de antes, que se va al acabar el fundido; si llega otra en pleno fundido, sustituye
  // a la de encima (la de debajo, entera, se queda: el fondo no da un bajón)
  const [layers, setLayers] = useState<(Prepared & { n: number })[]>([])
  useEffect(() => {
    let live = true
    void prepare(url).then((next) => {
      if (!live) return
      setLayers((all) => {
        const n = (all.at(-1)?.n ?? 0) + 1
        if (all.at(-1)?.src === next.src) return all
        return all.length > 1 ? [all[0] as Prepared & { n: number }, { ...next, n }] : [...all, { ...next, n }]
      })
    })
    return () => {
      live = false
    }
  }, [url])
  if (plain) return null
  return (
    <div className={styles.ambient} aria-hidden="true" data-ambiente={url}>
      {layers.map((layer, index) => (
        <div
          key={layer.n}
          className={styles.layer}
          style={{ backgroundImage: `url("${layer.src}")`, '--alpha': layer.alpha } as CSSProperties}
          onAnimationEnd={() => {
            if (index === layers.length - 1 && layers.length > 1) setLayers((all) => all.slice(-1))
          }}
        />
      ))}
    </div>
  )
}
