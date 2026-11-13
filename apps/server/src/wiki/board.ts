/**
 * La pizarra de una página (módulo 9, docs/specs/pizarra.md): su escena de Excalidraw vive en un documento de Yjs
 * aparte, como una pestaña de texto, con un mapa de elementos por su id (cada uno, el objeto de Excalidraw tal cual).
 * Aquí, lo que el servidor saca de ella: su texto y sus enlaces (para buscar y para «Mencionado en»), los archivos que
 * enseña (para que una jugadora pueda ver sus imágenes) y lo que ve una jugadora
 */
import type { JSONContent } from '@tiptap/core'
import type * as Y from 'yjs'

/** El nombre del mapa de elementos en el documento de la pizarra */
export const BOARD_ELEMENTS = 'elements'

/** Un elemento de Excalidraw, como lo guarda la pizarra (solo se mira lo que hace falta) */
export type BoardElement = {
  id: string
  type: string
  isDeleted?: boolean
  text?: string
  containerId?: string | null
  fileId?: string | null
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
  boundElements?: { id: string; type: string }[] | null
  customData?: { pageId?: string; title?: string; fileId?: string; name?: string; hidden?: boolean } | null
  [key: string]: unknown
}

/** Si un documento es una pizarra (tiene su mapa de elementos) */
export const isBoard = (doc: Y.Doc) => doc.share.has(BOARD_ELEMENTS)

/** Los elementos vivos de una pizarra (sin los borrados, que Excalidraw guarda como lápidas) */
export function boardElements(doc: Y.Doc): BoardElement[] {
  const map = doc.getMap<BoardElement>(BOARD_ELEMENTS)
  return [...map.values()].filter((element) => element && typeof element === 'object' && !element.isDeleted)
}

/**
 * La pizarra como un documento de texto, solo para lo que el servidor saca de los documentos: sus textos (para buscar),
 * sus tarjetas como enlaces a su página y sus imágenes como archivos incrustados
 */
export function boardJson(elements: readonly BoardElement[]): JSONContent {
  const content: JSONContent[] = []
  for (const element of elements) {
    const page = element.customData?.pageId
    if (page) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'pageLink', attrs: { pageId: page, title: element.customData?.title ?? '' } }]
      })
    }
    // Una imagen: su fileId es el de un archivo del mundo (lo sube Crisol al pegarla)
    const file = element.fileId ?? element.customData?.fileId
    if (element.type === 'image' && file) {
      content.push({ type: 'fileEmbed', attrs: { fileId: file, name: element.customData?.name ?? '' } })
    }
    if (element.type === 'text' && typeof element.text === 'string' && element.text.trim()) {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: element.text.trim() }] })
    }
  }
  return { type: 'doc', content }
}

/**
 * Lo que ve una jugadora: sin lo oculto, sin las tarjetas de páginas que no conoce y sin lo que va atado a lo quitado
 * (el texto dentro de una caja quitada, las flechas que iban a ella), en cadena
 */
export function boardForPlayer(elements: readonly BoardElement[], seesPage: (pageId: string) => boolean) {
  const removed = new Set<string>()
  for (const element of elements) {
    const page = element.customData?.pageId
    if (element.customData?.hidden || (page && !seesPage(page))) removed.add(element.id)
  }
  // Lo atado a lo quitado, hasta que no cambie nada (una flecha a una caja quitada lleva su propio texto)
  let changed = true
  while (changed) {
    changed = false
    for (const element of elements) {
      if (removed.has(element.id)) continue
      const tied = [element.containerId, element.startBinding?.elementId, element.endBinding?.elementId]
      if (tied.some((id) => id && removed.has(id))) {
        removed.add(element.id)
        changed = true
      }
    }
  }
  return elements
    .filter((element) => !removed.has(element.id))
    .map((element) =>
      // Lo que sigue: sin saber que había algo atado que ya no está
      element.boundElements
        ? { ...element, boundElements: element.boundElements.filter((bound) => !removed.has(bound.id)) }
        : element
    )
}
