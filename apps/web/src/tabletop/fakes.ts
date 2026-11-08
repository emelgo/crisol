/**
 * La Mesa de mentira para las pruebas de lo que la rodea (la campaña, sus ajustes): un canal que no manda nada y un
 * lienzo sin WebGL. Se usan desde vi.mock: `vi.mock('../tabletop/channel.ts', async () => (await import('../tabletop/fakes.ts')).quietChannel())`
 */
import { useRef } from 'react'

export function quietChannel() {
  return {
    connectTable: (_options: unknown, handlers: { onStatus?: (status: string) => void }) => {
      handlers.onStatus?.('open')
      return { sendViewport: () => {}, sendDrag: () => {}, close: () => {} }
    }
  }
}

export function blindRenderer() {
  return {
    useTableRenderer: () => {
      const host = useRef<HTMLDivElement>(null)
      const renderer = useRef({
        setView: () => {},
        setScene: () => {},
        setTokens: () => {},
        setFog: () => {},
        setGlow: () => {},
        setShapes: () => {},
        setLabels: () => {},
        setImages: () => {}
      })
      return { host, renderer, ready: true, failed: false, size: { width: 800, height: 600 } }
    }
  }
}
