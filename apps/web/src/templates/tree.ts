/**
 * Las plantillas en su árbol de carpetas (ADR-0024): lo de cada carpeta en su orden (su puesto y, sin él, por nombre),
 * para la lista de «Plantillas», la del editor y el selector al crear
 */
import type { TemplateFolder, TemplateView } from '@crisol/contracts'
import { bySiblingPlace } from '@crisol/domain'

type Level = { folders: TemplateFolder[]; templates: TemplateView[] }

/** Lo de cada carpeta (null: lo más alto): sus carpetas y sus plantillas, en su orden (su puesto y, sin él, por nombre) */
export function treeOf(folders: readonly TemplateFolder[], templates: readonly TemplateView[]) {
  const map = new Map<string | null, Level>()
  const at = (id: string | null) => {
    const entry = map.get(id) ?? { folders: [], templates: [] }
    map.set(id, entry)
    return entry
  }
  for (const folder of folders) at(folder.parentId).folders.push(folder)
  for (const template of templates) at(template.folderId).templates.push(template)
  for (const entry of map.values()) {
    entry.folders.sort(bySiblingPlace)
    entry.templates.sort(bySiblingPlace)
  }
  return map
}

/**
 * Las plantillas por carpetas, en el orden del árbol, para la lista del editor: las de cada carpeta (con su camino:
 * «Gente › Nobles») y, como en el árbol, las de lo más alto detrás; las carpetas sin plantillas no salen
 */
export function templateGroups(folders: readonly TemplateFolder[], templates: readonly TemplateView[]) {
  const tree = treeOf(folders, templates)
  const groups: { id: string | null; label: string | null; templates: TemplateView[] }[] = []
  const walk = (parentId: string | null, path: string[]) => {
    for (const folder of tree.get(parentId)?.folders ?? []) {
      const inside = tree.get(folder.id)?.templates ?? []
      const here = [...path, folder.name]
      if (inside.length) groups.push({ id: folder.id, label: here.join(' › '), templates: inside })
      walk(folder.id, here)
    }
  }
  walk(null, [])
  const top = tree.get(null)?.templates ?? []
  if (top.length) groups.push({ id: null, label: null, templates: top })
  return groups
}

/** Lo que distingue a una plantilla, en una línea: sus primeros campos (null, sin ninguno) */
export function fieldsLine(template: Pick<TemplateView, 'fields'>, count = 3): string | null {
  if (template.fields.length === 0) return null
  const shown = template.fields.slice(0, count).map((field) => field.name)
  return template.fields.length > count ? `${shown.join(', ')}…` : shown.join(', ')
}
