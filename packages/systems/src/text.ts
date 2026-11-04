/** Los textos de un sistema: uno solo, o uno por idioma ({ es, en }) */
import { z } from 'zod'

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export type Text = string | Partial<Record<Language, string>>

/** Un texto de hasta max caracteres, en un idioma o en varios (al menos uno) */
export const text = (max = 200) =>
  z.union([
    z.string().trim().min(1).max(max),
    z
      .strictObject({
        es: z.string().trim().min(1).max(max).optional(),
        en: z.string().trim().min(1).max(max).optional()
      })
      .refine((t) => t.es !== undefined || t.en !== undefined, 'Escribe el texto al menos en un idioma')
  ])

/** El texto en un idioma; si no lo tiene, el del primero que haya */
export function textOf(value: Text | undefined, language: Language = 'es'): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return value[language] ?? LANGUAGES.map((l) => value[l]).find((t) => t !== undefined) ?? ''
}
