/**
 * Lo que una campaña elige de su sistema: sus fuentes, el idioma del contenido y sus ajustes. Se normaliza contra lo
 * que el sistema declara: lo que falta toma su valor inicial (todas las fuentes, el primer idioma, el de cada ajuste) y
 * lo que no vale se dice
 */
import type { System } from './format.ts'
import { LANGUAGES, type Language, textOf } from './text.ts'

export type SettingValue = boolean | number | string | string[]

export interface Choices {
  sources: string[]
  language: Language
  settings: Record<string, SettingValue>
}

export function defaultChoices(system: System): Choices {
  return {
    sources: (system.sources ?? []).map((s) => s.key),
    language: system.languages[0] ?? 'es',
    settings: Object.fromEntries(
      Object.entries(system.settings ?? {}).map(([key, s]) => [
        key,
        s.default ??
          (s.kind === 'boolean'
            ? false
            : s.kind === 'number'
              ? 0
              : s.kind === 'choices'
                ? []
                : (s.options?.[0]?.value ?? ''))
      ])
    )
  }
}

/** Las elecciones de una campaña para su sistema, completas; si algo no vale, el porqué */
export function normalizeChoices(
  system: System,
  given: Partial<Choices> | null | undefined
): { choices: Choices; problems: string[] } {
  const base = defaultChoices(system)
  const problems: string[] = []
  const sources = new Set(base.sources)
  const chosen = given?.sources ?? base.sources
  for (const s of chosen) if (!sources.has(s)) problems.push(`No existe la fuente «${s}»`)
  const language = given?.language ?? base.language
  if (!system.languages.includes(language) || !(LANGUAGES as readonly string[]).includes(language))
    problems.push(`El sistema no trae el idioma «${language}»`)
  const settings = { ...base.settings }
  for (const [key, value] of Object.entries(given?.settings ?? {})) {
    const setting = system.settings?.[key]
    if (!setting) {
      problems.push(`No existe el ajuste «${key}»`)
      continue
    }
    const name = textOf(setting.label)
    const options = new Set((setting.options ?? []).map((o) => o.value))
    const ok =
      setting.kind === 'boolean'
        ? typeof value === 'boolean'
        : setting.kind === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : setting.kind === 'choice'
            ? typeof value === 'string' && options.has(value)
            : Array.isArray(value) && value.every((v) => typeof v === 'string' && options.has(v))
    if (!ok) problems.push(`«${name}» no vale así`)
    else settings[key] = value
  }
  return { choices: { sources: chosen.filter((s) => sources.has(s)), language, settings }, problems }
}
