/**
 * Lo que una campaña elige de su sistema: sus fuentes, qué se ve de lo que está en las dos ediciones, el idioma del
 * contenido y sus ajustes. Se normaliza contra lo que el sistema declara: lo que falta toma su valor inicial (todas las
 * fuentes, solo lo más nuevo, el primer idioma, el de cada ajuste) y lo que no vale se dice
 */
import type { System } from './format.ts'
import { own } from './own.ts'
import { LANGUAGES, type Language, textOf } from './text.ts'

/** Lo más que una campaña deja fuera de sus libros */
export const MAX_EXCLUDED = 10_000

export type SettingValue = boolean | number | string | string[]

/** De lo que está en las dos ediciones: solo la versión más nueva o las dos (la vieja, marcada «Legado») */
export const DUPLICATES = ['newest', 'both'] as const

export interface Choices {
  sources: string[]
  /** Las claves de las entradas del sistema que la campaña deja fuera (lo que el libro gane después, entra) */
  excluded?: string[]
  duplicates: (typeof DUPLICATES)[number]
  language: Language
  settings: Record<string, SettingValue>
}

export function defaultChoices(system: System): Choices {
  return {
    sources: (system.sources ?? []).map((s) => s.key),
    duplicates: 'newest',
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
  // Con fuentes, al menos una: sin ninguna, no hay contenido que ver
  if (sources.size > 0 && !chosen.some((s) => sources.has(s))) problems.push('Activa al menos una fuente')
  let duplicates = base.duplicates
  if (given?.duplicates !== undefined) {
    if ((DUPLICATES as readonly string[]).includes(given.duplicates)) duplicates = given.duplicates
    else problems.push(`«${String(given.duplicates)}» no vale para lo que está en las dos ediciones`)
  }
  const language = given?.language ?? base.language
  if (!system.languages.includes(language) || !(LANGUAGES as readonly string[]).includes(language))
    problems.push(`El sistema no trae el idioma «${language}»`)
  const settings = { ...base.settings }
  for (const [key, value] of Object.entries(given?.settings ?? {})) {
    const setting = system.settings ? own(system.settings, key) : undefined
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
  const excluded = given?.excluded ?? []
  if (!Array.isArray(excluded) || excluded.some((k) => typeof k !== 'string')) problems.push('Lo excluido no vale así')
  else if (excluded.length > MAX_EXCLUDED) problems.push(`Como mucho, ${MAX_EXCLUDED} entradas fuera`)
  const kept = Array.isArray(excluded) ? [...new Set(excluded.filter((k) => typeof k === 'string'))] : []
  return {
    choices: {
      sources: chosen.filter((s) => sources.has(s)),
      ...(kept.length > 0 ? { excluded: kept.slice(0, MAX_EXCLUDED) } : {}),
      duplicates,
      language,
      settings
    },
    problems
  }
}
