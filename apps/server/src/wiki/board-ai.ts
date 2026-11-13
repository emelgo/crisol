/**
 * La pizarra para la IA (módulo 9, docs/specs/pizarra.md): leerla en palabras (tarjetas, notas, cajas, flechas) y
 * hacerle cambios sencillos en una rejilla, como elementos de Excalidraw completos (los que la web pinta tal cual)
 */
import { randomInt, randomUUID } from 'node:crypto'
import type { BoardElement } from './board.ts'

/** Una casilla de la rejilla de la IA: cabe una tarjeta con aire alrededor */
export const CELL = { width: 300, height: 150 }
const CARD = { width: 240, height: 72 }
const BOX = { width: 220, height: 100 }
const FONT = 20
/** Excalifont, la letra a mano de Excalidraw */
const HAND = 5
const INK = '#e7e7ea'

const cellOf = (element: BoardElement) => ({
  column: Math.round(Number(element.x ?? 0) / CELL.width),
  row: Math.round(Number(element.y ?? 0) / CELL.height)
})

/** El texto de un elemento: el suyo o el del texto que lleva dentro */
const textOf = (element: BoardElement, byId: Map<string, BoardElement>) => {
  if (typeof element.text === 'string') return element.text
  const bound = element.boundElements?.find((b) => b.type === 'text')
  const inner = bound ? byId.get(bound.id) : undefined
  return typeof inner?.text === 'string' ? inner.text : ''
}

/** Lo que hay en la pizarra, en palabras (con los títulos de las páginas de las tarjetas) */
export function describeElements(elements: readonly BoardElement[], titleOf: (pageId: string) => string | null) {
  const byId = new Map(elements.map((element) => [element.id, element]))
  const hidden = (element: BoardElement) => Boolean(element.customData?.hidden)
  const result = {
    cards: [] as { id: string; pageId: string; title: string; column: number; row: number; hidden: boolean }[],
    notes: [] as { id: string; text: string; column: number; row: number; hidden: boolean }[],
    shapes: [] as { id: string; shape: string; text: string; column: number; row: number; hidden: boolean }[],
    arrows: [] as { id: string; from: string | null; to: string | null; text: string }[],
    images: [] as { id: string; fileId: string; column: number; row: number }[],
    drawings: 0
  }
  for (const element of elements) {
    const pageId = element.customData?.pageId
    if (pageId) {
      const title = titleOf(pageId) ?? element.customData?.title ?? ''
      result.cards.push({ id: element.id, pageId, title, ...cellOf(element), hidden: hidden(element) })
    } else if (element.type === 'text') {
      // El texto de dentro de una caja o una flecha sale con ella
      if (!element.containerId) {
        result.notes.push({ id: element.id, text: textOf(element, byId), ...cellOf(element), hidden: hidden(element) })
      }
    } else if (element.type === 'rectangle' || element.type === 'ellipse' || element.type === 'diamond') {
      result.shapes.push({
        id: element.id,
        shape: element.type,
        text: textOf(element, byId),
        ...cellOf(element),
        hidden: hidden(element)
      })
    } else if (element.type === 'arrow' || element.type === 'line') {
      result.arrows.push({
        id: element.id,
        from: element.startBinding?.elementId ?? null,
        to: element.endBinding?.elementId ?? null,
        text: textOf(element, byId)
      })
    } else if (element.type === 'image' && element.fileId) {
      result.images.push({ id: element.id, fileId: element.fileId, ...cellOf(element) })
    } else if (element.type === 'freedraw') {
      result.drawings++
    }
  }
  return result
}

/** Lo común de todo elemento de Excalidraw, como lo crea él */
function base(type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: INK,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: { type: 3 },
    seed: randomInt(1, 2 ** 31),
    version: 1,
    versionNonce: randomInt(1, 2 ** 31),
    isDeleted: false,
    boundElements: null as { id: string; type: string }[] | null,
    updated: Date.now(),
    link: null as string | null,
    locked: false,
    ...extra
  } satisfies BoardElement
}

/** Un texto (suelto o dentro de algo), con su tamaño aproximado (la web lo vuelve a medir) */
function text(value: string, x: number, y: number, containerId: string | null = null) {
  const lines = value.split('\n')
  const width = Math.max(...lines.map((line) => line.length), 1) * FONT * 0.55
  const height = lines.length * FONT * 1.25
  return base('text', x, y, width, height, {
    roundness: null,
    text: value,
    originalText: value,
    fontSize: FONT,
    fontFamily: HAND,
    textAlign: containerId ? 'center' : 'left',
    verticalAlign: containerId ? 'middle' : 'top',
    containerId,
    autoResize: true,
    lineHeight: 1.25
  })
}

export type BoardAdd = {
  ref?: string | undefined
  pageId?: string | undefined
  text?: string | undefined
  shape?: 'rectangle' | 'ellipse' | 'diamond' | undefined
  hidden?: boolean | undefined
  column: number
  row: number
}

/**
 * Los elementos nuevos de lo que pide la IA (y los que cambian: los que reciben una flecha la apuntan en
 * boundElements), y qué id tiene cada ref. Las flechas van de borde a borde, del centro de uno al del otro
 */
export function buildChanges(
  current: readonly BoardElement[],
  add: readonly BoardAdd[],
  arrows: readonly { from: string; to: string; text?: string | undefined }[],
  linkOf: (pageId: string) => string,
  titleOf: (pageId: string) => string
) {
  const created: BoardElement[] = []
  const refs = new Map<string, string>()
  const added: { ref: string | null; id: string }[] = []
  const hiddenData = (item: BoardAdd) => (item.hidden ? { hidden: true, shownOpacity: 100 } : {})
  for (const item of add) {
    const x = item.column * CELL.width
    const y = item.row * CELL.height
    let main: BoardElement
    if (item.pageId) {
      main = base('embeddable', x, y, CARD.width, CARD.height, {
        strokeColor: 'transparent',
        link: linkOf(item.pageId),
        customData: { pageId: item.pageId, title: titleOf(item.pageId), ...hiddenData(item) },
        ...(item.hidden ? { opacity: 40 } : {})
      })
      created.push(main)
    } else if (item.shape) {
      main = base(item.shape, x, y, BOX.width, BOX.height, {
        ...(item.hidden ? { opacity: 40, customData: hiddenData(item) } : {})
      })
      const label = text(item.text ?? '', x + 10, y + BOX.height / 2 - FONT, main.id)
      main.boundElements = [{ id: label.id, type: 'text' }]
      if (item.hidden) Object.assign(label, { opacity: 40, customData: hiddenData(item) })
      created.push(main, label)
    } else {
      main = text(item.text ?? '', x, y)
      if (item.hidden) Object.assign(main, { opacity: 40, customData: hiddenData(item) })
      created.push(main)
    }
    if (item.ref) refs.set(item.ref, main.id)
    added.push({ ref: item.ref ?? null, id: main.id })
  }

  const all = new Map<string, BoardElement>([...current, ...created].map((element) => [element.id, element]))
  const touched = new Map<string, BoardElement>()
  const bind = (target: BoardElement, arrowId: string) => {
    const copy = touched.get(target.id) ?? created.find((c) => c.id === target.id) ?? { ...target }
    copy.boundElements = [...(copy.boundElements ?? []), { id: arrowId, type: 'arrow' }]
    if (!created.includes(copy)) {
      copy.version = Number(copy.version ?? 1) + 1
      copy.versionNonce = randomInt(1, 2 ** 31)
      copy.updated = Date.now()
      touched.set(copy.id, copy)
    }
  }
  const center = (element: BoardElement) => ({
    x: Number(element.x ?? 0) + Number(element.width ?? 0) / 2,
    y: Number(element.y ?? 0) + Number(element.height ?? 0) / 2
  })
  for (const arrow of arrows) {
    const from = all.get(refs.get(arrow.from) ?? arrow.from)
    const to = all.get(refs.get(arrow.to) ?? arrow.to)
    if (!from || !to) throw new Error(`NO_ELEMENT:${!from ? arrow.from : arrow.to}`)
    const start = center(from)
    const end = center(to)
    const line = base('arrow', start.x, start.y, Math.abs(end.x - start.x), Math.abs(end.y - start.y), {
      roundness: { type: 2 },
      points: [
        [0, 0],
        [end.x - start.x, end.y - start.y]
      ],
      lastCommittedPoint: null,
      startBinding: { elementId: from.id, focus: 0, gap: 8 },
      endBinding: { elementId: to.id, focus: 0, gap: 8 },
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false
    })
    created.push(line)
    bind(from, line.id)
    bind(to, line.id)
    if (arrow.text) {
      const label = text(arrow.text, (start.x + end.x) / 2, (start.y + end.y) / 2, line.id)
      line.boundElements = [{ id: label.id, type: 'text' }]
      created.push(label)
    }
  }
  return { elements: [...created, ...touched.values()], added }
}

/**
 * Lo que se quita: lo pedido y lo atado a ello (su texto, las flechas que iban a ello y el texto de esas flechas), como
 * lápidas (una versión más) para que Excalidraw no lo resucite
 */
export function removals(current: readonly BoardElement[], ids: readonly string[]) {
  const gone = new Set(ids.filter((id) => current.some((element) => element.id === id)))
  let changed = true
  while (changed) {
    changed = false
    for (const element of current) {
      if (gone.has(element.id)) continue
      const tied = [element.containerId, element.startBinding?.elementId, element.endBinding?.elementId]
      if (tied.some((id) => id && gone.has(id))) {
        gone.add(element.id)
        changed = true
      }
    }
  }
  const asked = ids.filter((id) => gone.has(id)).length
  const tombstones = current
    .filter((element) => gone.has(element.id))
    .map((element) => ({
      ...element,
      isDeleted: true,
      version: Number(element.version ?? 1) + 1,
      versionNonce: randomInt(1, 2 ** 31),
      updated: Date.now()
    }))
  return { tombstones, removed: asked }
}
