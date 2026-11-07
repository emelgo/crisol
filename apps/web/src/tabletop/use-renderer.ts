/** El lienzo de PixiJS dentro de un elemento: se crea al montarse, sigue su tamaño y se suelta al irse */
import type { Size } from '@crisol/tabletop'
import { useEffect, useRef, useState } from 'react'
import { type RendererScene, TableRenderer } from './renderer.ts'

export function useTableRenderer(scene: RendererScene | null) {
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<TableRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = host.current
    if (!element) return
    let alive = true
    let observer: ResizeObserver | null = null
    TableRenderer.create(element).then(
      (made) => {
        if (!alive) return made.destroy()
        renderer.current = made
        const measure = () => {
          const next = { width: element.clientWidth, height: element.clientHeight }
          made.resize(next)
          setSize(next)
        }
        measure()
        observer = new ResizeObserver(measure)
        observer.observe(element)
        setReady(true)
      },
      () => {
        if (alive) setFailed(true)
      }
    )
    return () => {
      alive = false
      observer?.disconnect()
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [])

  useEffect(() => {
    if (ready) renderer.current?.setScene(scene)
  }, [ready, scene])

  return { host, renderer, ready, failed, size }
}
