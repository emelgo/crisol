/** Lo que se ve de un sistema en la lista: su nombre, su resumen, su licencia, sus tipos y sus tiradas */
import type { System } from './format.ts'
import { type Language, textOf } from './text.ts'

export function systemOverview(system: System, language: Language = 'es') {
  return {
    name: textOf(system.name, language),
    summary: textOf(system.summary, language),
    release: system.version,
    license: system.license ? `${textOf(system.license.name, language)} · ${system.license.license}` : null,
    types: Object.entries(system.types).map(([key, type]) => ({
      key,
      label: textOf(type.label, language) || key,
      document: type.document,
      fields: Object.keys(type.fields).length
    })),
    rolls: Object.entries(system.rolls ?? {}).map(([key, roll]) => ({
      key,
      label: textOf(roll.label, language) || key
    })),
    defaultRoll: system.dice?.default ?? null,
    critical: system.dice?.critical ?? ('d20' as const)
  }
}
