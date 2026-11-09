/** Lo de la pestaña «Escena» que comparten el mapa (en medio) y la rejilla (a la derecha) */
import type { SceneGrid, SceneView, SceneViewport } from '@crisol/contracts'
import type { Point } from '@crisol/tabletop'
import type { UseQueryResult } from '@tanstack/react-query'
import { createContext, type RefObject, useContext } from 'react'
import type { useScenePreparation } from '../../tabletop/use-preparation.ts'

export type GridPatch = Partial<SceneGrid>

export interface SceneTabState {
  worldId: string
  /** El nombre de la escena (el de su pestaña o, la suelta, el suyo) */
  name: string
  /** En una página de la wiki (no en una ventana de la Mesa): ahí van «Abrir en la mesa» y su recorrido */
  inPage: boolean
  scene: SceneView | undefined
  query: UseQueryResult<SceneView>
  preparation: ReturnType<typeof useScenePreparation>
  editable: boolean
  /** Cambia la rejilla: se ve al momento y se guarda (con `later`, un poco después, al arrastrar un deslizador) */
  saveGrid(patch: GridPatch, later?: boolean): void
  saveView(view: SceneViewport): Promise<unknown>
  /** Marcando las dos esquinas de una casilla */
  aligning: boolean
  setAligning(on: boolean): void
  /** Lo último que dijo la alineación: el tamaño que encaja o que no se vio ninguna */
  found: { size: number } | 'none' | null
  setFound(found: { size: number } | 'none' | null): void
  alignCorners(points: [Point, Point]): void
  /** Lo que enseña ahora el visor, como encuadre (para «Usar este encuadre») */
  viewer: RefObject<(() => SceneViewport | null) | null>
}

export const SceneTabContext = createContext<SceneTabState | null>(null)

export function useSceneTab() {
  const value = useContext(SceneTabContext)
  if (!value) throw new Error('Falta SceneTabProvider')
  return value
}
