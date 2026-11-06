/**
 * Las criaturas en juego (docs/specs/criaturas.md): su hoja es la entrada del compendio calculada con lo de la partida
 * encima (la misma hoja en partida que un personaje); los PG al ponerla en juego (medios o tirados); los números de sus
 * copias; y el daño que recibe, con su multiplicador y sus resistencias, inmunidades y vulnerabilidades
 */
import { type DieRoller, rollTree } from '@crisol/dice'
import { playedSheet, viewOf } from './builder.ts'
import type { Choices } from './choices.ts'
import type { SystemDocument } from './evaluate.ts'
import type { ContentItem } from './file.ts'
import type { Field, System } from './format.ts'
import type { Value } from './formulas/functions.ts'
import type { Mechanics } from './mechanics.ts'
import { type Play, resourcePaths } from './play.ts'
import { armFormula, rollContext } from './rolls.ts'
import { type Language, type Text, textOf } from './text.ts'

/** Un texto en dos idiomas (el tipo «Humanoide», el alineamiento) */
const isText = (v: unknown): v is Text =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.entries(v).every(([k, x]) => (k === 'es' || k === 'en') && typeof x === 'string')

/** El documento de una entrada: sus datos en el idioma de la campaña y su mecánica (sus acciones y sus recursos) */
export function creatureDocument(entry: ContentItem, language: Language): SystemDocument {
  const data = Object.fromEntries(
    Object.entries(entry.data).map(([k, v]) => [k, isText(v) ? textOf(v, language) : v])
  ) as Record<string, Value>
  return { data, ...(entry.mechanics ? { mechanics: entry.mechanics as Mechanics } : {}), items: [] }
}

/**
 * La hoja de una criatura en juego: su entrada con lo de la partida encima, con la misma forma que la de un personaje
 * (sus valores, recursos, acciones, bloques, tiradas y lo que lleva). `overrides`: el máximo de unos recursos (sus PG
 * tirados u otro máximo)
 */
export function creatureView(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates' | 'language'> & { settings?: Record<string, unknown> },
  entry: ContentItem,
  play: Play,
  overrides: Record<string, number> = {}
) {
  const { byKey } = viewOf(system, content, choices)
  const document = creatureDocument(entry, choices.language)
  const { played, sheetParts } = playedSheet(system, entry.type, document, play, byKey, choices, overrides)
  return { type: entry.type, document: played.document, played, view: sheetParts }
}

/**
 * Lo de la partida al ponerla en juego: nada (está entera); con los PG tirados, el máximo de su primer recurso que
 * diga cómo se tira (`roll`: sus dados de golpe), tirado en el servidor. Sin con qué tirar, por la media (su máximo)
 */
export function startingPlay(
  system: System,
  entry: ContentItem,
  options: { hp: 'average' | 'rolled'; roller?: DieRoller; language?: Language; settings?: Record<string, unknown> }
): { play: Play; overrides: Record<string, number> } {
  if (options.hp !== 'rolled') return { play: {}, overrides: {} }
  const fields = system.types[entry.type]?.fields ?? {}
  // Un campo por su ruta (`pg`, `vida.actual`): dentro de un grupo, entre sus campos
  const fieldAt = (path: string) =>
    path
      .split('.')
      .reduce<Field | undefined>(
        (f, k, i) => (i === 0 ? fields[k] : f?.kind === 'group' ? f.fields[k] : undefined),
        undefined
      )
  const life = resourcePaths(fields)
    .map(({ path }) => ({ path, field: fieldAt(path) }))
    .find(({ field }) => field?.kind === 'resource' && field.roll)
  const formula = life?.field?.kind === 'resource' ? life.field.roll : undefined
  if (!life || !formula) return { play: {}, overrides: {} }
  const document = creatureDocument(entry, options.language ?? 'es')
  try {
    const { scope } = rollContext(system, entry.type, document, {
      language: options.language ?? 'es',
      settings: options.settings ?? {}
    })
    const tree = armFormula(formula, scope, () => undefined)
    const total = rollTree(tree, options.roller).total
    if (!Number.isFinite(total) || total < 1) return { play: {}, overrides: {} }
    return { play: {}, overrides: { [life.path]: Math.min(100_000, Math.round(total)) } }
  } catch {
    // Sus dados de golpe vacíos o una fórmula sin dados: por la media
    return { play: {}, overrides: {} }
  }
}

/** Los números de unas copias nuevas: siguen al mayor de las que están; sin ninguna, desde el 1 */
export function nextNumbers(used: readonly number[], count: number): number[] {
  const from = used.length > 0 ? Math.max(...used) + 1 : 1
  return Array.from({ length: count }, (_, i) => from + i)
}

/** Lo que resiste, lo que no le hace nada y lo que le hace el doble: los campos que dice su tipo (`damage`) */
export interface Defenses {
  resist: string[]
  immune: string[]
  vulnerable: string[]
}

export function defensesOf(system: System, type: string, values: Record<string, Value>): Defenses {
  const damage = system.types[type]?.damage ?? {}
  const list = (field: string | undefined) => {
    const v = field ? values[field] : undefined
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  }
  return { resist: list(damage.resist), immune: list(damage.immune), vulnerable: list(damage.vulnerable) }
}

/**
 * El daño que recibe, parte a parte: el multiplicador (nada, mitad al superar la salvación, entero, doble) y después su
 * defensa contra su tipo (inmune, nada; resiste, la mitad; vulnerable, el doble). Hacia abajo, como en el 5e
 */
export function damageTaken(
  parts: readonly { amount: number; type?: string | undefined }[],
  multiplier: number,
  defenses: Defenses
): number {
  // Lo de un mismo tipo, junto antes de redondear (7 de fuego y 5 de frío a la mitad: 3 + 2, no 2 + 2)
  const byType = new Map<string, number>()
  for (const part of parts) byType.set(part.type ?? '', (byType.get(part.type ?? '') ?? 0) + Math.max(0, part.amount))
  let total = 0
  for (const [type, sum] of byType) {
    let amount = Math.floor(sum * multiplier)
    if (type && defenses.immune.includes(type)) amount = 0
    else if (type && defenses.resist.includes(type)) amount = Math.floor(amount / 2)
    else if (type && defenses.vulnerable.includes(type)) amount *= 2
    total += amount
  }
  return total
}
