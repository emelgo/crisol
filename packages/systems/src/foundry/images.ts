/**
 * Las imágenes de un sistema de Foundry (docs/specs/imagenes.md): las que nombra su contenido convertido (con el
 * crédito del mapa de arte), dónde está cada una dentro del zip y su licencia, según los avisos de sus carpetas. Lo usa
 * la web, que tiene el zip entero, para subir solo lo que hace falta
 */
import type { SystemFile } from '../file.ts'
import type { FoundryArt } from './convert.ts'

export type ImageLicense = 'foundry-only' | 'cc-by' | 'cc-by-nc-sa' | 'mit' | 'unknown'

/** Las imágenes que nombra su contenido, sin repetir, con el crédito de las que salen del mapa de arte */
export function imagesOf(file: SystemFile, art?: FoundryArt): { path: string; credit: string | null }[] {
  const fromArt = new Set(
    Object.values(art?.map ?? {}).flatMap((byId) =>
      Object.values(byId).flatMap((a) => (a.actor ? [a.actor.replace(/^\/+/, '')] : []))
    )
  )
  const paths = [...new Set(file.content.flatMap((c) => (c.img ? [c.img] : [])))].sort()
  return paths.map((path) => ({ path, credit: fromArt.has(path) ? (art?.credit ?? null) : null }))
}

/** Dónde está una imagen de Foundry dentro del zip del paquete; null si no es suya (las de serie de Foundry: icons/…) */
export function zipPathOf(path: string, pack: { id: string; kind: 'system' | 'module'; root: string }): string | null {
  const prefix = `${pack.kind === 'module' ? 'modules' : 'systems'}/${pack.id}/`
  const clean = path.replace(/^\/+/, '')
  return clean.startsWith(prefix) ? `${pack.root}${clean.slice(prefix.length)}` : null
}

/** Lo que dice un aviso de licencia (o una línea suya) */
function classify(text: string): ImageLicense | null {
  const t = text.toLowerCase()
  if (/nc-sa|noncommercial-sharealike|non-commercial/.test(t)) return 'cc-by-nc-sa'
  if (/outside of foundry|within foundry|other than running|may not be redistributed|not for redistribution/.test(t))
    return 'foundry-only'
  if (/cc by|cc-by|creative commons/.test(t)) return 'cc-by'
  if (/permission is hereby granted|\bmit\b/.test(t)) return 'mit'
  return null
}

/**
 * La licencia de una imagen del zip: la del aviso (LICENSE, LICENSE.txt…) de su carpeta o de la más cercana hacia
 * arriba; si el aviso nombra el archivo, la de su línea. Sin aviso que se entienda, desconocida
 */
export function licenseOf(zipPath: string, notices: Record<string, string>): ImageLicense {
  const byFolder = new Map<string, string>()
  for (const [path, text] of Object.entries(notices)) {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
    byFolder.set(folder, `${byFolder.get(folder) ?? ''}\n${text}`)
  }
  let folder = zipPath.includes('/') ? zipPath.slice(0, zipPath.lastIndexOf('/') + 1) : ''
  for (;;) {
    const text = byFolder.get(folder)
    if (text) {
      // Una línea que nombre el archivo (por su ruta desde la carpeta del aviso)
      const relative = zipPath.slice(folder.length)
      const line = text.split('\n').find((l) => l.includes(`/${relative}`) || l.includes(` ${relative}`))
      const found = (line && classify(line)) ?? classify(text)
      if (found) return found
    }
    if (folder === '') return 'unknown'
    const trimmed = folder.slice(0, -1)
    folder = trimmed.includes('/') ? trimmed.slice(0, trimmed.lastIndexOf('/') + 1) : ''
  }
}
