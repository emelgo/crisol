/**
 * La página del libro de un título o de un recuadro (ADR-0033), como la enseña 5etools («p5»). En Markdown, al final
 * del título (`## Encuentros {p12}`) o entre las opciones del recuadro (`> [!nota|p5] Título`)
 */
import { Extension } from '@tiptap/core'

/** `{p12}` (o `{p.12}`) al final del texto de un título */
export const HEADING_PAGE = /\s*\{p\.?\s*(\d{1,4})\}\s*$/

/** La opción de página de un recuadro (`p5`), si la hay */
export const pageOption = (options: readonly string[]) => {
  const found = options.map((o) => /^p\.?(\d{1,4})$/.exec(o)?.[1]).find(Boolean)
  return found ? Number(found) : null
}

type Element = { getAttribute(name: string): string | null }

export const PageNumbers = Extension.create({
  name: 'pageNumbers',
  addGlobalAttributes: () => [
    {
      types: ['heading', 'callout'],
      attributes: {
        page: {
          default: null,
          parseHTML: (element: Element) => {
            const value = Number(element.getAttribute('data-page'))
            return Number.isInteger(value) && value > 0 ? value : null
          },
          renderHTML: (attributes: Record<string, unknown>) =>
            attributes.page ? { 'data-page': String(attributes.page) } : {}
        }
      }
    }
  ]
})
