/**
 * Los secretos del texto de una entrada del compendio (`> [!secreto]` y las líneas `>` que lo siguen): a quien no
 * dirige la campaña no le llegan (ADR-0033), como los de los capítulos y las páginas
 */
import type { Text } from './text.ts'

const SECRET_HEAD = /^ {0,3}> ?\[!secreto[^\]]*\]/i
const QUOTED = /^ {0,3}>/

/** Un texto sin sus bloques `> [!secreto]` */
export function withoutSecretBlocks(text: string): string {
  if (!/\[!secreto/i.test(text)) return text
  const kept: string[] = []
  let inSecret = false
  for (const line of text.split('\n')) {
    if (SECRET_HEAD.test(line)) {
      inSecret = true
      continue
    }
    if (inSecret && QUOTED.test(line)) continue
    inSecret = false
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n')
}

const isText = (value: unknown): value is Text =>
  typeof value === 'string' ||
  (Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value as object).every(([k, v]) => (k === 'es' || k === 'en') && typeof v === 'string'))

/** Los datos de una entrada con sus textos sin secretos (en cada idioma) */
export function dataWithoutSecrets(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (!isText(value)) return [key, value]
      if (typeof value === 'string') return [key, withoutSecretBlocks(value)]
      return [key, Object.fromEntries(Object.entries(value).map(([lang, t]) => [lang, withoutSecretBlocks(String(t))]))]
    })
  )
}
