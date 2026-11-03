/**
 * Lo común de las portadas (de una página y de un mundo): los archivos del mundo para elegirla y cómo se pinta. Aparte
 * de cover.tsx para que la portada del mundo y la de la página no dependan la una de la otra
 */
import type { PageCover as Cover } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { useApi } from '../api/context.tsx'

export const useWorldFiles = (worldId: string, enabled = true) => {
  const api = useApi()
  return useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }), enabled })
}

/**
 * Cómo se pinta una portada: recortada alrededor de su punto de encuadre y, si se acercó, ampliada desde ese punto.
 * Quien la contiene recorta lo que sobra (overflow: hidden)
 */
export function coverStyle(cover: Cover): CSSProperties {
  const at = `${cover.x}% ${cover.y}%`
  const zoom = cover.zoom ?? 1
  return zoom === 1 ? { objectPosition: at } : { objectPosition: at, transform: `scale(${zoom})`, transformOrigin: at }
}
