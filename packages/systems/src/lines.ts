/**
 * En qué línea de un JSON está cada ruta (la de los problemas: types.personaje.fields.defensa.formula, bands[1].if),
 * para marcarla en Avanzado. El texto tiene que ser un JSON válido (lo es si se ha podido leer)
 */
import { pathText } from './validate.ts'

type Segment = string | number

export function jsonLines(text: string): Map<string, number> {
  const lines = new Map<string, number>()
  let i = 0
  let line = 1
  const space = () => {
    while (i < text.length) {
      const c = text[i]
      if (c === '\n') line++
      else if (c !== ' ' && c !== '\t' && c !== '\r') return
      i++
    }
  }
  const string = () => {
    const start = i
    i++
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    i++
    return JSON.parse(text.slice(start, i)) as string
  }
  const value = (path: Segment[]) => {
    space()
    const c = text[i]
    if (c === '{' || c === '[') {
      const object = c === '{'
      i++
      space()
      if (text[i] === (object ? '}' : ']')) {
        i++
        return
      }
      for (let n = 0; i < text.length; n++) {
        space()
        const at = line
        const segment = object ? string() : n
        const here = [...path, segment]
        lines.set(pathText(here), at)
        if (object) {
          space()
          i++ // los dos puntos
        }
        value(here)
        space()
        const next = text[i++]
        if (next !== ',') return
      }
      return
    }
    if (c === '"') {
      string()
      return
    }
    // Un número, true, false o null
    while (i < text.length && !',]} \t\r\n'.includes(text[i] as string)) i++
  }
  value([])
  return lines
}

/** La línea de una ruta o, si no está (lo que falta), la de lo que la contiene; si no, la primera */
export function lineOf(lines: Map<string, number>, path: string): number {
  let current = path
  while (current) {
    const found = lines.get(current)
    if (found) return found
    const shorter = current.replace(/(\.[^.[\]]*|\[\d+\])$/, '')
    if (shorter === current) break
    current = shorter
  }
  return 1
}
