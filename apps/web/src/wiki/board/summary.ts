/**
 * Lo que hay en una pizarra, en palabras (módulo 9): sus tarjetas, sus notas y quién va con quién por sus flechas. Para
 * la jugadora en el móvil, donde el lienzo entero sale diminuto, y para quien no lo ve
 */
type Element = {
  id: string
  type: string
  isDeleted?: boolean
  text?: string
  containerId?: string | null
  boundElements?: readonly { id: string; type: string }[] | null
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
  customData?: Record<string, unknown> | null
  x?: number
  y?: number
}

export type BoardSummary = {
  cards: { id: string; pageId: string; title: string }[]
  notes: { id: string; text: string }[]
  links: { id: string; from: string; to: string; label: string }[]
}

/** De arriba abajo y de izquierda a derecha, como se lee */
const reading = (a: Element, b: Element) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)

export function summarize(elements: readonly Element[], titleOf: (pageId: string) => string | undefined): BoardSummary {
  const live = elements.filter((element) => !element.isDeleted)
  const byId = new Map(live.map((element) => [element.id, element]))
  const textOf = (element: Element) => {
    if (typeof element.text === 'string') return element.text.trim()
    const bound = element.boundElements?.find((each) => each.type === 'text')
    const inner = bound ? byId.get(bound.id) : undefined
    return typeof inner?.text === 'string' ? inner.text.trim() : ''
  }
  const pageOf = (element: Element) =>
    typeof element.customData?.pageId === 'string' ? element.customData.pageId : null
  const nameOf = (element: Element | undefined) => {
    if (!element) return ''
    const pageId = pageOf(element)
    if (pageId) return titleOf(pageId) ?? String(element.customData?.title ?? '')
    return textOf(element)
  }
  const sorted = [...live].sort(reading)
  const summary: BoardSummary = { cards: [], notes: [], links: [] }
  for (const element of sorted) {
    const pageId = pageOf(element)
    if (pageId) summary.cards.push({ id: element.id, pageId, title: nameOf(element) })
    else if (element.type === 'arrow' || element.type === 'line') {
      const from = nameOf(byId.get(element.startBinding?.elementId ?? ''))
      const to = nameOf(byId.get(element.endBinding?.elementId ?? ''))
      if (from && to) summary.links.push({ id: element.id, from, to, label: textOf(element) })
    } else if (
      element.type === 'text' ? !element.containerId : ['rectangle', 'ellipse', 'diamond'].includes(element.type)
    ) {
      const text = textOf(element)
      if (text) summary.notes.push({ id: element.id, text })
    }
  }
  return summary
}
