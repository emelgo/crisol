/**
 * El fondo de ambiente (tanda 5, «Crisol, con cristal»): el cristal solo luce con algo detrás, y fuera de la Mesa no
 * hay mapa. Detrás de todo, fija, una imagen suave y tenue: en un mundo, su portada; en Inicio, la del mundo en el que
 * uno se para; si no, la de ambiente. Lo que enmarca va encima, de cristal (desenfoca lo de detrás). Con «Sin
 * desenfoque» (Ajustes) no sale: todo opaco, como antes. De cada imagen se hace una copia pequeña, suavizada y ya
 * mezclada con el color de fondo (opaca: al pasar de una a otra se funden sin sumar luz), y su luz pone el tope: con una
 * portada clara (nieve, un desierto a mediodía) va más tenue, para que el texto de encima se siga leyendo
 */
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './ambient.module.css'
import { usePlain } from './plain.ts'

/** La de siempre, si nadie pide otra */
export const DEFAULT_AMBIENT = '/ambiente/inicio.webp'

/** Lo más que se ve la imagen, y lo menos (con una muy clara) */
const MOST = 0.62
const LEAST = 0.16
/** La luz que puede tener el fondo en su parte más clara (el texto va sobre el cristal, que lo oscurece y lo desenfoca) */
const BRIGHTEST = 0.09
/** El color de debajo: el de --color-bg (si no se puede leer, el de siempre), en sRGB */
const baseColor = (): readonly [number, number, number] => {
  const value =
    typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--color-bg')
  const hex = value.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  return hex
    ? [Number.parseInt(hex[1] ?? '17', 16), Number.parseInt(hex[2] ?? '18', 16), Number.parseInt(hex[3] ?? '1b', 16)]
    : [0x17, 0x18, 0x1b]
}

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
  const base = baseColor()
  for (let alpha = MOST; alpha > LEAST; alpha -= 0.01) {
    const mix = (from: number, to: number) => from * (1 - alpha) + to * alpha
    if (luminance(mix(base[0], r), mix(base[1], g), mix(base[2], b)) <= BRIGHTEST) return Math.round(alpha * 100) / 100
  }
  return LEAST
}

type Prepared = { src: string; alpha: number }
const prepared = new Map<string, Promise<Prepared>>()
/** Las ya hechas, para ponerlas sin esperar (al volver a una vista, la misma de antes, sin fundido) */
const ready = new Map<string, Prepared>()
/** La última que se vio: al volver a montarse (tras la Mesa, por ejemplo), sale ya puesta */
let lastShown: Prepared | null = null

/** La copia suave de una imagen, ya mezclada con el fondo (si no se puede, la imagen tal cual con su tope) */
function prepare(url: string): Promise<Prepared> {
  const known = prepared.get(url)
  if (known) return known
  const work = (async () => {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    // Suavizada sin filtro (el desenfoque del lienzo deja una rejilla en algunos navegadores): se reduce mucho y se
    // vuelve a agrandar; el cristal de encima la desenfoca del todo
    const width = 640
    const height = Math.max(1, Math.round((image.naturalHeight * width) / image.naturalWidth))
    const small = document.createElement('canvas')
    small.width = 160
    small.height = Math.max(1, Math.round((height * 160) / width))
    const smallContext = small.getContext('2d')
    if (!smallContext) throw new Error('sin lienzo')
    smallContext.imageSmoothingQuality = 'high'
    smallContext.drawImage(image, 0, 0, small.width, small.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('sin lienzo')
    context.imageSmoothingQuality = 'high'
    context.drawImage(small, 0, 0, width, height)
    // El punto claro: el del 97 % (un brillo suelto no cuenta)
    const { data } = context.getImageData(0, 0, width, height)
    const points: [number, number, number, number][] = []
    for (let i = 0; i < data.length; i += 16) {
      const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
      points.push([luminance(r, g, b), r, g, b])
    }
    points.sort((a, b) => a[0] - b[0])
    const [, r, g, b] = points[Math.floor(points.length * 0.97)] ?? [0, 0, 0, 0]
    const alpha = ambientAlpha(r, g, b)
    // Mezclada con el color de fondo: opaca
    const mixed = document.createElement('canvas')
    mixed.width = width
    mixed.height = height
    const out = mixed.getContext('2d')
    if (!out) throw new Error('sin lienzo')
    const [br, bg, bb] = baseColor()
    out.fillStyle = `rgb(${br} ${bg} ${bb})`
    out.fillRect(0, 0, width, height)
    out.globalAlpha = alpha
    out.drawImage(canvas, 0, 0)
    return { src: mixed.toDataURL('image/webp', 0.95), alpha: 1 }
  })().catch(() => ({ src: url, alpha: ambientAlpha(140, 110, 90) }))
  prepared.set(url, work)
  void work.then((done) => ready.set(url, done))
  return work
}

type Layer = Prepared & { n: number; still?: boolean }

/** Prepararla ya (las portadas de los mundos de Inicio): al entrar en uno, su fondo está listo para la transición */
export const prepareAmbient = (url: string) => void prepare(url)

/** ¿En plena transición de vista? (la foto de lo nuevo se toma ahora: el fondo nuevo, ya puesto) */
const inTransition = () => {
  try {
    return document.documentElement.matches(':active-view-transition')
  } catch {
    return false
  }
}

/** La nueva, encima de la de antes; si ya había dos (en pleno fundido), en lugar de la de encima */
const stacked = (all: readonly Layer[], next: Prepared): Layer[] => {
  const n = (all.at(-1)?.n ?? 0) + 1
  return all.length > 1 ? [all[0] as Layer, { ...next, n }] : [...all, { ...next, n }]
}

export function Ambient() {
  const url = useSyncExternalStore(subscribe, current, current)
  const plain = usePlain()
  // La nueva aparece encima de la de antes (opacas las dos: un fundido limpio) y la de antes se va al acabar; si llega
  // otra en pleno fundido, sustituye a la de encima. Al montarse, la última que se vio, ya puesta (sin fundido)
  const [layers, setLayers] = useState<Layer[]>(() => (lastShown ? [{ ...lastShown, n: 0, still: true }] : []))
  // Si ya está hecha, al momento (en el mismo pintado): en una transición de vista entra en la foto de lo nuevo, ya
  // puesta y sin fundido propio (la transición funde una con otra, base.css)
  const [seen, setSeen] = useState(url)
  if (url !== seen) {
    setSeen(url)
    const known = ready.get(url)
    if (known && known.src !== layers.at(-1)?.src) {
      lastShown = known
      const n = (layers.at(-1)?.n ?? 0) + 1
      setLayers(inTransition() ? [{ ...known, n, still: true }] : stacked(layers, known))
    }
  }
  useEffect(() => {
    let live = true
    const show = (next: Prepared) => {
      if (!live) return
      lastShown = next
      setLayers((all) => (all.at(-1)?.src === next.src ? all : stacked(all, next)))
    }
    const known = ready.get(url)
    if (known) show(known)
    else void prepare(url).then(show)
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
          data-still={layer.still || undefined}
          style={{ backgroundImage: `url("${layer.src}")`, '--alpha': layer.alpha } as CSSProperties}
          onAnimationEnd={() => {
            if (index === layers.length - 1 && layers.length > 1) setLayers((all) => all.slice(-1))
          }}
        />
      ))}
    </div>
  )
}
