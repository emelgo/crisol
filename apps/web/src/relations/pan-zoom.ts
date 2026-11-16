/**
 * Mover y acercar el grafo (d3-zoom sobre su SVG o su lienzo): arrastrar lo mueve, la rueda acerca hacia el cursor y
 * con dos dedos también. Sin acercar con el doble clic (abre la página). fit encuadra lo que hay; centerOn lleva un
 * punto al centro
 */
import { select } from 'd3-selection'
import { type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from 'd3-zoom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 4

/** Lo que ocupan unos puntos, con su margen */
export function boundsOf(points: Iterable<{ x: number; y: number }>, margin = 60): Bounds | null {
  let box: Bounds | null = null
  for (const { x, y } of points) {
    if (!box) box = { minX: x, minY: y, maxX: x, maxY: y }
    else {
      box.minX = Math.min(box.minX, x)
      box.minY = Math.min(box.minY, y)
      box.maxX = Math.max(box.maxX, x)
      box.maxY = Math.max(box.maxY, y)
    }
  }
  return box && { minX: box.minX - margin, minY: box.minY - margin, maxX: box.maxX + margin, maxY: box.maxY + margin }
}

/** Lo que tapan las piezas que flotan encima (en píxeles de pantalla): abajo, la píldora y el zoom */
export interface Insets {
  top: number
  bottom: number
}

const NO_INSETS: Insets = { top: 0, bottom: 0 }

/** La transformación que encuadra unos límites en un hueco (sin lo que tapan las piezas de encima), sin pasar de maxScale */
export function fitTransform(
  box: Bounds,
  width: number,
  height: number,
  maxScale = 1.1,
  insets: Insets = NO_INSETS
): ZoomTransform {
  const room = Math.max(1, height - insets.top - insets.bottom)
  const k = Math.max(
    MIN_SCALE,
    Math.min(maxScale, width / Math.max(1, box.maxX - box.minX), room / Math.max(1, box.maxY - box.minY))
  )
  return zoomIdentity
    .translate(width / 2, insets.top + room / 2)
    .scale(k)
    .translate(-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2)
}

export function usePanZoom(
  element: Element | null,
  { onChange, insets = NO_INSETS }: { onChange?: (transform: ZoomTransform) => void; insets?: Insets } = {}
) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const listener = useRef(onChange)
  listener.current = onChange
  // Si se ha movido o acercado a mano (con el ratón, el dedo o los botones): entonces ya no se encuadra solo
  const touched = useRef(false)
  const behavior = useMemo<ZoomBehavior<Element, unknown>>(
    () =>
      zoom<Element, unknown>()
        .scaleExtent([MIN_SCALE, MAX_SCALE])
        .on('zoom', (event: { transform: ZoomTransform; sourceEvent: unknown }) => {
          if (event.sourceEvent) touched.current = true
          setTransform(event.transform)
          listener.current?.(event.transform)
        }),
    []
  )
  useEffect(() => {
    if (!element) return
    const selection = select(element)
    selection.call(behavior).on('dblclick.zoom', null)
    return () => {
      selection.on('.zoom', null)
    }
  }, [element, behavior])
  const apply = useCallback(
    (next: ZoomTransform) => {
      if (element) behavior.transform(select(element), next)
    },
    [element, behavior]
  )
  const zoomBy = useCallback(
    (factor: number) => {
      touched.current = true
      if (element) behavior.scaleBy(select(element), factor)
    },
    [element, behavior]
  )
  const size = useCallback(() => {
    const rect = element?.getBoundingClientRect()
    return { width: rect?.width || 800, height: rect?.height || 600 }
  }, [element])
  const fit = useCallback(
    (box: Bounds | null, maxScale?: number) => {
      if (!box) return
      touched.current = false
      const { width, height } = size()
      apply(fitTransform(box, width, height, maxScale, insets))
    },
    [apply, size, insets]
  )
  // Mientras no se toque, si el hueco cambia (el panel se pliega o se abre, la ventana cambia), se vuelve a encuadrar
  const keepFitted = useCallback(
    (box: Bounds | null, maxScale?: number) => {
      if (!element || typeof ResizeObserver === 'undefined') return () => undefined
      let last = ''
      const observer = new ResizeObserver(([entry]) => {
        const now = `${Math.round(entry?.contentRect.width ?? 0)}x${Math.round(entry?.contentRect.height ?? 0)}`
        if (now === last) return
        const first = last === ''
        last = now
        if (!first && !touched.current && box) apply(fitTransform(box, ...size2(entry), maxScale, insets))
      })
      observer.observe(element)
      return () => observer.disconnect()
    },
    [element, apply, insets]
  )
  const centerOn = useCallback(
    (point: { x: number; y: number }, scale?: number) => {
      const { width, height } = size()
      const k = scale ?? transform.k
      apply(
        zoomIdentity
          .translate(width / 2, height / 2)
          .scale(k)
          .translate(-point.x, -point.y)
      )
    },
    [apply, size, transform.k]
  )
  /** Encuadrar, si no se ha tocado desde el último encuadre (el grafo del mundo, al asentarse) */
  const refit = useCallback(
    (box: Bounds | null, maxScale?: number) => {
      if (!touched.current) fit(box, maxScale)
    },
    [fit]
  )
  return { transform, zoomBy, fit, refit, centerOn, keepFitted }
}

const size2 = (entry: ResizeObserverEntry | undefined): [number, number] => [
  entry?.contentRect.width || 800,
  entry?.contentRect.height || 600
]
