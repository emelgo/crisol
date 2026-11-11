/**
 * El fondo de ambiente (tanda 5, «Crisol, con cristal»): el cristal solo luce con algo detrás, y fuera de la Mesa no
 * hay mapa. Detrás de todo, fija, una imagen muy difuminada y tenue: en un mundo, su portada; en Inicio, la del mundo
 * que se señala; si no, la de ambiente. Lo que enmarca va encima de cristal (sin backdrop-filter: el fondo ya viene
 * difuminado, así que no cuesta nada al bajar). Con «Sin desenfoque» (Ajustes) no sale: todo opaco, como antes
 */
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './ambient.module.css'
import { usePlain } from './plain.ts'

/** La de siempre, si nadie pide otra */
export const DEFAULT_AMBIENT = '/ambiente/inicio.webp'

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

/** La imagen que se ve ahora (para las pruebas) */
export const ambientNow = current

export function Ambient() {
  const url = useSyncExternalStore(subscribe, current, current)
  const plain = usePlain()
  // La nueva aparece encima de la de antes, que se va al acabar el fundido
  const [layers, setLayers] = useState([{ url, n: 0 }])
  if (layers.at(-1)?.url !== url) setLayers((all) => [...all.slice(-1), { url, n: (all.at(-1)?.n ?? 0) + 1 }])
  if (plain) return null
  return (
    <div className={styles.ambient} aria-hidden="true" data-ambiente={url}>
      {layers.map((layer, index) => (
        <div
          key={layer.n}
          className={styles.layer}
          style={{ backgroundImage: `url("${layer.url}")` }}
          onAnimationEnd={() => {
            if (index === layers.length - 1 && layers.length > 1) setLayers((all) => all.slice(-1))
          }}
        />
      ))}
    </div>
  )
}
