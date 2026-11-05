/** El compendio de un sistema, validado (aparte de compendium.ts, para no hacer un ciclo con validate.ts) */
import type { System } from './format.ts'

/** Lo que no vale del compendio de un sistema: que sus tipos existan, que no se repitan y que sus carpetas sean campos */
export function checkCompendium(system: System, add: (path: (string | number)[], message: string) => void) {
  const layout = system.compendium
  if (!layout) return
  const seen = new Set<string>()
  layout.sections.forEach((section, i) => {
    section.types.forEach((type, j) => {
      const at = ['compendium', 'sections', i, 'types', j]
      if (!system.types[type]) add(at, `No existe el tipo «${type}»`)
      else if (seen.has(type)) add(at, `«${type}» ya está en otra sección`)
      seen.add(type)
    })
  })
  for (const [type, spec] of Object.entries(layout.types ?? {})) {
    const fields = system.types[type]?.fields
    if (!fields) add(['compendium', 'types', type], `No existe el tipo «${type}»`)
    else {
      if (spec.folder && !fields[spec.folder.field])
        add(['compendium', 'types', type, 'folder', 'field'], `«${type}» no tiene el campo «${spec.folder.field}»`)
      spec.filters?.forEach((filter, i) => {
        if (!fields[filter.field])
          add(['compendium', 'types', type, 'filters', i, 'field'], `«${type}» no tiene el campo «${filter.field}»`)
      })
    }
  }
}
