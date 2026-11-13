/**
 * El enlace entre la escena de Excalidraw y el documento de Yjs de la pizarra (docs/specs/pizarra.md): un `Y.Map` de
 * elementos por su id, cada uno el objeto de Excalidraw tal cual. Gana la versión más alta (y, a la par, el
 * `versionNonce` más bajo, como hace Excalidraw); lo borrado se queda como lápida (`isDeleted`) para que no vuelva.
 * Aquí no se importa Excalidraw: solo su forma, para probarlo sin él
 */
import type * as Y from 'yjs'

/** El nombre del mapa de elementos (el mismo que lee el servidor: apps/server/src/wiki/board.ts) */
export const BOARD_ELEMENTS = 'elements'

/** Lo que el enlace mira de un elemento de Excalidraw */
export type SceneElement = {
  readonly id: string
  readonly version: number
  readonly versionNonce: number
  readonly index?: string | null
  readonly isDeleted?: boolean
}

/** Si `candidate` debe ganar a `current` (el que ya hay) */
export const wins = (candidate: SceneElement, current: SceneElement | undefined) =>
  !current ||
  candidate.version > current.version ||
  (candidate.version === current.version && candidate.versionNonce < current.versionNonce)

/** El mapa de elementos de un documento de pizarra */
export const boardMap = <T extends SceneElement>(doc: Y.Doc) => doc.getMap<T>(BOARD_ELEMENTS)

/**
 * Lo que cambió en la escena, al documento: solo los elementos que ganan a lo guardado, en una transacción con su
 * origen (para no devolvérselos a la escena). Devuelve cuántos escribió
 */
export function writeScene<T extends SceneElement>(doc: Y.Doc, elements: readonly T[], origin: unknown) {
  const map = boardMap<T>(doc)
  const changed = elements.filter((element) => wins(element, map.get(element.id)))
  if (changed.length === 0) return 0
  doc.transact(() => {
    for (const element of changed) map.set(element.id, element)
  }, origin)
  return changed.length
}

/** Ordena como Excalidraw: por su índice fraccionario (los de antes, sin él, al final y por id) */
const byIndex = (a: SceneElement, b: SceneElement) => {
  const left = a.index ?? '￿'
  const right = b.index ?? '￿'
  if (left !== right) return left < right ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * La escena que sale de juntar la que hay en pantalla con la del documento: por cada id, el que gane; en el orden de
 * sus índices. Las lápidas siguen (Excalidraw las necesita para no resucitar lo borrado)
 */
export function mergeScene<T extends SceneElement>(local: readonly T[], stored: Iterable<T>): T[] {
  const merged = new Map<string, T>()
  for (const element of local) merged.set(element.id, element)
  for (const element of stored) {
    if (!element || typeof element !== 'object') continue
    if (wins(element, merged.get(element.id))) merged.set(element.id, element)
  }
  return [...merged.values()].sort(byIndex)
}

/** Si la escena juntada trae algo distinto de lo que hay en pantalla (para no repintar por nada) */
export function sceneChanged(local: readonly SceneElement[], merged: readonly SceneElement[]) {
  if (local.length !== merged.length) return true
  return merged.some((element, i) => {
    const current = local[i]
    return current?.id !== element.id || current.version !== element.version
  })
}
