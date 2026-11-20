/**
 * Las plantillas de la ficha de un tipo en el compendio (card.ts): `{campo}`, `{campo: lo que sale si lo tiene}` y
 * `{!campo: lo que sale si no}`, y los campos que nombran
 */
import type { Text } from './text.ts'

/** Lo de la ficha en el formato de un tipo */
export interface CardFormat {
  line?: Text | undefined
  left?: Text[] | undefined
  right?: Text[] | undefined
  hidden?: string[] | undefined
}

/** Un trozo de plantilla: texto, o un campo (con lo de dentro, si es «{campo: texto}»; con «!», si no lo tiene) */
export type Part = string | { key: string; negate: boolean; inner: Part[] | null }

/** Lee una plantilla: `{campo}`, `{campo: texto con {otro}}` y `{!campo: texto si no lo tiene}` */
export function parseTemplate(template: string): Part[] {
  let at = 0
  const read = (inside: boolean): Part[] => {
    const parts: Part[] = []
    let text = ''
    while (at < template.length) {
      const char = template[at] as string
      if (char === '}' && inside) {
        at++
        break
      }
      if (char === '{') {
        const head = /^\{(!?)([\p{L}\p{N}_]+)\s*(:|\})/u.exec(template.slice(at))
        if (head) {
          if (text) parts.push(text)
          text = ''
          at += head[0].length
          // Lo de dentro, con el espacio de tras los dos puntos («{rareza}{sintonia: (requiere…)}» → «rara (requiere…)»)
          const inner = head[3] === ':' ? read(true) : null
          parts.push({ key: head[2] as string, negate: head[1] === '!', inner })
          continue
        }
      }
      text += char
      at++
    }
    if (text) parts.push(text)
    return parts
  }
  return read(false)
}

/** Los campos que nombra una plantilla */
export function templateKeys(template: string): string[] {
  const keys: string[] = []
  const walk = (parts: Part[]) => {
    for (const part of parts) {
      if (typeof part === 'string') continue
      keys.push(part.key)
      if (part.inner) walk(part.inner)
    }
  }
  walk(parseTemplate(template))
  return keys
}

/** Los campos que no salen en la lista de un tipo: los que nombra su ficha y los de la hoja */
export function cardKeys(card: CardFormat | undefined): Set<string> {
  const keys = new Set(card?.hidden ?? [])
  const templates = [card?.line, ...(card?.left ?? []), ...(card?.right ?? [])].flatMap((t) =>
    t === undefined ? [] : typeof t === 'string' ? [t] : Object.values(t).filter((v): v is string => !!v)
  )
  for (const template of templates) {
    for (const key of templateKeys(template)) keys.add(key)
    if (!template.includes('{')) keys.add(template.trim())
  }
  return keys
}
